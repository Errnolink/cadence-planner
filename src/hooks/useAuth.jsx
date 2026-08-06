import { createContext, useContext, useState, useEffect } from 'react'
import { getSupabase } from '../data/supabaseClient.js'
import { API } from '../data/api.js'

const AuthContext = createContext(null)

/**
 * AuthProvider — single source of truth for authentication state.
 * Eliminates duplicate onAuthStateChange listeners that were previously
 * in both Auth.jsx and App.jsx.
 *
 * The supabase client is created lazily, so session bootstrap happens after
 * first paint without blocking the initial bundle.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    let active = true
    let subscription = null

    getSupabase().then((supabase) => {
      if (!active) return

      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!active) return
        setSession(session)
        if (session) {
          API.setUserId(session.user.id)
          // Background sync on boot
          API.syncFromServer(session.user.id).catch(console.error)
        }
      })

      // Listen for auth state changes (single listener for the entire app)
      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        setSession(session)
        API.setUserId(session ? session.user.id : null)
      }).data.subscription
    })

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
