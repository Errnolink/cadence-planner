/**
 * api.js
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
}

export const API = {
  userId: null,

  setUserId: (id) => {
    API.userId = id;
  },

  syncFromServer: async (userId) => {
    API.setUserId(userId);
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      if (data.semesters) localStorage.setItem(KEYS.DATA, JSON.stringify(data.semesters));
      if (data.active_sem_id) localStorage.setItem(KEYS.ACTIVE_SEM, JSON.stringify(data.active_sem_id));
      if (data.settings) localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      if (data.attendance) localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));
      if (data.custom_themes) localStorage.setItem(KEYS.CUSTOM_THEMES, JSON.stringify(data.custom_themes));
      if (data.theme_id) localStorage.setItem('cadence-theme', data.theme_id);
      
      // Reload to ensure all React state reads the fresh data from localStorage
      window.location.reload();
    } else if (error && error.code === 'PGRST116') {
      // No rows returned, meaning this is a new user or new device with local data only.
      // Let's push their local data up to the server.
      await API.syncToServer();
    }
  },

  syncToServer: async () => {
    if (!API.userId) return;
    
    window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'syncing' }));

    const payload = {
      user_id: API.userId,
      semesters: API.getSemesters([]),
      active_sem_id: API.getActiveSemId(null),
      settings: API.getSettings({}),
      attendance: API.getAttendance({}),
      custom_themes: API.getCustomThemes([]),
      theme_id: localStorage.getItem('cadence-theme') || 'nerv',
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase.from('user_data').upsert(payload);
    if (!error) {
      window.dispatchEvent(new CustomEvent('cadence-sync', { detail: 'success' }));
    } else {
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
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      // Trigger debounced cloud sync in the background if logged in
      if (API.userId) {
        clearTimeout(_syncTimer)
        _syncTimer = setTimeout(() => {
          API.syncToServer().catch(e => console.error("Cloud sync failed", e))
        }, SYNC_DEBOUNCE_MS)
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
      themeId: API.get('cadence-theme', 'nerv')
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
    if (data.themeId !== undefined) API.set('cadence-theme', data.themeId)
  }
}
