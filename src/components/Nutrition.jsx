import { useState, useEffect, Fragment } from 'react'
import { useMealPlans } from '../hooks/useMealPlans'
import { useSavedIngredients } from '../hooks/useSavedIngredients'
import { useLang } from '../i18n'
import { newId } from '../utils'

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY = [
  { key: 'sedentary',  mult: 1.2   },
  { key: 'light',      mult: 1.375 },
  { key: 'moderate',   mult: 1.55  },
  { key: 'active',     mult: 1.725 },
  { key: 'veryActive', mult: 1.9   },
]

const GOAL_OFFSETS = {
  maintenance:        0,
  leanBulk:         250,
  lightDeficit:    -300,
  aggressiveDeficit:-500,
}

const MACRO_KEYS = ['protein', 'carbs', 'fat', 'fiber']

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadLocal(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def }
}

function calcTDEE({ weight, weightUnit, height, age, sex, activity, bodyFat }) {
  const w = parseFloat(weight)
  if (!w) return null
  const kg  = weightUnit === 'lbs' ? w * 0.453592 : w
  const bf  = parseFloat(bodyFat)
  const act = ACTIVITY.find(x => x.key === activity) || ACTIVITY[1]
  let bmr
  if (bf > 0 && bf < 100) {
    bmr = 370 + 21.6 * (kg * (1 - bf / 100))
  } else {
    const h = parseFloat(height), a = parseInt(age)
    if (!h || !a) return null
    bmr = sex === 'female'
      ? 10 * kg + 6.25 * h - 5 * a - 161
      : 10 * kg + 6.25 * h - 5 * a + 5
  }
  return Math.round(bmr * act.mult)
}

function calcTargetMacros(kcal, weightKg, bodyFatPct) {
  const bf  = parseFloat(bodyFatPct)
  const lbm = weightKg && bf > 0 && bf < 100 ? weightKg * (1 - bf / 100) : null
  const protein = (lbm || weightKg) ? Math.round((lbm || weightKg) * 2.2) : Math.round(kcal * 0.25 / 4)
  const fat     = Math.round(kcal * 0.30 / 9)
  const carbs   = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { calories: kcal, protein, carbs, fat, fiber: 30 }
}

function sumMacros(items) {
  return items.reduce(
    (a, f) => ({
      calories: a.calories + (Number(f.calories) || 0),
      protein:  a.protein  + (Number(f.protein)  || 0),
      carbs:    a.carbs    + (Number(f.carbs)    || 0),
      fat:      a.fat      + (Number(f.fat)      || 0),
      fiber:    a.fiber    + (Number(f.fiber)    || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
}

// meal total = sum of its ingredients
function mealTotal(meal) {
  return sumMacros(meal.ingredients || [])
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

function MacroBar({ label, consumed, target, min, max, unit, color }) {
  const cap = parseFloat(max) || target || 0
  const pct = cap ? Math.min(100, Math.round((consumed / cap) * 100)) : 0

  const mn = parseFloat(min), mx = parseFloat(max)
  const fillColor = (mn && consumed < mn) ? 'var(--warning)'
    : (mx && consumed > mx)               ? 'var(--danger)'
    : color

  const rangeText = (mn && mx) ? ` / ${mn}–${mx}${unit}`
    : mx                       ? ` / ${mx}${unit}`
    : target                   ? ` / ${target}${unit}`
    : ''

  return (
    <div className="macro-bar-row">
      <span className="macro-bar-label">{label}</span>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <span className="macro-bar-value">{Math.round(consumed)}{unit}{rangeText}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const EMPTY_LIMITS = () => ({ protein: { min:'', max:'' }, carbs: { min:'', max:'' }, fat: { min:'', max:'' }, fiber: { min:'', max:'' } })

export default function Nutrition({ uid }) {
  const { t } = useLang()
  const { plans, createPlan, savePlanFoods, renamePlan, setPlanCalories, duplicatePlan, deletePlan } = useMealPlans(uid)

  const [tdeeOpen,    setTdeeOpen]    = useState(() => !loadLocal('pw-tdee', null)?.weight)
  const [limitsOpen,  setLimitsOpen]  = useState(false)
  const [tdeeForm,    setTdeeForm]    = useState(() => loadLocal('pw-tdee', {
    weight: '', weightUnit: 'kg', height: '', age: '', sex: 'male', activity: 'moderate', bodyFat: '',
  }))
  const [limits,      setLimits]      = useState(() => loadLocal('pw-macro-limits', EMPTY_LIMITS()))
  const [goal,        setGoal]        = useState(() => loadLocal('pw-goal', 'maintenance'))
  const [openPlans,   setOpenPlans]   = useState({})
  const [dialog,      setDialog]      = useState(null)
  const [newPlanDlg,  setNewPlanDlg]  = useState(false)

  function setTf(k, v) { setTdeeForm(f => ({ ...f, [k]: v })) }
  function setLimit(macro, bound, v) { setLimits(l => ({ ...l, [macro]: { ...l[macro], [bound]: v } })) }

  function applyTdee() {
    localStorage.setItem('pw-tdee', JSON.stringify(tdeeForm))
    setTdeeOpen(false)
  }

  function applyLimits() {
    localStorage.setItem('pw-macro-limits', JSON.stringify(limits))
    setLimitsOpen(false)
  }

  function setGoalAndSave(g) {
    setGoal(g)
    localStorage.setItem('pw-goal', g)
  }

  const tdee    = calcTDEE(tdeeForm)
  const target  = tdee != null ? tdee + GOAL_OFFSETS[goal] : null
  const bf      = parseFloat(tdeeForm.bodyFat)
  const usingKatch = bf > 0 && bf < 100
  const weightKg = tdeeForm.weight
    ? (tdeeForm.weightUnit === 'lbs' ? parseFloat(tdeeForm.weight) * 0.453592 : parseFloat(tdeeForm.weight))
    : null
  const lbmKg       = usingKatch && weightKg ? weightKg * (1 - bf / 100) : null
  const targetMacros = target ? calcTargetMacros(target, weightKg, tdeeForm.bodyFat) : null

  async function handleSaveMeal(meal) {
    const plan  = plans.find(p => p.id === dialog.planId)
    const foods = [...(plan?.foods || [])]
    const idx   = foods.findIndex(f => f.id === meal.id)
    if (idx >= 0) foods[idx] = meal
    else foods.push(meal)
    await savePlanFoods(dialog.planId, foods)
    setDialog(null)
  }

  async function handleDeleteMeal(planId, mealId) {
    const plan = plans.find(p => p.id === planId)
    await savePlanFoods(planId, (plan?.foods || []).filter(f => f.id !== mealId))
  }

  async function handleMoveMeal(planId, mealId, dir) {
    const plan  = plans.find(p => p.id === planId)
    const foods = [...(plan?.foods || [])]
    const idx   = foods.findIndex(f => f.id === mealId)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= foods.length) return
    ;[foods[idx], foods[swapIdx]] = [foods[swapIdx], foods[idx]]
    await savePlanFoods(planId, foods)
  }

  async function handleSetPlanCalories(planId, current) {
    const input = window.prompt(t('nutrition.mealplans.setCalories'), current ? String(current) : '')
    if (input === null) return
    const val = parseFloat(input)
    await setPlanCalories(planId, val > 0 ? val : null)
  }

  async function handleDuplicatePlan(planId) {
    const plan = plans.find(p => p.id === planId)
    if (plan) await duplicatePlan(plan)
  }

  return (
    <div className="nutrition-wrap">

      {/* Goal selector */}
      <div className="goal-selector-row">
        {Object.keys(GOAL_OFFSETS).map(gk => {
          const kcal   = tdee != null ? tdee + GOAL_OFFSETS[gk] : null
          const offset = GOAL_OFFSETS[gk]
          const label  = offset === 0 ? '—' : offset > 0 ? `+${offset}` : `${offset}`
          return (
            <button key={gk} className={`goal-chip ${goal === gk ? 'active' : ''}`} onClick={() => setGoalAndSave(gk)}>
              <span className="goal-chip-name">{t(`nutrition.goal.${gk}`)}</span>
              <span className="goal-chip-kcal">{kcal != null ? `${kcal} kcal` : `${label} kcal`}</span>
            </button>
          )
        })}
      </div>

      <div className="nutrition-scroll">

        {/* TDEE Calculator */}
        <div className="tdee-panel">
          <button className="tdee-toggle" onClick={() => setTdeeOpen(o => !o)}>
            {tdeeOpen ? '▾' : '▸'} {t('nutrition.tdee.title')}
            {!tdeeOpen && tdee && <span className="tdee-result-inline"> — {t('nutrition.tdee.maintenance')}: {tdee} kcal</span>}
          </button>

          {tdeeOpen && (
            <div className="tdee-form">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 110px', minWidth: 110 }}>
                  <label>{t('nutrition.tdee.weight')}</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="input" type="number" inputMode="decimal" value={tdeeForm.weight} onChange={e => setTf('weight', e.target.value)} placeholder="70" style={{ flex: 1, minWidth: 0 }} />
                    <select className="input" value={tdeeForm.weightUnit} onChange={e => setTf('weightUnit', e.target.value)} style={{ width: 58 }}>
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                </div>
                <div className="field" style={{ flex: '1 1 70px', minWidth: 70 }}>
                  <label>{t('nutrition.tdee.bodyFat')}</label>
                  <input className="input" type="number" inputMode="decimal" value={tdeeForm.bodyFat} onChange={e => setTf('bodyFat', e.target.value)} placeholder="e.g. 15" min="1" max="60" />
                </div>
                <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
                  <label>{t('nutrition.tdee.height')}</label>
                  <input className="input" type="number" inputMode="decimal" value={tdeeForm.height} onChange={e => setTf('height', e.target.value)} placeholder="175" disabled={usingKatch} style={{ opacity: usingKatch ? .45 : 1 }} />
                </div>
                <div className="field" style={{ flex: '1 1 70px', minWidth: 70 }}>
                  <label>{t('nutrition.tdee.age')}</label>
                  <input className="input" type="number" inputMode="numeric" value={tdeeForm.age} onChange={e => setTf('age', e.target.value)} placeholder="30" disabled={usingKatch} style={{ opacity: usingKatch ? .45 : 1 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '1 1 130px', opacity: usingKatch ? .45 : 1 }}>
                  <label>{t('nutrition.tdee.sex')}</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className={`btn btn-sm ${tdeeForm.sex === 'male' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTf('sex', 'male')} disabled={usingKatch}>{t('nutrition.tdee.male')}</button>
                    <button type="button" className={`btn btn-sm ${tdeeForm.sex === 'female' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTf('sex', 'female')} disabled={usingKatch}>{t('nutrition.tdee.female')}</button>
                  </div>
                </div>
                <div className="field" style={{ flex: '2 1 180px' }}>
                  <label>{t('nutrition.tdee.activity')}</label>
                  <select className="input" value={tdeeForm.activity} onChange={e => setTf('activity', e.target.value)}>
                    {ACTIVITY.map(a => <option key={a.key} value={a.key}>{t(`nutrition.tdee.${a.key}`)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {tdee && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{t('nutrition.tdee.maintenance')}: {tdee} kcal</span>
                    <span style={{ fontSize: 11, color: 'var(--fg2)' }}>
                      {usingKatch ? `${t('nutrition.tdee.usingKatch')} · ${t('nutrition.tdee.leanMass')}: ${lbmKg.toFixed(1)} kg` : t('nutrition.tdee.usingMifflin')}
                    </span>
                  </div>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={applyTdee}>{t('nutrition.tdee.apply')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Macro Limits */}
        <div className="tdee-panel">
          <button className="tdee-toggle" onClick={() => setLimitsOpen(o => !o)}>
            {limitsOpen ? '▾' : '▸'} {t('nutrition.macroLimits.title')}
          </button>
          {limitsOpen && (
            <div className="tdee-form">
              <div className="macro-limits-grid">
                <span />
                <span className="macro-limits-col-label">{t('nutrition.macroLimits.min')}</span>
                <span className="macro-limits-col-label">{t('nutrition.macroLimits.max')}</span>
                {MACRO_KEYS.map(mk => (
                  <Fragment key={mk}>
                    <span className="macro-limits-row-label">{t(`nutrition.${mk}`)} (g)</span>
                    <input className="input" type="number" inputMode="decimal" value={limits[mk]?.min || ''} onChange={e => setLimit(mk, 'min', e.target.value)} placeholder="—" />
                    <input className="input" type="number" inputMode="decimal" value={limits[mk]?.max || ''} onChange={e => setLimit(mk, 'max', e.target.value)} placeholder="—" />
                  </Fragment>
                ))}
              </div>
              <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={applyLimits}>{t('nutrition.tdee.apply')}</button>
            </div>
          )}
        </div>

        {/* Diets */}
        <div className="meal-plans-section">
          <div className="meal-plans-header">
            <span className="meal-plans-title">{t('nutrition.mealplans.title')}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setNewPlanDlg(true)}>{t('nutrition.mealplans.add')}</button>
          </div>

          {plans.length === 0 && (
            <p style={{ color: 'var(--fg2)', fontSize: 12, padding: '6px 0 10px' }}>{t('nutrition.mealplans.empty')}</p>
          )}

          {plans.map(plan => {
            const isOpen     = openPlans[plan.id]
            const foods       = plan.foods || []
            const total       = sumMacros(foods.flatMap(f => f.ingredients || []))
            const planTarget  = plan.targetCalories || target
            return (
              <div key={plan.id} className="mealplan-card">
                <div className="mealplan-card-header" onClick={() => setOpenPlans(o => ({ ...o, [plan.id]: !o[plan.id] }))}>
                  <span className="mealplan-card-chevron">{isOpen ? '▾' : '▸'}</span>
                  <span className="mealplan-card-name">{plan.name}</span>
                  <span
                    className="mealplan-card-kcal"
                    title={t('nutrition.mealplans.setCalories')}
                    onClick={e => { e.stopPropagation(); handleSetPlanCalories(plan.id, plan.targetCalories) }}
                    style={{ cursor: 'pointer' }}
                  >
                    {total.calories > 0 || plan.targetCalories
                      ? `${Math.round(total.calories)}${plan.targetCalories ? ` / ${plan.targetCalories}` : ''} kcal`
                      : t('nutrition.mealplans.setCalories')}
                  </span>
                  <div className="mealplan-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" title={t('nutrition.mealplans.duplicate')} onClick={() => handleDuplicatePlan(plan.id)}>⧉</button>
                    <button className="btn-icon" title={t('nutrition.mealplans.rename')} onClick={() => {
                      const n = window.prompt(t('nutrition.mealplans.rename'), plan.name)
                      if (n && n.trim()) renamePlan(plan.id, n.trim())
                    }}>✎</button>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => {
                      if (window.confirm(t('nutrition.mealplans.confirmDelete'))) deletePlan(plan.id)
                    }}>✕</button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mealplan-card-body">
                    {/* Progress vs. goal + limits */}
                    {(planTarget || Object.values(limits).some(l => l.min || l.max)) && (
                      <div className="progress-section" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <MacroBar label={t('nutrition.calories')} consumed={total.calories} target={planTarget} unit=" kcal" color="var(--accent)" />
                        <MacroBar label={t('nutrition.protein')} consumed={total.protein} target={targetMacros?.protein} min={limits.protein?.min} max={limits.protein?.max} unit="g" color="#f97316" />
                        <MacroBar label={t('nutrition.carbs')}   consumed={total.carbs}   target={targetMacros?.carbs}   min={limits.carbs?.min}   max={limits.carbs?.max}   unit="g" color="#eab308" />
                        <MacroBar label={t('nutrition.fat')}     consumed={total.fat}     target={targetMacros?.fat}     min={limits.fat?.min}     max={limits.fat?.max}     unit="g" color="#8b5cf6" />
                        <MacroBar label={t('nutrition.fiber')}   consumed={total.fiber}   target={targetMacros?.fiber}   min={limits.fiber?.min}   max={limits.fiber?.max}   unit="g" color="#22c55e" />
                      </div>
                    )}

                    {/* Meal list */}
                    <div className="meal-section">
                      <div className="meal-header">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDialog({ planId: plan.id })}>
                          {t('nutrition.addMeal')}
                        </button>
                      </div>
                      {foods.length === 0 ? (
                        <p style={{ color: 'var(--fg2)', fontSize: 12, padding: '4px 0 8px' }}>{t('nutrition.emptyMeal')}</p>
                      ) : foods.map((food, idx) => {
                        const mt = mealTotal(food)
                        return (
                          <div key={food.id} className="food-item">
                            <div className="food-item-info">
                              <span className="food-item-name">{food.name}</span>
                              <span className="food-item-macros">
                                {Math.round(mt.calories)} kcal
                                {mt.protein > 0 && ` · Protein:${Math.round(mt.protein)}g`}
                                {mt.carbs   > 0 && ` · Carbs:${Math.round(mt.carbs)}g`}
                                {mt.fat     > 0 && ` · Fat:${Math.round(mt.fat)}g`}
                                {mt.fiber   > 0 && ` · Fiber:${Math.round(mt.fiber)}g`}
                                {mt.grams   > 0 && ` · Grams:${Math.round(mt.grams)}g`}
                              </span>
                            </div>
                            <div className="food-item-actions">
                              <button
                                className="btn-icon"
                                title={t('nutrition.mealplans.moveUp')}
                                disabled={idx === 0}
                                style={{ opacity: idx === 0 ? 0.35 : 1, cursor: idx === 0 ? 'default' : 'pointer' }}
                                onClick={() => handleMoveMeal(plan.id, food.id, -1)}
                              >↑</button>
                              <button
                                className="btn-icon"
                                title={t('nutrition.mealplans.moveDown')}
                                disabled={idx === foods.length - 1}
                                style={{ opacity: idx === foods.length - 1 ? 0.35 : 1, cursor: idx === foods.length - 1 ? 'default' : 'pointer' }}
                                onClick={() => handleMoveMeal(plan.id, food.id, 1)}
                              >↓</button>
                              <button className="btn-icon" onClick={() => setDialog({ planId: plan.id, item: food })}>✎</button>
                              <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteMeal(plan.id, food.id)}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {dialog && (
        <MealDialog
          item={dialog.item}
          onSave={handleSaveMeal}
          onClose={() => setDialog(null)}
          uid={uid}
          t={t}
        />
      )}

      {newPlanDlg && (
        <NewPlanDialog
          onCreate={async name => { await createPlan(name); setNewPlanDlg(false) }}
          onClose={() => setNewPlanDlg(false)}
          t={t}
        />
      )}
    </div>
  )
}

// ── Meal Dialog ───────────────────────────────────────────────────────────────

async function analyzeImage(file) {
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
            { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } },
            { text: 'Read the nutrition label or food in this image. Return ONLY valid JSON, no other text:\n{"name":"food name","grams":serving_size_in_grams,"calories":kcal,"protein":g,"carbs":g,"fat":g,"fiber":g}\nAll values must be plain numbers. grams = serving size from the label in grams. Use 0 if unknown.' },
          ]
        }],
        generationConfig: { maxOutputTokens: 256 },
      })
    }
  )
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `API error ${res.status}`) }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('No data extracted')
  return JSON.parse(match[0])
}

function emptyIng() {
  return {
    id: newId(), name: '', grams: '',
    kcalPer100: '', proteinPer100: '', carbsPer100: '', fatPer100: '', fiberPer100: '',
    calories: '', protein: '', carbs: '', fat: '', fiber: '',
  }
}

function MealDialog({ item, onSave, onClose, uid, t }) {
  const { list: savedList, saveIngredient, deleteIngredient } = useSavedIngredients(uid)
  const [showSaved,   setShowSaved]   = useState(false)
  const [mealName,    setMealName]    = useState(item?.name || '')
  const [ingredients, setIngredients] = useState(() =>
    item?.ingredients?.length ? item.ingredients.map(i => ({ ...i,
      grams:         String(i.grams         ?? ''),
      kcalPer100:    String(i.kcalPer100    ?? ''),
      proteinPer100: String(i.proteinPer100 ?? ''),
      carbsPer100:   String(i.carbsPer100   ?? ''),
      fatPer100:     String(i.fatPer100     ?? ''),
      fiberPer100:   String(i.fiberPer100   ?? ''),
      calories:      String(i.calories      ?? ''),
      protein:       String(i.protein       ?? ''),
      carbs:         String(i.carbs         ?? ''),
      fat:           String(i.fat           ?? ''),
      fiber:         String(i.fiber         ?? ''),
    })) : [emptyIng()]
  )
  const [error,      setError]      = useState('')
  const [scanning,   setScanning]   = useState(false)
  const [scanError,  setScanError]  = useState('')

  function addIng() { setIngredients(p => [...p, emptyIng()]) }

  function updateIng(idx, field, val) {
    setIngredients(p => p.map((ing, i) => {
      if (i !== idx) return ing
      const next = { ...ing, [field]: val }
      if (field === 'grams' || field.endsWith('Per100')) {
        const g  = parseFloat(next.grams)         || 0
        const k  = parseFloat(next.kcalPer100)    || 0
        const pr = parseFloat(next.proteinPer100) || 0
        const c  = parseFloat(next.carbsPer100)   || 0
        const f  = parseFloat(next.fatPer100)     || 0
        const fi = parseFloat(next.fiberPer100)   || 0
        if (g > 0 && (k || pr || c || f || fi)) {
          next.calories = String(Math.round(k  * g / 100))
          next.protein  = String(+(pr * g / 100).toFixed(1))
          next.carbs    = String(+(c  * g / 100).toFixed(1))
          next.fat      = String(+(f  * g / 100).toFixed(1))
          next.fiber    = String(+(fi * g / 100).toFixed(1))
        }
      }
      return next
    }))
  }

  function removeIng(idx) {
    setIngredients(p => p.length > 1 ? p.filter((_, i) => i !== idx) : p)
  }

  function loadSaved(s) {
    const newIng = {
      id: newId(), name: s.name, grams: '',
      kcalPer100:    String(s.kcalPer100    || ''),
      proteinPer100: String(s.proteinPer100 || ''),
      carbsPer100:   String(s.carbsPer100   || ''),
      fatPer100:     String(s.fatPer100     || ''),
      fiberPer100:   String(s.fiberPer100   || ''),
      calories: '', protein: '', carbs: '', fat: '', fiber: '',
    }
    setIngredients(prev => {
      const last = prev[prev.length - 1]
      if (last && !last.name.trim() && !last.calories) return [...prev.slice(0, -1), newIng]
      return [...prev, newIng]
    })
    setShowSaved(false)
  }

  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanError('')
    setScanning(true)
    try {
      const r = await analyzeImage(file)
      const g = parseFloat(r.grams) || 0
      const newIng = {
        id:   newId(),
        name: r.name || '',
        grams: g > 0 ? String(g) : '',
        kcalPer100:    g > 0 ? String(+((r.calories || 0) * 100 / g).toFixed(1)) : '',
        proteinPer100: g > 0 ? String(+((r.protein  || 0) * 100 / g).toFixed(1)) : '',
        carbsPer100:   g > 0 ? String(+((r.carbs    || 0) * 100 / g).toFixed(1)) : '',
        fatPer100:     g > 0 ? String(+((r.fat      || 0) * 100 / g).toFixed(1)) : '',
        fiberPer100:   g > 0 ? String(+((r.fiber    || 0) * 100 / g).toFixed(1)) : '',
        calories: r.calories > 0 ? String(r.calories) : '',
        protein:  r.protein  > 0 ? String(r.protein)  : '',
        carbs:    r.carbs    > 0 ? String(r.carbs)    : '',
        fat:      r.fat      > 0 ? String(r.fat)      : '',
        fiber:    r.fiber    > 0 ? String(r.fiber)    : '',
      }
      setIngredients(prev => {
        const last = prev[prev.length - 1]
        if (last && !last.name.trim() && !last.calories) return [...prev.slice(0, -1), newIng]
        return [...prev, newIng]
      })
    } catch (err) {
      setScanError(err.message || t('nutrition.scanError'))
    } finally {
      setScanning(false)
    }
  }

  const parsed = ingredients.map(ing => ({
    calories: parseFloat(ing.calories) || 0,
    protein:  parseFloat(ing.protein)  || 0,
    carbs:    parseFloat(ing.carbs)    || 0,
    fat:      parseFloat(ing.fat)      || 0,
    fiber:    parseFloat(ing.fiber)    || 0,
  }))
  const total = sumMacros(parsed)

  function submit(e) {
    e.preventDefault()
    if (!mealName.trim()) { setError(t('nutrition.food.required')); return }
    onSave({
      id:   item?.id || newId(),
      name: mealName.trim(),
      ingredients: ingredients
        .filter(ing => ing.name.trim())
        .map(ing => ({
          id:            ing.id,
          name:          ing.name.trim(),
          grams:         parseFloat(ing.grams)         || 0,
          kcalPer100:    parseFloat(ing.kcalPer100)    || 0,
          proteinPer100: parseFloat(ing.proteinPer100) || 0,
          carbsPer100:   parseFloat(ing.carbsPer100)   || 0,
          fatPer100:     parseFloat(ing.fatPer100)     || 0,
          fiberPer100:   parseFloat(ing.fiberPer100)   || 0,
          calories:      parseFloat(ing.calories)      || 0,
          protein:       parseFloat(ing.protein)       || 0,
          carbs:         parseFloat(ing.carbs)         || 0,
          fat:           parseFloat(ing.fat)           || 0,
          fiber:         parseFloat(ing.fiber)         || 0,
        })),
    })
  }

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>{item ? t('nutrition.editMeal.title') : t('nutrition.addMeal.title')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Meal name */}
          <div className="field">
            <label>{t('nutrition.mealName')}</label>
            <input className={`input ${error ? 'input-error' : ''}`} value={mealName} onChange={e => { setMealName(e.target.value); setError('') }} placeholder={t('nutrition.mealNamePlaceholder')} autoFocus />
            {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
          </div>

          {/* Ingredients */}
          <div style={{ overflowX: 'auto' }}>
            {/* Column headers */}
            <div className="ing-header-row">
              <span className="ing-name" style={{ fontSize: 11, color: 'var(--fg2)' }}>{t('nutrition.ingredient')}</span>
              <span className="ing-num" style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('nutrition.calories')}</span>
              <span className="ing-num" style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('nutrition.protein')}</span>
              <span className="ing-num" style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('nutrition.carbs')}</span>
              <span className="ing-num" style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('nutrition.fat')}</span>
              <span className="ing-num" style={{ fontSize: 11, color: 'var(--fg2)', textAlign: 'center' }}>{t('nutrition.fiber')}</span>
              <span title={t('nutrition.per100gInfo')} style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--fg2)', cursor: 'help', userSelect: 'none' }}>ⓘ</span>
            </div>

            {ingredients.map((ing, idx) => {
              const g       = parseFloat(ing.grams) || 0
              const hasP100 = !!(parseFloat(ing.kcalPer100) || parseFloat(ing.proteinPer100) || parseFloat(ing.carbsPer100) || parseFloat(ing.fatPer100) || parseFloat(ing.fiberPer100))
              return (
                <Fragment key={ing.id}>
                  {/* Per-100g row */}
                  <div className="ing-row" style={{ marginBottom: 2 }}>
                    <input className="input ing-name" value={ing.name}          onChange={e => updateIng(idx, 'name',          e.target.value)} placeholder={t('nutrition.ingPlaceholder')} />
                    <input className="input ing-num"  type="number" inputMode="decimal" value={ing.kcalPer100}    onChange={e => updateIng(idx, 'kcalPer100',    e.target.value)} placeholder="0" />
                    <input className="input ing-num"  type="number" inputMode="decimal" value={ing.proteinPer100} onChange={e => updateIng(idx, 'proteinPer100', e.target.value)} placeholder="0" />
                    <input className="input ing-num"  type="number" inputMode="decimal" value={ing.carbsPer100}   onChange={e => updateIng(idx, 'carbsPer100',   e.target.value)} placeholder="0" />
                    <input className="input ing-num"  type="number" inputMode="decimal" value={ing.fatPer100}     onChange={e => updateIng(idx, 'fatPer100',     e.target.value)} placeholder="0" />
                    <input className="input ing-num"  type="number" inputMode="decimal" value={ing.fiberPer100}   onChange={e => updateIng(idx, 'fiberPer100',   e.target.value)} placeholder="0" />
                    <button type="button" className="btn-icon" style={{ color: 'var(--danger)', width: 28, flexShrink: 0 }} onClick={() => removeIng(idx)}>✕</button>
                  </div>
                  {/* Grams + calculated result row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingLeft: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--fg2)', flexShrink: 0 }}>Grams:</span>
                    <input
                      className={`input ${hasP100 ? 'ing-num-scaled' : ''}`}
                      type="number"
                      inputMode="decimal"
                      value={ing.grams}
                      onChange={e => updateIng(idx, 'grams', e.target.value)}
                      placeholder="0"
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--fg2)', flexShrink: 0 }}>g</span>
                    {g > 0 && hasP100 && (
                      <span style={{ fontSize: 11, color: 'var(--fg2)' }}>
                        = {ing.calories || 0} kcal · {ing.protein || 0}g P · {ing.carbs || 0}g C · {ing.fat || 0}g F · {ing.fiber || 0}g Fi
                      </span>
                    )}
                    {g > 0 && !hasP100 && (ing.calories || ing.protein) && (
                      <span style={{ fontSize: 11, color: 'var(--fg2)' }}>
                        {ing.calories || 0} kcal · {ing.protein || 0}g P · {ing.carbs || 0}g C · {ing.fat || 0}g F · {ing.fiber || 0}g Fi
                      </span>
                    )}
                    <button
                      type="button"
                      title={t('nutrition.saveIng')}
                      disabled={!ing.name.trim()}
                      onClick={() => saveIngredient(ing)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: ing.name.trim() ? 'pointer' : 'default', padding: '2px 4px', fontSize: 15, color: ing.name.trim() ? 'var(--fg2)' : 'var(--border)', flexShrink: 0 }}
                    >★</button>
                  </div>
                </Fragment>
              )
            })}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addIng}>
                {t('nutrition.addIngredient')}
              </button>
              <label className="btn btn-ghost btn-sm scan-btn" style={{ cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.45 : 1, userSelect: 'none' }}>
                {t('nutrition.camera')}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleScanFile} disabled={scanning} />
              </label>
              <label className="btn btn-ghost btn-sm scan-btn" style={{ cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.45 : 1, userSelect: 'none' }}>
                {t('nutrition.gallery')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanFile} disabled={scanning} />
              </label>
              <button
                type="button"
                className={`btn btn-ghost btn-sm${showSaved ? ' active' : ''}`}
                onClick={() => setShowSaved(p => !p)}
              >
                ★ {t('nutrition.savedIngredients')}{savedList.length > 0 ? ` (${savedList.length})` : ''}
              </button>
              {scanning && <><span className="scan-spinner" /><span style={{ fontSize: 12, color: 'var(--fg2)' }}>{t('nutrition.scanning')}</span></>}
              {scanError && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{scanError}</span>}
            </div>

            {showSaved && (
              <div className="saved-ing-list">
                {savedList.length === 0
                  ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fg2)' }}>{t('nutrition.noSaved')}</div>
                  : savedList.map(s => (
                    <div key={s.id} className="saved-ing-row" onClick={() => loadSaved(s)}>
                      <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--fg2)', flexShrink: 0 }}>
                        {s.kcalPer100} kcal · {s.proteinPer100}g P · {s.carbsPer100}g C · {s.fatPer100}g F
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); deleteIngredient(s.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--danger)', fontSize: 12, flexShrink: 0 }}
                      >✕</button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Live totals */}
          <div className="ing-totals">
            {t('nutrition.mealTotal')}: {Math.round(total.calories)} kcal
            {' · '}{t('nutrition.protein')}: {Math.round(total.protein)}g
            {' · '}{t('nutrition.carbs')}: {Math.round(total.carbs)}g
            {' · '}{t('nutrition.fat')}: {Math.round(total.fat)}g
            {' · '}{t('nutrition.fiber')}: {Math.round(total.fiber)}g
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

// ── New Diet Dialog ───────────────────────────────────────────────────────────

function NewPlanDialog({ onCreate, onClose, t }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) { setError(t('nutrition.food.required')); return }
    onCreate(name.trim())
  }

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <h2>{t('nutrition.mealplans.newTitle')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>{t('nutrition.mealplans.newTitle')}</label>
            <input className={`input ${error ? 'input-error' : ''}`} value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder={t('nutrition.mealplans.namePlaceholder')} autoFocus />
            {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t('exDialog.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('exDialog.add')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
