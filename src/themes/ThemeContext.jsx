import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES } from './index.js'
import { API } from '../data/api.js'

const ThemeContext = createContext(null)

const DEFAULT_ID  = 'nerv'

// ── CSS Injection Protection ─────────────────────────────────────────
const SAFE_ID_RE        = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/
const SAFE_KEY_RE       = /^-{0,2}[a-zA-Z][a-zA-Z0-9-]*$/
const DANGEROUS_VALUE_RE = /url\s*\(|@import|expression\s*\(|javascript:|behavior\s*:|binding\s*:|<|>/i
const MAX_TOKENS        = 50
const MAX_VALUE_LEN     = 200

/** Sanitize a custom theme object before injecting its tokens into CSS */
function sanitizeThemeForCSS(ct) {
  if (!ct.id || !SAFE_ID_RE.test(ct.id)) return null
  const safeTokens = {}
  let count = 0
  for (const [k, v] of Object.entries(ct.tokens || {})) {
    if (count >= MAX_TOKENS) break
    if (!SAFE_KEY_RE.test(k)) continue
    if (typeof v !== 'string' || v.length > MAX_VALUE_LEN) continue
    if (DANGEROUS_VALUE_RE.test(v)) continue
    safeTokens[k] = v
    count++
  }
  return { id: ct.id, tokens: safeTokens }
}

/** Validate a theme object before accepting it as a custom theme */
function validateThemeImport(themeObj) {
  if (!themeObj || typeof themeObj !== 'object') throw new Error('INVALID THEME OBJECT')
  if (!themeObj.id || !SAFE_ID_RE.test(themeObj.id)) throw new Error('INVALID THEME ID — USE ALPHANUMERIC/HYPHENS ONLY')
  if (typeof themeObj.label !== 'string' || themeObj.label.length === 0 || themeObj.label.length > 50) throw new Error('INVALID THEME LABEL')
  if (!themeObj.tokens || typeof themeObj.tokens !== 'object' || Array.isArray(themeObj.tokens)) throw new Error('INVALID TOKENS OBJECT')

  const entries = Object.entries(themeObj.tokens)
  if (entries.length === 0 || entries.length > MAX_TOKENS) throw new Error(`TOKENS COUNT MUST BE 1-${MAX_TOKENS}`)

  for (const [k, v] of entries) {
    if (!SAFE_KEY_RE.test(k)) throw new Error(`INVALID TOKEN KEY: ${k}`)
    if (typeof v !== 'string' || v.length > MAX_VALUE_LEN) throw new Error(`INVALID VALUE FOR ${k}`)
    if (DANGEROUS_VALUE_RE.test(v)) throw new Error(`UNSAFE CSS VALUE FOR ${k}`)
  }
}

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
      const safe = sanitizeThemeForCSS(ct)
      if (!safe) return // Skip themes that fail sanitization
      css += `:root[data-theme="${safe.id}"] {\n`
      Object.entries(safe.tokens).forEach(([k, v]) => {
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
    validateThemeImport(themeObj) // throws on invalid input
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
