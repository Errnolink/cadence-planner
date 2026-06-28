// ─── UTILS ───────────────────────────────────────────────────────
import { GRADE_MAP, GRID_START_HOUR, GRID_END_HOUR } from './constants.js'

let _id = 2000
export const genId = () => ++_id

export const pad2 = n => String(n).padStart(2, '0')

/** "08:30" → 510 (minutes since midnight) */
export const parseTimeToMins = str => {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 510 → "08:30" */
export const minsToTimeStr = mins => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${pad2(h)}:${pad2(m)}`
}

/** Fraction of grid height for a given time string */
export const timeFraction = (timeStr, startHour = GRID_START_HOUR, endHour = GRID_END_HOUR) => {
  const total  = (endHour - startHour) * 60
  const offset = parseTimeToMins(timeStr) - startHour * 60
  return Math.max(0, Math.min(1, offset / total))
}

/** Returns 0-based weekday index (MON=0 … FRI=4), -1 on weekends */
export const getTodayDayIdx = () => {
  const d = new Date().getDay()
  return d === 0 || d === 6 ? -1 : d - 1
}

export const gpToLabel = gp =>
  gp === null || gp === undefined
    ? '—'
    : GRADE_MAP.find(g => g.gp === gp)?.label ?? String(gp)

/** Weighted GPA for a single list of subjects (ignores nulls) */
export const calcGPA = subjects => {
  const graded = subjects.filter(s => s.gradePoint !== null && s.gradePoint !== undefined)
  if (!graded.length) return null
  const tw = graded.reduce((a, s) => a + s.gradePoint * (parseFloat(s.credits) || 0), 0)
  const tc = graded.reduce((a, s) => a + (parseFloat(s.credits) || 0), 0)
  return tc ? (tw / tc).toFixed(2) : null
}

/** Cumulative GPA across all semesters */
export const calcCGPA = semesters => calcGPA(semesters.flatMap(s => s.subjects))

/** Given a calendar date (year, month 0-based, day), return the DAYS label or null */
export const dateToDayLabel = (year, month, day) => {
  const LABELS = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  return LABELS[new Date(year, month, day).getDay()]
}
