import { useState, useEffect } from 'react'
import { newId } from '../utils'
import { useLang } from '../i18n'
import { MUSCLE_CATEGORIES } from '../utils'

export default function Plan({ workout, onChange, onStartSession }) {
  const { t } = useLang()
  const exercises = workout.exercises || []
  const [dialog, setDialog] = useState(null) // null | { mode: 'add'|'edit', item? }

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
                  {ex.sets} {t('plan.sets')} × {ex.reps} {t('plan.reps')}
                  {ex.weight ? ` · ${ex.weight} ${ex.unit || 'kg'}` : ''}
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
        />
      )}
    </div>
  )
}

function ExerciseDialog({ item, onSave, onClose }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    name:     item?.name     || '',
    category: item?.category || '',
    sets:     item?.sets     != null ? String(item.sets) : '3',
    reps:     item?.reps     || '8-10',
    weight:   item?.weight   != null ? String(item.weight) : '',
    unit:     item?.unit     || 'kg',
    notes:    item?.notes    || '',
  })
  const [error, setError] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('exDialog.required')); return }
    onSave({
      name:     form.name.trim(),
      category: form.category,
      sets:     Math.max(1, parseInt(form.sets) || 3),
      reps:     form.reps,
      weight:   parseFloat(form.weight) || 0,
      unit:     form.unit,
      notes:    form.notes,
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
            <input className={`input ${error ? 'input-error' : ''}`} value={form.name} onChange={e => { set('name', e.target.value); setError('') }} placeholder={t('exDialog.namePlaceholder')} autoFocus />
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
              <label>{t('exDialog.reps')}</label>
              <input className="input" value={form.reps} onChange={e => set('reps', e.target.value)} placeholder={t('exDialog.repsPlaceholder')} />
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
