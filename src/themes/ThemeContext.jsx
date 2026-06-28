import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES } from './index.js'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'cadence-theme'
const DEFAULT_ID  = 'nerv'

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_ID }
    catch { return DEFAULT_ID }
  })

  // Apply theme attribute to <html> so CSS vars take effect immediately
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    try { localStorage.setItem(STORAGE_KEY, themeId) } catch {}
  }, [themeId])

  const cycleTheme = () => {
    const idx  = THEMES.findIndex(t => t.id === themeId)
    const next = THEMES[(idx + 1) % THEMES.length]
    setThemeId(next.id)
  }

  const currentTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0]

  return (
    <ThemeContext.Provider value={{ themeId, setTheme: setThemeId, cycleTheme, themes: THEMES, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
