import { describe, it, expect } from 'vitest'
import {
  subjectGradePoint, computeSemesterGPA, computeCGPA, gradeCoverage,
  SCHEME_PRESETS, GRADE_BAND_PRESETS, DEFAULT_SCHEME,
} from './grading.js'

const preset = (id) => SCHEME_PRESETS.find(p => p.id === id).scheme

const sitting = (subjectId, attempt, o, s, a) => [
  { id: `${subjectId}-o${attempt}`, subjectId, componentId: 'internal', partId: 'objective',  attempt, score: o, maxScore: 10 },
  { id: `${subjectId}-s${attempt}`, subjectId, componentId: 'internal', partId: 'subjective', attempt, score: s, maxScore: 10 },
  { id: `${subjectId}-a${attempt}`, subjectId, componentId: 'internal', partId: 'assignment', attempt, score: a, maxScore: 5  },
]
const theory = (subjectId, score) =>
  ({ id: `${subjectId}-t`, subjectId, componentId: 'theory', partId: 'paper', attempt: 1, score, maxScore: 75 })

const subj = (id, name, credits, gradePoint = null) => ({ id, name, credits, colorIdx: 0, gradePoint })

describe('subjectGradePoint', () => {
  const s = subj(1, 'MATHS', 4)

  it('falls back to the hand-typed grade when there are no marks', () => {
    const r = subjectGradePoint(subj(1, 'MATHS', 4, 9), [], preset('avg-internals-25-75'))
    expect(r).toMatchObject({ gp: 9, source: 'manual' })
  })

  it('reports nothing when there is neither a mark nor a typed grade', () => {
    expect(subjectGradePoint(s, [], preset('avg-internals-25-75'))).toMatchObject({ gp: null, source: null })
  })

  it('derives from marks once any exist', () => {
    const marks = [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)]
    const r = subjectGradePoint(s, marks, preset('avg-internals-25-75'))
    expect(r.source).toBe('derived')
    expect(r.pct).toBeCloseTo(78, 5)   // projection, not the 19.5 banked
    expect(r.gp).toBe(8)               // A
    expect(r.isComplete).toBe(false)
  })

  it('derived beats a stale hand-typed value', () => {
    const marks = [...sitting(1, 1, 10, 10, 5), ...sitting(1, 2, 10, 10, 5)]
    const r = subjectGradePoint(subj(1, 'MATHS', 4, 4), marks, preset('avg-internals-25-75'))
    expect(r.source).toBe('derived')
    expect(r.gp).toBe(10)              // 100% projected, not the typed 4
  })

  it('grades the real total once the subject is complete', () => {
    const marks = [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5), theory(1, 60)]
    const r = subjectGradePoint(s, marks, preset('avg-internals-25-75'))
    expect(r.isComplete).toBe(true)
    expect(r.pct).toBeCloseTo(79.5, 5)
    expect(r.gp).toBe(8)
  })

  it('grades a partial term on the projection, not on banked marks', () => {
    // 19.5 banked out of 100 would be an F; the projection is 78, an A.
    const marks = [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)]
    expect(subjectGradePoint(s, marks, preset('avg-internals-25-75')).gp).toBe(8)
  })

  it('reverts to the typed grade when marks are cleared', () => {
    const withMark = [...sitting(1, 1, 8, 7, 4)]
    const cleared = withMark.map(m => ({ ...m, score: null }))
    const s9 = subj(1, 'MATHS', 4, 9)
    expect(subjectGradePoint(s9, withMark, preset('avg-internals-25-75')).source).toBe('derived')
    expect(subjectGradePoint(s9, cleared, preset('avg-internals-25-75'))).toMatchObject({ gp: 9, source: 'manual' })
  })

  it('only counts marks belonging to the subject', () => {
    const other = [...sitting(2, 1, 10, 10, 5)]
    expect(subjectGradePoint(s, other, preset('avg-internals-25-75')).source).toBeNull()
  })

  it('follows the scheme it is given', () => {
    const marks = [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)]
    const avg = subjectGradePoint(s, marks, preset('avg-internals-25-75'))
    const best = subjectGradePoint(s, marks, preset('best-internals-25-75'))
    expect(avg.pct).toBeCloseTo(78, 5)
    expect(best.pct).toBeCloseTo(80, 5)
    expect(avg.gp).toBe(8)    // A
    expect(best.gp).toBe(9)   // A+ — the rule alone moves the grade point
  })

  it('follows the band set it is given', () => {
    const marks = [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)]
    const four = { ...preset('avg-internals-25-75'), bands: GRADE_BAND_PRESETS.find(b => b.id === 'four-point') }
    expect(subjectGradePoint(s, marks, four).gp).toBe(2)   // 78% is a C on a 4.0 scale
  })
})

describe('computeSemesterGPA', () => {
  it('weights by credits, not by subject count', () => {
    const semester = {
      gradingScheme: DEFAULT_SCHEME,
      subjects: [subj(1, 'BIG', 4, 10), subj(2, 'SMALL', 1, 4)],
      assessments: [],
    }
    // (10*4 + 4*1) / 5 = 8.8, not the unweighted mean of 7
    expect(computeSemesterGPA(semester)).toBeCloseTo(8.8, 5)
  })

  it('mixes derived and hand-typed subjects', () => {
    const semester = {
      gradingScheme: preset('avg-internals-25-75'),
      subjects: [subj(1, 'DERIVED', 4), subj(2, 'TYPED', 4, 6)],
      assessments: [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)],   // → gp 8
    }
    expect(computeSemesterGPA(semester)).toBeCloseTo(7, 5)   // (8*4 + 6*4) / 8
  })

  it('ignores ungraded subjects rather than counting them as zero', () => {
    const semester = {
      gradingScheme: DEFAULT_SCHEME,
      subjects: [subj(1, 'GRADED', 4, 8), subj(2, 'UNGRADED', 4)],
      assessments: [],
    }
    expect(computeSemesterGPA(semester)).toBeCloseTo(8, 5)
  })

  it('honours a per-subject scheme override', () => {
    const semester = {
      gradingScheme: preset('avg-internals-25-75'),
      subjects: [{ ...subj(1, 'X', 4), gradingScheme: preset('best-internals-25-75') }],
      assessments: [...sitting(1, 1, 8, 7, 4), ...sitting(1, 2, 6, 9, 5)],
    }
    expect(computeSemesterGPA(semester)).toBe(9)   // best-of → A+, not the semester default's A
  })

  it('returns null with no graded subjects', () => {
    expect(computeSemesterGPA({ subjects: [subj(1, 'X', 4)], assessments: [] })).toBeNull()
    expect(computeSemesterGPA(undefined)).toBeNull()
  })

  it('treats a zero-credit subject as carrying no weight', () => {
    const semester = { gradingScheme: DEFAULT_SCHEME, subjects: [subj(1, 'X', 0, 10)], assessments: [] }
    expect(computeSemesterGPA(semester)).toBeNull()
  })
})

describe('computeCGPA', () => {
  it('pools every graded subject across semesters by credit', () => {
    const sems = [
      { gradingScheme: DEFAULT_SCHEME, subjects: [subj(1, 'A', 4, 10)], assessments: [] },
      { gradingScheme: DEFAULT_SCHEME, subjects: [subj(2, 'B', 2, 4)],  assessments: [] },
    ]
    expect(computeCGPA(sems)).toBeCloseTo((10 * 4 + 4 * 2) / 6, 5)
  })

  it('is unaffected by a semester with nothing graded', () => {
    const sems = [
      { gradingScheme: DEFAULT_SCHEME, subjects: [subj(1, 'A', 4, 8)], assessments: [] },
      { gradingScheme: DEFAULT_SCHEME, subjects: [subj(2, 'B', 4)],    assessments: [] },
    ]
    expect(computeCGPA(sems)).toBeCloseTo(8, 5)
  })

  it('returns null for an empty list', () => {
    expect(computeCGPA([])).toBeNull()
    expect(computeCGPA()).toBeNull()
  })
})

describe('gradeCoverage', () => {
  it('separates derived from hand-typed', () => {
    const semester = {
      gradingScheme: preset('avg-internals-25-75'),
      subjects: [subj(1, 'D', 4), subj(2, 'M', 4, 7), subj(3, 'NONE', 4)],
      assessments: [...sitting(1, 1, 8, 7, 4)],
    }
    expect(gradeCoverage(semester)).toEqual({ derived: 1, manual: 1, graded: 2, total: 3 })
  })
})
