export function newId() {
  return crypto.randomUUID()
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const MUSCLE_CATEGORIES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Core', 'Cardio', 'Full Body', 'Other',
]

export const WGER_CATEGORIES = {
  8: 'Arms', 10: 'Back', 11: 'Calves', 12: 'Chest',
  14: 'Legs', 15: 'Shoulders', 9: 'Abs',
}

export function totalVolume(exercises) {
  return exercises.reduce((sum, ex) => {
    const sets = ex.sets || []
    return sum + sets.filter(s => s.done).reduce((s2, set) => s2 + (set.reps || 0) * (set.weight || 0), 0)
  }, 0)
}

export function totalSets(exercises) {
  return exercises.reduce((sum, ex) => sum + (ex.sets || []).filter(s => s.done).length, 0)
}
