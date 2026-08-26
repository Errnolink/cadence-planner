import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { INITIAL_SEMESTERS, SUBJECT_COLORS } from '../data/index.js'
import { API } from '../data/api.js'
import { normalizeSemesters, DEFAULT_SCHEME } from '../data/grading.js'

/**
 * useSemesters — all semester CRUD state, extracted from App.jsx.
 * Returns derived state + action callbacks.
 */
export function useSemesters() {
  const [semesters, setSemesters] = useState(() => {
    return normalizeSemesters(API.getSemesters(INITIAL_SEMESTERS))
  })
  
  const [activeSemId, setActiveSemId] = useState(() => {
    return API.getActiveSemId(semesters[0]?.id || 1)
  })

  // Seeded from storage rather than '', so a boot that changes nothing writes
  // nothing at all.
  const lastSavedSemestersRef = useRef(null)
  if (lastSavedSemestersRef.current === null) {
    lastSavedSemestersRef.current = JSON.stringify(API.getSemesters(null))
  }

  useEffect(() => {
    const handleSync = () => {
      const newSems = normalizeSemesters(API.getSemesters(INITIAL_SEMESTERS))
      setSemesters(newSems)
      lastSavedSemestersRef.current = JSON.stringify(newSems)
      setActiveSemId(API.getActiveSemId(newSems[0]?.id || 1))
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  // The first run of each effect below persists what we booted with — seed data
  // on a fresh device, a migrated shape on an older one. Neither is an edit the
  // user made, so both go in unstamped. These used to be `isFirstRender` guards
  // that skipped the write entirely, which StrictMode's second mount defeated:
  // the write happened anyway, stamped, and every boot then looked like the
  // newest edit to the sync merge.
  const isBootWriteActiveSem = useRef(true)
  const isBootWriteSem = useRef(true)

  useEffect(() => {
    const isBootWrite = isBootWriteActiveSem.current
    isBootWriteActiveSem.current = false
    const currentLocalId = API.getActiveSemId(null)
    if (currentLocalId === activeSemId) return
    API.saveActiveSemId(activeSemId, isBootWrite)
  }, [activeSemId])

  useEffect(() => {
    const serialized = JSON.stringify(semesters)
    if (serialized === lastSavedSemestersRef.current) return
    // Advance the ref (and consume the boot flag) only when the write landed,
    // so a rejected write — quota, private mode — is retried on the next
    // change instead of being silently dropped.
    if (API.saveSemesters(semesters, isBootWriteSem.current)) {
      isBootWriteSem.current = false
      lastSavedSemestersRef.current = serialized
    }
  }, [semesters])

  const activeSem = useMemo(
    () => semesters.find(s => String(s.id) === String(activeSemId)),
    [semesters, activeSemId]
  )

  // Mirror of `semesters` for callbacks that must read the list without
  // running side effects inside a setState updater (React may invoke those
  // more than once — StrictMode does so deliberately).
  const semestersRef = useRef(semesters)
  useEffect(() => { semestersRef.current = semesters }, [semesters])

  const updateSem = useCallback((updater) => {
    setSemesters(prev => prev.map(s => String(s.id) === String(activeSemId) ? updater(s) : s))
  }, [activeSemId])

  const addSemester = useCallback(() => {
    setSemesters(prev => {
      // Ids are opaque (like subjects and timetable entries already are).
      // Max-plus-one over `id` produced NaN the moment any id was non-numeric
      // — e.g. from a hand-edited backup — and then every
      // String(s.id) === String(activeSemId) comparison matched "NaN".
      const labelCounter = Math.max(
        0,
        prev.length,
        ...prev.map(p => Number(String(p.label ?? '').match(/(\d+)\s*$/)?.[1])).filter(Number.isFinite),
        ...prev.map(p => Number(p.id)).filter(Number.isFinite),
      ) + 1
      const newSem = {
        id: crypto.randomUUID(),
        label: `SEM ${String(labelCounter).padStart(2, '0')}`,
        startDate: '',
        endDate: '',
        subjects: [],
        timetable: [],
        exams: [],
        assessments: [],
        gradingScheme: DEFAULT_SCHEME,
      }
      return [...prev, newSem]
    })
  }, [])

  const removeSemester = useCallback((id) => {
    // Pure updater; the active-id fallback is driven separately so it cannot
    // be scheduled twice by a re-invoked updater.
    setSemesters(prev => {
      if (prev.length <= 1) return prev // Can't delete the last one
      return prev.filter(s => String(s.id) !== String(id))
    })
    setActiveSemId(prevId => {
      if (String(prevId) !== String(id)) return prevId
      const all = semestersRef.current
      const survivors = all.filter(s => String(s.id) !== String(id))
      // Nothing survives (or nothing was actually removed) → keep the selection
      if (survivors.length === 0 || survivors.length === all.length) return prevId
      return survivors[0].id
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

  // ── Assessment CRUD ───────────────────────────────────────────
  // Replaces the old exam CRUD. An assessment is one mark: a component, a
  // sitting, and optionally a part within that sitting. `blocksClasses`
  // decides whether its date suspends teaching — true for a sit-down paper,
  // false for an assignment deadline.
  const addAssessment = useCallback(assessment => {
    updateSem(sem => ({
      ...sem,
      assessments: [...(sem.assessments || []), { id: crypto.randomUUID(), ...assessment }],
    }))
  }, [updateSem])

  /** Add a whole sitting at once — one entry per part of the component. */
  const addSitting = useCallback((component, subjectId, attempt, shared = {}) => {
    updateSem(sem => ({
      ...sem,
      assessments: [
        ...(sem.assessments || []),
        ...(component.parts ?? [{ id: 'score', label: component.label, max: 100 }]).map(part => ({
          id: crypto.randomUUID(),
          subjectId,
          componentId: component.id,
          partId: part.id,
          attempt,
          title: `${component.label} ${attempt} · ${part.label}`,
          score: null,
          maxScore: part.max,
          date: '', startTime: '', endTime: '', room: '', notes: '',
          blocksClasses: false,
          ...shared,
        })),
      ],
    }))
  }, [updateSem])

  const updateAssessment = useCallback(assessment => {
    updateSem(sem => ({
      ...sem,
      assessments: (sem.assessments || []).map(a =>
        String(a.id) === String(assessment.id) ? { ...a, ...assessment } : a),
    }))
  }, [updateSem])

  /** Set one mark without rebuilding the whole record. '' clears it. */
  const setAssessmentScore = useCallback((id, score) => {
    const parsed = score === '' || score === null || score === undefined ? null : Number(score)
    updateSem(sem => ({
      ...sem,
      assessments: (sem.assessments || []).map(a =>
        String(a.id) === String(id)
          ? { ...a, score: Number.isFinite(parsed) ? parsed : null }
          : a),
    }))
  }, [updateSem])

  const removeAssessment = useCallback(id => {
    updateSem(sem => ({
      ...sem,
      assessments: (sem.assessments || []).filter(a => String(a.id) !== String(id)),
    }))
  }, [updateSem])

  /** Drop every entry of one sitting (all its parts). */
  const removeSitting = useCallback((subjectId, componentId, attempt) => {
    updateSem(sem => ({
      ...sem,
      assessments: (sem.assessments || []).filter(a => !(
        String(a.subjectId) === String(subjectId) &&
        a.componentId === componentId &&
        String(a.attempt ?? 1) === String(attempt)
      )),
    }))
  }, [updateSem])

  // ── Grading scheme ────────────────────────────────────────────
  const setGradingScheme = useCallback(scheme => {
    updateSem(sem => ({ ...sem, gradingScheme: scheme }))
  }, [updateSem])

  /** null clears the override so the subject inherits the semester scheme. */
  const setSubjectScheme = useCallback((subjectId, scheme) => {
    updateSem(sem => ({
      ...sem,
      subjects: sem.subjects.map(s => {
        if (String(s.id) !== String(subjectId)) return s
        if (scheme === null) {
          const { gradingScheme: _drop, ...rest } = s
          return rest
        }
        return { ...s, gradingScheme: scheme }
      }),
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
    // Assessment actions
    addAssessment,
    addSitting,
    updateAssessment,
    setAssessmentScore,
    removeAssessment,
    removeSitting,
    // Grading scheme
    setGradingScheme,
    setSubjectScheme,
  }
}
