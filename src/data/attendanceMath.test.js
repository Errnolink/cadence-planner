import { describe, it, expect } from 'vitest'
import {
  computeSubjectStats,
  computeOverallStats,
  computeAllStats,
  marginToThreshold,
  recoveryPath,
  statusTier,
  pruneOrphans,
} from './attendanceMath.js'
import { weekdayOf } from './calendar.js'

// MATH meets MON / WED / FRI. PHYS meets TUE.
const TT = [
  { id: 'e-mon', subjectId: 'math', day: 'MON', startTime: '09:00', endTime: '10:00' },
  { id: 'e-wed', subjectId: 'math', day: 'WED', startTime: '09:00', endTime: '10:00' },
  { id: 'e-fri', subjectId: 'math', day: 'FRI', startTime: '09:00', endTime: '10:00' },
  { id: 'e-tue', subjectId: 'phys', day: 'TUE', startTime: '11:00', endTime: '12:00' },
]
const SUBJECTS = [{ id: 'math' }, { id: 'phys' }]

const TUESDAY = '2026-08-11'
const MONDAY = '2026-08-10'

describe('fixture sanity', () => {
  it('2026-08-11 really is a Tuesday', () => expect(weekdayOf(TUESDAY)).toBe('TUE'))
  it('2026-08-10 really is a Monday', () => expect(weekdayOf(MONDAY)).toBe('MON'))
})

describe('C1 — exam day marked "count as present"', () => {
  const examDates = new Set([TUESDAY])

  it('credits only the slots actually scheduled on that weekday', () => {
    // MATH has no Tuesday slot, so a Tuesday exam credits it with nothing.
    const att = { [TUESDAY]: { examCountAsPresent: true } }
    const s = computeSubjectStats(att, 'math', TT, examDates)
    expect(s.present).toBe(0) // was 3 before the fix
    expect(s.total).toBe(0) //   was 3 before the fix
  })

  it('does credit the subject that DOES meet that weekday', () => {
    const att = { [TUESDAY]: { examCountAsPresent: true } }
    const s = computeSubjectStats(att, 'phys', TT, examDates)
    expect(s).toMatchObject({ present: 1, total: 1, percentage: 100 })
  })

  it('skips an exam day entirely when the user did not opt in', () => {
    const att = { [TUESDAY]: { 'e-tue': 'ABSENT' } }
    const s = computeSubjectStats(att, 'phys', TT, examDates)
    expect(s).toMatchObject({ present: 0, absent: 0, total: 0 })
  })
})

describe('C2 — an explicit mark always beats the exam-day credit', () => {
  const examDates = new Set([TUESDAY])

  it('does not overwrite an explicit ABSENT on a slot of that weekday', () => {
    const att = { [TUESDAY]: { examCountAsPresent: true, 'e-tue': 'ABSENT' } }
    const s = computeSubjectStats(att, 'phys', TT, examDates)
    expect(s.absent).toBe(1) // was 0 before the fix
    expect(s.present).toBe(0) // was 1 before the fix
    expect(s.total).toBe(1)
  })

  it('still counts an explicit mark on a slot from another weekday', () => {
    // The engine has never filtered explicit marks by weekday, and must not
    // start — the user typed it, it counts.
    const att = { [TUESDAY]: { examCountAsPresent: true, 'e-mon': 'ABSENT' } }
    const s = computeSubjectStats(att, 'math', TT, examDates)
    expect(s).toMatchObject({ present: 0, absent: 1, total: 1 })
  })
})

describe('ordinary marks', () => {
  it('counts PRESENT and ABSENT toward the total, CANCELLED outside it', () => {
    const att = {
      '2026-08-10': { 'e-mon': 'PRESENT' },
      '2026-08-12': { 'e-wed': 'ABSENT' },
      '2026-08-14': { 'e-fri': 'CANCELLED' },
    }
    const s = computeSubjectStats(att, 'math', TT)
    expect(s).toMatchObject({ present: 1, absent: 1, cancelled: 1, total: 2, percentage: 50 })
  })

  it('reports 100% for a subject with no records at all', () => {
    expect(computeSubjectStats({}, 'math', TT)).toMatchObject({ total: 0, percentage: 100 })
  })

  it('ignores a mark whose timetable entry no longer exists', () => {
    const att = { '2026-08-10': { 'e-deleted': 'PRESENT' } }
    expect(computeSubjectStats(att, 'math', TT)).toMatchObject({ total: 0 })
  })

  it('ignores cleared (null) marks left behind by older builds', () => {
    const att = { '2026-08-10': { 'e-mon': null, 'e-wed': 'PRESENT' } }
    expect(computeSubjectStats(att, 'math', TT)).toMatchObject({ present: 1, total: 1 })
  })
})

describe('holidays', () => {
  it('discards every mark recorded on a holiday', () => {
    const att = { '2026-08-10': { isHoliday: true, 'e-mon': 'ABSENT' } }
    expect(computeSubjectStats(att, 'math', TT)).toMatchObject({ absent: 0, total: 0 })
  })
})

describe('substitutes', () => {
  it('does not count a slot substituted AWAY toward its own subject', () => {
    const att = { [MONDAY]: { 'e-mon': 'PRESENT', 'e-mon_sub': 'phys' } }
    expect(computeSubjectStats(att, 'math', TT)).toMatchObject({ present: 0, total: 0 })
  })

  it('counts a slot substituted INTO another subject toward that subject', () => {
    const att = { [MONDAY]: { 'e-mon': 'PRESENT', 'e-mon_sub': 'phys' } }
    expect(computeSubjectStats(att, 'phys', TT)).toMatchObject({ present: 1, total: 1 })
  })

  it('follows a substitute through the exam-day credit too', () => {
    const att = { [TUESDAY]: { examCountAsPresent: true, 'e-tue_sub': 'math' } }
    const examDates = new Set([TUESDAY])
    expect(computeSubjectStats(att, 'math', TT, examDates)).toMatchObject({ present: 1, total: 1 })
    expect(computeSubjectStats(att, 'phys', TT, examDates)).toMatchObject({ total: 0 })
  })
})

describe('withHistory', () => {
  const att = {
    '2026-08-10': { 'e-mon': 'PRESENT' },
    '2026-08-12': { 'e-wed': 'ABSENT' },
    '2026-08-11': { examCountAsPresent: true },
    '2026-08-17': { 'e-mon': 'PRESENT', 'e-mon_sub': 'phys' },
  }
  const examDates = new Set(['2026-08-11'])

  it('is null unless asked for', () => {
    expect(computeSubjectStats(att, 'math', TT, examDates).history).toBeNull()
  })

  it('emits exactly the rows that were counted, newest first', () => {
    const s = computeSubjectStats(att, 'math', TT, examDates, { withHistory: true })
    expect(s.history.map(r => r.date)).toEqual(['2026-08-12', '2026-08-10'])
    // the substituted-away row is NOT here, and the exam row (no MATH slot on
    // a Tuesday) is NOT here — which is exactly what the percentage counted
    expect(s.history.length).toBe(s.present + s.absent + s.cancelled)
  })

  it('includes rows substituted INTO the subject, flagged as such', () => {
    const s = computeSubjectStats(att, 'phys', TT, examDates, { withHistory: true })
    const subRow = s.history.find(r => r.date === '2026-08-17')
    expect(subRow).toBeTruthy()
    expect(subRow.substituted).toBe(true)
    const examRow = s.history.find(r => r.date === '2026-08-11')
    expect(examRow.examCredited).toBe(true)
    expect(examRow.status).toBe('PRESENT')
  })
})

describe('computeAllStats', () => {
  const att = {
    '2026-08-10': { 'e-mon': 'PRESENT' },
    '2026-08-11': { examCountAsPresent: true, 'e-tue': 'ABSENT' },
    '2026-08-12': { 'e-wed': 'ABSENT' },
    '2026-08-14': { 'e-fri': 'CANCELLED' },
    '2026-08-17': { 'e-mon': 'PRESENT', 'e-mon_sub': 'phys' },
    '2026-08-18': { isHoliday: true, 'e-tue': 'ABSENT' },
  }
  const examDates = new Set(['2026-08-11'])

  it('matches computeSubjectStats for every subject', () => {
    const { bySubject } = computeAllStats(att, SUBJECTS, TT, examDates)
    for (const s of SUBJECTS) {
      const one = computeSubjectStats(att, s.id, TT, examDates)
      expect(bySubject.get(String(s.id))).toEqual({ ...one, history: null })
    }
  })

  it('overall totals equal the sum of the individual subject totals', () => {
    const { overall } = computeAllStats(att, SUBJECTS, TT, examDates)
    const sum = SUBJECTS.reduce((a, s) => {
      const st = computeSubjectStats(att, s.id, TT, examDates)
      return {
        present: a.present + st.present,
        absent: a.absent + st.absent,
        cancelled: a.cancelled + st.cancelled,
        total: a.total + st.total,
      }
    }, { present: 0, absent: 0, cancelled: 0, total: 0 })
    expect(overall).toMatchObject(sum)
    expect(computeOverallStats(att, SUBJECTS, TT, examDates)).toEqual(overall)
  })

  it('gives every listed subject a bucket even with zero records', () => {
    const { bySubject } = computeAllStats({}, SUBJECTS, TT)
    expect([...bySubject.keys()].sort()).toEqual(['math', 'phys'])
    expect(bySubject.get('math')).toMatchObject({ total: 0, percentage: 100 })
  })
})

describe('margin / recovery / tier', () => {
  it('margin: 30/40 at exactly 75% can miss 0 more', () => expect(marginToThreshold(30, 40)).toBe(0))
  it('margin: 31/40 can miss 1 more', () => expect(marginToThreshold(31, 40)).toBe(1))
  it('margin: an empty record is unbounded', () => expect(marginToThreshold(0, 0)).toBe(Infinity))
  it('margin: never negative when already below threshold', () => expect(marginToThreshold(10, 40)).toBe(0))
  it('recovery: 30/40 is already at threshold', () => expect(recoveryPath(30, 40)).toBe(0))
  it('recovery: 25/40 needs 20 straight', () => expect(recoveryPath(25, 40)).toBe(20))
  it('recovery: nothing recorded needs nothing', () => expect(recoveryPath(0, 0)).toBe(0))
  it('tier: 74 critical, 75 watch, 84 watch, 85 safe', () => {
    expect(statusTier(74)).toBe('critical')
    expect(statusTier(75)).toBe('watch')
    expect(statusTier(84)).toBe('watch')
    expect(statusTier(85)).toBe('safe')
  })
})

describe('pruneOrphans', () => {
  it('returns the same object when nothing is orphaned', () => {
    const att = { '2026-08-10': { 'e-mon': 'PRESENT' } }
    expect(pruneOrphans(att, ['e-mon'])).toBe(att)
  })

  it('drops orphan marks, notes and substitutes', () => {
    const att = {
      '2026-08-10': {
        'e-mon': 'PRESENT',
        'e-gone': 'ABSENT',
        'e-gone_note': 'hi',
        'e-gone_sub': 'phys',
        'e-mon_note': 'kept',
      },
    }
    expect(pruneOrphans(att, new Set(['e-mon']))).toEqual({
      '2026-08-10': { 'e-mon': 'PRESENT', 'e-mon_note': 'kept' },
    })
  })

  it('removes a date that has nothing left on it', () => {
    const att = { '2026-08-10': { 'e-gone': 'PRESENT' }, '2026-08-11': { 'e-mon': 'ABSENT' } }
    expect(pruneOrphans(att, ['e-mon'])).toEqual({ '2026-08-11': { 'e-mon': 'ABSENT' } })
  })

  it('keeps day-level flags even when every mark is orphaned', () => {
    const att = { '2026-08-10': { isHoliday: true, examCountAsPresent: true, 'e-gone': 'PRESENT' } }
    expect(pruneOrphans(att, ['e-mon'])).toEqual({
      '2026-08-10': { isHoliday: true, examCountAsPresent: true },
    })
  })

  it('normalises numeric entry ids to strings', () => {
    const att = { '2026-08-10': { 7: 'PRESENT', 8: 'ABSENT' } }
    expect(pruneOrphans(att, [7])).toEqual({ '2026-08-10': { 7: 'PRESENT' } })
  })
})

// ─────────────────────────────────────────────────────────────────
// The reported percentage is compared against a threshold, so it must
// never round UP across it. 56 of 75 is 74.667%: it used to print as
// "75%" and tier as WATCH, telling a student they were at the line
// when they were below it.
// ─────────────────────────────────────────────────────────────────

describe('percentage never rounds up across the threshold', () => {
  /** n Mondays, the first `present` of them attended. */
  const record = (present, total) => {
    const attendance = {}
    const d = new Date(2026, 0, 5) // a Monday
    for (let i = 0; i < total; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      attendance[key] = { 'e-mon': i < present ? 'PRESENT' : 'ABSENT' }
      d.setDate(d.getDate() + 7)
    }
    return attendance
  }
  const pctOf = (present, total) =>
    computeSubjectStats(record(present, total), 'math', TT, new Set()).percentage

  it('floors a shortfall instead of rounding it up to the threshold', () => {
    expect(pctOf(56, 75)).toBe(74)     // 74.667% — was 75
    expect(pctOf(149, 200)).toBe(74)   // 74.5%
    expect(pctOf(38, 51)).toBe(74)     // 74.51%
    expect(pctOf(71, 95)).toBe(74)     // 74.74%
  })

  it('still reports exactly 75 when the record really is 75%', () => {
    expect(pctOf(3, 4)).toBe(75)
    expect(pctOf(75, 100)).toBe(75)
    expect(pctOf(45, 60)).toBe(75)
  })

  it('never drops a point from an exact-integer percentage', () => {
    // (57/100)*100 === 56.99999999999999 in IEEE doubles — flooring the float
    // quotient showed 56 for a true 57. Multiplying first keeps the division
    // exact; every triple here displayed one point low before the fix.
    expect(pctOf(57, 100)).toBe(57)
    expect(pctOf(29, 50)).toBe(58)
    expect(pctOf(58, 100)).toBe(58)
    expect(pctOf(87, 150)).toBe(58)
    expect(pctOf(114, 200)).toBe(57)
    expect(pctOf(145, 250)).toBe(58)
    // and exhaustively: every exact-integer percentage up to 400 classes
    for (let total = 1; total <= 400; total++) {
      for (let present = 0; present <= total; present++) {
        if ((present * 100) % total !== 0) continue
        expect(pctOf(present, total)).toBe((present * 100) / total)
      }
    }
  })

  it('tiers a shortfall as critical, and agrees with recoveryPath', () => {
    for (const [present, total] of [[56, 75], [149, 200], [38, 51], [71, 95]]) {
      const pct = pctOf(present, total)
      expect(statusTier(pct)).toBe('critical')
      // The tier and the advice must tell the same story: a critical record
      // has classes to make up, so recoveryPath must be non-zero.
      expect(recoveryPath(present, total)).toBeGreaterThan(0)
    }
  })

  it('never reports a percentage above the true value', () => {
    for (let total = 1; total <= 60; total++) {
      for (let present = 0; present <= total; present++) {
        expect(pctOf(present, total)).toBeLessThanOrEqual((present / total) * 100 + 1e-9)
      }
    }
  })

  it('an empty record is still 100%, not 0', () => {
    expect(computeSubjectStats({}, 'math', TT, new Set()).percentage).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────
// Semester dates used to bound nothing: attendance counted every date in
// the map regardless of term, so a mark from last term still moved this
// term's percentage. A semester with no dates set stays unbounded.
// ─────────────────────────────────────────────────────────────────

describe('semester dates scope the count', () => {
  const TERM = { startDate: '2026-08-03', endDate: '2026-08-31' }
  // 2026-07-27, 08-03, 08-10 and 09-07 are all Mondays.
  const BEFORE = '2026-07-27'
  const FIRST  = '2026-08-03'
  const INSIDE = '2026-08-10'
  const LAST   = '2026-08-31'
  const AFTER  = '2026-09-07'

  const att = {
    [BEFORE]: { 'e-mon': 'ABSENT' },
    [FIRST]:  { 'e-mon': 'PRESENT' },
    [INSIDE]: { 'e-mon': 'PRESENT' },
    [LAST]:   { 'e-mon': 'PRESENT' },
    [AFTER]:  { 'e-mon': 'ABSENT' },
  }

  it('counts only the dates inside the term', () => {
    const s = computeSubjectStats(att, 'math', TT, new Set(), { semester: TERM })
    expect(s).toMatchObject({ present: 3, absent: 0, total: 3, percentage: 100 })
  })

  it('treats both bounds as inclusive', () => {
    const only = { [FIRST]: att[FIRST], [LAST]: att[LAST] }
    expect(computeSubjectStats(only, 'math', TT, new Set(), { semester: TERM }).total).toBe(2)
  })

  it('counts everything when the semester has no dates', () => {
    const s = computeSubjectStats(att, 'math', TT, new Set(), { semester: { startDate: '', endDate: '' } })
    expect(s).toMatchObject({ present: 3, absent: 2, total: 5 })
    // and identically when no semester is passed at all
    expect(computeSubjectStats(att, 'math', TT, new Set())).toMatchObject({ total: 5 })
  })

  it('honours a half-open term — one bound set, the other blank', () => {
    expect(computeSubjectStats(att, 'math', TT, new Set(), { semester: { startDate: '2026-08-03', endDate: '' } }).total).toBe(4)
    expect(computeSubjectStats(att, 'math', TT, new Set(), { semester: { endDate: '2026-08-31', startDate: '' } }).total).toBe(4)
  })

  it('scopes the history to the term as well, so it cannot contradict the percentage', () => {
    const s = computeSubjectStats(att, 'math', TT, new Set(), { semester: TERM, withHistory: true })
    expect(s.history).toHaveLength(s.total)
    expect(s.history.every(r => r.date >= TERM.startDate && r.date <= TERM.endDate)).toBe(true)
  })

  it('scopes computeAllStats and its roll-up too', () => {
    const { overall, bySubject } = computeAllStats(att, SUBJECTS, TT, new Set(), TERM)
    expect(overall).toMatchObject({ present: 3, total: 3 })
    expect(bySubject.get('math')).toMatchObject({ present: 3, total: 3 })
  })
})
