import { createContext, useContext, useState, useEffect, Component } from 'react'
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'
import Layout from './components/Layout'
import { LangProvider } from './i18n'

export const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} })
export function useTheme() { return useContext(ThemeCtx) }

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#f87171', background: '#1e1e2e', minHeight: '100vh' }}>
          <h2 style={{ marginBottom: 12 }}>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>{String(this.state.err)}</pre>
          <button style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }} onClick={() => this.setState({ err: null })}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

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
    <ErrorBoundary>
      <LangProvider>
        <ThemeCtx.Provider value={{ theme, toggle }}>
          {user ? <Layout user={user} /> : <Auth />}
        </ThemeCtx.Provider>
      </LangProvider>
    </ErrorBoundary>
  )
}
