import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { newId, today } from '../utils'
import { useLang } from '../i18n'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    ;[[880, now], [1100, now + 0.18], [1320, now + 0.36]].forEach(([freq, start]) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.8, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.start(start)
      osc.stop(start + 0.25)
    })
  } catch {}
}

function fmtCountdown(s) {
  const m   = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function swPost(msg) {
  const ctrl = navigator.serviceWorker?.controller
  if (ctrl) { ctrl.postMessage(msg); return }
  navigator.serviceWorker?.ready.then(reg => reg.active?.postMessage(msg)).catch(() => {})
}

function scheduleSW(delay, title, body) {
  swPost({ type: 'SCHEDULE_NOTIFICATION', delay, title, body })
}

function cancelSW() {
  swPost({ type: 'CANCEL_NOTIFICATION' })
}

function swShowCountdown(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  const label = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  swPost({ type: 'SHOW_COUNTDOWN', title: `⏱ ${label}`, body: 'Rest timer' })
}

function swFireDone(title, body) {
  swPost({ type: 'FIRE_NOTIFICATION', title, body })
}

function calc1RM(weight, reps) {
  const w = parseFloat(weight), r = parseInt(reps, 10)
  if (!w || !r || r <= 0) return null
  if (r === 1) return w
  return Math.round(w * (1 + r / 30))
}

export default function LogSession({ session, onFinish, onCancel, logs = [], allWorkouts = [] }) {
  const { t } = useLang()
  const [elapsed,        setElapsed]        = useState(0)
  const [durationOffset, setDurationOffset] = useState(() => {
    if (!session) return 0
    try {
      const saved = JSON.parse(localStorage.getItem('wind_session_live') || 'null')
      if (saved?.workoutId === session.workoutId) return saved.durationOffset || 0
    } catch {}
    return 0
  })

  // True when useState already hydrated exercises/notes from localStorage on page reload —
  // the reset effect checks this and skips the first run so it doesn't overwrite the restored data.
  const restoredFromStorage = useRef(false)

  const [exercises, setExercises] = useState(() => {
    if (!session) return []
    try {
      const saved = JSON.parse(localStorage.getItem('wind_session_live') || 'null')
      if (saved?.workoutId === session.workoutId && saved?.exercises?.length > 0) {
        restoredFromStorage.current = true
        return saved.exercises
      }
    } catch {}
    return JSON.parse(JSON.stringify(session.exercises))
  })
  const [notes, setNotes] = useState(() => {
    if (!session) return ''
    try {
      const saved = JSON.parse(localStorage.getItem('wind_session_live') || 'null')
      if (saved?.workoutId === session.workoutId) return saved.notes || ''
    } catch {}
    return ''
  })
  const [currentRest, setCurrentRest] = useState(90)
  const [countdown,   setCountdown]   = useState(null)
  const [paused,      setPaused]      = useState(false)
  const [showAddEx,   setShowAddEx]   = useState(false)
  const [prs,         setPrs]         = useState({})
  const [showToast,   setShowToast]   = useState(false)
  const wakeLock   = useRef(null)
  const pingTimer  = useRef(null)
  const restEndMs  = useRef(null)

  function setRestEnd(ms) {
    restEndMs.current = ms
    if (ms) localStorage.setItem('wind_rest_end', String(ms))
    else     localStorage.removeItem('wind_rest_end')
  }

  // PR map: exercise name (lower) → max weight ever logged
  const prMap = useMemo(() => {
    const map = {}
    for (const log of logs) {
      for (const ex of log.exercises || []) {
        const name = (ex.name || '').toLowerCase()
        for (const s of ex.sets || []) {
          if (s.done) {
            const w = parseFloat(s.weight) || 0
            if (w > (map[name] || 0)) map[name] = w
          }
        }
      }
    }
    return map
  }, [logs])

  // Last session sets per exercise (most recent first in logs = desc order)
  const lastSessionMap = useMemo(() => {
    const map = {}
    for (const log of logs) {
      for (const ex of log.exercises || []) {
        const name = (ex.name || '').toLowerCase()
        if (!map[name]) {
          const done = (ex.sets || []).filter(s => s.done && s.weight)
          if (done.length) map[name] = done
        }
      }
    }
    return map
  }, [logs])

  // Raw (unfiltered) last-session sets per exercise, by set index — used to prefill
  // weight when an exercise is added mid-session, same lookup startSession() uses
  // for exercises that are already in the plan.
  const lastRawSetsMap = useMemo(() => {
    const sortedLogs = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const map = {}
    for (const log of sortedLogs) {
      for (const ex of log.exercises || []) {
        const name = (ex.name || '').toLowerCase()
        if (!map[name] && (ex.sets || []).length > 0) map[name] = ex.sets
      }
    }
    return map
  }, [logs])

  // Persist live exercise state so it survives Android killing the PWA tab.
  // Intentionally omits session?.workoutId from deps: we only want this to fire when
  // exercises/notes actually change, not when the session first mounts (exercises would
  // still be [] at that point and we'd overwrite localStorage with bad data).
  useEffect(() => {
    if (!session) return
    try {
      localStorage.setItem('wind_session_live', JSON.stringify({
        workoutId: session.workoutId,
        exercises,
        notes,
        durationOffset,
      }))
    } catch {}
  }, [exercises, notes, durationOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return
    if (restoredFromStorage.current) {
      restoredFromStorage.current = false
      // Page reloaded with an existing session — restore any in-progress rest timer
      const savedEnd = Number(localStorage.getItem('wind_rest_end') || 0)
      if (savedEnd) {
        restEndMs.current = savedEnd
        const remaining = Math.ceil((savedEnd - Date.now()) / 1000)
        if (remaining > 0) {
          setCountdown(remaining)
          startPing()
        } else if (Date.now() - savedEnd < 5 * 60 * 1000) {
          // Rest ended while away, within 5-min grace → fire immediately
          setCountdown(0)
        }
      }
      return
    }
    // New session — clear any leftover rest from a previous one
    setRestEnd(null)
    setExercises(JSON.parse(JSON.stringify(session.exercises)))
    setNotes('')
    setCountdown(null)
    setPrs({})
    setDurationOffset(0)
  }, [session?.workoutId])

  useEffect(() => {
    if (!session) return
    setElapsed(Math.floor((Date.now() - session.startMs) / 1000) + durationOffset)
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - session.startMs) / 1000) + durationOffset), 1000)
    return () => clearInterval(id)
  }, [session, durationOffset])

  // Wake lock — keep screen on during session
  useEffect(() => {
    if (!session || !navigator.wakeLock) return
    const acquire = () => navigator.wakeLock.request('screen').then(l => { wakeLock.current = l }).catch(() => {})
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      wakeLock.current?.release()
      wakeLock.current = null
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [session])

  // Ask notification permission once when session starts
  useEffect(() => {
    if (!session || !('Notification' in window) || Notification.permission !== 'default') return
    Notification.requestPermission()
  }, [session])

  // When returning to the app, resync the countdown and catch any missed rest-end
  // notification (SW or tab may have been killed by battery optimization).
  useEffect(() => {
    if (!session) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      const endMs = restEndMs.current || Number(localStorage.getItem('wind_rest_end') || 0)
      if (!endMs) return
      const remaining = Math.ceil((endMs - Date.now()) / 1000)
      if (remaining <= 0) {
        if (Date.now() - endMs < 5 * 60 * 1000) setCountdown(0) // triggers done handler
      } else {
        if (!restEndMs.current) { restEndMs.current = endMs; startPing() }
        setCountdown(remaining)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [session])

  // Keep SW alive while rest timer runs: ping every 20 s to reset the SW idle timeout
  function startPing() {
    if (pingTimer.current) clearInterval(pingTimer.current)
    pingTimer.current = setInterval(() => swPost({ type: 'PING' }), 20000)
  }
  function stopPing() {
    if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null }
  }

  // Auto-dismiss toast after 5 s
  useEffect(() => {
    if (!showToast) return
    const tid = setTimeout(() => setShowToast(false), 5000)
    return () => clearTimeout(tid)
  }, [showToast])

  // Rest countdown — derives remaining time from restEndMs wall clock so it stays
  // accurate when the browser throttles timers in the background.
  useEffect(() => {
    if (countdown === null) { stopPing(); return }
    if (countdown === 0) {
      stopPing()
      playBeep()
      setShowToast(true)
      swFireDone(t('log.restDone'), t('log.restDoneBody'))
      const tid = setTimeout(() => setCountdown(null), 2500)
      return () => clearTimeout(tid)
    }
    swShowCountdown(countdown)
    // Poll at 500 ms — even if throttled to 1 s in the background, each tick
    // recomputes from the wall clock so the display never drifts.
    const tid = setInterval(() => {
      if (!restEndMs.current) return
      const remaining = Math.max(0, Math.ceil((restEndMs.current - Date.now()) / 1000))
      if (remaining !== countdown) setCountdown(remaining)
    }, 500)
    return () => clearInterval(tid)
  }, [countdown])

  if (!session) {
    return (
      <div className="empty">
        <h3>{t('log.noWorkout')}</h3>
        <p>{t('log.noWorkoutHint')}</p>
      </div>
    )
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value }
      return next
    })
  }

  function toggleDone(exIdx, setIdx) {
    const wasDone = exercises[exIdx].sets[setIdx].done
    const exName  = (exercises[exIdx].name || '').toLowerCase()
    const w = parseFloat(exercises[exIdx].sets[setIdx].weight)

    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], done: !next[exIdx].sets[setIdx].done }
      return next
    })

    if (!wasDone) {
      // Detect new PR
      if (w > 0 && w > (prMap[exName] || 0)) {
        setPrs(prev => ({ ...prev, [`${exIdx}-${setIdx}`]: true }))
      }
      // Start rest timer — schedule OS-level trigger for screen-off, plus live countdown
      const secs = exercises[exIdx].restSecs || 150
      setCurrentRest(secs)
      setPaused(false)
      setRestEnd(Date.now() + secs * 1000)
      setCountdown(secs)
      scheduleSW(secs * 1000, t('log.restDone'), t('log.restDoneBody'))
      swShowCountdown(secs)
      startPing()
    }
  }

  function pauseRest() {
    stopPing()
    swPost({ type: 'CLOSE_TRIGGER' })  // cancel OS-level trigger; keep countdown notification
    restEndMs.current = null
    localStorage.removeItem('wind_rest_end')
    setPaused(true)
  }

  function resumeRest() {
    const secs = countdown
    setRestEnd(Date.now() + secs * 1000)
    scheduleSW(secs * 1000, t('log.restDone'), t('log.restDoneBody'))
    startPing()
    swShowCountdown(secs)
    setPaused(false)
  }

  function skipRest() {
    cancelSW()
    stopPing()
    setPaused(false)
    setRestEnd(null)
    setCountdown(null)
  }

  function adjustRest(delta) {
    setCurrentRest(c => Math.max(10, c + delta))
    if (restEndMs.current) setRestEnd(restEndMs.current + delta * 1000)
    setCountdown(c => c !== null ? Math.max(0, c + delta) : c)
  }

  function addSet(exIdx) {
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      const last = next[exIdx].sets[next[exIdx].sets.length - 1] || { reps: '', weight: '' }
      next[exIdx].sets.push({ reps: last.reps, weight: last.weight, done: false })
      return next
    })
  }

  function addExerciseMidSession(exData) {
    const history = lastRawSetsMap[(exData.name || '').toLowerCase()] || []
    const newEx = {
      ...exData,
      sets: Array.from({ length: exData.sets || 3 }, (_, i) => {
        const prev = history[i]
        const w    = prev?.weight
        return {
          reps:   exData.reps || '',
          weight: (w != null && w !== '' && parseFloat(w) > 0) ? String(w) : '',
          done: false,
        }
      }),
    }
    setExercises(prev => [...prev, newEx])
    setShowAddEx(false)
  }

  function removeSet(exIdx, setIdx) {
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      next[exIdx].sets.splice(setIdx, 1)
      return next
    })
  }

  function editDuration() {
    const currentMins = Math.round(elapsed / 60)
    const input = window.prompt(t('log.editDurationPrompt'), String(currentMins))
    if (input === null) return
    const mins = parseInt(input, 10)
    if (isNaN(mins) || mins < 0) return
    const desiredSecs = mins * 60
    const actualSecs  = Math.floor((Date.now() - session.startMs) / 1000)
    setDurationOffset(desiredSecs - actualSecs)
  }

  function finish() {
    cancelSW()
    stopPing()
    setRestEnd(null)
    const mins = Math.round(elapsed / 60)
    onFinish({
      id:          newId(),
      workoutId:   session.workoutId,
      workoutName: session.workoutName,
      date:        today(),
      duration:    mins,
      notes,
      exercises,
    })
  }

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0')
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const isDone = countdown === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="log-header">
        <span style={{ fontWeight: 700, flex: 1 }}>{session.workoutName}</span>
        <span className="log-timer" onClick={editDuration} style={{ cursor: 'pointer' }} title={t('log.editDurationHint')}>⏱ {hh}:{mm}:{ss} ✎</span>
        <button className="btn btn-primary btn-sm" onClick={finish}>{t('log.finish')}</button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={onCancel}>{t('log.cancel')}</button>
      </div>

      <div className="log-body">
        {exercises.map((ex, exIdx) => {
          const lastSets = lastSessionMap[(ex.name || '').toLowerCase()]
          const lastHint = lastSets
            ? lastSets.slice(0, 4).map(s => `${s.weight}×${s.reps}`).join(', ')
            : null

          return (
            <div key={ex.id || exIdx} className="log-exercise">
              <div className="log-exercise-header">
                <span>{ex.name}</span>
                {ex.category && <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{ex.category}</span>}
              </div>
              {lastHint && (
                <div className="log-last-time">
                  ↩ {t('log.lastTime')} {lastHint}
                </div>
              )}
              <div className="log-sets">
                <div className="log-set-row" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>#</span>
                  <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{ex.targetType === 'time' ? t('log.time') : t('log.reps')}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('log.weight')} ({ex.unit || 'kg'})</span>
                  <span />
                </div>
                {ex.sets.map((s, setIdx) => {
                  const isTime = ex.targetType === 'time'
                  const oneRM  = s.done && !isTime ? calc1RM(s.weight, s.reps) : null
                  const isPR   = prs[`${exIdx}-${setIdx}`]
                  return (
                    <div key={setIdx}>
                      <div className="log-set-row">
                        <span className="log-set-num">{setIdx + 1}</span>
                        <input
                          className="input"
                          style={{ textAlign: 'center', padding: '5px 6px' }}
                          value={s.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                          inputMode={isTime ? 'text' : 'numeric'}
                          placeholder="—"
                        />
                        <input
                          className="input"
                          style={{ textAlign: 'center', padding: '5px 6px' }}
                          value={s.weight}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                        />
                        <button
                          className={`set-done ${s.done ? 'checked' : ''}`}
                          onClick={() => toggleDone(exIdx, setIdx)}
                        >
                          {s.done ? '✓' : ''}
                        </button>
                      </div>
                      <div className="set-tags">
                        {[
                          { key: 'warmup',    label: 'WU',  cls: 'wu',      title: t('log.tag.warmup')    },
                          { key: 'failure',   label: 'F',   cls: 'failure', title: t('log.tag.failure')   },
                          { key: 'restPause', label: 'RP',  cls: 'rp',      title: t('log.tag.restPause') },
                          { key: 'dropset',   label: 'DS',  cls: 'dropset', title: t('log.tag.dropset')   },
                        ].map(({ key, label, cls, title }) => (
                          <button
                            key={key}
                            type="button"
                            title={title}
                            className={`set-tag set-tag--${cls}${s[key] ? ' active' : ''}`}
                            onClick={() => updateSet(exIdx, setIdx, key, !s[key])}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {s.done && (isPR || oneRM) && (
                        <div className="log-set-extras">
                          {isPR && <span className="pr-badge">🏆 {t('log.newPR')}</span>}
                          {oneRM && <span className="onerms-badge">≈ {oneRM} {ex.unit || 'kg'} 1RM</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => addSet(exIdx)}>{t('log.addSet')}</button>
                  {ex.sets.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeSet(exIdx, ex.sets.length - 1)}>− {t('log.set')}</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEx(true)}>+ {t('log.addExercise')}</button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>{t('log.notes')}</label>
          <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t('log.notesPlaceholder')} />
        </div>
      </div>

      {countdown !== null && (
        <div className={`rest-bar${isDone ? ' rest-bar--done' : paused ? ' rest-bar--paused' : ''}`}>
          <span className="rest-bar-label">{isDone ? '✓' : paused ? '⏸' : '⏱'} {t('log.restTimer')}</span>
          <span className="rest-bar-count">{isDone ? t('log.restDone') : fmtCountdown(countdown)}</span>
          {!isDone && (
            <div className="rest-bar-actions">
              {paused ? (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resumeRest}>▶ {t('log.resume')}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={skipRest}>{t('log.skip')}</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => adjustRest(-15)}>−15s</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={pauseRest}>⏸</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={skipRest}>{t('log.skip')}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => adjustRest(+15)}>+15s</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showToast && session && createPortal(
        <div className="rest-toast" onClick={() => setShowToast(false)}>
          <span style={{ fontSize: 22 }}>✓</span>
          <div className="rest-toast-body">
            <div className="rest-toast-title">{t('log.restDone')}</div>
            <div className="rest-toast-sub">{t('log.restDoneBody')}</div>
          </div>
          <button className="rest-toast-close" onClick={e => { e.stopPropagation(); setShowToast(false) }}>✕</button>
        </div>,
        document.body
      )}

      {showAddEx && (
        <AddExerciseDialog
          onSave={addExerciseMidSession}
          onClose={() => setShowAddEx(false)}
          allWorkouts={allWorkouts}
        />
      )}
    </div>
  )
}

function AddExerciseDialog({ onSave, onClose, allWorkouts }) {
  const { t, lang } = useLang()
  const [name,     setName]    = useState('')
  const [sets,     setSets]    = useState('3')
  const [reps,     setReps]    = useState('8-10')
  const [restSecs, setRest]    = useState('150')
  const [sugs,     setSugs]    = useState([])
  const [showDrop, setShowDrop]= useState(false)
  const debRef  = useRef(null)
  const wrapRef = useRef(null)

  const splitNames = useMemo(() => {
    const seen = new Set()
    for (const w of (allWorkouts || []))
      for (const ex of (w.exercises || []))
        seen.add(ex.name)
    return [...seen]
  }, [allWorkouts])

  const filteredSplits = useMemo(() => {
    const q = name.trim().toLowerCase()
    return q.length < 2 ? [] : splitNames.filter(n => n.toLowerCase().includes(q))
  }, [splitNames, name])

  function handleName(val) {
    setName(val)
    setShowDrop(val.trim().length >= 2)
    clearTimeout(debRef.current)
    if (val.trim().length < 2) { setSugs([]); return }
    debRef.current = setTimeout(async () => {
      try {
        const langName = lang === 'es' ? 'spanish' : 'english'
        const res  = await fetch(`https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(val)}&language=${langName}&format=json`)
        const data = await res.json()
        setSugs((data.suggestions || []).slice(0, 8))
      } catch {}
    }, 300)
  }

  function pick(n) { setName(n); setSugs([]); setShowDrop(false) }

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      id: newId(), name: name.trim(),
      sets: Math.max(1, parseInt(sets) || 3),
      reps: reps || '8-10',
      restSecs: Math.max(10, parseInt(restSecs) || 150),
      targetType: 'reps', weight: 0, unit: 'kg',
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{t('log.addExercise')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>{t('exDialog.name')}</label>
            <div ref={wrapRef} style={{ position: 'relative' }}>
              <input className="input" value={name} onChange={e => handleName(e.target.value)} placeholder={t('exDialog.namePlaceholder')} autoFocus />
              {showDrop && (sugs.length > 0 || filteredSplits.length > 0) && (
                <div className="autocomplete-dropdown">
                  {sugs.map(s => (
                    <button key={s.data?.id || s.value} type="button" className="autocomplete-item" onMouseDown={() => pick(s.value)}>
                      <span>{s.value}</span>
                      {s.data?.category && <span className="autocomplete-cat">{s.data.category}</span>}
                    </button>
                  ))}
                  {filteredSplits.length > 0 && sugs.length > 0 && (
                    <div className="autocomplete-section">{t('exDialog.fromSplits')}</div>
                  )}
                  {filteredSplits.map((n, i) => (
                    <button key={`s${i}`} type="button" className="autocomplete-item" onMouseDown={() => pick(n)}>
                      <span>{n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('exDialog.sets')}</label>
              <input className="input" type="number" min="1" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('exDialog.reps')}</label>
              <input className="input" value={reps} onChange={e => setReps(e.target.value)} />
            </div>
            <div className="field" style={{ width: 80 }}>
              <label>{t('exDialog.restSecs')}</label>
              <input className="input" type="number" min="10" value={restSecs} onChange={e => setRest(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t('exDialog.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>{t('log.addExercise')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
