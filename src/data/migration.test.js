import { describe, it, expect } from 'vitest'
import { normalizeSemester, normalizeSemesters, classBlockingDates, DEFAULT_SCHEME } from './grading.js'
import { INITIAL_SEMESTERS } from './initialData.js'

/**
 * The migration runs on every load and every cloud pull, against data that
 * may already be migrated, partly migrated, or from a much older build. The
 * failure that matters is not a crash — it is silently changing which dates
 * suspend teaching, because that moves the attendance percentage without the
 * user touching anything.
 */

describe('exams → assessments migration', () => {
  it('leaves the blocking dates of the seed data exactly as they were', () => {
    const before = new Set(INITIAL_SEMESTERS.flatMap(s => (s.exams ?? []).map(e => e.date)))
    const after = new Set(normalizeSemesters(INITIAL_SEMESTERS).flatMap(s => [...classBlockingDates(s.assessments)]))
    expect(after).toEqual(before)
  })

  it('carries every exam across', () => {
    for (const sem of normalizeSemesters(INITIAL_SEMESTERS)) {
      const original = INITIAL_SEMESTERS.find(s => s.id === sem.id)
      expect(sem.assessments).toHaveLength(original.exams.length)
    }
  })

  it('is idempotent — running it twice changes nothing', () => {
    const once = normalizeSemesters(INITIAL_SEMESTERS)
    const twice = normalizeSemesters(once)
    expect(twice).toEqual(once)
  })

  it('does not re-migrate a semester that already has assessments', () => {
    const sem = {
      id: 1, exams: [{ id: 'old', subjectId: 1, date: '2020-01-01' }],
      assessments: [{ id: 'new', subjectId: 1, componentId: 'theory', score: 60, maxScore: 75 }],
      gradingScheme: DEFAULT_SCHEME,
    }
    // The stale `exams` array must not resurrect itself over real marks.
    expect(normalizeSemester(sem).assessments).toHaveLength(1)
    expect(normalizeSemester(sem).assessments[0].id).toBe('new')
  })

  it('adds a scheme to a semester migrated before schemes existed', () => {
    const sem = { id: 1, assessments: [] }
    expect(normalizeSemester(sem).gradingScheme).toBe(DEFAULT_SCHEME)
  })

  it('keeps the legacy exams array so an older build still renders', () => {
    const out = normalizeSemester(INITIAL_SEMESTERS[0])
    expect(out.exams).toEqual(INITIAL_SEMESTERS[0].exams)
  })

  it('does not mutate its input', () => {
    const snapshot = JSON.parse(JSON.stringify(INITIAL_SEMESTERS))
    normalizeSemesters(INITIAL_SEMESTERS)
    expect(INITIAL_SEMESTERS).toEqual(snapshot)
  })

  it('preserves subjects, timetable and dates untouched', () => {
    const out = normalizeSemester(INITIAL_SEMESTERS[0])
    expect(out.subjects).toBe(INITIAL_SEMESTERS[0].subjects)
    expect(out.timetable).toBe(INITIAL_SEMESTERS[0].timetable)
    expect(out.label).toBe(INITIAL_SEMESTERS[0].label)
  })

  it('survives a semester with no exams key at all', () => {
    const out = normalizeSemester({ id: 9, subjects: [], timetable: [] })
    expect(out.assessments).toEqual([])
    expect(classBlockingDates(out.assessments).size).toBe(0)
  })

  it('tolerates junk without throwing', () => {
    expect(normalizeSemester(null)).toBeNull()
    expect(normalizeSemester(undefined)).toBeUndefined()
    expect(normalizeSemesters(null)).toBeNull()
    expect(normalizeSemesters(undefined)).toBeUndefined()
  })
})

describe('the guarantee that assignments cannot cancel classes', () => {
  const migrated = normalizeSemester(INITIAL_SEMESTERS[0])

  it('a newly added assignment adds no blocking date', () => {
    const before = classBlockingDates(migrated.assessments)
    const withAssignment = {
      ...migrated,
      assessments: [...migrated.assessments, {
        id: 'a1', subjectId: 1, componentId: 'internal', partId: 'assignment',
        attempt: 1, score: 4, maxScore: 5,
        date: '2026-08-15',            // deliberately the same day as an exam
        blocksClasses: false,
      }],
    }
    expect(classBlockingDates(withAssignment.assessments)).toEqual(before)
  })

  it('a whole internals sitting on a teaching day suspends nothing', () => {
    const sitting = ['objective', 'subjective', 'assignment'].map((partId, i) => ({
      id: `s${i}`, subjectId: 1, componentId: 'internal', partId, attempt: 1,
      score: 8, maxScore: 10, date: '2026-09-10', blocksClasses: false,
    }))
    expect(classBlockingDates([...migrated.assessments, ...sitting]).has('2026-09-10')).toBe(false)
  })

  it('only the blocksClasses flag decides, not the presence of a date', () => {
    const dated = [
      { id: 'x', date: '2026-10-01', blocksClasses: true },
      { id: 'y', date: '2026-10-02', blocksClasses: false },
      { id: 'z', date: '2026-10-03' },                       // absent = falsy
    ]
    expect(classBlockingDates(dated)).toEqual(new Set(['2026-10-01']))
  })
})
