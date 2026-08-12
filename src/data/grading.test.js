import { describe, it, expect } from 'vitest'
import {
  aggregateComponent,
  computeSubjectGrade,
  targetForGrade,
  nextBandTarget,
  pctToGradePoint,
  pctToGradeLabel,
  validateScheme,
  resolveScheme,
  migrateExamsToAssessments,
  classBlockingDates,
  isGraded,
  SCHEME_PRESETS,
  DEFAULT_SCHEME,
} from './grading.js'

const preset = (id) => SCHEME_PRESETS.find(p => p.id === id).scheme

const mid = (n, score) => ({ id: `m${n}`, componentId: 'mid', title: `Mid ${n}`, score, maxScore: 50 })
const final = (score) => ({ id: 'f', componentId: 'final', title: 'Final', score, maxScore: 75 })

// ── The two real-world schemes this feature exists for ────────────
// Same marks, same subject, one field different. Mid 1 = 40/50, Mid 2 = 30/50.

describe('average-of-mids vs best-of-mids (25 internal + 75 external)', () => {
  const mids = [mid(1, 40), mid(2, 30)]

  it('AVERAGE: both mids pooled → 70/100 → 17.5 of 25 internal marks', () => {
    const g = computeSubjectGrade(mids, preset('avg-mids-25-75'))
    const mids_ = g.byComponent.find(c => c.component.id === 'mid')
    expect(mids_.fraction).toBeCloseTo(0.70, 5)
    expect(mids_.points).toBeCloseTo(17.5, 5)
    expect(g.locked).toBeCloseTo(17.5, 5)
  })

  it('BEST: only the higher mid counts → 40/50 → 20 of 25 internal marks', () => {
    const g = computeSubjectGrade(mids, preset('best-mids-25-75'))
    const mids_ = g.byComponent.find(c => c.component.id === 'mid')
    expect(mids_.fraction).toBeCloseTo(0.80, 5)
    expect(mids_.points).toBeCloseTo(20, 5)
    expect(g.locked).toBeCloseTo(20, 5)
  })

  it('the two schemes differ by exactly 2.5 marks on identical input', () => {
    const avg = computeSubjectGrade(mids, preset('avg-mids-25-75')).locked
    const best = computeSubjectGrade(mids, preset('best-mids-25-75')).locked
    expect(best - avg).toBeCloseTo(2.5, 5)
  })

  it('best-of never scores below average-of on the same marks', () => {
    for (const [a, b] of [[40, 30], [10, 49], [25, 25], [0, 50], [50, 50]]) {
      const marks = [mid(1, a), mid(2, b)]
      const avg = computeSubjectGrade(marks, preset('avg-mids-25-75')).locked
      const best = computeSubjectGrade(marks, preset('best-mids-25-75')).locked
      expect(best).toBeGreaterThanOrEqual(avg - 1e-9)
    }
  })

  it('identical mids make the two schemes agree', () => {
    const marks = [mid(1, 35), mid(2, 35)]
    expect(computeSubjectGrade(marks, preset('avg-mids-25-75')).locked)
      .toBeCloseTo(computeSubjectGrade(marks, preset('best-mids-25-75')).locked, 5)
  })

  it('full term: 40 + 30 mids and 60/75 final → 65.5 → A', () => {
    const g = computeSubjectGrade([...mids, final(60)], preset('avg-mids-25-75'))
    expect(g.locked).toBeCloseTo(17.5 + 60, 5)      // 77.5
    expect(g.isComplete).toBe(true)
    expect(pctToGradeLabel(g.locked)).toBe('A')     // 70-79
  })
})

// ── current vs locked vs ceiling ─────────────────────────────────

describe('standing before everything is graded', () => {
  const g = computeSubjectGrade([mid(1, 40), mid(2, 30)], preset('avg-mids-25-75'))

  it('locked counts only banked marks', () => expect(g.locked).toBeCloseTo(17.5, 5))
  it('current normalises over graded weight only', () => expect(g.current).toBeCloseTo(70, 5))
  it('ceiling adds every remaining mark', () => expect(g.ceiling).toBeCloseTo(92.5, 5))
  it('knows what is still outstanding', () => {
    expect(g.gradedWeight).toBe(25)
    expect(g.remainingWeight).toBe(75)
    expect(g.isComplete).toBe(false)
  })
  it('reports nothing when nothing is graded', () => {
    const empty = computeSubjectGrade([], preset('avg-mids-25-75'))
    expect(empty.current).toBeNull()
    expect(empty.gradePoint).toBeNull()
    expect(empty.locked).toBe(0)
  })
})

// ── "what do I need on the final" ────────────────────────────────

describe('targetForGrade', () => {
  const g = computeSubjectGrade([mid(1, 40), mid(2, 30)], preset('avg-mids-25-75'))

  it('needs 70% of the external paper to reach 70 overall', () => {
    const t = targetForGrade(g, 70)
    expect(t.reachable).toBe(true)
    expect(t.needed).toBeCloseTo(70, 5)   // (70 - 17.5) / 75 * 100
  })

  it('flags an unreachable target instead of returning >100', () => {
    const t = targetForGrade(g, 95)
    expect(t.reachable).toBe(false)
    expect(t.needed).toBeGreaterThan(100)
  })

  it('reports a target already banked', () => {
    const t = targetForGrade(g, 15)
    expect(t.alreadyAchieved).toBe(true)
    expect(t.needed).toBe(0)
  })

  it('is unreachable once nothing is left to grade', () => {
    const done = computeSubjectGrade([mid(1, 40), mid(2, 30), final(40)], preset('avg-mids-25-75'))
    expect(targetForGrade(done, 90).reachable).toBe(false)
  })

  it('nextBandTarget aims from where the subject is heading, not marks banked', () => {
    // Projected standing is 70 (an A), so the next band up is A+ at 80 —
    // NOT the P band at 40, which is all the 17.5 banked marks would suggest.
    const n = nextBandTarget(g)
    expect(n.band.min).toBe(80)
    expect(n.label).toBe('A+')
    // Still costed against banked marks: (80 - 17.5) / 75 * 100
    expect(n.needed).toBeCloseTo(83.333, 2)
    expect(n.reachable).toBe(true)
  })

  it('nextBandTarget measures from final marks once the subject is complete', () => {
    const done = computeSubjectGrade([mid(1, 40), mid(2, 30), final(60)], preset('avg-mids-25-75'))
    expect(done.isComplete).toBe(true)
    expect(done.locked).toBeCloseTo(77.5, 5)
    const n = nextBandTarget(done)
    expect(n.band.min).toBe(80)          // 77.5 → next is A+
    expect(n.reachable).toBe(false)      // nothing left to earn it with
  })

  it('returns null at the top band', () => {
    const perfect = computeSubjectGrade([mid(1, 50), mid(2, 50), final(75)], preset('avg-mids-25-75'))
    expect(perfect.locked).toBeCloseTo(100, 5)
    expect(nextBandTarget(perfect)).toBeNull()
  })
})

// ── aggregation rules ────────────────────────────────────────────

describe('aggregateComponent', () => {
  it('ignores ungraded entries', () => {
    expect(aggregateComponent([mid(1, 40), mid(2, null)], { mode: 'average' })).toBeCloseTo(0.8, 5)
  })
  it('returns null when nothing is graded', () => {
    expect(aggregateComponent([mid(1, null)], { mode: 'average' })).toBeNull()
    expect(aggregateComponent([], { mode: 'average' })).toBeNull()
  })
  it('best 2 of 3 drops the lowest', () => {
    const r = aggregateComponent([mid(1, 40), mid(2, 30), mid(3, 45)], { mode: 'best', n: 2 })
    expect(r).toBeCloseTo(85 / 100, 5)
  })
  it('best n larger than the entry count uses everything', () => {
    expect(aggregateComponent([mid(1, 40)], { mode: 'best', n: 5 })).toBeCloseTo(0.8, 5)
  })
  it('pools rather than averaging percentages when maximums differ', () => {
    const entries = [
      { componentId: 'x', score: 10, maxScore: 10 },   // 100%
      { componentId: 'x', score: 45, maxScore: 90 },   // 50%
    ]
    // pooled 55/100 = 0.55, not the 0.75 mean of the two percentages
    expect(aggregateComponent(entries, { mode: 'average' })).toBeCloseTo(0.55, 5)
  })
  it('latest picks the most recent dated entry', () => {
    const entries = [
      { componentId: 'x', score: 10, maxScore: 50, date: '2026-01-10' },
      { componentId: 'x', score: 40, maxScore: 50, date: '2026-03-01' },
    ]
    expect(aggregateComponent(entries, { mode: 'latest' })).toBeCloseTo(0.8, 5)
  })
  it('treats a zero mark as graded, not as missing', () => {
    expect(isGraded({ score: 0, maxScore: 50 })).toBe(true)
    expect(aggregateComponent([mid(1, 0), mid(2, 50)], { mode: 'average' })).toBeCloseTo(0.5, 5)
  })
  it('rejects entries with no usable maximum', () => {
    expect(isGraded({ score: 10, maxScore: 0 })).toBe(false)
  })
})

// ── scheme plumbing ──────────────────────────────────────────────

describe('schemes', () => {
  it('every preset weights to exactly 100', () => {
    for (const p of SCHEME_PRESETS) {
      const v = validateScheme(p.scheme)
      expect(v.total, `${p.id} totals ${v.total}`).toBe(100)
      expect(v.valid).toBe(true)
    }
  })
  it('catches weights that do not add up', () => {
    const v = validateScheme({ components: [{ weight: 30 }, { weight: 50 }] })
    expect(v.valid).toBe(false)
    expect(v.total).toBe(80)
  })
  it('a subject override beats the semester default', () => {
    const semester = { gradingScheme: preset('avg-mids-25-75') }
    const subject = { gradingScheme: preset('internal-only') }
    expect(resolveScheme(semester, subject)).toBe(subject.gradingScheme)
  })
  it('a subject with no override inherits the semester', () => {
    const semester = { gradingScheme: preset('best-mids-25-75') }
    expect(resolveScheme(semester, { name: 'X' })).toBe(semester.gradingScheme)
  })
  it('falls back to the built-in default', () => {
    expect(resolveScheme(undefined, undefined)).toBe(DEFAULT_SCHEME)
  })
})

describe('grade bands', () => {
  it.each([[95, 10], [85, 9], [75, 8], [65, 7], [57, 6], [52, 5], [45, 4], [12, 0]])(
    '%i%% → gp %i', (pct, gp) => expect(pctToGradePoint(pct)).toBe(gp))
  it('band floors are inclusive', () => expect(pctToGradePoint(90)).toBe(10))
  it('returns null for no score', () => expect(pctToGradePoint(null)).toBeNull())
})

// ── migration: the bit that protects attendance ──────────────────

describe('exam → assessment migration', () => {
  const exams = [
    { id: 'ex-1', subjectId: 1, date: '2026-08-15', startTime: '09:00', endTime: '11:00', room: 'HALL A', notes: 'Unit II' },
    { id: 'ex-2', subjectId: 2, date: '2026-08-20', startTime: '14:00', endTime: '16:00', room: 'HALL B', notes: '' },
  ]

  it('preserves every scheduled exam', () => {
    const out = migrateExamsToAssessments(exams)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 'ex-1', subjectId: 1, date: '2026-08-15', room: 'HALL A' })
  })
  it('leaves migrated exams ungraded rather than inventing marks', () => {
    expect(migrateExamsToAssessments(exams).every(a => a.score === null)).toBe(true)
  })
  it('keeps migrated exams class-blocking so attendance is unchanged', () => {
    const out = migrateExamsToAssessments(exams)
    expect(out.every(a => a.blocksClasses)).toBe(true)
    expect(classBlockingDates(out)).toEqual(new Set(['2026-08-15', '2026-08-20']))
  })
  it('an assignment deadline must NOT suspend that day\'s classes', () => {
    const assessments = [
      ...migrateExamsToAssessments(exams),
      { id: 'a1', componentId: 'assignment', date: '2026-09-01', blocksClasses: false, score: 8, maxScore: 10 },
    ]
    expect(classBlockingDates(assessments).has('2026-09-01')).toBe(false)
    expect(classBlockingDates(assessments).size).toBe(2)
  })
  it('an undated assessment contributes no blocking date', () => {
    expect(classBlockingDates([{ id: 'x', blocksClasses: true, date: '' }]).size).toBe(0)
  })
  it('handles a semester with no exams', () => {
    expect(migrateExamsToAssessments(undefined)).toEqual([])
  })
})
