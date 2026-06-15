import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'
import Layout from './components/Layout'
import { LangProvider } from './i18n'

export const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} })
export function useTheme() { return useContext(ThemeCtx) }

export default function App() {
  const user  = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('pw-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pw-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  if (user === undefined) {
    return (
      <div className="splash">
        <div className="splash-spinner" />
      </div>
    )
  }

  return (
    <LangProvider>
      <ThemeCtx.Provider value={{ theme, toggle }}>
        {user ? <Layout user={user} /> : <Auth />}
      </ThemeCtx.Provider>
    </LangProvider>
  )
}
