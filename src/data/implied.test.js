import { describe, it, expect } from 'vitest'
import {
  bandRange, impliedComponentMarks, subjectGradePoint,
  SCHEME_PRESETS, GRADE_BAND_PRESETS,
} from './grading.js'

const scheme = SCHEME_PRESETS.find(p => p.id === 'avg-internals-25-75').scheme

const sitting = (attempt, o, s, a) => [
  { id: `o${attempt}`, subjectId: 1, componentId: 'internal', partId: 'objective',  attempt, score: o, maxScore: 10 },
  { id: `s${attempt}`, subjectId: 1, componentId: 'internal', partId: 'subjective', attempt, score: s, maxScore: 10 },
  { id: `a${attempt}`, subjectId: 1, componentId: 'internal', partId: 'assignment', attempt, score: a, maxScore: 5  },
]
// Mid 1 = 19/25, Mid 2 = 20/25 → averaged = 19.5 of 25
const internals = [...sitting(1, 8, 7, 4), ...sitting(2, 6, 9, 5)]

describe('bandRange', () => {
  it('bounds a middle band by the next floor up', () => {
    expect(bandRange(8)).toMatchObject({ min: 70, max: 80, label: 'A', maxInclusive: false })
  })
  it('caps the top band at 100 inclusive', () => {
    expect(bandRange(10)).toMatchObject({ min: 90, max: 100, maxInclusive: true })
  })
  it('runs the bottom band down to 0', () => {
    expect(bandRange(0)).toMatchObject({ min: 0, max: 40 })
  })
  it('follows the band set given', () => {
    const four = GRADE_BAND_PRESETS.find(b => b.id === 'four-point')
    expect(bandRange(3, four)).toMatchObject({ min: 80, max: 90, label: 'B' })
  })
  it('returns null for a grade point the bands do not define', () => {
    expect(bandRange(7.5)).toBeNull()
  })
})

describe('impliedComponentMarks — the real case', () => {
  it('pins theory to a window from an awarded A', () => {
    const r = impliedComponentMarks(internals, scheme, 'theory', 8)
    expect(r.possible).toBe(true)
    expect(r.known).toBeCloseTo(19.5, 5)
    expect(r.min).toBeCloseTo(50.5, 5)   // 70 - 19.5
    expect(r.max).toBeCloseTo(60.5, 5)   // 80 - 19.5
    expect(r.weight).toBe(75)
    expect(r.midpoint).toBeCloseTo(55.5, 5)
    expect(r.band.label).toBe('A')
  })

  it('a higher awarded grade implies a higher window', () => {
    const a = impliedComponentMarks(internals, scheme, 'theory', 8)
    const aPlus = impliedComponentMarks(internals, scheme, 'theory', 9)
    expect(aPlus.min).toBeGreaterThan(a.min)
    expect(aPlus.min).toBeCloseTo(60.5, 5)   // 80 - 19.5
    expect(aPlus.max).toBeCloseTo(70.5, 5)
  })

  it('better internals imply a lower theory mark for the same grade', () => {
    const strong = [...sitting(1, 10, 10, 5), ...sitting(2, 10, 10, 5)]   // 25/25
    const r = impliedComponentMarks(strong, scheme, 'theory', 8)
    expect(r.min).toBeCloseTo(45, 5)   // 70 - 25
    expect(r.max).toBeCloseTo(55, 5)
  })

  it('clamps the top band to the paper, not to 100', () => {
    const r = impliedComponentMarks(internals, scheme, 'theory', 10)   // 90-100
    expect(r.min).toBeCloseTo(70.5, 5)
    expect(r.max).toBe(75)             // 100 - 19.5 = 80.5, capped at the 75-mark paper
    expect(r.possible).toBe(true)
  })

  it('clamps the bottom band at zero', () => {
    const r = impliedComponentMarks(internals, scheme, 'theory', 0)   // 0-40
    expect(r.min).toBe(0)
    expect(r.max).toBeCloseTo(20.5, 5)
  })
})

describe('impliedComponentMarks — when it cannot answer', () => {
  it('refuses while another component is still ungraded', () => {
    const r = impliedComponentMarks([], scheme, 'theory', 8)
    expect(r.possible).toBe(false)
    expect(r.blockedBy).toEqual(['INTERNALS'])
  })

  it('flags an awarded grade that the marks cannot produce', () => {
    // 25/25 internals and an F: the total would have to be under 40, so theory
    // under 15 — possible. Use a case that truly cannot happen instead:
    // 0 internals and an O needs 90+ from a 75-mark paper.
    const zero = [...sitting(1, 0, 0, 0), ...sitting(2, 0, 0, 0)]
    const r = impliedComponentMarks(zero, scheme, 'theory', 10)
    expect(r.possible).toBe(false)
  })

  it('returns null for an unknown component', () => {
    expect(impliedComponentMarks(internals, scheme, 'nope', 8)).toBeNull()
  })

  it('returns null for a grade point outside the bands', () => {
    expect(impliedComponentMarks(internals, scheme, 'theory', 99)).toBeNull()
  })

  it('the window always lies inside the component weight', () => {
    for (const gp of [0, 4, 5, 6, 7, 8, 9, 10]) {
      const r = impliedComponentMarks(internals, scheme, 'theory', gp)
      expect(r.min).toBeGreaterThanOrEqual(0)
      expect(r.max).toBeLessThanOrEqual(75)
      expect(r.min).toBeLessThanOrEqual(r.max)
    }
  })
})

describe('an awarded grade outranks everything computed', () => {
  const subject = { id: 1, name: 'MATHS', credits: 4, gradePoint: 6 }

  it('beats the projection from marks', () => {
    const derived = subjectGradePoint(subject, internals, scheme)
    expect(derived).toMatchObject({ gp: 8, source: 'derived' })   // 78% projected

    const awarded = subjectGradePoint({ ...subject, awardedGp: 9 }, internals, scheme)
    expect(awarded).toMatchObject({ gp: 9, source: 'awarded', isComplete: true })
  })

  it('beats a hand-typed grade', () => {
    expect(subjectGradePoint({ ...subject, awardedGp: 10 }, [], scheme))
      .toMatchObject({ gp: 10, source: 'awarded' })
  })

  it('an awarded 0 is a real F, not a missing value', () => {
    expect(subjectGradePoint({ ...subject, awardedGp: 0 }, internals, scheme))
      .toMatchObject({ gp: 0, source: 'awarded' })
  })

  it('an empty awarded field falls through to the derived grade', () => {
    expect(subjectGradePoint({ ...subject, awardedGp: '' }, internals, scheme).source).toBe('derived')
    expect(subjectGradePoint({ ...subject, awardedGp: null }, internals, scheme).source).toBe('derived')
  })
})
