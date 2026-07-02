import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { today } from '../utils'

const EMPTY = () => ({ breakfast: [], lunch: [], dinner: [], other: [] })

export function useNutrition(uid) {
  const [date,    setDate]  = useState(today())
  const [dayData, setData]  = useState(null)
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    if (!uid) return
    setLoad(true)
    const ref = doc(db, 'users', uid, 'nutrition', date)
    return onSnapshot(ref, snap => {
      setData(snap.exists() ? snap.data() : { date, meals: EMPTY() })
      setLoad(false)
    })
  }, [uid, date])

  async function saveMeal(mealKey, items) {
    const ref = doc(db, 'users', uid, 'nutrition', date)
    await setDoc(ref, {
      date,
      meals: { ...EMPTY(), ...(dayData?.meals || {}), [mealKey]: items },
    }, { merge: true })
  }

  function prevDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDate(d.toISOString().slice(0, 10))
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setDate(d.toISOString().slice(0, 10))
  }

  return { date, setDate, prevDay, nextDay, dayData, loading, saveMeal }
}
