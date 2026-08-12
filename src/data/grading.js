// ─── GRADING / GRADEBOOK ─────────────────────────────────────────
// Pure math for assessment marks → component scores → weighted subject
// total → letter grade → grade point.
//
// The whole module is side-effect free so it can be unit-tested without a
// renderer, same as attendanceMath.js.

import { GRADE_MAP } from './constants.js'

// ── Grade bands ──────────────────────────────────────────────────
//
// Percentage floor → grade point → letter. Entirely institution-specific,
// so bands live in the scheme and are editable. Each band carries its own
// label rather than deriving one from GRADE_MAP, because a 4.0-scale
// university has no grade point 9 to look up.
//
// A band set also declares its `scale` (the maximum grade point), which is
// what the GPA badge should print instead of a hardcoded "/ 10.0".

/** JNTU 10-point absolute scale. Confirmed against the user's institution. */
export const JNTU_BANDS = {
  id: 'jntu-10',
  label: 'JNTU · 10-POINT',
  scale: 10,
  bands: [
    { min: 90, gp: 10, label: 'O'  },
    { min: 80, gp: 9,  label: 'A+' },
    { min: 70, gp: 8,  label: 'A'  },
    { min: 60, gp: 7,  label: 'B+' },
    { min: 55, gp: 6,  label: 'B'  },
    { min: 50, gp: 5,  label: 'C'  },
    { min: 40, gp: 4,  label: 'P'  },
    { min: 0,  gp: 0,  label: 'F'  },
  ],
}

/**
 * Starting points, not authoritative claims about any institution.
 * Only the JNTU set has been confirmed; everything else is a common shape
 * to edit from. Check yours against your own handbook.
 */
export const GRADE_BAND_PRESETS = [
  JNTU_BANDS,
  {
    id: 'ten-point-pass-50',
    label: '10-POINT · PASS AT 50',
    scale: 10,
    bands: [
      { min: 90, gp: 10, label: 'S' },
      { min: 80, gp: 9,  label: 'A' },
      { min: 70, gp: 8,  label: 'B' },
      { min: 60, gp: 7,  label: 'C' },
      { min: 55, gp: 6,  label: 'D' },
      { min: 50, gp: 5,  label: 'E' },
      { min: 0,  gp: 0,  label: 'F' },
    ],
  },
  {
    id: 'four-point',
    label: '4.0 SCALE',
    scale: 4,
    bands: [
      { min: 90, gp: 4, label: 'A' },
      { min: 80, gp: 3, label: 'B' },
      { min: 70, gp: 2, label: 'C' },
      { min: 60, gp: 1, label: 'D' },
      { min: 0,  gp: 0, label: 'F' },
    ],
  },
]

export const DEFAULT_BAND_SET = JNTU_BANDS
export const DEFAULT_GRADE_BANDS = JNTU_BANDS.bands

/** Accepts either a band set ({scale, bands}) or a bare bands array. */
const bandsOf = (b) => (Array.isArray(b) ? b : b?.bands) ?? DEFAULT_GRADE_BANDS
export const scaleOf = (b) => (Array.isArray(b) ? null : b?.scale) ?? DEFAULT_BAND_SET.scale

/** Percentage → grade point (highest matching floor). */
export function pctToGradePoint(pct, bands = DEFAULT_GRADE_BANDS) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
  const list = [...bandsOf(bands)].sort((a, b) => b.min - a.min)
  for (const band of list) if (pct >= band.min) return band.gp
  return 0
}

/** Percentage → the matching band, so callers can read its label directly. */
export function pctToBand(pct, bands = DEFAULT_GRADE_BANDS) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null
  const list = [...bandsOf(bands)].sort((a, b) => b.min - a.min)
  return list.find(band => pct >= band.min) ?? list[list.length - 1] ?? null
}

/**
 * Grade point → label. Prefers the band set's own labels; falls back to the
 * legacy GRADE_MAP so the existing roster dropdown keeps working.
 */
export function gradePointToLabel(gp, bands = DEFAULT_GRADE_BANDS) {
  if (gp === null || gp === undefined) return '—'
  const hit = bandsOf(bands).find(b => b.gp === gp)
  if (hit?.label) return hit.label
  return GRADE_MAP.find(g => g.gp === gp)?.label ?? String(gp)
}

/** Percentage → letter label, in one step. */
export const pctToGradeLabel = (pct, bands) => pctToBand(pct, bands)?.label ?? '—'

/**
 * Is an edited band set usable? Bands must reach down to 0 so every
 * percentage lands somewhere, and duplicate floors would make the result
 * depend on array order.
 */
export function validateBands(input) {
  const list = bandsOf(input)
  const errors = []
  if (!Array.isArray(list) || list.length === 0) return { valid: false, errors: ['NO BANDS DEFINED'] }

  for (const b of list) {
    const min = Number(b.min)
    if (!Number.isFinite(min) || min < 0 || min > 100) errors.push(`INVALID FLOOR: ${b.min}`)
    if (!Number.isFinite(Number(b.gp))) errors.push(`INVALID GRADE POINT FOR ${b.label ?? b.min}`)
    if (!b.label) errors.push(`MISSING LABEL FOR FLOOR ${b.min}`)
  }
  const floors = list.map(b => Number(b.min))
  if (new Set(floors).size !== floors.length) errors.push('DUPLICATE FLOORS')
  if (Math.min(...floors) !== 0) errors.push('LOWEST BAND MUST START AT 0')

  const scale = scaleOf(input)
  const maxGp = Math.max(...list.map(b => Number(b.gp) || 0))
  if (maxGp > scale) errors.push(`GRADE POINT ${maxGp} EXCEEDS SCALE ${scale}`)

  return { valid: errors.length === 0, errors }
}

// ── Schemes ──────────────────────────────────────────────────────
//
// A component's `weight` is literally its marks out of 100, so "25 internals
// + 75 external" is expressed directly rather than as an abstract percentage.
// Raw marks stay in their own units and are scaled onto that weight.
//
// A component declares `parts` — the split within one sitting — each with its
// own maximum. Parts are summed per sitting, then the `rule` decides how
// sittings combine.
//
// The split and the rule are independent knobs, because they vary
// independently: two colleges can share "objective 10 + subjective 10 +
// assignment 5" while one averages the two mids and the other takes the
// better one. Baking either in would force a rewrite for the next
// institution.

/** Objective 10 + subjective 10 + assignment 5, taken twice, averaged → 25. */
const INTERNALS_25 = {
  id: 'internal',
  label: 'INTERNALS',
  weight: 25,
  rule: { mode: 'average' },
  parts: [
    { id: 'objective',  label: 'OBJECTIVE',  max: 10 },
    { id: 'subjective', label: 'SUBJECTIVE', max: 10 },
    { id: 'assignment', label: 'ASSIGNMENT', max: 5  },
  ],
}

const THEORY_75 = {
  id: 'theory',
  label: 'THEORY',
  weight: 75,
  rule: { mode: 'average' },
  parts: [{ id: 'paper', label: 'PAPER', max: 75 }],
}

export const DEFAULT_SCHEME = {
  components: [INTERNALS_25, THEORY_75],
  bands: DEFAULT_BAND_SET,
}

/** Ready-made schemes offered in the scheme editor. */
export const SCHEME_PRESETS = [
  {
    id: 'avg-internals-25-75',
    label: 'AVG OF MIDS · 25 + 75',
    description: 'Two sittings of objective 10 + subjective 10 + assignment 5, averaged into 25 internal marks. Theory out of 75.',
    scheme: { components: [INTERNALS_25, THEORY_75], bands: DEFAULT_BAND_SET },
  },
  {
    id: 'best-internals-25-75',
    label: 'BEST OF MIDS · 25 + 75',
    description: 'Same split, but only the higher sitting counts toward the 25 internal marks.',
    scheme: {
      components: [{ ...INTERNALS_25, rule: { mode: 'best', n: 1 } }, THEORY_75],
      bands: DEFAULT_BAND_SET,
    },
  },
  {
    id: 'mids-assign-final',
    label: 'MIDS + ASSIGNMENTS + FINAL',
    description: 'Separate assignment component. Best 2 of 3 mids (30), assignments (20), final (50).',
    scheme: {
      components: [
        { id: 'mid',        label: 'MIDS',        weight: 30, rule: { mode: 'best', n: 2 },
          parts: [{ id: 'paper', label: 'PAPER', max: 50 }] },
        { id: 'assignment', label: 'ASSIGNMENTS', weight: 20, rule: { mode: 'average' },
          parts: [{ id: 'work', label: 'WORK', max: 10 }] },
        { id: 'final',      label: 'FINAL',       weight: 50, rule: { mode: 'average' },
          parts: [{ id: 'paper', label: 'PAPER', max: 100 }] },
      ],
      bands: DEFAULT_BAND_SET,
    },
  },
  {
    id: 'internal-only',
    label: 'FULLY INTERNAL',
    description: 'Labs and project subjects with no external paper.',
    scheme: {
      components: [
        { id: 'internal', label: 'INTERNAL', weight: 60, rule: { mode: 'average' },
          parts: [{ id: 'record', label: 'RECORD', max: 30 }, { id: 'execution', label: 'EXECUTION', max: 30 }] },
        { id: 'viva',     label: 'VIVA',     weight: 40, rule: { mode: 'average' },
          parts: [{ id: 'viva', label: 'VIVA', max: 40 }] },
      ],
      bands: DEFAULT_BAND_SET,
    },
  },
]

/** Total marks in one sitting of a component (the sum of its parts). */
export const sittingMax = (component) =>
  (component?.parts ?? []).reduce((a, p) => a + (Number(p.max) || 0), 0)

export const AGGREGATION_MODES = ['average', 'best', 'latest']

export const AGGREGATION_LABELS = {
  average: 'AVERAGE OF ALL',
  best:    'BEST N',
  latest:  'MOST RECENT',
}

/**
 * The scheme that applies to one subject: its own override if it has one,
 * otherwise the semester default, otherwise the built-in default.
 */
export function resolveScheme(semester, subject) {
  return subject?.gradingScheme ?? semester?.gradingScheme ?? DEFAULT_SCHEME
}

/** Do a scheme's weights add up? Returns { valid, total }. */
export function validateScheme(scheme) {
  const total = (scheme?.components ?? []).reduce((a, c) => a + (Number(c.weight) || 0), 0)
  return { valid: Math.abs(total - 100) < 0.001, total: Math.round(total * 100) / 100 }
}

// ── Aggregation ──────────────────────────────────────────────────

/** An assessment counts toward a score only once it has a usable mark. */
export const isGraded = (a) =>
  a && a.score !== null && a.score !== undefined && a.score !== '' &&
  Number.isFinite(Number(a.score)) && Number(a.maxScore) > 0

/**
 * Group a component's entries into sittings ("attempt 1", "attempt 2", …).
 *
 * A sitting is the unit the average/best rule operates on, and it is not the
 * same thing as a single mark. One mid can be split into objective +
 * subjective + assignment; "best of the mids" means those parts are summed
 * per sitting FIRST and the sitting totals are then compared. Ranking the
 * individual papers instead would happily pick two halves of the same mid.
 *
 * Ungraded parts are excluded from a sitting rather than counted as zero, so
 * a half-marked mid reports the standing on what has actually been returned.
 */
export function groupIntoAttempts(entries) {
  const byAttempt = new Map()
  for (const e of (entries ?? [])) {
    if (!isGraded(e)) continue
    const key = e.attempt ?? 1
    if (!byAttempt.has(key)) byAttempt.set(key, { attempt: key, parts: [], score: 0, max: 0 })
    const group = byAttempt.get(key)
    group.parts.push(e)
    group.score += Number(e.score)
    group.max += Number(e.maxScore)
  }
  return [...byAttempt.values()]
    .filter(g => g.max > 0)
    .map(g => ({ ...g, fraction: g.score / g.max }))
    .sort((a, b) => String(a.attempt).localeCompare(String(b.attempt), undefined, { numeric: true }))
}

/**
 * Collapse one component's entries into a single fraction (0..1).
 *
 * Sittings are pooled (Σscore / Σmax) rather than averaged as percentages,
 * which is the defensible reading when sittings carry different maximums.
 * Returns null when nothing in the component is graded yet.
 */
export function aggregateComponent(entries, rule = { mode: 'average' }) {
  const attempts = groupIntoAttempts(entries)
  if (attempts.length === 0) return null

  let selected = attempts
  if (rule?.mode === 'best') {
    const n = Math.max(1, Number(rule.n) || 1)
    selected = [...attempts].sort((a, b) => b.fraction - a.fraction).slice(0, n)
  } else if (rule?.mode === 'latest') {
    // Sittings sort by attempt key, so the last one is the most recent.
    selected = attempts.slice(-1)
  }

  const score = selected.reduce((a, g) => a + g.score, 0)
  const max = selected.reduce((a, g) => a + g.max, 0)
  return max > 0 ? score / max : null
}

// ── Subject roll-up ──────────────────────────────────────────────

/**
 * Weighted standing for one subject.
 *
 * Distinguishes three numbers that are easy to conflate:
 *   current   — of the weight graded so far, what fraction was earned.
 *               "How am I doing?" Undefined until something is graded.
 *   locked    — absolute points banked out of the full 100. Only falls if
 *               you do badly; ungraded work sits at 0 here.
 *   ceiling   — locked + all remaining weight, i.e. the best still reachable.
 */
export function computeSubjectGrade(assessments, scheme = DEFAULT_SCHEME) {
  const components = scheme?.components ?? []
  const bands = scheme?.bands ?? DEFAULT_GRADE_BANDS

  const byComponent = components.map(c => {
    const entries = (assessments ?? []).filter(a => a.componentId === c.id)
    const fraction = aggregateComponent(entries, c.rule)
    const weight = Number(c.weight) || 0
    const attempts = groupIntoAttempts(entries)

    // Which sittings the rule actually used — the UI greys out a dropped mid
    // rather than leaving the student to work out why the total looks high.
    const counted = new Set(
      c.rule?.mode === 'best'
        ? [...attempts].sort((a, b) => b.fraction - a.fraction)
            .slice(0, Math.max(1, Number(c.rule.n) || 1)).map(a => a.attempt)
        : c.rule?.mode === 'latest'
          ? attempts.slice(-1).map(a => a.attempt)
          : attempts.map(a => a.attempt)
    )

    // Per-part standing across every sitting: "objective 14/20 over both mids".
    // This is the answer to "where am I actually losing marks".
    const byPart = (c.parts ?? []).map(p => {
      const marks = entries.filter(e => e.partId === p.id && isGraded(e))
      const score = marks.reduce((a, e) => a + Number(e.score), 0)
      const max = marks.reduce((a, e) => a + Number(e.maxScore), 0)
      return { part: p, score, max, count: marks.length, fraction: max > 0 ? score / max : null }
    })

    return {
      component: c,
      entries,
      attempts: attempts.map(a => ({ ...a, counted: counted.has(a.attempt) })),
      byPart,
      sittingMax: sittingMax(c),
      gradedCount: entries.filter(isGraded).length,
      totalCount: entries.length,
      fraction,                                          // 0..1 or null
      pct: fraction === null ? null : fraction * 100,
      marks: fraction === null ? null : fraction * weight, // marks earned of `weight`
      points: fraction === null ? 0 : fraction * weight,   // contribution to the 100
      weight,
    }
  })

  const gradedWeight = byComponent.reduce((a, c) => a + (c.fraction === null ? 0 : c.weight), 0)
  const remainingWeight = byComponent.reduce((a, c) => a + (c.fraction === null ? c.weight : 0), 0)
  const locked = byComponent.reduce((a, c) => a + c.points, 0)

  return {
    byComponent,
    gradedWeight,
    remainingWeight,
    locked,                                                   // 0..100
    ceiling: locked + remainingWeight,                        // 0..100
    current: gradedWeight > 0 ? (locked / gradedWeight) * 100 : null,
    isComplete: remainingWeight === 0 && gradedWeight > 0,
    gradePoint: gradedWeight > 0 ? pctToGradePoint(locked, bands) : null,
    projectedGradePoint: gradedWeight > 0 ? pctToGradePoint((locked / gradedWeight) * 100, bands) : null,
  }
}

/**
 * What average percentage is needed across everything still ungraded to
 * finish on `targetPct`.
 *
 * Mirrors the attendance tab's recovery-path idea: the question a student
 * actually asks is "what do I need on the final", not "what is my mean".
 *
 * Returns:
 *   { reachable: false }                      target is out of reach
 *   { alreadyAchieved: true }                 locked in regardless
 *   { needed, reachable: true }               needed % across remaining work
 */
export function targetForGrade(grade, targetPct) {
  const { locked, remainingWeight } = grade
  if (locked >= targetPct) return { alreadyAchieved: true, reachable: true, needed: 0 }
  if (remainingWeight <= 0) return { alreadyAchieved: false, reachable: false, needed: null }

  const needed = ((targetPct - locked) / remainingWeight) * 100
  if (needed > 100) return { alreadyAchieved: false, reachable: false, needed }
  return { alreadyAchieved: false, reachable: true, needed }
}

/**
 * The next grade band worth aiming for, and what it takes to get there.
 *
 * "Next" is measured from where the subject is *heading* (the projected
 * standing), not from marks banked so far. Mid-term a student with 70% in
 * their mids has only 17.5 points banked out of 100, so anchoring on that
 * would announce "next grade: P" to someone on course for an A — true, and
 * useless. The target arithmetic still works off banked marks, because
 * that is what actually has to be made up.
 */
export function nextBandTarget(grade, bands = DEFAULT_GRADE_BANDS) {
  const standing = grade.isComplete ? grade.locked : (grade.current ?? grade.locked)
  const ascending = [...bands].sort((a, b) => a.min - b.min)
  const next = ascending.find(b => b.min > standing)
  if (!next) return null
  return { band: next, label: gradePointToLabel(next.gp), ...targetForGrade(grade, next.min) }
}

// ── Migration ────────────────────────────────────────────────────

/**
 * exams[] → assessments[].
 *
 * Existing exams are scheduled sit-down papers, so they keep blocksClasses:
 * true and stay in examDates. That flag is the whole point of the split —
 * without it an assignment deadline would suspend that day's classes and
 * silently move the attendance percentage.
 */
export function migrateExamsToAssessments(exams = []) {
  return exams.map(e => ({
    id: e.id,
    subjectId: e.subjectId,
    componentId: 'final',
    title: e.title ?? 'EXAM',
    score: null,
    maxScore: 100,
    date: e.date ?? '',
    startTime: e.startTime ?? '',
    endTime: e.endTime ?? '',
    room: e.room ?? '',
    blocksClasses: true,
    notes: e.notes ?? '',
  }))
}

/** Only assessments that actually replace a day's classes feed examDates. */
export const classBlockingDates = (assessments = []) =>
  new Set(assessments.filter(a => a.blocksClasses && a.date).map(a => a.date))
