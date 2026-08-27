import { createContext, useContext, useMemo } from 'react'

export const AttendanceContext = createContext(null)

// Named `useAttendanceContext`, not `useAttendance`: the state hook in
// useAttendance.js already owns that name, and App imports both. Two different
// things under one name made the import list the only way to tell which you
// had.
export function useAttendanceContext() {
  const ctx = useContext(AttendanceContext)
  if (!ctx) throw new Error('useAttendanceContext must be used within AttendanceProvider')
  return ctx
}

// Stats selectors bound to the provider's timetable / examDates / semester.
// All three scope to the provider's semester by default — `subject` used to
// forward `options` untouched while `overall`/`all` scoped themselves, so a
// caller that forgot to pass `semester` got a per-subject percentage that
// silently disagreed with the overall figure rendered beside it. Callers can
// still override by putting `semester` in `options`.
export function useAttendanceStats() {
  const { timetable, examDates, semester, getSubjectStats, getOverallStats, getAllStats } = useAttendanceContext()

  return useMemo(() => ({
    subject: (subjectId, options) => getSubjectStats(subjectId, timetable, examDates, { semester, ...options }),
    overall: (subjects) => getOverallStats(subjects, timetable, examDates, semester),
    all: (subjects) => getAllStats(subjects, timetable, examDates, semester),
  }), [timetable, examDates, semester, getSubjectStats, getOverallStats, getAllStats])
}
