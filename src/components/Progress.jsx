import { useState, useMemo } from 'react'
import { useBodyWeight } from '../hooks/useBodyWeight'
import { useLang } from '../i18n'
import { fmtDate } from '../utils'

function shortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function calc1RM(weight, reps) {
  const w = parseFloat(weight), r = parseInt(reps, 10)
  if (!w || !r || r <= 0) return null
  if (r === 1) return w
  return Math.round(w * (1 + r / 30))
}

async function analyzeBodyFat(file) {
  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_KEY not configured')
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Look at this full-body photo of a person. Estimate their body fat percentage based on visible muscle definition, skin folds, and overall physique. Be conservative and realistic. Return ONLY valid JSON with one field: {"bodyFat": <number>} where the number is a body fat percentage like 18.5. If the image does not clearly show a human body or you cannot make a reasonable estimate, return {"bodyFat": null}.',
            },
            { inline_data: { mime_type: file.type, data: base64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error('API error')
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  return JSON.parse(text)
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────
function LineChart({ data, unit = '' }) {
  if (!data || !data.length) return null

  const W = 400, H = 150
  const PAD = { t: 10, r: 14, b: 26, l: 44 }
  const CW = W - PAD.l - PAD.r
  const CH = H - PAD.t - PAD.b

  const ys = data.map(d => d.y)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeY = maxY === minY ? Math.max(1, minY * 0.1) : maxY - minY

  const px = i => PAD.l + (data.length === 1 ? CW / 2 : (i / (data.length - 1)) * CW)
  const py = y => PAD.t + CH - ((y - minY) / rangeY) * CH

  const pts = data.map((d, i) => `${px(i).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ')

  const yTicks = [0, 1, 2, 3].map(i => minY + (rangeY * i / 3))
  const step = Math.max(1, Math.ceil(data.length / 5))
  const xIdxs = []
  for (let i = 0; i < data.length; i += step) xIdxs.push(i)
  if (xIdxs[xIdxs.length - 1] !== data.length - 1) xIdxs.push(data.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={py(v).toFixed(1)} x2={W - PAD.r} y2={py(v).toFixed(1)} stroke="var(--border)" strokeWidth="1" />
          <text x={PAD.l - 5} y={py(v) + 4} textAnchor="end" fontSize="10" fill="var(--fg2)">{Number.isInteger(v) ? v : v.toFixed(1)}{unit}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={px(i).toFixed(1)} cy={py(d.y).toFixed(1)} r="4" fill="var(--accent)">
          <title>{d.label}: {d.y}{unit}</title>
        </circle>
      ))}
      {xIdxs.map(i => (
        <text key={i} x={px(i).toFixed(1)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--fg2)">{data[i].label}</text>
      ))}
    </svg>
  )
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 88, fontSize: 11, color: 'var(--fg2)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div style={{ flex: 1, height: 18, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .4s ease' }} />
          </div>
          <span style={{ width: 32, fontSize: 12, fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>{d.value}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="prog-section">
      <h3 className="prog-section-title">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ color: 'var(--fg2)', fontSize: 13, fontStyle: 'italic', padding: '8px 0' }}>{text}</div>
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Progress({ uid, logs }) {
  const { t } = useLang()
  const { entries, addEntry, deleteEntry } = useBodyWeight(uid)

  const [bwInput,    setBwInput]    = useState('')
  const [bwUnit,     setBwUnit]     = useState('kg')
  const [bfInput,    setBfInput]    = useState('')
  const [bfScanning, setBfScanning] = useState(false)
  const [bfError,    setBfError]    = useState('')
  const [selEx,      setSelEx]      = useState('')

  const bwChartData = entries.map(e => ({ y: e.weight, label: shortDate(e.date) }))
  const bfChartData = entries.filter(e => e.bodyFat != null).map(e => ({ y: e.bodyFat, label: shortDate(e.date) }))

  const allExercises = useMemo(() => {
    const names = new Set()
    for (const log of logs) {
      for (const ex of log.exercises || []) {
        if (ex.name) names.add(ex.name)
      }
    }
    return [...names].sort()
  }, [logs])

  const exChartData = useMemo(() => {
    if (!selEx) return []
    const points = [], seen = new Set()
    for (const log of [...logs].reverse()) {
      if (seen.has(log.date)) continue
      const ex = (log.exercises || []).find(e => e.name === selEx)
      if (!ex) continue
      const doneSets = (ex.sets || []).filter(s => s.done && parseFloat(s.weight) > 0)
      if (!doneSets.length) continue
      seen.add(log.date)
      const best = doneSets.reduce((b, s) => parseFloat(s.weight) > parseFloat(b.weight) ? s : b)
      points.push({ y: parseFloat(best.weight), label: shortDate(log.date), reps: best.reps })
    }
    return points
  }, [logs, selEx])

  const latest1RM = useMemo(() => {
    if (!exChartData.length) return null
    const last = exChartData[exChartData.length - 1]
    return calc1RM(last.y, last.reps)
  }, [exChartData])

  const weeklyVolume = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const catSets = {}
    for (const log of logs) {
      if (log.date < cutoffStr) continue
      for (const ex of log.exercises || []) {
        const cat = ex.category || 'Other'
        const done = (ex.sets || []).filter(s => s.done).length
        if (done > 0) catSets[cat] = (catSets[cat] || 0) + done
      }
    }
    return Object.entries(catSets).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [logs])

  async function handleBFScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setBfScanning(true)
    setBfError('')
    try {
      const result = await analyzeBodyFat(file)
      if (result.bodyFat !== null && result.bodyFat !== undefined) {
        setBfInput(String(result.bodyFat))
      } else {
        setBfError(t('progress.bfScanError'))
      }
    } catch {
      setBfError(t('progress.bfScanError'))
    } finally {
      setBfScanning(false)
    }
  }

  function handleAddWeight(e) {
    e.preventDefault()
    const v = parseFloat(bwInput)
    if (!v || v <= 0) return
    const bf = bfInput.trim() !== '' ? parseFloat(bfInput) : null
    addEntry(v, bwUnit, bf)
    setBwInput('')
    setBfInput('')
    setBfError('')
  }

  return (
    <div className="progress-page">
      {/* Body Weight + Body Fat */}
      <Section title={t('progress.bodyWeight')}>
        <form onSubmit={handleAddWeight} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
              <label>{t('progress.weightLabel')}</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={bwInput}
                onChange={e => setBwInput(e.target.value)}
                placeholder={t('progress.weightPlaceholder')}
              />
            </div>
            <div className="field" style={{ width: 68 }}>
              <label>{t('exDialog.unit')}</label>
              <select className="input" value={bwUnit} onChange={e => setBwUnit(e.target.value)}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
              <label>{t('progress.bodyFat')} (%)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={bfInput}
                  onChange={e => setBfInput(e.target.value)}
                  placeholder={t('progress.bfPlaceholder')}
                  min="1"
                  max="60"
                  step="0.1"
                />
                <label
                  className="btn btn-ghost btn-sm"
                  style={{ cursor: bfScanning ? 'default' : 'pointer', opacity: bfScanning ? 0.45 : 1, flexShrink: 0, userSelect: 'none', padding: '0 8px' }}
                  title={t('progress.bfScanHint')}
                >
                  {bfScanning ? <span className="scan-spinner" /> : '📷'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBFScan} disabled={bfScanning} />
                </label>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>{t('progress.add')}</button>
          </div>
          {bfError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{bfError}</div>}
          <div style={{ fontSize: 11, color: 'var(--fg2)' }}>{t('progress.bfScanHint')}</div>
        </form>

        {entries.length === 0 ? (
          <Empty text={t('progress.noWeightData')} />
        ) : (
          <>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('progress.weightLabel')}</div>
            <LineChart data={bwChartData} unit={bwUnit === 'lbs' ? 'lbs' : 'kg'} />

            {bfChartData.length >= 1 && (
              <>
                <div style={{ margin: '12px 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('progress.bodyFat')}</div>
                <LineChart data={bfChartData} unit="%" />
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {[...entries].reverse().slice(0, 7).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--fg2)', fontSize: 12, minWidth: 80 }}>{fmtDate(e.date)}</span>
                  <span style={{ fontWeight: 600 }}>{e.weight} {e.unit}</span>
                  {e.bodyFat != null && (
                    <span style={{ fontSize: 12, color: 'var(--fg2)' }}>· {e.bodyFat}% BF</span>
                  )}
                  <button type="button" className="btn-icon" style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 'auto' }} onClick={() => deleteEntry(e.id)}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Exercise Progress */}
      <Section title={t('progress.exerciseProgress')}>
        <select className="input" value={selEx} onChange={e => setSelEx(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">{t('progress.selectExercise')}</option>
          {allExercises.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {selEx && (
          exChartData.length === 0
            ? <Empty text={t('progress.noExerciseData')} />
            : <>
                <LineChart data={exChartData} unit="kg" />
                {latest1RM && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg2)' }}>
                    {t('progress.estimated1RM')}: <strong style={{ color: 'var(--fg)' }}>{latest1RM} kg</strong>
                  </div>
                )}
              </>
        )}
      </Section>

      {/* Weekly Muscle Volume */}
      <Section title={t('progress.weeklyVolume')}>
        {weeklyVolume.length === 0
          ? <Empty text={t('progress.noVolumeData')} />
          : <BarChart data={weeklyVolume} />
        }
      </Section>
    </div>
  )
}
