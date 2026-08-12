import { describe, it, expect } from 'vitest'
import {
  aggregateComponent,
  groupIntoAttempts,
  computeSubjectGrade,
  targetForGrade,
  nextBandTarget,
  pctToGradePoint,
  pctToGradeLabel,
  validateScheme,
  validateBands,
  resolveScheme,
  sittingMax,
  scaleOf,
  GRADE_BAND_PRESETS,
  JNTU_BANDS,
  migrateExamsToAssessments,
  classBlockingDates,
  isGraded,
  SCHEME_PRESETS,
  DEFAULT_SCHEME,
} from './grading.js'

const preset = (id) => SCHEME_PRESETS.find(p => p.id === id).scheme

/** One sitting of the real internals split: objective 10 + subjective 10 + assignment 5. */
const sitting = (attempt, objective, subjective, assignment) => [
  { id: `o${attempt}`, componentId: 'internal', partId: 'objective',  attempt, score: objective,  maxScore: 10 },
  { id: `s${attempt}`, componentId: 'internal', partId: 'subjective', attempt, score: subjective, maxScore: 10 },
  { id: `a${attempt}`, componentId: 'internal', partId: 'assignment', attempt, score: assignment, maxScore: 5  },
]
const theory = (score) => ({ id: 't', componentId: 'theory', partId: 'paper', attempt: 1, score, maxScore: 75 })

// ─────────────────────────────────────────────────────────────────
// The actual scheme: 100 = theory 75 + internals 25, where internals is
// two sittings of (objective 10 + subjective 10 + assignment 5), averaged.
// ─────────────────────────────────────────────────────────────────

describe('internals: two sittings of obj 10 + subj 10 + assign 5', () => {
  // Mid 1 = 8+7+4 = 19/25 · Mid 2 = 6+9+5 = 20/25
  const mids = [...sitting(1, 8, 7, 4), ...sitting(2, 6, 9, 5)]

  it('sums the three parts within each sitting', () => {
    const attempts = groupIntoAttempts(mids)
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toMatchObject({ attempt: 1, score: 19, max: 25 })
    expect(attempts[1]).toMatchObject({ attempt: 2, score: 20, max: 25 })
  })

  it('AVERAGE pools both sittings → 39/50 → 19.5 of 25', () => {
    const g = computeSubjectGrade(mids, preset('avg-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.fraction).toBeCloseTo(39 / 50, 5)
    expect(internals.marks).toBeCloseTo(19.5, 5)
  })

  it('BEST takes the higher sitting → 20/25 → 20 of 25', () => {
    const g = computeSubjectGrade(mids, preset('best-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.fraction).toBeCloseTo(20 / 25, 5)
    expect(internals.marks).toBeCloseTo(20, 5)
  })

  it('a sitting is worth 25 marks', () => {
    expect(sittingMax(preset('avg-internals-25-75').components[0])).toBe(25)
  })

  it('full subject: internals 19.5 + theory 60 → 79.5 → A', () => {
    const g = computeSubjectGrade([...mids, theory(60)], preset('avg-internals-25-75'))
    expect(g.locked).toBeCloseTo(79.5, 5)
    expect(g.isComplete).toBe(true)
    expect(pctToGradeLabel(g.locked)).toBe('A')
  })
})

// ── the reason best-of needs sitting-level grouping ──────────────

describe('best-of compares whole sittings, not individual papers', () => {
  // Mid 1 is lopsided: a great objective, a poor subjective.
  // Mid 1 = 10+2+3 = 15/25 · Mid 2 = 6+8+5 = 19/25
  const mids = [...sitting(1, 10, 2, 3), ...sitting(2, 6, 8, 5)]

  it('picks Mid 2 (19) over Mid 1 (15), not the best loose papers', () => {
    const g = computeSubjectGrade(mids, preset('best-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.marks).toBeCloseTo(19, 5)
    // Ranking loose entries would have grabbed Mid 1's 10/10 objective and
    // scored higher than any real sitting ever did.
    expect(internals.marks).toBeLessThan(20)
  })

  it('marks which sittings the rule actually counted', () => {
    const g = computeSubjectGrade(mids, preset('best-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.attempts.find(a => a.attempt === 2).counted).toBe(true)
    expect(internals.attempts.find(a => a.attempt === 1).counted).toBe(false)
  })

  it('average counts every sitting', () => {
    const g = computeSubjectGrade(mids, preset('avg-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.attempts.every(a => a.counted)).toBe(true)
  })

  it('best-of never scores below average-of on the same marks', () => {
    const cases = [[8, 7, 4, 6, 9, 5], [10, 2, 3, 6, 8, 5], [5, 5, 2, 5, 5, 2], [10, 10, 5, 0, 0, 0]]
    for (const [o1, s1, a1, o2, s2, a2] of cases) {
      const m = [...sitting(1, o1, s1, a1), ...sitting(2, o2, s2, a2)]
      const avg = computeSubjectGrade(m, preset('avg-internals-25-75')).locked
      const best = computeSubjectGrade(m, preset('best-internals-25-75')).locked
      expect(best).toBeGreaterThanOrEqual(avg - 1e-9)
    }
  })

  it('identical sittings make the two schemes agree', () => {
    const m = [...sitting(1, 7, 7, 4), ...sitting(2, 7, 7, 4)]
    expect(computeSubjectGrade(m, preset('avg-internals-25-75')).locked)
      .toBeCloseTo(computeSubjectGrade(m, preset('best-internals-25-75')).locked, 5)
  })
})

// ── per-part tracking ────────────────────────────────────────────

describe('per-part breakdown across sittings', () => {
  const mids = [...sitting(1, 8, 4, 5), ...sitting(2, 9, 3, 4)]
  const g = computeSubjectGrade(mids, preset('avg-internals-25-75'))
  const internals = g.byComponent.find(c => c.component.id === 'internal')

  it('totals each part over every sitting', () => {
    const part = (id) => internals.byPart.find(p => p.part.id === id)
    expect(part('objective')).toMatchObject({ score: 17, max: 20 })   // 8 + 9
    expect(part('subjective')).toMatchObject({ score: 7, max: 20 })   // 4 + 3
    expect(part('assignment')).toMatchObject({ score: 9, max: 10 })   // 5 + 4
  })

  it('shows subjective as the weak spot', () => {
    const weakest = [...internals.byPart].sort((a, b) => a.fraction - b.fraction)[0]
    expect(weakest.part.id).toBe('subjective')
    expect(weakest.fraction).toBeCloseTo(0.35, 5)
  })

  it('reports a part with no marks as null rather than zero', () => {
    const partial = computeSubjectGrade(sitting(1, 8, 6, null), preset('avg-internals-25-75'))
    const c = partial.byComponent.find(x => x.component.id === 'internal')
    expect(c.byPart.find(p => p.part.id === 'assignment').fraction).toBeNull()
  })
})

describe('half-marked sittings', () => {
  it('scores on what has been returned, not on unreturned papers as zero', () => {
    // Objective and subjective back (8 + 6 of 20), assignment not yet marked.
    const g = computeSubjectGrade(sitting(1, 8, 6, null), preset('avg-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.fraction).toBeCloseTo(14 / 20, 5)   // not 14/25
    expect(internals.marks).toBeCloseTo(17.5, 5)
  })

  it('ignores a sitting where nothing is marked yet', () => {
    const g = computeSubjectGrade([...sitting(1, 8, 7, 4), ...sitting(2, null, null, null)],
      preset('avg-internals-25-75'))
    const internals = g.byComponent.find(c => c.component.id === 'internal')
    expect(internals.attempts).toHaveLength(1)
    expect(internals.fraction).toBeCloseTo(19 / 25, 5)
  })
})

// ── standing, targets ────────────────────────────────────────────

describe('standing and targets', () => {
  const mids = [...sitting(1, 8, 7, 4), ...sitting(2, 6, 9, 5)]   // 19.5 of 25
  const g = computeSubjectGrade(mids, preset('avg-internals-25-75'))

  it('separates banked marks, projection and ceiling', () => {
    expect(g.locked).toBeCloseTo(19.5, 5)
    expect(g.current).toBeCloseTo(78, 5)
    expect(g.ceiling).toBeCloseTo(94.5, 5)
    expect(g.gradedWeight).toBe(25)
    expect(g.remainingWeight).toBe(75)
  })

  it('says what the theory paper has to be for an overall 70', () => {
    const t = targetForGrade(g, 70)
    expect(t.reachable).toBe(true)
    expect(t.needed).toBeCloseTo(67.333, 2)
  })

  it('flags an unreachable target rather than returning over 100', () => {
    expect(targetForGrade(g, 99).reachable).toBe(false)
  })

  it('aims from the projected standing, not banked marks', () => {
    // Projection is 78 (an A), so the next band is A+ at 80 — not the P band
    // at 40, which is all 19.5 banked marks would suggest.
    const n = nextBandTarget(g)
    expect(n.band.min).toBe(80)
    expect(n.label).toBe('A+')
    expect(n.needed).toBeCloseTo(80.667, 2)
  })

  it('accepts a band set as well as a bare array', () => {
    // scheme.bands is a set; a bare spread threw "is not iterable" here while
    // every other band reader accepted both forms.
    expect(() => nextBandTarget(g, JNTU_BANDS)).not.toThrow()
    expect(nextBandTarget(g, JNTU_BANDS).label).toBe(nextBandTarget(g, JNTU_BANDS.bands).label)
    expect(nextBandTarget(g, DEFAULT_SCHEME.bands).label).toBe('A+')
  })

  it('returns null at the top band', () => {
    const perfect = computeSubjectGrade([...sitting(1, 10, 10, 5), theory(75)], preset('avg-internals-25-75'))
    expect(perfect.locked).toBeCloseTo(100, 5)
    expect(nextBandTarget(perfect)).toBeNull()
  })

  it('reports nothing when nothing is graded', () => {
    const empty = computeSubjectGrade([], preset('avg-internals-25-75'))
    expect(empty.current).toBeNull()
    expect(empty.gradePoint).toBeNull()
    expect(empty.locked).toBe(0)
  })
})

// ── aggregation rules ────────────────────────────────────────────

describe('aggregateComponent', () => {
  const s = (attempt, score, max = 25) => ({ componentId: 'x', attempt, score, maxScore: max })

  it('best 2 of 3 drops the lowest sitting', () => {
    expect(aggregateComponent([s(1, 20), s(2, 15), s(3, 22)], { mode: 'best', n: 2 }))
      .toBeCloseTo(42 / 50, 5)
  })
  it('best n beyond the sitting count uses everything', () => {
    expect(aggregateComponent([s(1, 20)], { mode: 'best', n: 5 })).toBeCloseTo(0.8, 5)
  })
  it('latest uses the last sitting', () => {
    expect(aggregateComponent([s(1, 25), s(2, 10)], { mode: 'latest' })).toBeCloseTo(0.4, 5)
  })
  it('orders sittings numerically, so 10 follows 9', () => {
    const attempts = groupIntoAttempts([s(9, 5), s(10, 20), s(2, 1)])
    expect(attempts.map(a => a.attempt)).toEqual([2, 9, 10])
  })
  it('pools rather than averaging percentages when sittings differ in size', () => {
    // 100% of 10 and 50% of 90 → pooled 55/100, not the 75% mean
    expect(aggregateComponent([s(1, 10, 10), s(2, 45, 90)], { mode: 'average' })).toBeCloseTo(0.55, 5)
  })
  it('returns null when nothing is graded', () => {
    expect(aggregateComponent([], { mode: 'average' })).toBeNull()
    expect(aggregateComponent([s(1, null)], { mode: 'average' })).toBeNull()
  })
  it('treats a zero as a real mark, not a missing one', () => {
    expect(isGraded({ score: 0, maxScore: 10 })).toBe(true)
    expect(aggregateComponent([s(1, 0), s(2, 25)], { mode: 'average' })).toBeCloseTo(0.5, 5)
  })
  it('rejects an entry with no usable maximum', () => {
    expect(isGraded({ score: 10, maxScore: 0 })).toBe(false)
  })
  it('defaults a missing attempt key to a single sitting', () => {
    expect(groupIntoAttempts([{ componentId: 'x', score: 5, maxScore: 10 }])).toHaveLength(1)
  })
})

// ── schemes ──────────────────────────────────────────────────────

describe('schemes', () => {
  it('every preset weights to exactly 100', () => {
    for (const p of SCHEME_PRESETS) {
      const v = validateScheme(p.scheme)
      expect(v.total, `${p.id} totals ${v.total}`).toBe(100)
    }
  })
  it('every preset component declares parts that sum to a usable sitting', () => {
    for (const p of SCHEME_PRESETS) {
      for (const c of p.scheme.components) {
        expect(sittingMax(c), `${p.id}/${c.id}`).toBeGreaterThan(0)
      }
    }
  })
  it('catches weights that do not add up', () => {
    const v = validateScheme({ components: [{ weight: 30 }, { weight: 50 }] })
    expect(v.valid).toBe(false)
    expect(v.total).toBe(80)
  })
  it('the split and the rule are independent', () => {
    const avg = preset('avg-internals-25-75').components[0]
    const best = preset('best-internals-25-75').components[0]
    expect(avg.parts).toEqual(best.parts)          // same split
    expect(avg.rule).not.toEqual(best.rule)        // different rule
  })
  it('a subject override beats the semester default', () => {
    const semester = { gradingScheme: preset('avg-internals-25-75') }
    const subject = { gradingScheme: preset('internal-only') }
    expect(resolveScheme(semester, subject)).toBe(subject.gradingScheme)
  })
  it('a subject with no override inherits the semester', () => {
    const semester = { gradingScheme: preset('best-internals-25-75') }
    expect(resolveScheme(semester, { name: 'X' })).toBe(semester.gradingScheme)
  })
  it('falls back to the built-in default', () => {
    expect(resolveScheme(undefined, undefined)).toBe(DEFAULT_SCHEME)
  })
})

describe('grade bands — JNTU default', () => {
  it.each([[95, 10], [85, 9], [75, 8], [65, 7], [57, 6], [52, 5], [45, 4], [12, 0]])(
    '%i%% → gp %i', (pct, gp) => expect(pctToGradePoint(pct)).toBe(gp))
  it.each([[95, 'O'], [85, 'A+'], [75, 'A'], [65, 'B+'], [57, 'B'], [52, 'C'], [45, 'P'], [12, 'F']])(
    '%i%% → %s', (pct, label) => expect(pctToGradeLabel(pct)).toBe(label))
  it('band floors are inclusive', () => expect(pctToGradePoint(90)).toBe(10))
  it('returns null for no score', () => expect(pctToGradePoint(null)).toBeNull())
  it('100 lands in the top band', () => expect(pctToGradeLabel(100)).toBe('O'))
})

describe('grade bands — other institutions', () => {
  const bandSet = (id) => GRADE_BAND_PRESETS.find(b => b.id === id)

  it('a 4.0 scale reports its own labels and points, not JNTU\'s', () => {
    const four = bandSet('four-point')
    expect(pctToGradePoint(85, four)).toBe(3)
    expect(pctToGradeLabel(85, four)).toBe('B')
    expect(scaleOf(four)).toBe(4)
  })

  it('the same mark grades differently under different bands', () => {
    expect(pctToGradeLabel(78, bandSet('jntu-10'))).toBe('A')
    expect(pctToGradeLabel(78, bandSet('ten-point-pass-50'))).toBe('B')
    expect(pctToGradeLabel(78, bandSet('four-point'))).toBe('C')
  })

  it('a pass-at-50 scheme fails a 45 that JNTU would pass', () => {
    expect(pctToGradePoint(45, bandSet('jntu-10'))).toBe(4)
    expect(pctToGradePoint(45, bandSet('ten-point-pass-50'))).toBe(0)
  })

  it('every preset is internally valid', () => {
    for (const set of GRADE_BAND_PRESETS) {
      const v = validateBands(set)
      expect(v.errors, `${set.id}: ${v.errors.join(', ')}`).toEqual([])
    }
  })

  it('accepts a bare array as well as a band set', () => {
    expect(pctToGradePoint(85, JNTU_BANDS.bands)).toBe(9)
    expect(pctToGradePoint(85, JNTU_BANDS)).toBe(9)
  })

  it('tolerates bands supplied out of order', () => {
    const shuffled = [...JNTU_BANDS.bands].reverse()
    expect(pctToGradeLabel(85, shuffled)).toBe('A+')
  })

  it('the whole subject grade follows the chosen bands', () => {
    const mids = [...sitting(1, 8, 7, 4), ...sitting(2, 6, 9, 5)]
    const marks = [...mids, theory(60)]                       // 79.5 overall
    const jntu = computeSubjectGrade(marks, { ...preset('avg-internals-25-75'), bands: bandSet('jntu-10') })
    const four = computeSubjectGrade(marks, { ...preset('avg-internals-25-75'), bands: bandSet('four-point') })
    expect(jntu.gradePoint).toBe(8)   // A on a 10-point scale
    expect(four.gradePoint).toBe(2)   // C on a 4.0 scale
  })
})

describe('validateBands', () => {
  it('rejects bands that never reach 0', () => {
    const v = validateBands([{ min: 50, gp: 5, label: 'C' }, { min: 40, gp: 4, label: 'P' }])
    expect(v.valid).toBe(false)
    expect(v.errors).toContain('LOWEST BAND MUST START AT 0')
  })
  it('rejects duplicate floors, which would depend on array order', () => {
    const v = validateBands([{ min: 50, gp: 5, label: 'C' }, { min: 50, gp: 6, label: 'B' }, { min: 0, gp: 0, label: 'F' }])
    expect(v.errors).toContain('DUPLICATE FLOORS')
  })
  it('rejects a floor outside 0-100', () => {
    expect(validateBands([{ min: 120, gp: 5, label: 'C' }, { min: 0, gp: 0, label: 'F' }]).valid).toBe(false)
  })
  it('rejects a missing label', () => {
    const v = validateBands([{ min: 50, gp: 5 }, { min: 0, gp: 0, label: 'F' }])
    expect(v.errors.some(e => e.includes('MISSING LABEL'))).toBe(true)
  })
  it('rejects a grade point above the declared scale', () => {
    const v = validateBands({ scale: 4, bands: [{ min: 50, gp: 10, label: 'A' }, { min: 0, gp: 0, label: 'F' }] })
    expect(v.errors.some(e => e.includes('EXCEEDS SCALE'))).toBe(true)
  })
  it('accepts a valid custom set', () => {
    expect(validateBands({
      scale: 10,
      bands: [{ min: 75, gp: 10, label: 'EXCELLENT' }, { min: 35, gp: 5, label: 'PASS' }, { min: 0, gp: 0, label: 'FAIL' }],
    }).valid).toBe(true)
  })
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
  it("an assignment deadline must NOT suspend that day's classes", () => {
    const assessments = [
      ...migrateExamsToAssessments(exams),
      { id: 'a1', componentId: 'internal', partId: 'assignment', attempt: 1,
        date: '2026-09-01', blocksClasses: false, score: 4, maxScore: 5 },
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
