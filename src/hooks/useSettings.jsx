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

  const isSyncUpdate = useRef(false)
  const isFirstRender = useRef(true)
  
  useEffect(() => {
    const handleSync = () => {
      isSyncUpdate.current = true
      setSettings(API.getSettings(defaultSettings))
      setTimeout(() => { isSyncUpdate.current = false }, 0)
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
    } else {
      if (!isSyncUpdate.current) {
        API.saveSettings(settings)
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
