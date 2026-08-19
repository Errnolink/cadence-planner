// ─── ATTENDANCE MATH ─────────────────────────────────────────────
// The pure half of useAttendance: everything that turns the raw
// attendance map into numbers. No React, no storage — so it can be
// unit-tested without a renderer (see attendanceMath.test.js).
//
// Shape of the attendance map:
//   { 'YYYY-MM-DD': {
//       isHoliday?: true,
//       examCountAsPresent?: true,
//       [entryId]: 'PRESENT' | 'ABSENT' | 'CANCELLED',
//       [`${entryId}_note`]: string,
//       [`${entryId}_sub`]: subjectId,     // this slot was swapped to another subject
//   } }

import { ATTENDANCE_THRESHOLD } from './constants.js'
import { weekdayOf, isInTerm } from './calendar.js'

/** @typedef {'PRESENT'|'ABSENT'|'CANCELLED'} Status */

const EMPTY_SET = new Set()
const STATUSES = new Set(['PRESENT', 'ABSENT', 'CANCELLED'])

const blank = () => ({ present: 0, absent: 0, cancelled: 0, total: 0 })

const finalize = (acc, history) => ({
  present: acc.present,
  absent: acc.absent,
  cancelled: acc.cancelled,
  total: acc.total,
  // FLOOR, not round. This number is compared against a threshold, so rounding
  // it up is the one direction that can lie: 56 of 75 is 74.667%, which used to
  // display as "75%" and — because statusTier is handed this same rounded
  // figure — tier as WATCH rather than BELOW MIN, telling a student they were
  // safe while they were short. Flooring can only ever understate, and keeps
  // the printed percentage and the tier telling the same story.
  //
  // The numerator stays an integer on purpose. (57/100)*100 is
  // 56.99999999999999 in IEEE doubles, so flooring the float quotient printed
  // 56 for a true 57 — multiplying first keeps the division exact and the
  // floor honest at every total (verified for every present/total <= 5000).
  percentage: acc.total === 0 ? 100 : Math.floor((acc.present * 100) / acc.total),
  history,
})

const accumulate = (acc, status) => {
  if (status === 'PRESENT') { acc.present++; acc.total++ }
  else if (status === 'ABSENT') { acc.absent++; acc.total++ }
  else if (status === 'CANCELLED') { acc.cancelled++ }
}

/**
 * Single traversal of the attendance map that emits one record per counted
 * class instance. Both computeSubjectStats and computeAllStats are thin
 * wrappers over this, so the two can never disagree.
 *
 * Emitted record:
 *   { date, entryId, entry, subjectId, status, substituted, examCredited }
 * `subjectId` is the subject the instance counts *towards* — the substitute
 * target when the slot was swapped, otherwise the entry's own subject. Always
 * a string, because entry/subject ids are numbers in seed data and strings
 * everywhere a <select> wrote them.
 *
 * Cost: O(dates × marks-on-that-date), plus O(entries) on the rare exam day
 * that was opted into "count as present".
 */
function traverse(attendance, timetable, examDates, emit, semester) {
  if (!attendance) return
  const entryById = new Map(timetable.map(t => [String(t.id), t]))
  const dates = examDates instanceof Set ? examDates : new Set(examDates || [])

  for (const dateStr of Object.keys(attendance)) {
    const dayData = attendance[dateStr]
    if (!dayData || typeof dayData !== 'object') continue

    // Outside the semester's dates the class never happened as far as this
    // term is concerned. The attendance map is global across semesters and
    // keyed by entry id, so without this a date belonging to last term still
    // counted toward this one. A semester with no dates set is unbounded and
    // keeps counting everything, which is how every semester behaved before
    // the bounds were enforced.
    if (!isInTerm(dateStr, semester)) continue

    if (dayData.isHoliday) continue

    // Exam days have no regular classes unless the user opted the day in.
    const isExamDay = dates.has(dateStr)
    if (isExamDay && dayData.examCountAsPresent !== true) continue

    // ── 1. Explicit marks. These are the highest-authority signal in the
    //       app, so they are counted on every kind of day, exam or not.
    for (const key of Object.keys(dayData)) {
      if (key === 'isHoliday' || key === 'examCountAsPresent') continue
      if (key.endsWith('_note') || key.endsWith('_sub')) continue
      const status = dayData[key]
      if (!STATUSES.has(status)) continue
      const entry = entryById.get(key)
      if (!entry) continue // orphaned mark — the entry was deleted (see pruneOrphans)
      const sub = dayData[`${key}_sub`]
      emit({
        date: dateStr,
        entryId: key,
        entry,
        subjectId: sub ? String(sub) : String(entry.subjectId),
        status,
        substituted: Boolean(sub),
        examCredited: false,
      })
    }

    // ── 2. Exam-day blanket credit. Only the slots that actually fall on
    //       this date's weekday, and only where the user left no mark.
    if (isExamDay) {
      const wd = weekdayOf(dateStr)
      for (const entry of timetable) {
        if (entry.day !== wd) continue
        const id = String(entry.id)
        if (STATUSES.has(dayData[id])) continue // explicit mark already emitted above
        const sub = dayData[`${id}_sub`]
        emit({
          date: dateStr,
          entryId: id,
          entry,
          subjectId: sub ? String(sub) : String(entry.subjectId),
          status: 'PRESENT',
          substituted: Boolean(sub),
          examCredited: true,
        })
      }
    }
  }
}

const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

/**
 * Attendance for one subject.
 * @param {object} attendance
 * @param {string|number} subjectId
 * @param {Array} timetable
 * @param {Set<string>} [examDates]
 * @param {{withHistory?: boolean}} [options] — withHistory returns the rows
 *        that were actually counted, newest first, so a history view can
 *        never contradict the percentage next to it.
 */
export function computeSubjectStats(attendance, subjectId, timetable = [], examDates = EMPTY_SET, { withHistory = false, semester } = {}) {
  const want = String(subjectId)
  const acc = blank()
  const history = withHistory ? [] : null

  traverse(attendance, timetable, examDates, rec => {
    if (rec.subjectId !== want) return
    accumulate(acc, rec.status)
    if (history) history.push(rec)
  }, semester)

  if (history) history.sort(byDateDesc)
  return finalize(acc, history)
}

/**
 * Every subject's stats plus the roll-up, in ONE traversal.
 * O(dates × marks) instead of the O(subjects × dates × entries) you get from
 * calling computeSubjectStats in a loop.
 * @returns {{overall: object, bySubject: Map<string, object>}}
 */
export function computeAllStats(attendance, subjects = [], timetable = [], examDates = EMPTY_SET, semester) {
  const accs = new Map()
  for (const s of subjects) accs.set(String(s.id), blank())
  const overallAcc = blank()

  traverse(attendance, timetable, examDates, rec => {
    const acc = accs.get(rec.subjectId)
    if (!acc) return // substitute pointing at a subject outside this semester
    accumulate(acc, rec.status)
    accumulate(overallAcc, rec.status)
  }, semester)

  const bySubject = new Map()
  for (const [id, acc] of accs) bySubject.set(id, finalize(acc, null))
  return { overall: finalize(overallAcc, null), bySubject }
}

/** Roll-up across every subject. */
export function computeOverallStats(attendance, subjects = [], timetable = [], examDates = EMPTY_SET, semester) {
  return computeAllStats(attendance, subjects, timetable, examDates, semester).overall
}

/** How many more classes can be missed while staying >= threshold. */
export function marginToThreshold(present, total, threshold = ATTENDANCE_THRESHOLD) {
  if (total === 0) return Infinity
  // present / (total + x) >= threshold  →  x <= present/threshold - total
  return Math.max(0, Math.floor(present / threshold - total))
}

/** How many consecutive classes must be attended to climb back to threshold. */
export function recoveryPath(present, total, threshold = ATTENDANCE_THRESHOLD) {
  if (total === 0) return 0
  if (present / total >= threshold) return 0
  // (present + x) / (total + x) >= threshold  →  x >= (threshold*total - present) / (1 - threshold)
  return Math.ceil((threshold * total - present) / (1 - threshold))
}

/** 'critical' | 'watch' | 'safe' for a whole-number percentage. */
export function statusTier(percentage, threshold = ATTENDANCE_THRESHOLD) {
  if (percentage < threshold * 100) return 'critical'
  if (percentage < (threshold + 0.1) * 100) return 'watch'
  return 'safe'
}

/**
 * Drop attendance keys whose timetable entry no longer exists — deleting a
 * subject or a slot used to leave its marks, notes and substitutes behind
 * forever, invisible in the UI but uploaded on every sync.
 * Returns the SAME object when nothing needed removing, so callers can use
 * identity to decide whether to persist.
 */
export function pruneOrphans(attendance, allEntryIds) {
  if (!attendance) return attendance
  const live = new Set(Array.from(allEntryIds || [], String))
  let changed = false
  const next = {}

  for (const [dateStr, day] of Object.entries(attendance)) {
    if (!day || typeof day !== 'object') { changed = true; continue }
    const kept = {}
    for (const [k, v] of Object.entries(day)) {
      if (k === 'isHoliday' || k === 'examCountAsPresent') { kept[k] = v; continue }
      const id = k.endsWith('_note') ? k.slice(0, -5)
        : k.endsWith('_sub') ? k.slice(0, -4)
          : k
      if (live.has(id)) kept[k] = v
      else changed = true
    }
    // A day left with only day-level flags and no marks is still meaningful
    // (a manual holiday), so only drop it when it is genuinely empty.
    if (Object.keys(kept).length) next[dateStr] = kept
    else changed = true
  }

  return changed ? next : attendance
}
