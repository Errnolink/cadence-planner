/**
 * api.js
 * Centralized data wrapper. Currently uses localStorage.
 * Acts as the foundation for future cloud sync (Firebase/Supabase/REST).
 */

const KEYS = {
  DATA: 'cadence_data',
  ACTIVE_SEM: 'cadence_active_sem',
  SETTINGS: 'cadence_settings',
  ATTENDANCE: 'cadence_attendance',
  CUSTOM_THEMES: 'cadence_custom_themes',
}

export const API = {
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
    if (!data || data.version !== 1) throw new Error("Invalid format or unsupported version")
    if (data.semesters !== undefined) API.saveSemesters(data.semesters)
    if (data.activeSemId !== undefined) API.saveActiveSemId(data.activeSemId)
    if (data.settings !== undefined) API.saveSettings(data.settings)
    if (data.attendance !== undefined) API.saveAttendance(data.attendance)
    if (data.customThemes !== undefined) API.saveCustomThemes(data.customThemes)
    if (data.themeId !== undefined) API.set('cadence-theme', data.themeId)
  }
}
