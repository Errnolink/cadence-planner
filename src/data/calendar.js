// ─── CALENDAR / DAY METADATA ─────────────────────────────────────
// One place that answers "what kind of day is this?", replacing four
// duplicated isHoliday expressions and three inline date templates.
import { DAYS } from './constants.js'
import { isSecondOrFourthSaturday, pad2 } from './utils.js'

const EMPTY_SET = new Set()

/** ({year, month0, day}) → "YYYY-MM-DD" */
export const dateStrFromParts = (year, month0, day) =>
  `${year}-${pad2(month0 + 1)}-${pad2(day)}`

/** "YYYY-MM-DD" → { year, month0, day } (local, no UTC drift) */
export const partsFromDateStr = (dateStr) => {
  const [year, m, d] = String(dateStr).split('-').map(Number)
  return { year, month0: (m || 1) - 1, day: d || 1 }
}

/** "YYYY-MM-DD" → local Date at midnight */
export const dateFromStr = (dateStr) => {
  const { year, month0, day } = partsFromDateStr(dateStr)
  return new Date(year, month0, day)
}

/** "YYYY-MM-DD" → 'MON' | 'TUE' | … (matches DAYS ordering, Mon-first) */
export const weekdayOf = (dateStr) => {
  const js = dateFromStr(dateStr).getDay() // 0 = Sun
  return DAYS[js === 0 ? 6 : js - 1]
}

/**
 * Is a date inside a semester's bounds?
 *
 * A semester with no dates set contains every date, which is what every
 * semester was until the bounds started being enforced — so an unbounded
 * semester counts exactly as much attendance as it always did.
 *
 * Both bounds are inclusive, and the comparison is a plain string compare:
 * 'YYYY-MM-DD' sorts lexicographically the same way it sorts chronologically,
 * which is the whole reason the app stores dates in that shape.
 *
 * Exported because `computeSubjectStats` scopes on the same rule, and two
 * copies of it would eventually disagree about a boundary day.
 */
export function isInTerm(dateStr, semester) {
  const start = semester?.startDate || null
  const end = semester?.endDate || null
  return (!start || dateStr >= start) && (!end || dateStr <= end)
}

/**
 * Everything the UI needs to know about a single date.
 * Replaces the ad-hoc `date` object that was sometimes {year,month,day} and
 * sometimes also carried isHoliday/isManualHoliday depending on the caller —
 * that inconsistency made the day modal behave differently when opened from
 * the timetable vs. the calendar.
 */
export function getDayMeta(dateStr, { settings, attendance, examDates = EMPTY_SET, semester } = {}) {
  const { year, month0, day } = partsFromDateStr(dateStr)
  const dayData = attendance?.[dateStr] ?? {}

  const isManualHoliday = dayData.isHoliday === true
  const isAutoHoliday = Boolean(settings?.holidays2nd4thSat) && isSecondOrFourthSaturday(year, month0, day)

  return {
    dateStr,
    year, month0, day,
    weekday: weekdayOf(dateStr),
    isManualHoliday,
    isAutoHoliday,
    isHoliday: isManualHoliday || isAutoHoliday,
    isExamDay: examDates.has(dateStr),
    examCountAsPresent: dayData.examCountAsPresent === true,
    inTerm: isInTerm(dateStr, semester),
  }
}
