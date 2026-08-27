import { createContext, useContext } from 'react'

// Context and consumer hook, kept apart from the provider component so neither
// file mixes component and non-component exports — see the note in useAuth.jsx.
// The provider is src/providers/SettingsProvider.jsx.
export const SettingsContext = createContext(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
