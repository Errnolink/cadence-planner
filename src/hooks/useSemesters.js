import { useState, useCallback, useMemo, useEffect } from 'react'
import { INITIAL_SEMESTERS, SUBJECT_COLORS, genId } from '../data/index.js'
import { API } from '../data/api.js'

/**
 * useSemesters — all semester CRUD state, extracted from App.jsx.
 * Returns derived state + action callbacks.
 */
export function useSemesters() {
  const [semesters, setSemesters] = useState(() => {
    return API.getSemesters(INITIAL_SEMESTERS)
  })
  
  const [activeSemId, setActiveSemId] = useState(() => {
    return API.getActiveSemId(semesters[0]?.id || 1)
  })

  useEffect(() => {
    API.saveActiveSemId(activeSemId)
  }, [activeSemId])

  useEffect(() => {
    API.saveSemesters(semesters)
  }, [semesters])

  const activeSem = useMemo(
    () => semesters.find(s => String(s.id) === String(activeSemId)),
    [semesters, activeSemId]
  )

  const updateSem = useCallback((updater) => {
    setSemesters(prev => prev.map(s => s.id === activeSemId ? updater(s) : s))
  }, [activeSemId])

  const addSemester = useCallback(() => {
    setSemesters(prev => {
      const newId = (prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0) + 1
      const newSem = {
        id: newId,
        label: `SEM ${String(newId).padStart(2, '0')}`,
        startDate: '',
        endDate: '',
        subjects: [],
        timetable: [],
      }
      return [...prev, newSem]
    })
  }, [])

  const removeSemester = useCallback((id) => {
    setSemesters(prev => {
      if (prev.length <= 1) return prev // Can't delete the last one
      const next = prev.filter(s => s.id !== id)
      return next
    })
    setActiveSemId(prevId => {
      if (prevId === id) {
        // If we deleted the active sem, switch to the first available one
        const remaining = semesters.filter(s => s.id !== id)
        return remaining.length > 0 ? remaining[0].id : prevId
      }
      return prevId
    })
  }, [semesters])

  // ── Subject CRUD ───────────────────────────────────────────────
  const addSubject = useCallback(() => {
    updateSem(sem => ({
      ...sem,
      subjects: [
        ...sem.subjects,
        {
          id:         genId(),
          name:       'NEW SUBJECT',
          code:       '',
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

  const clearAllLocations = useCallback(() => {
    setSemesters(prev => prev.map(sem => ({
      ...sem,
      timetable: sem.timetable.map(t => ({ ...t, room: '' }))
    })))
  }, [])

  return {
    // State
    semesters,
    setSemesters,
    activeSemId,
    activeSem,
    // Sem actions
    setActiveSemId,
    addSemester,
    updateSem,
    removeSemester,
    // Subject actions
    addSubject,
    updateSubject,
    removeSubject,
    // Timetable actions
    saveTimetableEntry,
    deleteTimetableEntry,
    clearAllLocations,
  }
}
