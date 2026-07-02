import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { newId } from '../utils'

export function useLogs(uid) {
  const [logList,  setLogList]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'logs'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setLogList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [uid])

  async function saveLog(data) {
    const id  = data.id || newId()
    await setDoc(doc(db, 'users', uid, 'logs', id), { ...data, id, createdAt: serverTimestamp() })
    return id
  }

  async function updateLog(id, patch) {
    await setDoc(doc(db, 'users', uid, 'logs', id), patch, { merge: true })
  }

  async function deleteLog(id) {
    await deleteDoc(doc(db, 'users', uid, 'logs', id))
  }

  return { logList, loading, saveLog, updateLog, deleteLog }
}
