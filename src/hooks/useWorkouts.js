import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { newId } from '../utils'

export function useWorkouts(uid) {
  const [workoutList, setWorkoutList] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'workouts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setWorkoutList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [uid])

  async function createWorkout(name) {
    const id  = newId()
    const ref = doc(db, 'users', uid, 'workouts', id)
    await setDoc(ref, { name, exercises: [], isFavourite: false, createdAt: serverTimestamp() })
    return id
  }

  async function saveWorkout(id, data) {
    await setDoc(doc(db, 'users', uid, 'workouts', id), data, { merge: true })
  }

  async function deleteWorkout(id) {
    await deleteDoc(doc(db, 'users', uid, 'workouts', id))
  }

  async function renameWorkout(id, name) {
    await setDoc(doc(db, 'users', uid, 'workouts', id), { name }, { merge: true })
  }

  async function setFavourite(id, val) {
    await setDoc(doc(db, 'users', uid, 'workouts', id), { isFavourite: val }, { merge: true })
  }

  async function duplicateWorkout(id, newName) {
    const source = workoutList.find(w => w.id === id)
    if (!source) return null
    const newWorkoutId = newId()
    const exercises = (source.exercises || []).map(ex => ({ ...ex, id: newId() }))
    await setDoc(doc(db, 'users', uid, 'workouts', newWorkoutId), {
      name: newName, exercises, isFavourite: false, createdAt: serverTimestamp(),
    })
    return { id: newWorkoutId, name: newName, exercises, isFavourite: false }
  }

  return { workoutList, loading, createWorkout, saveWorkout, deleteWorkout, renameWorkout, setFavourite, duplicateWorkout }
}
