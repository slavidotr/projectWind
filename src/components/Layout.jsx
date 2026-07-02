import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useTheme } from '../App'
import { useWorkouts } from '../hooks/useWorkouts'
import { useLogs } from '../hooks/useLogs'
import { useLang, LANGS } from '../i18n'
import Plan from './Plan'
import LogSession from './LogSession'
import History from './History'
import ExerciseLibrary from './ExerciseLibrary'
import Nutrition from './Nutrition'
import Progress from './Progress'
import Features from './Features'

export default function Layout({ user }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const { t, lang, setLang } = useLang()
  const { workoutList, loading, createWorkout, saveWorkout, deleteWorkout, renameWorkout, setFavourite, duplicateWorkout } = useWorkouts(user.uid)
  const logsApi = useLogs(user.uid)

  const [currentWorkout, setCurrentWorkout] = useState(null)
  const [dirty,          setDirty]          = useState(false)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [newName,        setNewName]        = useState('')
  const [showNew,        setShowNew]        = useState(false)

  // Persist active session across page reloads (Android kills PWA tabs when backgrounded)
  const [activeSession, setActiveSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wind_session') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wind_session') || 'null') ? 1 : 0 } catch { return 0 }
  })

  useEffect(() => {
    if (activeSession) localStorage.setItem('wind_session', JSON.stringify(activeSession))
    else { localStorage.removeItem('wind_session'); localStorage.removeItem('wind_session_live') }
  }, [activeSession])

  const TABS = [t('tabs.plan'), t('tabs.log'), t('tabs.history'), t('tabs.exercises'), t('tabs.nutrition'), t('tabs.progress'), t('tabs.features')]

  // Auto-select favourite or first
  useEffect(() => {
    if (!workoutList.length || currentWorkout) return
    const pick = workoutList.find(w => w.isFavourite) || workoutList[0]
    if (pick) loadWorkout(pick)
  }, [workoutList])

  function loadWorkout(w) {
    setCurrentWorkout({ ...w, exercises: w.exercises || [] })
    setDirty(false)
  }

  async function handleSave() {
    if (!currentWorkout || !dirty) return
    await saveWorkout(currentWorkout.id, {
      name: currentWorkout.name,
      exercises: currentWorkout.exercises,
      isFavourite: currentWorkout.isFavourite,
    })
    setDirty(false)
  }

  useEffect(() => {
    const h = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [currentWorkout, dirty])

  function updateWorkout(patch) {
    setCurrentWorkout(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = await createWorkout(name)
    setNewName(''); setShowNew(false)
    setTimeout(() => loadWorkout({ id, name, exercises: [], isFavourite: false }), 300)
  }

  async function handleDelete(id) {
    if (!window.confirm(t('layout.confirmDelete'))) return
    if (currentWorkout?.id === id) setCurrentWorkout(null)
    await deleteWorkout(id)
  }

  async function handleRename(id, current) {
    const name = window.prompt(t('layout.renameWorkout'), current)
    if (!name || name.trim() === current) return
    await renameWorkout(id, name.trim())
    if (currentWorkout?.id === id) setCurrentWorkout(prev => ({ ...prev, name: name.trim() }))
  }

  async function handleFav(id, current) {
    await setFavourite(id, !current)
    if (currentWorkout?.id === id) updateWorkout({ isFavourite: !current })
  }

  async function handleDuplicate(w) {
    const copy = await duplicateWorkout(w.id, `${w.name} ${t('layout.copySuffix')}`)
    if (copy) setTimeout(() => loadWorkout(copy), 300)
  }

  function startSession() {
    if (!currentWorkout) return

    // Build a map of exercise name → last session's per-set data (newest log first)
    const sortedLogs = [...(logsApi.logList || [])].sort((a, b) =>
      (b.date || '').localeCompare(a.date || ''))
    const lastSetsBy = {}
    for (const log of sortedLogs) {
      for (const ex of (log.exercises || [])) {
        const key = (ex.name || '').toLowerCase()
        if (!lastSetsBy[key] && (ex.sets || []).length > 0) lastSetsBy[key] = ex.sets
      }
    }

    setActiveSession({
      workoutId:   currentWorkout.id,
      workoutName: currentWorkout.name,
      startMs:     Date.now(),
      exercises:   currentWorkout.exercises.map(ex => {
        const history = lastSetsBy[(ex.name || '').toLowerCase()] || []
        return {
          ...ex,
          sets: Array.from({ length: ex.sets || 3 }, (_, i) => {
            const prev = history[i]
            const w    = prev?.weight
            return {
              reps:   ex.reps || '',
              weight: (w != null && w !== '' && parseFloat(w) > 0)
                ? String(w)
                : (ex.weight || ''),
              done: false,
            }
          }),
        }
      }),
      notes: '',
    })
    setTab(1)
  }

  async function finishSession(session) {
    await logsApi.saveLog(session)
    setActiveSession(null)
    setTab(2)
  }

  function cancelSession() {
    if (!window.confirm(t('log.confirmCancel'))) return
    setActiveSession(null)
  }

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>Toji reach</span>
        <button className="btn-icon" title={t('layout.signOut')} onClick={() => signOut(auth)}>↩</button>
      </div>
      <div className="sidebar-workouts">
        {loading && <div style={{ padding: '12px', color: 'var(--fg2)', fontSize: 13 }}>{t('layout.loading')}</div>}
        {workoutList.map(w => (
          <div key={w.id} className={`workout-item ${currentWorkout?.id === w.id ? 'active' : ''}`} onClick={() => { loadWorkout(w); setDrawerOpen(false) }}>
            {w.isFavourite && <span>★</span>}
            <span className="workout-item-name">{w.name}</span>
            <span className="workout-actions" onClick={e => e.stopPropagation()}>
              <button title={t('layout.rename')} onClick={() => handleRename(w.id, w.name)}>✎</button>
              <button title={w.isFavourite ? t('layout.unmarkFav') : t('layout.markFav')} onClick={() => handleFav(w.id, w.isFavourite)}>{w.isFavourite ? '★' : '☆'}</button>
              <button title={t('layout.duplicateWorkout')} onClick={() => handleDuplicate(w)}>⧉</button>
              <button title={t('layout.deleteWorkout')} onClick={() => handleDelete(w.id)}>✕</button>
            </span>
          </div>
        ))}
        {showNew ? (
          <form onSubmit={handleCreate} style={{ padding: '6px 4px', display: 'flex', gap: 4 }}>
            <input className="input" autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('layout.workoutNamePlaceholder')} style={{ flex: 1, fontSize: 12 }} onKeyDown={e => e.key === 'Escape' && setShowNew(false)} />
            <button className="btn btn-primary btn-sm" type="submit">{t('layout.add')}</button>
          </form>
        ) : (
          <button className="workout-item" onClick={() => setShowNew(true)} style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('layout.newWorkout')}</button>
        )}
      </div>
      <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg2)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName || user.email}</span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {Object.entries(LANGS).map(([code]) => (
            <button key={code} onClick={() => setLang(code)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 11, color: lang === code ? 'var(--accent)' : 'var(--fg2)', fontWeight: lang === code ? 700 : 400 }}>{code.toUpperCase()}</button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-shell">
      <div className="sidebar">{sidebar}</div>
      <div className={`sidebar-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`sidebar-drawer ${drawerOpen ? 'open' : ''}`}>{sidebar}</div>

      <div className="main">
        <div className="header">
          <button className="btn-icon menu-btn" onClick={() => setDrawerOpen(true)}>☰</button>
          <div className={`header-title${dirty ? ' dirty' : ''}`}>
            {currentWorkout ? currentWorkout.name : TABS[tab]}
          </div>
          <div className="header-actions">
            {dirty && <button className="btn btn-primary btn-sm" onClick={handleSave}>{t('layout.save')}</button>}
            <button className="btn-icon" onClick={toggleTheme} title={t('layout.toggleTheme')}>{theme === 'dark' ? '☀' : '🌙'}</button>
            <div className="user-avatar" title={user.email} onClick={() => signOut(auth)}>{(user.displayName || user.email || '?')[0].toUpperCase()}</div>
          </div>
        </div>

        <>
          <div className="tabs">
            {TABS.map((label, i) => (
              <button key={i} className={`tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{label}</button>
            ))}
          </div>
          {activeSession && tab !== 1 && (
            <button className="session-return-banner" onClick={() => setTab(1)}>
              ⏱ {activeSession.workoutName} — {t('layout.returnToSession')}
            </button>
          )}
          <div className="tab-content">
            {tab === 0 && (currentWorkout
              ? <Plan workout={currentWorkout} onChange={exercises => updateWorkout({ exercises })} onStartSession={startSession} allWorkouts={workoutList} />
              : <div className="empty">
                  <h3>{t('layout.noWorkoutSelected')}</h3>
                  <p>{t('layout.noWorkoutHint')}</p>
                  <button
                    className="btn btn-primary mobile-only"
                    style={{ marginTop: 8 }}
                    onClick={() => setDrawerOpen(true)}
                  >
                    ☰ {t('layout.openWorkoutList')}
                  </button>
                </div>
            )}
            {/* Always mounted so rest timer and wake lock survive tab switches */}
            <div style={{ display: tab === 1 ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <LogSession session={activeSession} onFinish={finishSession} onCancel={cancelSession} logs={logsApi.logList} allWorkouts={workoutList} />
            </div>
            {tab === 2 && <History logs={logsApi.logList} loading={logsApi.loading} onDelete={logsApi.deleteLog} onUpdate={logsApi.updateLog} />}
            {tab === 3 && <ExerciseLibrary currentWorkout={currentWorkout} onAddExercise={ex => {
              if (currentWorkout) { updateWorkout({ exercises: [...(currentWorkout.exercises || []), ex] }); setTab(0) }
            }} />}
            {tab === 4 && <Nutrition uid={user.uid} />}
            {tab === 5 && <Progress uid={user.uid} logs={logsApi.logList} />}
            {tab === 6 && <Features />}
          </div>
        </>
      </div>
    </div>
  )
}
