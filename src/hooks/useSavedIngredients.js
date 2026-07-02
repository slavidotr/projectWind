import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { newId } from '../utils'

export function useSavedIngredients(uid) {
  const [list, setList] = useState([])

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'savedIngredients'), orderBy('savedAt', 'asc'))
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [uid])

  async function saveIngredient(ing) {
    const id = newId()
    await setDoc(doc(db, 'users', uid, 'savedIngredients', id), {
      id,
      name:          ing.name.trim(),
      kcalPer100:    parseFloat(ing.kcalPer100)    || 0,
      proteinPer100: parseFloat(ing.proteinPer100) || 0,
      carbsPer100:   parseFloat(ing.carbsPer100)   || 0,
      fatPer100:     parseFloat(ing.fatPer100)     || 0,
      fiberPer100:   parseFloat(ing.fiberPer100)   || 0,
      savedAt:       serverTimestamp(),
    })
  }

  async function deleteIngredient(id) {
    await deleteDoc(doc(db, 'users', uid, 'savedIngredients', id))
  }

  return { list, saveIngredient, deleteIngredient }
}
