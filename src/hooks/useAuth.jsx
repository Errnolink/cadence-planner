import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../data/supabaseClient.js'
import { API } from '../data/api.js'

const AuthContext = createContext(null)

/**
 * AuthProvider — single source of truth for authentication state.
 * Eliminates duplicate onAuthStateChange listeners that were previously
 * in both Auth.jsx and App.jsx.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        API.setUserId(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth state changes (single listener for the entire app)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        API.setUserId(session.user.id)
      } else {
        API.setUserId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
