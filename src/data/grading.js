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
  rounding: 'none',
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

// ── Rounding ─────────────────────────────────────────────────────
//
// Some universities round each component's marks to a whole number before
// adding them up: internals averaging 19.5 out of 25 are recorded as 20, and
// that half mark can cross a grade band. Others keep the fraction.
//
// This is an institutional rule of exactly the same kind as the aggregation
// mode and the bands, so it lives on the scheme, not in app settings — one
// install can then hold a semester that rounds and a subject that does not,
// the same way it already holds "average of mids" beside "best of mids".

export const ROUNDING_MODES = ['none', 'half-up']

export const ROUNDING_LABELS = {
  none:      'EXACT',
  'half-up': 'ROUND ½ UP',
}

export const ROUNDING_BLURBS = {
  none:      'Each component keeps its exact marks. Two mids of 19 and 20 count as 19.5 of 25.',
  'half-up': 'Each component is rounded to a whole number before the components are added. Two mids of 19 and 20 count as 20 of 25.',
}

/**
 * Apply a scheme's rounding rule to one component's earned marks.
 *
 * `Math.round` is already half-up across the non-negative range marks occupy.
 * The `toFixed` pass is not decoration: marks arrive from `score / max *
 * weight`, and two mids totalling 29 of 50 weighted to 25 is exactly 14.5 but
 * reaches here as 14.499999999999998 — a plain Math.round returns 14, losing
 * the student the mark this option exists to give them. 21 such triples exist
 * across the realistic range of scores, maxima and weights.
 */
export function roundMarks(marks, rounding = 'none') {
  if (marks === null || marks === undefined || !Number.isFinite(marks)) return marks
  if (rounding !== 'half-up') return marks
  return Math.round(Number(marks.toFixed(6)))
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
  const rounding = scheme?.rounding ?? 'none'

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

    // The scheme's rounding rule applies HERE, to each component's marks, and
    // the rounded figure is what gets added into the 100 — which is what a
    // university that rounds actually does. `rawMarks` is kept so the UI can
    // show the arithmetic behind a mark that moved.
    const rawMarks = fraction === null ? null : fraction * weight
    const marks = roundMarks(rawMarks, rounding)

    return {
      component: c,
      entries,
      attempts: attempts.map(a => ({ ...a, counted: counted.has(a.attempt) })),
      byPart,
      sittingMax: sittingMax(c),
      gradedCount: entries.filter(isGraded).length,
      totalCount: entries.length,
      fraction,                                          // 0..1 or null — as measured
      pct: fraction === null ? null : fraction * 100,
      rawMarks,                                          // before rounding
      marks,                                             // marks earned of `weight`
      points: marks === null ? 0 : marks,                // contribution to the 100
      rounded: rawMarks !== null && marks !== rawMarks,
      weight,
    }
  })

  const gradedWeight = byComponent.reduce((a, c) => a + (c.fraction === null ? 0 : c.weight), 0)
  const remainingWeight = byComponent.reduce((a, c) => a + (c.fraction === null ? c.weight : 0), 0)
  const locked = byComponent.reduce((a, c) => a + c.points, 0)

  return {
    byComponent,
    rounding,
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

  // Under half-up rounding the last half mark is free — a 59.5 paper is
  // recorded as 60 — so asking for the full figure sends the student after a
  // mark they do not need.
  //
  // Claimed only when a single component is outstanding, where the gain is
  // exactly 0.5 (round(x) >= k iff x >= k - 0.5). With two components left the
  // gain depends on where each one lands, anywhere from 0 to 1.0, and assuming
  // any of it could tell someone they need less than they really do. Erring
  // upward costs a student some extra revision; erring downward costs them the
  // grade.
  const outstanding = grade.byComponent?.filter(c => c.fraction === null && c.weight > 0) ?? []
  const slack = grade.rounding === 'half-up' && outstanding.length === 1 ? 0.5 : 0

  const needed = ((targetPct - locked - slack) / remainingWeight) * 100
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
  // bandsOf, not a bare spread: every other reader accepts either a band set
  // ({scale, bands}) or a plain array, and scheme.bands is a set. Spreading
  // the set threw "is not iterable" — an inconsistency the UI had to guard
  // against locally, which is exactly the wrong place for it.
  const ascending = [...bandsOf(bands)].sort((a, b) => a.min - b.min)
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

/**
 * Bring one semester up to the gradebook shape. Idempotent — safe to run on
 * every load and on every cloud pull.
 *
 * `exams` is deliberately left in place rather than deleted. Nothing reads it
 * after this point, but keeping the original array means downgrading to an
 * older build still shows the user their exam schedule instead of an empty
 * tab. It can be dropped in a later schema version once this one has settled.
 */
export function normalizeSemester(sem) {
  if (!sem || typeof sem !== 'object') return sem
  if (Array.isArray(sem.assessments)) {
    // Already migrated; just make sure a scheme is present.
    return sem.gradingScheme ? sem : { ...sem, gradingScheme: DEFAULT_SCHEME }
  }
  return {
    ...sem,
    assessments: migrateExamsToAssessments(sem.exams ?? []),
    gradingScheme: sem.gradingScheme ?? DEFAULT_SCHEME,
  }
}

export const normalizeSemesters = (list) =>
  Array.isArray(list) ? list.map(normalizeSemester) : list

// ── GPA from real marks ──────────────────────────────────────────
//
// `subject.gradePoint` is hand-typed: the student works their grade out
// themselves and enters a number, which then drives the GPA and CGPA badges.
// Once marks exist the app can derive it, so these helpers prefer a derived
// grade point and fall back to the typed one.
//
// The manual value is never overwritten. A subject with no marks yet still
// shows what was typed, and clearing marks reverts to it rather than to
// nothing — losing a grade the user entered by hand would be worse than
// showing a slightly stale one.

/**
 * One subject's grade point.
 * @returns {{gp: number|null, source: 'derived'|'manual'|null, pct: number|null, isComplete: boolean}}
 */
export function subjectGradePoint(subject, assessments = [], scheme = DEFAULT_SCHEME) {
  const mine = assessments.filter(a => String(a.subjectId) === String(subject?.id))
  const grade = computeSubjectGrade(mine, scheme)

  // An awarded grade is the university's published result. It outranks
  // anything computed here — our projection is an estimate, that is the fact.
  const awarded = subject?.awardedGp
  if (awarded !== null && awarded !== undefined && awarded !== '') {
    return { gp: Number(awarded), source: 'awarded', pct: null, isComplete: true }
  }

  if (grade.gradedWeight > 0) {
    // Partway through a term, banked marks understate the outcome — a student
    // who has only sat internals holds 19.5 of 100. Grade the projection while
    // work is outstanding, and the real total once everything is in.
    const pct = grade.isComplete ? grade.locked : grade.current
    return {
      gp: pctToGradePoint(pct, scheme?.bands),
      source: 'derived',
      pct,
      isComplete: grade.isComplete,
    }
  }

  const manual = subject?.gradePoint
  return {
    gp: manual === null || manual === undefined ? null : manual,
    source: manual === null || manual === undefined ? null : 'manual',
    pct: null,
    isComplete: false,
  }
}

/** Credit-weighted GPA for one semester, using derived marks where they exist. */
export function computeSemesterGPA(semester) {
  const subjects = semester?.subjects ?? []
  const assessments = semester?.assessments ?? []
  let points = 0, credits = 0
  for (const s of subjects) {
    const { gp } = subjectGradePoint(s, assessments, resolveScheme(semester, s))
    if (gp === null) continue
    const c = parseFloat(s.credits) || 0
    points += gp * c
    credits += c
  }
  return credits ? points / credits : null
}

/** Cumulative GPA across semesters, credit-weighted over every graded subject. */
export function computeCGPA(semesters = []) {
  let points = 0, credits = 0
  for (const sem of semesters) {
    const assessments = sem?.assessments ?? []
    for (const s of (sem?.subjects ?? [])) {
      const { gp } = subjectGradePoint(s, assessments, resolveScheme(sem, s))
      if (gp === null) continue
      const c = parseFloat(s.credits) || 0
      points += gp * c
      credits += c
    }
  }
  return credits ? points / credits : null
}

// ── Working backwards from an awarded grade ──────────────────────
//
// Universities commonly publish a letter grade for the subject and never
// release the external paper's mark. The exact figure is unrecoverable, but
// it is bounded: the awarded band fixes the total to a range, and everything
// else is known, so the missing component is pinned to a window.
//
//   total   = known marks + unknown component
//   band    = [floor, next floor)
//   unknown ∈ [floor − known, nextFloor − known), clamped to [0, weight]
//
// Never present the midpoint as if it were the mark.

/** The percentage window a grade point corresponds to: [min, max). */
export function bandRange(gp, bands = DEFAULT_GRADE_BANDS) {
  const list = [...bandsOf(bands)].sort((a, b) => a.min - b.min)
  const i = list.findIndex(b => b.gp === gp)
  if (i === -1) return null
  return {
    min: list[i].min,
    max: i === list.length - 1 ? 100 : list[i + 1].min,
    maxInclusive: i === list.length - 1,
    label: list[i].label,
  }
}

/**
 * Infer one component's marks from the grade the university awarded.
 *
 * @returns {null | {
 *   possible: boolean, min: number, max: number, maxInclusive: boolean,
 *   midpoint: number, weight: number, known: number, band: object,
 *   blockedBy: string[]   // components still ungraded, if any
 * }}
 */
export function impliedComponentMarks(assessments, scheme, componentId, awardedGp) {
  const components = scheme?.components ?? []
  const target = components.find(c => c.id === componentId)
  if (!target) return null

  const band = bandRange(awardedGp, scheme?.bands)
  if (!band) return null

  const grade = computeSubjectGrade(assessments, scheme)

  // Every other component must be graded, or "known" is not actually known
  // and the window would be meaninglessly wide.
  const blockedBy = grade.byComponent
    .filter(c => c.component.id !== componentId && c.fraction === null)
    .map(c => c.component.label)

  const known = grade.byComponent
    .filter(c => c.component.id !== componentId)
    .reduce((a, c) => a + c.points, 0)

  const weight = Number(target.weight) || 0

  // The band bounds a mark the university RECORDED. Under half-up rounding
  // that recorded figure is round(raw), and round(x) >= k iff x >= k - 0.5, so
  // the paper the student actually sat sits half a mark below the window the
  // band alone implies. `blockedBy` has already established that this is the
  // only ungraded component, so the whole shift lands here.
  const slack = (scheme?.rounding ?? 'none') === 'half-up' ? 0.5 : 0
  const rawMin = band.min - known - slack
  const rawMax = band.max - known - slack

  const min = Math.max(0, Math.min(weight, rawMin))
  const max = Math.max(0, Math.min(weight, rawMax))

  // An empty window means the awarded grade cannot be reconciled with the
  // marks on record — usually a typo in the internals, occasionally a
  // university revision. Say so rather than quietly clamping to something.
  const possible = blockedBy.length === 0 && rawMin <= weight && rawMax > 0 && min < max

  return {
    possible,
    min, max,
    maxInclusive: band.maxInclusive && max === rawMax,
    midpoint: (min + max) / 2,
    weight, known, band,
    blockedBy,
  }
}

/** How many of a semester's subjects have a grade at all, and how they got it. */
export function gradeCoverage(semester) {
  const subjects = semester?.subjects ?? []
  const assessments = semester?.assessments ?? []
  let derived = 0, manual = 0, awarded = 0
  for (const s of subjects) {
    const { source } = subjectGradePoint(s, assessments, resolveScheme(semester, s))
    if (source === 'derived') derived++
    else if (source === 'manual') manual++
    else if (source === 'awarded') awarded++
  }
  // `awarded` used to be missed here, so a subject with a published result was
  // counted toward the GPA but not toward "n/m GRADES RECORDED".
  return { derived, manual, awarded, graded: derived + manual + awarded, total: subjects.length }
}
