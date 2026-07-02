import { useState } from 'react'
import { fmtDate, fmtDuration, totalSets, totalVolume } from '../utils'
import { useLang } from '../i18n'

function exportCSV(logs) {
  const rows = [['Date', 'Workout', 'Duration (min)', 'Exercise', 'Set', 'Reps', 'Weight', 'Unit', 'Done']]
  for (const log of logs) {
    const base = [log.date, log.workoutName, log.duration || 0]
    for (const ex of log.exercises || []) {
      for (const [i, s] of (ex.sets || []).entries()) {
        rows.push([...base, ex.name, i + 1, s.reps, s.weight, ex.unit || 'kg', s.done ? '1' : '0'])
      }
    }
  }
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'workout-history.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function History({ logs, loading, onDelete, onUpdate }) {
  const { t } = useLang()
  const [expanded, setExpanded] = useState({})

  function handleEditDuration(log) {
    const input = window.prompt(t('history.editDurationPrompt'), String(log.duration || 0))
    if (input === null) return
    const mins = parseInt(input, 10)
    if (isNaN(mins) || mins < 0) return
    onUpdate(log.id, { duration: mins })
  }

  if (loading) return <div className="empty"><p>{t('layout.loading')}</p></div>

  if (!logs.length) {
    return (
      <div className="empty">
        <h3>{t('history.empty')}</h3>
        <p>{t('history.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(logs)}>{t('history.export')}</button>
      </div>
      <div className="history-list">
        {logs.map(log => {
          const isOpen = expanded[log.id]
          const sets   = totalSets(log.exercises || [])
          const vol    = totalVolume(log.exercises || [])

          return (
            <div key={log.id} className="history-card">
              <div className="history-card-header" onClick={() => setExpanded(e => ({ ...e, [log.id]: !e[log.id] }))}>
                <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{isOpen ? '▼' : '▶'}</span>
                <span className="history-workout-name">{log.workoutName}</span>
                <span className="history-date">{fmtDate(log.date)}</span>
                <button
                  className="btn-icon"
                  style={{ color: 'var(--danger)', marginLeft: 4 }}
                  title={t('history.delete')}
                  onClick={e => { e.stopPropagation(); if (window.confirm(t('history.confirmDelete'))) onDelete(log.id) }}
                >✕</button>
              </div>

              <div className="history-stats">
                <div className="history-stat">
                  <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{t('history.sets')}</span>
                  <strong>{sets}</strong>
                </div>
                {vol > 0 && (
                  <div className="history-stat">
                    <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{t('history.volume')}</span>
                    <strong>{vol.toLocaleString()} kg</strong>
                  </div>
                )}
                <div className="history-stat">
                  <span style={{ fontSize: 11, color: 'var(--fg2)' }}>{t('history.duration')}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <strong>{fmtDuration(log.duration)}</strong>
                    <button
                      className="btn-icon"
                      style={{ fontSize: 11 }}
                      title={t('history.editDuration')}
                      onClick={e => { e.stopPropagation(); handleEditDuration(log) }}
                    >✎</button>
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="history-detail">
                  {(log.exercises || []).map((ex, i) => {
                    const doneSets = (ex.sets || []).filter(s => s.done)
                    return (
                      <div key={i} className="history-ex">
                        <span className="history-ex-name">{ex.name}</span>
                        <span className="history-ex-sets">
                          {doneSets.map((s, j) => (
                            <span key={j} style={{ marginRight: 6 }}>{s.reps}×{s.weight}{ex.unit || 'kg'}</span>
                          ))}
                        </span>
                      </div>
                    )
                  })}
                  {log.notes && <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 8, fontStyle: 'italic' }}>{log.notes}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
