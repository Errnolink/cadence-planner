import { useState, useCallback, useMemo, useEffect } from 'react'
import { INITIAL_SEMESTERS, SUBJECT_COLORS, genId } from '../data/index.js'

/**
 * useSemesters — all semester CRUD state, extracted from App.jsx.
 * Returns derived state + action callbacks.
 */
export function useSemesters() {
  const [semesters, setSemesters] = useState(() => {
    try {
      const saved = localStorage.getItem('cadence_data')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to parse cadence_data', e)
    }
    return INITIAL_SEMESTERS
  })
  
  const [activeSemId, setActiveSemId] = useState(semesters[0]?.id || 1)

  useEffect(() => {
    localStorage.setItem('cadence_data', JSON.stringify(semesters))
  }, [semesters])

  const activeSem = useMemo(
    () => semesters.find(s => s.id === activeSemId),
    [semesters, activeSemId]
  )

  const updateSem = useCallback(
    fn => setSemesters(prev => prev.map(s => s.id === activeSemId ? fn(s) : s)),
    [activeSemId]
  )

  // ── Subject CRUD ───────────────────────────────────────────────
  const addSubject = useCallback(() => {
    updateSem(sem => ({
      ...sem,
      subjects: [
        ...sem.subjects,
        {
          id:         genId(),
          name:       'NEW SUBJECT',
          credits:    3,
          colorIdx:   sem.subjects.length % SUBJECT_COLORS.length,
          gradePoint: null,
        },
      ],
    }))
  }, [updateSem])

  const updateSubject = useCallback((id, key, value) => {
    updateSem(sem => ({
      ...sem,
      subjects: sem.subjects.map(s => s.id === id ? { ...s, [key]: value } : s),
    }))
  }, [updateSem])

  const removeSubject = useCallback(id => {
    updateSem(sem => ({
      ...sem,
      subjects:  sem.subjects.filter(s  => s.id !== id),
      timetable: sem.timetable.filter(t => t.subjectId !== id),
    }))
  }, [updateSem])

  // ── Timetable CRUD ─────────────────────────────────────────────
  const saveTimetableEntry = useCallback(entry => {
    updateSem(sem => {
      const exists = sem.timetable.some(t => t.id === entry.id)
      return {
        ...sem,
        timetable: exists
          ? sem.timetable.map(t => t.id === entry.id ? entry : t)
          : [...sem.timetable, entry],
      }
    })
  }, [updateSem])

  const deleteTimetableEntry = useCallback(id => {
    updateSem(sem => ({
      ...sem,
      timetable: sem.timetable.filter(t => t.id !== id),
    }))
  }, [updateSem])

  return {
    // State
    semesters,
    setSemesters,
    activeSemId,
    activeSem,
    // Semester navigation
    setActiveSemId,
    // Subject actions
    addSubject,
    updateSubject,
    removeSubject,
    // Timetable actions
    saveTimetableEntry,
    deleteTimetableEntry,
  }
}
