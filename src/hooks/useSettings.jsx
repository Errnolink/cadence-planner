import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { API } from '../data/api.js'

const defaultSettings = {
  showLocation: false,
  themeMode: 'dark', // 'dark' or 'light'
  holidays2nd4thSat: true,
  enableGlitch: true,
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    return API.getSettings(defaultSettings)
  })

  // First run persists the defaults we booted with, which is not a user edit —
  // see the note on API.saveSemesters.
  const isBootWrite = useRef(true)

  // Seeded from storage rather than '', so a boot that changes nothing writes
  // nothing at all.
  const lastSavedSettingsRef = useRef(null)
  if (lastSavedSettingsRef.current === null) {
    lastSavedSettingsRef.current = JSON.stringify(API.getSettings(null))
  }

  useEffect(() => {
    const handleSync = () => {
      const fresh = API.getSettings(defaultSettings)
      setSettings(fresh)
      lastSavedSettingsRef.current = JSON.stringify(fresh)
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  useEffect(() => {
    const serialized = JSON.stringify(settings)
    if (serialized !== lastSavedSettingsRef.current) {
      // Advance the ref (and consume the boot flag) only when the write
      // landed — same contract as useSemesters' save effect.
      if (API.saveSettings(settings, isBootWrite.current)) {
        isBootWrite.current = false
        lastSavedSettingsRef.current = serialized
      }
    }
    // Also apply data-mode to documentElement here so CSS can react
    document.documentElement.setAttribute('data-mode', settings.themeMode)
  }, [settings])

  const updateSettings = (newVals) => {
    setSettings(prev => ({ ...prev, ...newVals }))
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
