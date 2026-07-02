import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { today } from '../utils'

export function useBodyWeight(uid) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'bodyweight'), orderBy('date', 'asc'))
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [uid])

  async function addEntry(weight, unit = 'kg', bodyFat = null) {
    const date = today()
    const data = {
      id: date,
      date,
      weight: parseFloat(weight),
      unit,
      savedAt: serverTimestamp(),
    }
    if (bodyFat !== null && !isNaN(parseFloat(bodyFat))) {
      data.bodyFat = Math.round(parseFloat(bodyFat) * 10) / 10
    }
    await setDoc(doc(db, 'users', uid, 'bodyweight', date), data)
  }

  async function deleteEntry(id) {
    await deleteDoc(doc(db, 'users', uid, 'bodyweight', id))
  }

  return { entries, addEntry, deleteEntry }
}
