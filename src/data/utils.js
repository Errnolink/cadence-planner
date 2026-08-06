// ─── UTILS ───────────────────────────────────────────────────────
import { GRADE_MAP } from './constants.js'

/** Collision-safe ID generator — uses timestamp so IDs survive page reloads */
export const pad2 = n => String(n).padStart(2, '0')

/** "08:30" → 510 (minutes since midnight) */
export const parseTimeToMins = str => {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const getTodayDayIdx = () => {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
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

/** Automatically generate a short subject code from its name */
export const generateSubjectCode = (name) => {
  if (!name) return ''
  const words = name.split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').substring(0, 4).toUpperCase()
}

/** Check if date is the 2nd or 4th Saturday of the month */
export const isSecondOrFourthSaturday = (year, month, day) => {
  const date = new Date(year, month, day);
  if (date.getDay() !== 6) return false;
  const n = Math.ceil(day / 7);
  return n === 2 || n === 4;
}

/** Local Date → "YYYY-MM-DD" (calendar/exam date format) */
export const toDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days from today (local midnight) until dateStr — negative means past */
export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, (m || 1) - 1, d || 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

