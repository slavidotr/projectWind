import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    // If Firebase auth hangs (network issue, token refresh failure),
    // fall back to logged-out state after 6 seconds so the app doesn't freeze.
    const timeout = setTimeout(() => setUser(prev => prev === undefined ? null : prev), 6000)
    const unsub = onAuthStateChanged(auth, u => {
      clearTimeout(timeout)
      setUser(u)
    })
    return () => { clearTimeout(timeout); unsub() }
  }, [])
  return user
}
