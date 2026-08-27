import { createContext, useContext } from 'react'

// Context and consumer hook, kept apart from the provider component so neither
// file mixes component and non-component exports — see the note in useAuth.jsx.
// The provider, and the theme sanitising it depends on, are in
// src/providers/ThemeProvider.jsx.
export const ThemeContext = createContext(null)

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
