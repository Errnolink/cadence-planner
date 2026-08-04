import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { INITIAL_SEMESTERS, SUBJECT_COLORS } from '../data/index.js'
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
    const handleSync = () => {
      setSemesters(API.getSemesters(INITIAL_SEMESTERS))
      const newSems = API.getSemesters(INITIAL_SEMESTERS)
      setActiveSemId(API.getActiveSemId(newSems[0]?.id || 1))
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  const isFirstRenderActiveSem = useRef(true)
  const isFirstRenderSem = useRef(true)

  useEffect(() => {
    if (isFirstRenderActiveSem.current) {
      isFirstRenderActiveSem.current = false
      return
    }
    const currentLocalId = API.getActiveSemId(null)
    if (currentLocalId === activeSemId) return
    API.saveActiveSemId(activeSemId)
  }, [activeSemId])

  useEffect(() => {
    if (isFirstRenderSem.current) {
      isFirstRenderSem.current = false
      return
    }
    const currentLocal = API.getSemesters(null)
    if (JSON.stringify(currentLocal) === JSON.stringify(semesters)) return
    API.saveSemesters(semesters)
  }, [semesters])

  const activeSem = useMemo(
    () => semesters.find(s => String(s.id) === String(activeSemId)),
    [semesters, activeSemId]
  )

  const updateSem = useCallback((updater) => {
    setSemesters(prev => prev.map(s => String(s.id) === String(activeSemId) ? updater(s) : s))
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
      const next = prev.filter(s => String(s.id) !== String(id))
      queueMicrotask(() => {
        setActiveSemId(prevId => {
          if (String(prevId) === String(id)) {
            // If we deleted the active sem, switch to the first available one
            return next.length > 0 ? next[0].id : prevId
          }
          return prevId
        })
      })
      return next
    })
  }, [])

  // ── Subject CRUD ───────────────────────────────────────────────
  const addSubject = useCallback(() => {
    updateSem(sem => ({
      ...sem,
      subjects: [
        ...sem.subjects,
        {
          id:         crypto.randomUUID(),
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
      subjects:  sem.subjects.filter(s  => String(s.id) !== String(id)),
      timetable: sem.timetable.filter(t => String(t.subjectId) !== String(id)),
    }))
  }, [updateSem])

  // ── Timetable CRUD ─────────────────────────────────────────────
  const saveTimetableEntry = useCallback(entry => {
    updateSem(sem => {
      const exists = sem.timetable.some(t => String(t.id) === String(entry.id))
      return {
        ...sem,
        timetable: exists
          ? sem.timetable.map(t => String(t.id) === String(entry.id) ? entry : t)
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

  // ── Exam CRUD ─────────────────────────────────────────────────
  const addExam = useCallback(exam => {
    updateSem(sem => ({ ...sem, exams: [...(sem.exams || []), exam] }))
  }, [updateSem])

  const updateExam = useCallback(exam => {
    updateSem(sem => ({
      ...sem,
      exams: (sem.exams || []).map(e => String(e.id) === String(exam.id) ? exam : e),
    }))
  }, [updateSem])

  const removeExam = useCallback(id => {
    updateSem(sem => ({
      ...sem,
      exams: (sem.exams || []).filter(e => String(e.id) !== String(id)),
    }))
  }, [updateSem])

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
    // Exam actions
    addExam,
    updateExam,
    removeExam,
  }
}
