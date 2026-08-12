import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { API } from '../data/api.js'
import {
  computeSubjectStats,
  computeOverallStats,
  computeAllStats,
  marginToThreshold,
  recoveryPath,
  statusTier,
  pruneOrphans,
} from '../data/attendanceMath.js'

const EMPTY_EXAM_DATES = new Set()

// One-shot garbage collection of attendance rows whose timetable entry was
// deleted long ago. Bumped when the pruning rules change; the stamp keeps it
// from running on every load.
const PRUNE_STAMP_KEY = 'cadence_pruned_at'
const PRUNE_SCHEMA = '2'

// Memoized per page load so React StrictMode's double-invoked initialiser
// cannot half-apply the sweep.
let _bootPruneResult = null

/**
 * Sweep orphaned attendance keys once per schema version.
 * Deliberately conservative: if the semester list can't be read or has no
 * entries at all, nothing is pruned — losing real history to a bad read would
 * be far worse than leaving dead keys in place.
 */
function bootPrune(attendance) {
  if (_bootPruneResult) return _bootPruneResult.value
  let value = attendance
  try {
    if (localStorage.getItem(PRUNE_STAMP_KEY) !== PRUNE_SCHEMA) {
      const semesters = API.getSemesters([]) || []
      const liveIds = new Set()
      for (const sem of semesters) {
        for (const entry of (sem?.timetable || [])) liveIds.add(String(entry.id))
      }
      if (liveIds.size > 0) {
        const pruned = pruneOrphans(attendance, liveIds)
        localStorage.setItem(PRUNE_STAMP_KEY, PRUNE_SCHEMA)
        if (pruned !== attendance) {
          API.saveAttendance(pruned)
          value = pruned
        }
      }
    }
  } catch (e) {
    console.error('Attendance prune sweep failed', e)
  }
  _bootPruneResult = { value }
  return value
}

/**
 * Write one date's object back into the map, dropping the date entirely when
 * nothing is left on it. Empty `{}` days used to accumulate in localStorage
 * and in every sync payload forever.
 */
function writeDay(prev, dateStr, day) {
  if (Object.keys(day).length === 0) {
    if (!(dateStr in prev)) return prev
    const next = { ...prev }
    delete next[dateStr]
    return next
  }
  return { ...prev, [dateStr]: day }
}

export function useAttendance() {
  const [attendance, setAttendance] = useState(() => bootPrune(API.getAttendance({})))

  const lastSavedAttendanceRef = useRef('')

  useEffect(() => {
    const handleSync = () => {
      const fresh = API.getAttendance({})
      setAttendance(fresh)
      lastSavedAttendanceRef.current = JSON.stringify(fresh)
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const serialized = JSON.stringify(attendance)
    if (serialized === lastSavedAttendanceRef.current) return
    lastSavedAttendanceRef.current = serialized
    API.saveAttendance(attendance)
  }, [attendance])

  // ── Mutations ──────────────────────────────────────────────────
  // All of these delete keys rather than writing null/false: a cleared mark
  // is the absence of data, not a piece of data.

  const markAttendance = useCallback((dateStr, entryId, status) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      if (status == null) delete day[entryId]
      else day[entryId] = status // 'PRESENT' | 'ABSENT' | 'CANCELLED'
      return writeDay(prev, dateStr, day)
    })
  }, [])

  const markDayAttendance = useCallback((dateStr, entryIds, status) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      entryIds.forEach(id => {
        if (status == null) delete day[id]
        else day[id] = status // 'PRESENT' | 'ABSENT'
      })
      return writeDay(prev, dateStr, day)
    })
  }, [])

  const toggleHoliday = useCallback((dateStr) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      if (day.isHoliday) delete day.isHoliday
      else day.isHoliday = true
      return writeDay(prev, dateStr, day)
    })
  }, [])

  const setNote = useCallback((dateStr, entryId, note) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      const key = `${entryId}_note`
      if (note) day[key] = note
      else delete day[key]
      return writeDay(prev, dateStr, day)
    })
  }, [])

  const setSubstitute = useCallback((dateStr, entryId, substituteSubjectId) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      const key = `${entryId}_sub`
      if (substituteSubjectId) day[key] = substituteSubjectId
      else delete day[key]
      return writeDay(prev, dateStr, day)
    })
  }, [])

  const setExamDayPresent = useCallback((dateStr, value) => {
    setAttendance(prev => {
      const day = { ...(prev[dateStr] || {}) }
      if (value) day.examCountAsPresent = true
      else delete day.examCountAsPresent
      return writeDay(prev, dateStr, day)
    })
  }, [])

  // ── Derived stats — thin wrappers over src/data/attendanceMath.js ──

  const getSubjectStats = useCallback(
    (subjectId, timetable, examDates = EMPTY_EXAM_DATES, options) =>
      computeSubjectStats(attendance, subjectId, timetable, examDates, options),
    [attendance])

  const getOverallStats = useCallback(
    (subjects, timetable, examDates = EMPTY_EXAM_DATES) =>
      computeOverallStats(attendance, subjects, timetable, examDates),
    [attendance])

  /** One traversal for every subject at once — prefer this in list views. */
  const getAllStats = useCallback(
    (subjects, timetable, examDates = EMPTY_EXAM_DATES) =>
      computeAllStats(attendance, subjects, timetable, examDates),
    [attendance])

  return useMemo(() => ({
    attendance, markAttendance, markDayAttendance, toggleHoliday, setNote, setSubstitute, setExamDayPresent,
    getSubjectStats, getOverallStats, getAllStats,
    // Already stable module-level functions — no wrapper needed.
    getMarginToThreshold: marginToThreshold,
    getRecoveryPath: recoveryPath,
    getStatusTier: statusTier,
  }), [attendance, markAttendance, markDayAttendance, toggleHoliday, setNote, setSubstitute, setExamDayPresent,
    getSubjectStats, getOverallStats, getAllStats])
}
