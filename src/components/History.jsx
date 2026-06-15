import { useState } from 'react'
import { fmtDate, fmtDuration, totalSets, totalVolume } from '../utils'
import { useLang } from '../i18n'

export default function History({ logs, loading, onDelete }) {
  const { t } = useLang()
  const [expanded, setExpanded] = useState({})

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
                <strong>{fmtDuration(log.duration)}</strong>
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
  )
}
