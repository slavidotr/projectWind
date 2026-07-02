import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { newId } from '../utils'

export function useMealPlans(uid) {
  const [plans,   setPlans] = useState([])
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'mealplans'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoad(false)
    })
  }, [uid])

  async function createPlan(name) {
    const id = newId()
    await setDoc(doc(db, 'users', uid, 'mealplans', id), {
      id, name, foods: [], createdAt: serverTimestamp(),
    })
    return id
  }

  async function savePlanFoods(planId, foods) {
    await setDoc(doc(db, 'users', uid, 'mealplans', planId), { foods }, { merge: true })
  }

  async function renamePlan(planId, name) {
    await setDoc(doc(db, 'users', uid, 'mealplans', planId), { name }, { merge: true })
  }

  async function deletePlan(planId) {
    await deleteDoc(doc(db, 'users', uid, 'mealplans', planId))
  }

  return { plans, loading, createPlan, savePlanFoods, renamePlan, deletePlan }
}
