import { useMemo } from 'react'
import { AttendanceContext } from './useAttendanceContext.jsx'

// The attendance map, its mutations, and the three scoping values that every
// stats call travelled with as separate props (timetable, examDates,
// semester). They always moved together; now they are one context.
//
// App owns the useAttendance state and passes it in — its delete handlers
// (subject / slot / semester) need pruneToEntries, and App sits above this
// provider. The provider mounts inside App because timetable, examDates and
// semester derive from the active semester, which only App holds; mounting
// above App would need a second useSemesters instance.
//
// The context object and consumer hooks live in useAttendanceContext.jsx so
// this module stays component-only for fast refresh.

export function AttendanceProvider({ attendance, timetable, examDates, semester, children }) {
  const value = useMemo(
    () => ({ ...attendance, timetable, examDates, semester }),
    [attendance, timetable, examDates, semester]
  )

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}
