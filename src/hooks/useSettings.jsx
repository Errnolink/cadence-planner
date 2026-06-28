import { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../data/api.js'

const defaultSettings = {
  showLocation: false,
  themeMode: 'dark', // 'dark' or 'light'
  holidays2nd4thSat: true,
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    return API.getSettings(defaultSettings)
  })

  useEffect(() => {
    API.saveSettings(settings)
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
