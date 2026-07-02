import { useState } from 'react'
import { useLang } from '../i18n'

const PLATES_KG  = [25, 20, 15, 10, 5, 2.5, 1.25]
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5]

function calcPlates(target, bar, plates) {
  let rem = (target - bar) / 2
  if (rem <= 0) return []
  const result = []
  for (const p of plates) {
    const n = Math.floor(rem / p + 0.0001)
    if (n > 0) {
      result.push({ weight: p, count: n })
      rem = Math.round((rem - p * n) * 1000) / 1000
    }
  }
  return result
}

export default function PlateCalculator({ onClose }) {
  const { t } = useLang()
  const [target, setTarget] = useState('')
  const [bar,    setBar]    = useState('20')
  const [unit,   setUnit]   = useState('kg')

  const plates = unit === 'lbs' ? PLATES_LBS : PLATES_KG
  const tgt = parseFloat(target)
  const barW = parseFloat(bar) || 0
  const result = tgt > 0 ? calcPlates(tgt, barW, plates) : []
  const totalLoaded = Math.round((barW + result.reduce((s, p) => s + p.weight * p.count * 2, 0)) * 100) / 100

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <h2>{t('plan.plateCalcTitle')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('plan.targetWeight')}</label>
              <input className="input" type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} placeholder="100" autoFocus />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('plan.barWeight')}</label>
              <input className="input" type="number" inputMode="decimal" value={bar} onChange={e => setBar(e.target.value)} />
            </div>
            <div className="field" style={{ width: 72 }}>
              <label>{t('exDialog.unit')}</label>
              <select className="input" value={unit} onChange={e => { setUnit(e.target.value); setBar(e.target.value === 'lbs' ? '45' : '20') }}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
          </div>

          {tgt > 0 && (
            <div className="plate-result">
              <div className="plate-result-label">{t('plan.perSide')}</div>
              {result.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--fg2)', fontStyle: 'italic', marginTop: 6 }}>{t('plan.noPlates')}</div>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {result.map(p => (
                      <span key={p.weight} className="plate-chip">{p.weight}{unit} × {p.count}</span>
                    ))}
                  </div>
              }
              {result.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--fg2)', marginTop: 10 }}>
                  {t('plan.totalLoaded')}: <strong>{totalLoaded} {unit}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('exDialog.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
