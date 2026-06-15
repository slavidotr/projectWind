import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { useLang, LANGS } from '../i18n'

export default function Auth() {
  const { t, lang, setLang } = useLang()
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
      }
    } catch (err) { setError(friendlyError(err.code, t)) }
    finally { setBusy(false) }
  }

  async function googleLogin() {
    setError(''); setBusy(true)
    try { await signInWithPopup(auth, googleProvider) }
    catch (err) { setError(friendlyError(err.code, t)) }
    finally { setBusy(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          {Object.entries(LANGS).map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: lang === code ? 'var(--accent)' : 'var(--fg2)', fontWeight: lang === code ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <h1>{t('auth.title')}</h1>
        <p className="subtitle">{t('auth.subtitle')}</p>
        <button className="btn btn-google btn-full" onClick={googleLogin} disabled={busy}>
          <GoogleIcon /> {t('auth.google')}
        </button>
        <div className="auth-divider">{t('auth.or')}</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <div className="field">
              <label>{t('auth.name')}</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('auth.namePlaceholder')} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label>{t('auth.email')}</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required autoComplete="email" />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.passwordPlaceholder')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'login' ? t('auth.login') : t('auth.createAccount')}
          </button>
        </form>
        <p className="auth-toggle">
          {mode === 'login'
            ? <>{t('auth.noAccount')} <button onClick={() => setMode('register')}>{t('auth.signup')}</button></>
            : <>{t('auth.haveAccount')} <button onClick={() => setMode('login')}>{t('auth.login')}</button></>}
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M46 24c0-1.2-.1-2.4-.3-3.5H24v6.7h12.5c-.5 2.8-2.1 5.2-4.5 6.8v5.6h7.2C43.2 36 46 30.5 46 24z"/>
      <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2.1 1.4-4.7 2.2-8.7 2.2-6.7 0-12.3-4.5-14.3-10.6H2.2v5.8C6.1 42.3 14.4 47 24 47z"/>
      <path fill="#FBBC05" d="M9.7 27.2A14.5 14.5 0 0 1 9.7 20.8v-5.8H2.2A23 23 0 0 0 1 24c0 3.7.9 7.2 2.5 10.3l7-5.1z"/>
      <path fill="#EA4335" d="M24 9.5c3.7 0 7 1.3 9.6 3.8l7.2-7.2C36.9 2.1 31.5 0 24 0 14.4 0 6.1 4.7 2.2 13.7l7.5 5.8C11.7 14 17.3 9.5 24 9.5z"/>
    </svg>
  )
}

function friendlyError(code, t) {
  const map = {
    'auth/user-not-found':       t('auth.err.noUser'),
    'auth/wrong-password':       t('auth.err.wrongPassword'),
    'auth/email-already-in-use': t('auth.err.emailInUse'),
    'auth/weak-password':        t('auth.err.weakPassword'),
    'auth/invalid-email':        t('auth.err.invalidEmail'),
    'auth/popup-closed-by-user': t('auth.err.cancelled'),
    'auth/invalid-credential':   t('auth.err.invalidCredential'),
  }
  return map[code] || t('auth.err.default')
}
