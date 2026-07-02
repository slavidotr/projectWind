import { useState, useEffect, useRef, useMemo } from 'react'
import { newId, MUSCLE_CATEGORIES } from '../utils'
import { useLang } from '../i18n'
import PlateCalculator from './PlateCalculator'

export default function Plan({ workout, onChange, onStartSession, allWorkouts }) {
  const { t } = useLang()
  const exercises = workout.exercises || []
  const [dialog,     setDialog]     = useState(null) // null | { mode: 'add'|'edit', item? }
  const [showPlates, setShowPlates] = useState(false)

  function saveExercise(data) {
    if (dialog.mode === 'add') {
      onChange([...exercises, { id: newId(), ...data }])
    } else {
      onChange(exercises.map(e => e.id === dialog.item.id ? { ...e, ...data } : e))
    }
    setDialog(null)
  }

  function deleteExercise(id) {
    onChange(exercises.filter(e => e.id !== id))
  }

  function move(id, dir) {
    const idx = exercises.findIndex(e => e.id === id)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= exercises.length) return
    const arr = [...exercises]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    onChange(arr)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="plan-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setDialog({ mode: 'add' })}>{t('plan.addExercise')}</button>
        {exercises.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={onStartSession}>{t('plan.startSession')} ▶</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPlates(true)}>{t('plan.plateCalc')}</button>
      </div>

      {exercises.length === 0 ? (
        <div className="empty">
          <h3>{t('plan.noExercises')}</h3>
          <p>{t('plan.noExercisesHint')}</p>
          <button className="btn btn-primary" onClick={() => setDialog({ mode: 'add' })}>{t('plan.addExercise')}</button>
        </div>
      ) : (
        <div className="exercise-list">
          {exercises.map((ex, i) => (
            <div key={ex.id} className="exercise-card">
              <div className="exercise-card-body">
                <div className="exercise-name">{ex.name}</div>
                <div className="exercise-meta">
                  {ex.sets} {t('plan.sets')} × {ex.reps}{ex.targetType !== 'time' && ` ${t('plan.reps')}`}
                  {ex.weight ? ` · ${ex.weight} ${ex.unit || 'kg'}` : ''}
                  {' · ⏱ '}{ex.restSecs || 150}s
                </div>
                {ex.category && <span className="exercise-category">{ex.category}</span>}
                {ex.notes && <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 4 }}>{ex.notes}</div>}
              </div>
              <div className="exercise-actions">
                <button className="btn-icon" title={t('plan.moveUp')} onClick={() => move(ex.id, -1)} disabled={i === 0}>↑</button>
                <button className="btn-icon" title={t('plan.moveDown')} onClick={() => move(ex.id, 1)} disabled={i === exercises.length - 1}>↓</button>
                <button className="btn-icon" title={t('plan.edit')} onClick={() => setDialog({ mode: 'edit', item: ex })}>✎</button>
                <button className="btn-icon" title={t('plan.delete')} style={{ color: 'var(--danger)' }} onClick={() => deleteExercise(ex.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <ExerciseDialog
          item={dialog.item}
          onSave={saveExercise}
          onClose={() => setDialog(null)}
          allWorkouts={allWorkouts}
          currentWorkoutId={workout.id}
        />
      )}
      {showPlates && <PlateCalculator onClose={() => setShowPlates(false)} />}
    </div>
  )
}

function ExerciseDialog({ item, onSave, onClose, allWorkouts, currentWorkoutId }) {
  const { t, lang } = useLang()
  const [form, setForm] = useState({
    name:       item?.name       || '',
    category:   item?.category   || '',
    sets:       item?.sets       != null ? String(item.sets)     : '3',
    reps:       item?.reps       || '8-10',
    targetType: item?.targetType || 'reps',
    weight:     item?.weight     != null ? String(item.weight)  : '',
    unit:       item?.unit       || 'kg',
    restSecs:   item?.restSecs   != null ? String(item.restSecs): '150',
    notes:      item?.notes      || '',
  })
  const [error,       setError]   = useState('')
  const [suggestions, setSugs]    = useState([])
  const [showDrop,    setShowDrop] = useState(false)
  const debounceRef = useRef(null)
  const nameWrapRef = useRef(null)

  // Unique exercises from other workouts
  const splitExercises = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const w of (allWorkouts || [])) {
      if (w.id === currentWorkoutId) continue
      for (const ex of (w.exercises || [])) {
        if (!seen.has(ex.name)) {
          seen.add(ex.name)
          result.push({ name: ex.name, category: ex.category, fromWorkout: w.name })
        }
      }
    }
    return result
  }, [allWorkouts, currentWorkoutId])

  // Splits filtered by current name input
  const filteredSplits = useMemo(() => {
    const q = form.name.trim().toLowerCase()
    if (q.length < 2) return []
    return splitExercises.filter(ex => ex.name.toLowerCase().includes(q))
  }, [splitExercises, form.name])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleNameChange(val) {
    set('name', val)
    setError('')
    setShowDrop(val.trim().length >= 2)
    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setSugs([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const langName = lang === 'es' ? 'spanish' : 'english'
        const res  = await fetch(`https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(val)}&language=${langName}&format=json`)
        const data = await res.json()
        setSugs((data.suggestions || []).slice(0, 8))
      } catch {}
    }, 300)
  }

  function pickSuggestion(sug) {
    set('name', sug.value)
    const cat = sug.data?.category
    if (cat && MUSCLE_CATEGORIES.includes(cat)) set('category', cat)
    setSugs([])
    setShowDrop(false)
  }

  function pickFromSplit(ex) {
    set('name', ex.name)
    if (ex.category && MUSCLE_CATEGORIES.includes(ex.category)) set('category', ex.category)
    setSugs([])
    setShowDrop(false)
  }

  useEffect(() => {
    function handler(e) {
      if (nameWrapRef.current && !nameWrapRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('exDialog.required')); return }
    onSave({
      name:       form.name.trim(),
      category:   form.category,
      sets:       Math.max(1, parseInt(form.sets)      || 3),
      reps:       form.reps,
      targetType: form.targetType,
      weight:     parseFloat(form.weight)              || 0,
      unit:       form.unit,
      restSecs:   Math.max(10, parseInt(form.restSecs) || 150),
      notes:      form.notes,
    })
  }

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{item ? t('exDialog.editTitle') : t('exDialog.addTitle')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>{t('exDialog.name')}</label>
            <div ref={nameWrapRef} style={{ position: 'relative' }}>
              <input className={`input ${error ? 'input-error' : ''}`} value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder={t('exDialog.namePlaceholder')} autoFocus />
              {showDrop && (suggestions.length > 0 || filteredSplits.length > 0) && (
                <div className="autocomplete-dropdown">
                  {suggestions.map(sug => (
                    <button key={sug.data?.id || sug.value} type="button" className="autocomplete-item" onMouseDown={() => pickSuggestion(sug)}>
                      <span>{sug.value}</span>
                      {sug.data?.category && <span className="autocomplete-cat">{sug.data.category}</span>}
                    </button>
                  ))}
                  {filteredSplits.length > 0 && (
                    <>
                      {suggestions.length > 0 && <div className="autocomplete-section">{t('exDialog.fromSplits')}</div>}
                      {filteredSplits.map((ex, i) => (
                        <button key={`s${i}`} type="button" className="autocomplete-item" onMouseDown={() => pickFromSplit(ex)}>
                          <span>{ex.name}</span>
                          <span className="autocomplete-cat">{ex.fromWorkout}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
          </div>
          <div className="field">
            <label>{t('exDialog.category')}</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">—</option>
              {MUSCLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('exDialog.sets')}</label>
              <input className="input" type="number" min="1" value={form.sets} onChange={e => set('sets', e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ margin: 0 }}>{form.targetType === 'time' ? t('exDialog.timeTarget') : t('exDialog.repsTarget')}</label>
                <button
                  type="button"
                  className="type-toggle"
                  onClick={() => set('targetType', form.targetType === 'reps' ? 'time' : 'reps')}
                >
                  {form.targetType === 'reps' ? t('exDialog.timeMode') : t('exDialog.repsMode')}
                </button>
              </div>
              <input
                className="input"
                value={form.reps}
                onChange={e => set('reps', e.target.value)}
                placeholder={form.targetType === 'time' ? t('exDialog.timePlaceholder') : t('exDialog.repsPlaceholder')}
                inputMode={form.targetType === 'time' ? 'text' : 'text'}
              />
            </div>
            <div className="field" style={{ width: 80 }}>
              <label>{t('exDialog.restSecs')}</label>
              <input className="input" type="number" min="10" value={form.restSecs} onChange={e => set('restSecs', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('exDialog.weight')}</label>
              <input className="input" value={form.weight} onChange={e => set('weight', e.target.value)} inputMode="decimal" placeholder="0" />
            </div>
            <div className="field" style={{ width: 90 }}>
              <label>{t('exDialog.unit')}</label>
              <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>{t('exDialog.notes')}</label>
            <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder={t('exDialog.notesPlaceholder')} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t('exDialog.cancel')}</button>
            <button type="submit" className="btn btn-primary">{item ? t('exDialog.save') : t('exDialog.add')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
