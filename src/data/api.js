/**
 * api.js — v1.3
 * Centralized data wrapper. Uses localStorage for fast reads, syncs with Supabase in background.
 */
import { getSupabase } from './supabaseClient';

/** Debounce delay for cloud sync — prevents request storms during rapid edits */
const SYNC_DEBOUNCE_MS = 2000
let _syncTimer = null
// Set when the last sync failed (e.g. offline edits) — drives the reconnect resync
let _syncFailed = false
let _retryTimer = null

// Serialize pulls and pushes so they can never overlap: an in-flight push
// landing after a pull would regress the server to stale data. The queue
// swallows rejections so a failure can never wedge subsequent syncs.
let _syncQueue = Promise.resolve()
function serialize(fn) {
  const run = _syncQueue.then(fn, fn)
  _syncQueue = run.catch(() => {})
  return run
}

// Bounded retry for transient failures while still online — one shot, 10s later.
function scheduleRetry() {
  if (_retryTimer) return
  _retryTimer = setTimeout(() => {
    _retryTimer = null
    if (navigator.onLine && API.userId && _syncFailed) API.syncToServer().catch(console.error)
  }, 10000)
}

// When connectivity returns, push any changes that failed while offline.
// Guarded by the failed flag so we don't fire spurious pushes.
window.addEventListener('online', () => {
  if (API.userId && _syncFailed) {
    _syncFailed = false
    API.syncToServer().catch(console.error)
  }
})

const KEYS = {
  DATA: 'cadence_data',
  ACTIVE_SEM: 'cadence_active_sem',
  SETTINGS: 'cadence_settings',
  ATTENDANCE: 'cadence_attendance',
  CUSTOM_THEMES: 'cadence_custom_themes',
  THEME: 'cadence-theme',
  UPDATED_AT: 'cadence_updated_at',
  USER_ID: 'cadence_user_id',
  KEY_STAMPS: 'cadence_key_stamps',
}

export { KEYS }

// ── Per-key timestamp merge ────────────────────────────────────────────
// Payload keys (server columns) → local storage keys.
const STORAGE_KEY_FOR = {
  semesters: KEYS.DATA,
  active_sem_id: KEYS.ACTIVE_SEM,
  settings: KEYS.SETTINGS,
  attendance: KEYS.ATTENDANCE,
  custom_themes: KEYS.CUSTOM_THEMES,
  theme_id: KEYS.THEME,
}
const PAYLOAD_KEYS = Object.keys(STORAGE_KEY_FOR)
const PAYLOAD_KEY_FOR = Object.fromEntries(
  Object.entries(STORAGE_KEY_FOR).map(([k, v]) => [v, k])
)

// Set once a pulled row proves the server has the key_updated_at column;
// pushes include key_updated_at only then (avoids 42703 on pre-migration projects).
let _serverHasKeyStamps = false

function getKeyStamps() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.KEY_STAMPS)) || {}
  } catch {
    return {}
  }
}

function setKeyStamp(payloadKey, iso) {
  const m = getKeyStamps()
  m[payloadKey] = iso
  localStorage.setItem(KEYS.KEY_STAMPS, JSON.stringify(m))
}

export const API = {
  userId: null,

  setUserId: (id) => {
    API.userId = id;
  },

  syncFromServer: (userId) => serialize(async () => {
    const localUserId = localStorage.getItem(KEYS.USER_ID);
    API.setUserId(userId);
    // Cancel any pending debounced push so it can't fire right after a server pull
    clearTimeout(_syncTimer);
    window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'syncing' }));

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        if (data.key_updated_at !== undefined) _serverHasKeyStamps = true;
        const serverStamps = data.key_updated_at && typeof data.key_updated_at === 'object' ? data.key_updated_at : {};
        // Rows without per-key stamps (pre-migration) use the whole-row
        // updated_at as a proxy stamp for every key.
        const proxyStamp = data.updated_at || null;

        // Write a payload key locally with API.set's encoding (raw for
        // THEME, JSON otherwise), adopting the given stamp into the per-key
        // map. Never touches whole-row updated_at — a pull is not an edit.
        const write = (pk, value, stamp) => {
          if (value === undefined || value === null) return;
          const storageKey = STORAGE_KEY_FOR[pk];
          if (pk === 'theme_id') {
            // Strip JSON quotes from legacy rows pushed by the pre-fix client
            localStorage.setItem(storageKey, String(value).replace(/^"|"$/g, ''));
          } else if (pk === 'active_sem_id') {
            // Legacy rows stored the id as a numeric string; keep coercing
            // those, but never coerce an opaque id (semesters created after
            // the UUID switch) — Number('4f3a…') is NaN and would wipe it.
            const n = Number(value);
            const normalized = Number.isFinite(n) && String(n) === String(value) ? n : value;
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          } else {
            localStorage.setItem(storageKey, JSON.stringify(value));
          }
          if (stamp) setKeyStamp(pk, stamp);
        };

        if (_serverHasKeyStamps) {
          // ── Per-key merge: for each key, the newer timestamp wins. ──
          let serverWon = false; // → local state changed (dispatch data-updated)
          let localWon = false;  // → server is stale (push merged state)
          const localStamps = getKeyStamps();
          for (const pk of PAYLOAD_KEYS) {
            const ls = localStamps[pk] ? Date.parse(localStamps[pk]) : 0;
            const ssRaw = serverStamps[pk] || proxyStamp;
            const ss = ssRaw ? Date.parse(ssRaw) : 0;
            if (ss > ls) {
              if (data[pk] !== undefined && data[pk] !== null) {
                write(pk, data[pk], ssRaw);
                serverWon = true;
              }
            } else if (ls > ss) {
              localWon = true;
            }
            // Equal stamps → values match; keep local, neither side wins.
          }
          localStorage.setItem(KEYS.USER_ID, userId);
          if (serverWon) {
            window.dispatchEvent(new CustomEvent('cadence-data-updated'));
          }
          if (localWon) {
            // Server is stale for at least one key — push the merged state.
            // Server-adopted stamps were written into the local map above,
            // so the local map IS the merged stamp map.
            await API._push();
            return; // _push dispatched success/error
          }
        } else {
          // ── Legacy whole-row compare (server has no key_updated_at column) ──
          const localUpdated = localStorage.getItem(KEYS.UPDATED_AT);
          const serverUpdated = data.updated_at;

          let shouldUpdateLocal = true;
          let shouldPushToServer = false;

          // Only compare timestamps if the local data belongs to the same user
          if (localUserId === userId && localUpdated && serverUpdated) {
            const localTime = new Date(localUpdated).getTime();
            const serverTime = new Date(serverUpdated).getTime();

            if (localTime > serverTime) {
              shouldUpdateLocal = false;
              shouldPushToServer = true;
            } else if (localTime === serverTime) {
              shouldUpdateLocal = false;
            }
          }

          if (shouldUpdateLocal) {
            // Adopt the server's whole-row timestamp as the per-key stamp so
            // the map is consistent if the migration lands later.
            write('semesters', data.semesters, serverUpdated);
            write('active_sem_id', data.active_sem_id, serverUpdated);
            write('settings', data.settings, serverUpdated);
            write('attendance', data.attendance, serverUpdated);
            write('custom_themes', data.custom_themes, serverUpdated);
            write('theme_id', data.theme_id, serverUpdated);
            if (serverUpdated) localStorage.setItem(KEYS.UPDATED_AT, serverUpdated);
            localStorage.setItem(KEYS.USER_ID, userId);

            // Dispatch event instead of reloading to allow React to update state seamlessly
            window.dispatchEvent(new CustomEvent('cadence-data-updated'));
          }

          if (shouldPushToServer) {
            // Inline push — we already hold the serialization slot
            await API._push();
            return; // _push dispatched success/error
          }
        }
      } else if (error && error.code === 'PGRST116') {
        // No rows returned — new user or new device with local data only.
        // Push their local data up to the server.
        localStorage.setItem(KEYS.USER_ID, userId);
        await API._push();
        return; // _push dispatched success/error
      } else if (error) {
        throw error;
      }

      _syncFailed = false;
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'success' }));
    } catch (e) {
      console.error('Cloud pull failed', e);
      _syncFailed = true;
      scheduleRetry();
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'error' }));
    }
  }),

  syncToServer: () => serialize(() => API._push()),

  // Raw push body — callers must already hold the serialization slot.
  // Returns true on success, false on failure (never throws).
  _push: async () => {
    if (!API.userId) return true;

    // Cancel any pending debounced sync so we don't double-push
    clearTimeout(_syncTimer);

    window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'syncing' }));

    try {
      const payload = {
        user_id: API.userId,
        semesters: API.getSemesters([]),
        active_sem_id: API.getActiveSemId(null),
        settings: API.getSettings({}),
        attendance: API.getAttendance({}),
        custom_themes: API.getCustomThemes([]),
        theme_id: API.get(KEYS.THEME, 'nerv'),
        updated_at: API.get(KEYS.UPDATED_AT, null) || new Date().toISOString()
      };
      // Only after a pull proved the column exists — sending an unknown
      // column to a pre-migration project would 42703 on every push.
      if (_serverHasKeyStamps) {
        payload.key_updated_at = getKeyStamps();
      }

      const supabase = await getSupabase();
      const { error } = await supabase.from('user_data').upsert(payload);
      if (error) {
        _syncFailed = true;
        scheduleRetry();
        window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'error' }));
        return false;
      }
      _syncFailed = false;
      // Null it, don't just clear it. scheduleRetry() guards on `if (_retryTimer)
      // return`, so leaving a spent handle in place silently disabled the bounded
      // retry for the rest of the session — every later failure skipped it.
      clearTimeout(_retryTimer);
      _retryTimer = null;
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'success' }));
      return true;
    } catch (e) {
      console.error('Cloud sync failed', e);
      _syncFailed = true;
      scheduleRetry();
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'error' }));
      return false;
    }
  },

  // --- Generic Storage Wrapper ---
  get: (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // If it was stored as a raw string (e.g. old themes)
          return saved
        }
      }
    } catch (e) {
      console.error(`Failed to retrieve ${key}`, e)
    }
    return defaultValue
  },
  
  set: (key, value, skipTimestampUpdate = false) => {
    try {
      localStorage.setItem(key, key === KEYS.THEME ? value : JSON.stringify(value))
      
      if (!skipTimestampUpdate && key !== KEYS.UPDATED_AT) {
        const ts = new Date().toISOString()
        localStorage.setItem(KEYS.UPDATED_AT, ts)
        const pk = PAYLOAD_KEY_FOR[key]
        if (pk) setKeyStamp(pk, ts)
      }

      // Trigger debounced cloud sync in the background if logged in
      if (API.userId) {
        clearTimeout(_syncTimer)
        _syncTimer = setTimeout(() => API.syncToServer().catch(console.error), SYNC_DEBOUNCE_MS)
      }
    } catch (e) {
      console.error(`Failed to save ${key}`, e)
    }
  },

  // --- Domain Specific Getters/Setters ---
  
  // `skipTimestamp` marks a write that is not a user edit — persisting the
  // state a provider booted with, or a shape migration. Stamping those made
  // every page load look like the newest edit to the per-key merge below, so a
  // device that had never been touched won every key and pushed its seed data
  // over real cloud data. Mounting is not an edit.
  getSemesters: (fallback) => API.get(KEYS.DATA, fallback),
  saveSemesters: (data, skipTimestamp) => API.set(KEYS.DATA, data, skipTimestamp),

  getActiveSemId: (fallback) => API.get(KEYS.ACTIVE_SEM, fallback),
  saveActiveSemId: (id, skipTimestamp) => API.set(KEYS.ACTIVE_SEM, id, skipTimestamp),

  getSettings: (fallback) => API.get(KEYS.SETTINGS, fallback),
  saveSettings: (settings, skipTimestamp) => API.set(KEYS.SETTINGS, settings, skipTimestamp),

  getAttendance: (fallback) => API.get(KEYS.ATTENDANCE, fallback),
  saveAttendance: (data, skipTimestamp) => API.set(KEYS.ATTENDANCE, data, skipTimestamp),

  getCustomThemes: (fallback) => API.get(KEYS.CUSTOM_THEMES, fallback),
  saveCustomThemes: (themes) => API.set(KEYS.CUSTOM_THEMES, themes),

  // --- Import / Export ---
  exportAllData: () => {
    return {
      version: 1,
      semesters: API.getSemesters([]),
      activeSemId: API.getActiveSemId(null),
      settings: API.getSettings({}),
      attendance: API.getAttendance({}),
      customThemes: API.getCustomThemes([]),
      themeId: API.get(KEYS.THEME, 'nerv')
    }
  },
  importAllData: async (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid data format')
    if (data.version !== 1) throw new Error('Unsupported backup version')

    // Validate semesters structure
    if (data.semesters !== undefined) {
      if (!Array.isArray(data.semesters)) throw new Error('Semesters must be an array')
      const seenIds = new Set()
      data.semesters.forEach((sem, i) => {
        if (typeof sem !== 'object' || sem === null) throw new Error(`Invalid semester at index ${i}`)
        // A missing or duplicated id makes every String(s.id) comparison in
        // the app ambiguous — reject it here rather than debug it later.
        if (sem.id === undefined || sem.id === null || sem.id === '') throw new Error(`Semester ${i} has no id`)
        const key = String(sem.id)
        if (key === 'NaN') throw new Error(`Semester ${i} has an invalid id`)
        if (seenIds.has(key)) throw new Error(`Duplicate semester id "${key}"`)
        seenIds.add(key)
        if (sem.subjects !== undefined && !Array.isArray(sem.subjects)) throw new Error(`Invalid subjects in semester ${i}`)
        if (sem.timetable !== undefined && !Array.isArray(sem.timetable)) throw new Error(`Invalid timetable in semester ${i}`)
      })
    }

    // Validate settings shape
    if (data.settings !== undefined) {
      if (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings)) {
        throw new Error('Invalid settings format')
      }
    }

    // Validate attendance shape
    if (data.attendance !== undefined) {
      if (typeof data.attendance !== 'object' || data.attendance === null || Array.isArray(data.attendance)) {
        throw new Error('Invalid attendance format')
      }
    }

    // Validate custom themes
    if (data.customThemes !== undefined) {
      if (!Array.isArray(data.customThemes)) throw new Error('Custom themes must be an array')
    }

    // All validations passed — write data
    if (data.semesters !== undefined) API.saveSemesters(data.semesters)
    if (data.activeSemId !== undefined) API.saveActiveSemId(data.activeSemId)
    if (data.settings !== undefined) API.saveSettings(data.settings)
    if (data.attendance !== undefined) API.saveAttendance(data.attendance)
    if (data.customThemes !== undefined) API.saveCustomThemes(data.customThemes)
    if (data.themeId !== undefined) API.set(KEYS.THEME, data.themeId)

    // Each save above only ARMS the 2s debounced push. Callers reload right
    // after a restore, which destroys the timer — so the restored data would
    // live on this device only, and the next sync from another device would
    // resolve the merge in favour of the stale server row and undo it.
    // Flush synchronously instead.
    if (API.userId) await API.syncToServer()
  },
  clearLocalData: () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  }
}
