import { useState, useEffect } from 'react'
import { newId, today, fmtDuration } from '../utils'
import { useLang } from '../i18n'

export default function LogSession({ session, onFinish, onCancel }) {
  const { t } = useLang()
  const [elapsed, setElapsed]   = useState(0) // seconds
  const [exercises, setExercises] = useState(() => session ? JSON.parse(JSON.stringify(session.exercises)) : [])
  const [notes, setNotes]       = useState('')

  useEffect(() => {
    if (!session) return
    setExercises(JSON.parse(JSON.stringify(session.exercises)))
    setNotes('')
  }, [session?.workoutId])

  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - session.startMs) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [session])

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
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], done: !next[exIdx].sets[setIdx].done }
      return next
    })
  }

  function addSet(exIdx) {
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      const last = next[exIdx].sets[next[exIdx].sets.length - 1] || { reps: '', weight: '' }
      next[exIdx].sets.push({ reps: last.reps, weight: last.weight, done: false })
      return next
    })
  }

  function removeSet(exIdx, setIdx) {
    setExercises(prev => {
      const next = prev.map(e => ({ ...e, sets: [...e.sets] }))
      next[exIdx].sets.splice(setIdx, 1)
      return next
    })
  }

  function finish() {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="log-header">
        <span style={{ fontWeight: 700, flex: 1 }}>{session.workoutName}</span>
        <span className="log-timer">⏱ {hh}:{mm}:{ss}</span>
        <button className="btn btn-primary btn-sm" onClick={finish}>{t('log.finish')}</button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={onCancel}>{t('log.cancel')}</button>
      </div>

      <div className="log-body">
        {exercises.map((ex, exIdx) => (
          <div key={ex.id || exIdx} className="log-exercise">
            <div className="log-exercise-header">
              <span>{ex.name}</span>
              {ex.category && <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{ex.category}</span>}
            </div>
            <div className="log-sets">
              <div className="log-set-row" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>#</span>
                <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('log.reps')}</span>
                <span style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('log.weight')} ({ex.unit || 'kg'})</span>
                <span />
              </div>
              {ex.sets.map((s, setIdx) => (
                <div key={setIdx} className="log-set-row">
                  <span className="log-set-num">{setIdx + 1}</span>
                  <input
                    className="input"
                    style={{ textAlign: 'center', padding: '5px 6px' }}
                    value={s.reps}
                    onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                    inputMode="numeric"
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
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => addSet(exIdx)}>{t('log.addSet')}</button>
                {ex.sets.length > 1 && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeSet(exIdx, ex.sets.length - 1)}>− {t('log.set')}</button>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="field" style={{ marginTop: 12 }}>
          <label>{t('log.notes')}</label>
          <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t('log.notesPlaceholder')} />
        </div>
      </div>
    </div>
  )
}
