import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES } from './index.js'
import { API } from '../data/api.js'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'cadence-theme'
const DEFAULT_ID  = 'nerv'

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return API.get('cadence-theme', DEFAULT_ID)
  })

  const [customThemes, setCustomThemes] = useState(() => {
    return API.getCustomThemes([])
  })

  useEffect(() => {
    API.saveCustomThemes(customThemes)
  }, [customThemes])

  const allThemes = [...THEMES, ...customThemes.map(ct => ({ id: ct.id, label: ct.label }))]
  const currentTheme = allThemes.find(t => t.id === themeId) ?? THEMES[0]

  // Apply theme attribute to <html> so CSS vars take effect immediately
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    API.set('cadence-theme', themeId)
  }, [themeId])

  // Inject custom styles
  useEffect(() => {
    const styleId = 'cadence-custom-themes'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    
    let css = ''
    customThemes.forEach(ct => {
      css += `:root[data-theme="${ct.id}"] {\n`
      Object.entries(ct.tokens).forEach(([k, v]) => {
        css += `  ${k}: ${v};\n`
      })
      css += `}\n`
    })
    
    styleEl.textContent = css
  }, [customThemes])

  const cycleTheme = () => {
    const idx  = allThemes.findIndex(t => t.id === themeId)
    const next = allThemes[(idx + 1) % allThemes.length]
    setThemeId(next.id)
  }

  const addCustomTheme = (themeObj) => {
    setCustomThemes(prev => [...prev.filter(t => t.id !== themeObj.id), themeObj])
    setThemeId(themeObj.id)
  }

  return (
    <ThemeContext.Provider value={{ themeId, setTheme: setThemeId, cycleTheme, themes: allThemes, currentTheme, addCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
