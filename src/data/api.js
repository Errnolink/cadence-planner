/**
 * api.js — v1.1
 * Centralized data wrapper. Uses localStorage for fast reads, syncs with Supabase in background.
 */
import { supabase } from './supabaseClient';

/** Debounce delay for cloud sync — prevents request storms during rapid edits */
const SYNC_DEBOUNCE_MS = 2000
let _syncTimer = null

const KEYS = {
  DATA: 'cadence_data',
  ACTIVE_SEM: 'cadence_active_sem',
  SETTINGS: 'cadence_settings',
  ATTENDANCE: 'cadence_attendance',
  CUSTOM_THEMES: 'cadence_custom_themes',
  THEME: 'cadence-theme',
  UPDATED_AT: 'cadence_updated_at',
  USER_ID: 'cadence_user_id',
}

export { KEYS }

export const API = {
  userId: null,

  setUserId: (id) => {
    API.userId = id;
  },

  syncFromServer: async (userId) => {
    const localUserId = localStorage.getItem(KEYS.USER_ID);
    API.setUserId(userId);
    // Cancel any pending debounced push so it can't fire right after a server pull
    clearTimeout(_syncTimer);
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
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
        if (data.semesters) localStorage.setItem(KEYS.DATA, JSON.stringify(data.semesters));
        if (data.active_sem_id != null) localStorage.setItem(KEYS.ACTIVE_SEM, JSON.stringify(Number(data.active_sem_id)));
        if (data.settings) localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
        if (data.attendance) localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));
        if (data.custom_themes) localStorage.setItem(KEYS.CUSTOM_THEMES, JSON.stringify(data.custom_themes));
        if (data.theme_id) localStorage.setItem(KEYS.THEME, data.theme_id);
        if (data.updated_at) localStorage.setItem(KEYS.UPDATED_AT, data.updated_at);
        localStorage.setItem(KEYS.USER_ID, userId);
        
        // Dispatch event instead of reloading to allow React to update state seamlessly
        window.dispatchEvent(new CustomEvent('cadence-data-updated'));
      }
      
      if (shouldPushToServer) {
        await API.syncToServer();
      }
    } else if (error && error.code === 'PGRST116') {
      // No rows returned, meaning this is a new user or new device with local data only.
      // Let's push their local data up to the server.
      localStorage.setItem(KEYS.USER_ID, userId);
      await API.syncToServer();
    }
  },

  syncToServer: async () => {
    if (!API.userId) return;

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
        theme_id: localStorage.getItem(KEYS.THEME) || 'nerv',
        updated_at: localStorage.getItem(KEYS.UPDATED_AT) || new Date().toISOString()
      };

      const { error } = await supabase.from('user_data').upsert(payload);
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: error ? 'error' : 'success' }));
    } catch (e) {
      console.error('Cloud sync failed', e);
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'error' }));
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
        localStorage.setItem(KEYS.UPDATED_AT, new Date().toISOString())
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
  
  getSemesters: (fallback) => API.get(KEYS.DATA, fallback),
  saveSemesters: (data) => API.set(KEYS.DATA, data),

  getActiveSemId: (fallback) => API.get(KEYS.ACTIVE_SEM, fallback),
  saveActiveSemId: (id) => API.set(KEYS.ACTIVE_SEM, id),

  getSettings: (fallback) => API.get(KEYS.SETTINGS, fallback),
  saveSettings: (settings) => API.set(KEYS.SETTINGS, settings),

  getAttendance: (fallback) => API.get(KEYS.ATTENDANCE, fallback),
  saveAttendance: (data) => API.set(KEYS.ATTENDANCE, data),

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
  importAllData: (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid data format')
    if (data.version !== 1) throw new Error('Unsupported backup version')

    // Validate semesters structure
    if (data.semesters !== undefined) {
      if (!Array.isArray(data.semesters)) throw new Error('Semesters must be an array')
      data.semesters.forEach((sem, i) => {
        if (typeof sem !== 'object' || sem === null) throw new Error(`Invalid semester at index ${i}`)
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
  },
  clearLocalData: () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  }
}
