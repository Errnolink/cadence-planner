import { createContext, useContext } from 'react'

// The context and its consumer hook live apart from the provider component so
// that neither file mixes component and non-component exports — the condition
// that breaks React Fast Refresh, and the one `react/only-export-components`
// was flagging here. Same split as AttendanceContext / useAttendanceContext.
// The provider is src/providers/AuthProvider.jsx.
export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
