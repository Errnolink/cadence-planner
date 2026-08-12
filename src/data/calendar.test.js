import { describe, it, expect } from 'vitest'
import {
  weekdayOf,
  dateStrFromParts,
  partsFromDateStr,
  dateFromStr,
  getDayMeta,
} from './calendar.js'

describe('weekdayOf', () => {
  it('walks a full week Monday → Sunday', () => {
    // 2026-08-10 is a Monday.
    const week = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']
    expect(week.map(weekdayOf)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  })

  it('puts Sunday last rather than first (JS getDay() is 0-based on Sunday)', () => {
    expect(weekdayOf('2026-08-16')).toBe('SUN')
  })

  it('does not drift across a UTC date boundary', () => {
    // A naive `new Date('2026-01-01')` parses as UTC midnight and can render
    // as 2025-12-31 in western timezones. The local parse must not.
    expect(weekdayOf('2026-01-01')).toBe('THU')
  })
})

describe('date string round-trip', () => {
  it('formats from parts with zero padding', () => {
    expect(dateStrFromParts(2026, 0, 5)).toBe('2026-01-05')
    expect(dateStrFromParts(2026, 11, 31)).toBe('2026-12-31')
  })

  it('parses back to the same parts', () => {
    expect(partsFromDateStr('2026-08-09')).toEqual({ year: 2026, month0: 7, day: 9 })
  })

  it('builds a local midnight Date', () => {
    const d = dateFromStr('2026-08-09')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 9, 0])
  })
})

describe('getDayMeta', () => {
  const settings = { holidays2nd4thSat: true }

  it('reports a manual holiday from the attendance map', () => {
    const meta = getDayMeta('2026-08-10', { settings, attendance: { '2026-08-10': { isHoliday: true } } })
    expect(meta).toMatchObject({ isManualHoliday: true, isAutoHoliday: false, isHoliday: true, weekday: 'MON' })
  })

  it('reports the 2nd Saturday as an automatic holiday only when the setting is on', () => {
    expect(getDayMeta('2026-08-08', { settings }).isAutoHoliday).toBe(true)
    expect(getDayMeta('2026-08-08', { settings: {} }).isAutoHoliday).toBe(false)
    expect(getDayMeta('2026-08-15', { settings }).isAutoHoliday).toBe(false) // 3rd Saturday
  })

  it('flags exam days and the opt-in credit', () => {
    const meta = getDayMeta('2026-08-11', {
      settings,
      examDates: new Set(['2026-08-11']),
      attendance: { '2026-08-11': { examCountAsPresent: true } },
    })
    expect(meta.isExamDay).toBe(true)
    expect(meta.examCountAsPresent).toBe(true)
    expect(getDayMeta('2026-08-12', { settings }).isExamDay).toBe(false)
  })

  it('bounds inTerm by the semester dates, and treats an unbounded semester as always in term', () => {
    const semester = { startDate: '2026-01-01', endDate: '2026-05-31' }
    expect(getDayMeta('2026-03-02', { settings, semester }).inTerm).toBe(true)
    expect(getDayMeta('2025-12-31', { settings, semester }).inTerm).toBe(false)
    expect(getDayMeta('2026-06-01', { settings, semester }).inTerm).toBe(false)
    expect(getDayMeta('2026-06-01', { settings, semester: { startDate: '', endDate: '' } }).inTerm).toBe(true)
    expect(getDayMeta('2026-06-01', { settings }).inTerm).toBe(true)
  })

  it('works with no options at all', () => {
    expect(getDayMeta('2026-08-12')).toMatchObject({ weekday: 'WED', isHoliday: false, isExamDay: false })
  })
})
