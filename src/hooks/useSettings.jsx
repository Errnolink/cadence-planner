import { createContext, useContext, useState, useEffect } from 'react'

const defaultSettings = {
  showLocation: true,
  themeMode: 'dark', // 'dark' or 'light'
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('cadence_settings')
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    localStorage.setItem('cadence_settings', JSON.stringify(settings))
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
