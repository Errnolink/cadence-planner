import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  pad2,
  parseTimeToMins,
  gpToLabel,
  calcGPA,
  calcCGPA,
  generateSubjectCode,
  isSecondOrFourthSaturday,
  toDateStr,
  daysUntil,
  getTodayDayIdx,
} from './utils.js'

afterEach(() => vi.useRealTimers())

describe('pad2 / parseTimeToMins', () => {
  it('pads single digits', () => {
    expect(pad2(0)).toBe('00')
    expect(pad2(9)).toBe('09')
    expect(pad2(23)).toBe('23')
  })

  it('parses HH:MM to minutes since midnight', () => {
    expect(parseTimeToMins('08:30')).toBe(510)
    expect(parseTimeToMins('00:00')).toBe(0)
    expect(parseTimeToMins('23:59')).toBe(1439)
  })

  it('treats a missing time as midnight rather than NaN', () => {
    expect(parseTimeToMins('')).toBe(0)
    expect(parseTimeToMins(undefined)).toBe(0)
  })

  it('keeps HH:MM ordering monotonic', () => {
    expect(parseTimeToMins('09:30')).toBeLessThan(parseTimeToMins('11:00'))
  })
})

describe('gpToLabel', () => {
  it('maps grade points to letters', () => {
    expect(gpToLabel(10)).toBe('O')
    expect(gpToLabel(7)).toBe('B+')
    expect(gpToLabel(0)).toBe('F')
  })

  it('renders an em-dash for an ungraded subject', () => {
    expect(gpToLabel(null)).toBe('—')
    expect(gpToLabel(undefined)).toBe('—')
  })

  it('falls back to the raw value for an unknown grade point', () => {
    expect(gpToLabel(3)).toBe('3')
  })
})

describe('calcGPA / calcCGPA', () => {
  it('weights by credits', () => {
    // (10*4 + 8*2) / 6 = 9.33
    expect(calcGPA([
      { gradePoint: 10, credits: 4 },
      { gradePoint: 8, credits: 2 },
    ])).toBe('9.33')
  })

  it('ignores ungraded subjects', () => {
    expect(calcGPA([
      { gradePoint: 9, credits: 3 },
      { gradePoint: null, credits: 3 },
    ])).toBe('9.00')
  })

  it('returns null when nothing is graded', () => {
    expect(calcGPA([{ gradePoint: null, credits: 3 }])).toBeNull()
    expect(calcGPA([])).toBeNull()
  })

  it('returns null when every graded subject carries zero credits', () => {
    expect(calcGPA([{ gradePoint: 9, credits: 0 }])).toBeNull()
  })

  it('cumulates across semesters', () => {
    const sems = [
      { subjects: [{ gradePoint: 10, credits: 2 }] },
      { subjects: [{ gradePoint: 6, credits: 2 }] },
    ]
    expect(calcCGPA(sems)).toBe('8.00')
  })
})

describe('generateSubjectCode', () => {
  it('takes the first three letters of a single word', () => {
    expect(generateSubjectCode('Algorithms')).toBe('ALG')
  })

  it('takes initials of a multi-word name, capped at four', () => {
    expect(generateSubjectCode('Data Structures')).toBe('DS')
    expect(generateSubjectCode('Introduction To Digital Signal Processing')).toBe('ITDS')
  })

  it('splits on hyphens too and tolerates empty input', () => {
    expect(generateSubjectCode('Object-Oriented')).toBe('OO')
    expect(generateSubjectCode('')).toBe('')
    expect(generateSubjectCode(undefined)).toBe('')
  })
})

describe('isSecondOrFourthSaturday', () => {
  // August 2026: Saturdays fall on the 1st, 8th, 15th, 22nd and 29th.
  it('is true for the 2nd and 4th Saturday', () => {
    expect(isSecondOrFourthSaturday(2026, 7, 8)).toBe(true)
    expect(isSecondOrFourthSaturday(2026, 7, 22)).toBe(true)
  })

  it('is false for the 1st, 3rd and 5th Saturday', () => {
    expect(isSecondOrFourthSaturday(2026, 7, 1)).toBe(false)
    expect(isSecondOrFourthSaturday(2026, 7, 15)).toBe(false)
    expect(isSecondOrFourthSaturday(2026, 7, 29)).toBe(false)
  })

  it('is false for any day that is not a Saturday', () => {
    expect(isSecondOrFourthSaturday(2026, 7, 10)).toBe(false)
  })
})

describe('toDateStr / daysUntil / getTodayDayIdx', () => {
  it('formats a local Date without UTC drift', () => {
    expect(toDateStr(new Date(2026, 7, 3))).toBe('2026-08-03')
    expect(toDateStr(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
  })

  it('counts whole days forward and backward from today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 12, 14, 30))
    expect(daysUntil('2026-08-12')).toBe(0)
    expect(daysUntil('2026-08-13')).toBe(1)
    expect(daysUntil('2026-08-05')).toBe(-7)
    expect(daysUntil(null)).toBeNull()
  })

  it('makes Monday index 0 and Sunday index 6', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 10)) // Monday
    expect(getTodayDayIdx()).toBe(0)
    vi.setSystemTime(new Date(2026, 7, 16)) // Sunday
    expect(getTodayDayIdx()).toBe(6)
  })
})
