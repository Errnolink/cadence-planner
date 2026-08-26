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

/**
 * Sweep orphaned attendance keys once per schema version.
 * Deliberately conservative: if the semester list can't be read or has no
 * entries at all, nothing is pruned — losing real history to a bad read would
 * be far worse than leaving dead keys in place.
 *
 * There is deliberately NO module-level memo here. One used to cache the first
 * call's result to make StrictMode's double-invoked initialiser idempotent, but
 * it also made every LATER call ignore its argument — so remounting this hook
 * (ErrorBoundary's ATTEMPT RECOVERY does exactly that) re-seeded state from the
 * page-load snapshot and then persisted it over everything marked since,
 * pushing the emptied map to the cloud behind it. The `cadence_pruned_at` stamp
 * below already provides the idempotence the memo was there for: a second call
 * sees the stamp, skips the sweep, and returns its argument untouched.
 */
function bootPrune(attendance) {
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

  // Seeded from storage rather than '', so a boot that changes nothing writes
  // nothing at all.
  const lastSavedAttendanceRef = useRef(null)
  if (lastSavedAttendanceRef.current === null) {
    lastSavedAttendanceRef.current = JSON.stringify(API.getAttendance(null))
  }

  useEffect(() => {
    const handleSync = () => {
      const fresh = API.getAttendance({})
      setAttendance(fresh)
      lastSavedAttendanceRef.current = JSON.stringify(fresh)
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  // First run persists the state we booted with (post-prune), which is not a
  // user edit — see the note on API.saveSemesters.
  const isBootWrite = useRef(true)

  useEffect(() => {
    const serialized = JSON.stringify(attendance)
    if (serialized === lastSavedAttendanceRef.current) return
    // Advance the ref (and consume the boot flag) only when the write landed —
    // same contract as useSemesters' save effect.
    if (API.saveAttendance(attendance, isBootWrite.current)) {
      isBootWrite.current = false
      lastSavedAttendanceRef.current = serialized
    }
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

  // Immediate prune after a timetable entry dies (subject deleted, slot
  // deleted, semester deleted). The boot sweep would catch these eventually,
  // but it is gated behind cadence_pruned_at and until then the dead rows sit
  // in storage and in every sync payload. pruneOrphans returns the same
  // object when nothing changed, so the write guard no-ops the common case.
  const pruneToEntries = useCallback((liveEntryIds) => {
    setAttendance(prev => pruneOrphans(prev, liveEntryIds))
  }, [])

  // ── Derived stats — thin wrappers over src/data/attendanceMath.js ──

  // `semester` scopes the traversal to that term's dates. Omit it and the
  // whole map counts, which is what an unbounded semester wants anyway.

  const getSubjectStats = useCallback(
    (subjectId, timetable, examDates = EMPTY_EXAM_DATES, options) =>
      computeSubjectStats(attendance, subjectId, timetable, examDates, options),
    [attendance])

  const getOverallStats = useCallback(
    (subjects, timetable, examDates = EMPTY_EXAM_DATES, semester) =>
      computeOverallStats(attendance, subjects, timetable, examDates, semester),
    [attendance])

  /** One traversal for every subject at once — prefer this in list views. */
  const getAllStats = useCallback(
    (subjects, timetable, examDates = EMPTY_EXAM_DATES, semester) =>
      computeAllStats(attendance, subjects, timetable, examDates, semester),
    [attendance])

  return useMemo(() => ({
    attendance, markAttendance, markDayAttendance, toggleHoliday, setNote, setSubstitute, setExamDayPresent, pruneToEntries,
    getSubjectStats, getOverallStats, getAllStats,
    // Already stable module-level functions — no wrapper needed.
    getMarginToThreshold: marginToThreshold,
    getRecoveryPath: recoveryPath,
    getStatusTier: statusTier,
  }), [attendance, markAttendance, markDayAttendance, toggleHoliday, setNote, setSubstitute, setExamDayPresent, pruneToEntries,
    getSubjectStats, getOverallStats, getAllStats])
}
