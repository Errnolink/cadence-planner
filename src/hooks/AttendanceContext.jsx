import { useMemo } from 'react'
import { AttendanceContext } from './useAttendanceContext.jsx'
import { useAttendance as useAttendanceState } from './useAttendance.js'

// The attendance map, its mutations, and the three scoping values that every
// stats call travelled with as separate props (timetable, examDates,
// semester). They always moved together; now they are one context.
//
// The provider lives inside App rather than main.jsx: `timetable`,
// `examDates` and `semester` derive from the active semester, which only App
// holds. Mounting it above App would mean a second useSemesters instance —
// two sources of truth for the same state.
//
// The context object itself lives in useAttendanceContext.jsx with the
// consumer hooks, so this module stays component-only for fast refresh.

export function AttendanceProvider({ timetable, examDates, semester, children }) {
  const attendance = useAttendanceState()

  const value = useMemo(
    () => ({ ...attendance, timetable, examDates, semester }),
    [attendance, timetable, examDates, semester]
  )

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}
