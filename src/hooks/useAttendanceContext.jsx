import { createContext, useContext, useMemo } from 'react'

export const AttendanceContext = createContext(null)


export function useAttendance() {
  const ctx = useContext(AttendanceContext)
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider')
  return ctx
}

// Stats selectors bound to the provider's timetable / examDates / semester.
// `options` is forwarded whole — computeSubjectStats reads `semester` and
// `withHistory` out of it.
export function useAttendanceStats() {
  const { timetable, examDates, semester, getSubjectStats, getOverallStats, getAllStats } = useAttendance()

  return useMemo(() => ({
    subject: (subjectId, options) => getSubjectStats(subjectId, timetable, examDates, options),
    overall: (subjects) => getOverallStats(subjects, timetable, examDates, semester),
    all: (subjects) => getAllStats(subjects, timetable, examDates, semester),
  }), [timetable, examDates, semester, getSubjectStats, getOverallStats, getAllStats])
}
