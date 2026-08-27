import { useState, useMemo } from 'react'
import { subjectVars } from '../../data/index.js'
import {
  computeSubjectGrade, nextBandTarget, pctToGradeLabel, scaleOf, impliedComponentMarks,
  subjectGradePoint, gradePointToLabel,
  AGGREGATION_LABELS, DEFAULT_GRADE_BANDS,
} from '../../data/grading.js'
import { SittingRow } from './SittingRow.jsx'

/** 19.5 → "19.5" · 20 → "20" · null → "—". */
const fmt = (v, digits = 1) => {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—'
  return String(Math.round(n * 10 ** digits) / 10 ** digits)
}

/**
 * nextBandTarget spreads its bands argument, so it needs a bare array —
 * while a scheme carries a band SET ({ scale, bands }). Normalise once here
 * rather than at four call sites.
 */
const bandsArrayOf = (scheme) => {
  const b = scheme?.bands
  if (Array.isArray(b)) return b
  return b?.bands ?? DEFAULT_GRADE_BANDS
}

/** "AVERAGE OF ALL" / "BEST 1" — the rule in words, not in JSON. */
const ruleWords = (rule) => {
  if (rule?.mode === 'best') return `BEST ${Math.max(1, Number(rule.n) || 1)}`
  return AGGREGATION_LABELS[rule?.mode] ?? AGGREGATION_LABELS.average
}

const attemptKeysOf = (entries) => {
  const keys = [...new Set((entries ?? []).map(e => e.attempt ?? 1))]
  return keys.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
}

const nextAttempt = (entries) => {
  const nums = (entries ?? []).map(e => Number(e.attempt)).filter(Number.isFinite)
  return nums.length ? Math.max(...nums) + 1 : 1
}

/** The target sentence, phrased around whatever is actually left to sit. */
function targetLine(grade, scheme) {
  const target = nextBandTarget(grade, bandsArrayOf(scheme))
  if (!target) {
    return grade.gradedWeight > 0
      ? { tone: 'var(--cad-success)', text: 'TOP BAND — NOTHING ABOVE THIS TO AIM FOR' }
      : null
  }
  const name = target.band?.label ?? target.label
  if (target.alreadyAchieved) {
    return { tone: 'var(--cad-success)', text: `${name} IS LOCKED IN — BANKED MARKS ALREADY CLEAR ${target.band.min}%` }
  }
  if (!target.reachable) {
    return grade.remainingWeight <= 0
      ? { tone: 'var(--cad-danger)', text: `${name} IS OUT OF REACH — NOTHING LEFT TO BE GRADED` }
      : { tone: 'var(--cad-danger)', text: `${name} IS OUT OF REACH — THE REMAINING ${fmt(grade.remainingWeight, 0)} MARKS CANNOT COVER THE GAP` }
  }
  // Name the paper when exactly one component is still ungraded, which is the
  // common mid-semester case and the whole point of the sentence.
  const open = grade.byComponent.filter(c => c.fraction === null && c.weight > 0)
  const where = open.length === 1
    ? `OF THE ${fmt(open[0].weight, 0)}-MARK ${open[0].component.label} PAPER`
    : `ACROSS THE REMAINING ${fmt(grade.remainingWeight, 0)} MARKS`
  return { tone: 'var(--cad-accent)', text: `NEED ${fmt(target.needed)}% ${where} FOR ${name}` }
}

/**
 * One subject's gradebook — collapsed to a standing summary, expanded to the
 * marks grid.
 *
 * The bar draws two different things that are easy to conflate: marks BANKED
 * (solid) and weight still AVAILABLE (hatched). A student reading a single
 * filled bar would take a mid-semester 20/100 as a catastrophe rather than as
 * "75 marks not sat yet".
 */
export function SubjectGradeCard({
  subject, scheme, assessments = [], editMode,
  onAddSitting, onSetScore, onRemoveSitting, onEditScheme, onUpdateSubject, hasOverride,
}) {
  const [open, setOpen] = useState(false)

  const grade = useMemo(() => computeSubjectGrade(assessments, scheme), [assessments, scheme])

  const bands = bandsArrayOf(scheme)
  const scale = scaleOf(scheme?.bands)
  const projected = grade.current
  const projectedLetter = projected === null ? '—' : pctToGradeLabel(projected, bands)

  // The headline grade must come from the same place the roster badge does,
  // or the two views disagree. subjectGradePoint ranks an awarded result above
  // a projection above a hand-typed grade; reading grade.current alone here
  // meant setting an awarded grade changed the roster and not this card.
  const effective = subjectGradePoint(subject, assessments, scheme)
  const letter = effective.gp === null ? projectedLetter : gradePointToLabel(effective.gp, bands)
  // Worth surfacing when the published result differs from what the marks
  // projected — that gap is information, not an error to hide.
  const showsBoth = effective.source === 'awarded' && projected !== null &&
    gradePointToLabel(effective.gp, bands) !== projectedLetter
  // With nothing graded the "next band" is the pass mark measured from zero,
  // which is true and useless — say nothing is graded instead.
  const target = grade.gradedWeight > 0 ? targetLine(grade, scheme) : null

  // Which component the university never publishes a mark for: the single
  // ungraded one. With two or more still open the answer is not determined,
  // and impliedComponentMarks reports that rather than guessing.
  const impliedComponent = useMemo(() => {
    const ungraded = grade.byComponent.filter(c => c.fraction === null)
    if (ungraded.length === 1) return ungraded[0].component
    return (scheme?.components ?? []).find(c => c.id === 'theory') ?? null
  }, [grade, scheme])

  const awardedGp = subject.awardedGp
  const implied = useMemo(() => {
    if (awardedGp === null || awardedGp === undefined || awardedGp === '') return null
    if (!impliedComponent) return null
    return impliedComponentMarks(assessments, scheme, impliedComponent.id, Number(awardedGp))
  }, [awardedGp, impliedComponent, assessments, scheme])
  const components = scheme?.components ?? []

  const lockedPct = Math.max(0, Math.min(100, grade.locked))
  const availablePct = Math.max(0, Math.min(100 - lockedPct, grade.remainingWeight))

  return (
    <div
      style={{
        ...subjectVars(subject.colorIdx),
        border: '1px solid var(--cad-border-dim)',
        borderLeft: '3px solid var(--subj-border)',
        borderRadius: '0 var(--cad-radius) var(--cad-radius) 0',
        background: 'var(--cad-bg-elevated)',
      }}
    >
      {/* ── Collapsed summary ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full btn-mech"
        style={{ display: 'block', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 0 }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span aria-hidden="true" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>
              {open ? '▾' : '▸'}
            </span>
            {/* Wraps rather than ellipsising. At 375px this box is 208px and a
                real syllabus name like "CONSTITUTION OF INDIA AND PROFESSIONAL
                ETHICS" needs 297px — a third of the card's own title was being
                hidden behind an ellipsis. A taller row is the cheaper price. */}
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', fontWeight: 'bold', color: 'var(--subj-text)', overflowWrap: 'anywhere' }}>
              {subject.name}
            </span>
            {hasOverride && (
              <span className="cad-chip" title="THIS SUBJECT OVERRIDES THE SEMESTER SCHEME">OWN SCHEME</span>
            )}
          </div>
          <div className="flex items-baseline gap-3 shrink-0">
            <span title="MARKS BANKED OUT OF 100" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--cad-text-hi)' }}>
              {fmt(grade.locked)}<span style={{ color: 'var(--cad-text-xlo)' }}>/100</span>
            </span>
            <span title="PROJECTED PERCENTAGE ON WHAT HAS BEEN GRADED SO FAR" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--cad-accent-text)' }}>
              {projected === null ? '—' : `${fmt(projected)}%`}
            </span>
            {/* When a published result contradicts the projection, show the
                projection struck through beside it rather than silently
                replacing it — the gap is the interesting part. */}
            {showsBoth && (
              <span
                title={`PROJECTED ${projectedLetter} FROM MARKS, BUT ${letter} WAS AWARDED`}
                style={{
                  fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                  color: 'var(--cad-text-xlo)', textDecoration: 'line-through',
                }}
              >{projectedLetter}</span>
            )}
            <span
              title={
                effective.source === 'awarded'
                  ? `AWARDED GRADE ${letter} (${effective.gp} OF ${scale}) — FROM RESULTS`
                  : effective.source === 'manual'
                    ? `GRADE ${letter} (${effective.gp} OF ${scale}) — ENTERED BY HAND`
                    : grade.projectedGradePoint === null
                      ? 'NOTHING GRADED YET'
                      : `PROJECTED GRADE POINT ${grade.projectedGradePoint} OF ${scale}`
              }
              style={{
                fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', minWidth: '22px', textAlign: 'right',
                color: effective.gp === null ? 'var(--cad-text-xlo)'
                  : effective.source === 'awarded' ? 'var(--cad-accent-text)' : 'var(--cad-text-hi)',
              }}
            >
              {letter}
              {effective.source === 'awarded' && <span className="sr-only"> awarded</span>}
              {effective.source === 'derived' && <span className="sr-only"> projected from marks</span>}
            </span>
          </div>
        </div>

        {/* Banked (solid) vs still available (hatched) — two different things. */}
        <div
          role="img"
          aria-label={`${fmt(grade.locked)} marks banked, ${fmt(grade.remainingWeight, 0)} marks still available`}
          style={{ display: 'flex', width: '100%', height: '5px', marginTop: '6px', background: 'var(--cad-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}
        >
          <div style={{ width: `${lockedPct}%`, background: 'var(--subj-border)' }} />
          <div
            style={{
              width: `${availablePct}%`,
              backgroundImage: 'repeating-linear-gradient(135deg, var(--subj-border) 0 2px, transparent 2px 5px)',
              opacity: 0.35,
            }}
          />
        </div>
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', marginTop: '4px' }}>
          {fmt(grade.locked)} BANKED <span aria-hidden="true">∥</span> {fmt(grade.remainingWeight, 0)} STILL AVAILABLE <span aria-hidden="true">∥</span> CEILING {fmt(grade.ceiling)}
        </div>
      </button>

      {/* ── Expanded marks grid ── */}
      {open && (
        <div style={{ borderTop: '1px solid var(--cad-border-dim)', padding: '8px 10px' }}>
          {components.length === 0 && (
            <div className="text-center" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', border: '1px dashed var(--cad-border)', padding: '10px' }}>
              // THIS SUBJECT&apos;S SCHEME HAS NO COMPONENTS — OPEN SCHEME AND PICK ONE
            </div>
          )}

          {components.map(component => {
            const cs = grade.byComponent.find(c => c.component.id === component.id)
            const entries = cs?.entries ?? []
            const computedByAttempt = new Map((cs?.attempts ?? []).map(a => [String(a.attempt), a]))
            const keys = attemptKeysOf(entries)
            // Weakest part across every sitting — "where am I losing marks".
            const scoredParts = (cs?.byPart ?? []).filter(p => p.fraction !== null)
            const weakest = scoredParts.length > 1
              ? scoredParts.reduce((lo, p) => (p.fraction < lo.fraction ? p : lo), scoredParts[0])
              : null

            return (
              <div key={component.id} style={{ marginBottom: '12px' }}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                  <div className="flex items-baseline gap-2">
                    <span className="cad-label" style={{ color: 'var(--cad-text-mid)' }}>{component.label}</span>
                    <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-xlo)' }}>
                      {fmt(component.weight, 0)} MARKS <span aria-hidden="true">∥</span> {ruleWords(component.rule)}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: cs?.marks === null || cs === undefined ? 'var(--cad-text-xlo)' : 'var(--cad-text-hi)' }}>
                    {/* Where the scheme's rounding moved a mark, show the
                        measured figure it came from. A number that changed
                        deserves to say why — the same reason an awarded grade
                        shows the projection it overrode instead of replacing
                        it silently. */}
                    {cs?.rounded && (
                      <span style={{ color: 'var(--cad-text-lo)' }}>
                        <span aria-hidden="true">{fmt(cs.rawMarks)} → </span>
                        <span className="sr-only">{fmt(cs.rawMarks)} rounded up to </span>
                      </span>
                    )}
                    {cs && cs.marks !== null ? fmt(cs.marks) : '—'} / {fmt(component.weight, 0)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {keys.length === 0 && (
                    <div className="text-center" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', border: '1px dashed var(--cad-border)', padding: '8px' }}>
                      {editMode ? '// NO SITTINGS YET — ADD ONE BELOW' : '// NO SITTINGS YET — TURN ON EDIT MODE TO ADD ONE'}
                    </div>
                  )}
                  {keys.map(attempt => (
                    <SittingRow
                      key={`${component.id}-${attempt}`}
                      subjectName={subject.name}
                      component={component}
                      attempt={attempt}
                      entries={entries.filter(e => (e.attempt ?? 1) === attempt)}
                      computed={computedByAttempt.get(String(attempt))}
                      editMode={editMode}
                      onSetScore={onSetScore}
                      onRemoveSitting={(a) => onRemoveSitting?.(subject.id, component.id, a)}
                    />
                  ))}
                </div>

                {editMode && (
                  <button
                    type="button"
                    onClick={() => onAddSitting?.(component, subject.id, nextAttempt(entries))}
                    className="cad-chip btn-mech"
                    style={{ marginTop: '6px' }}
                    aria-label={`ADD SITTING — ${component.label}, ${subject.name}`}
                  >＋ ADD SITTING</button>
                )}

                {/* Per-part standing across sittings. */}
                {scoredParts.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ marginTop: '6px' }}>
                    {(cs?.byPart ?? []).map(p => {
                      const weak = weakest && weakest.part.id === p.part.id
                      return (
                        <span
                          key={p.part.id}
                          title={weak ? 'WEAKEST PART — MOST MARKS LOST HERE' : undefined}
                          style={{
                            fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                            color: weak ? 'var(--cad-danger)' : 'var(--cad-text-mid)',
                          }}
                        >
                          {weak && <span aria-hidden="true">▼ </span>}
                          {p.part.label} {p.fraction === null ? '—' : `${fmt(p.score)}/${fmt(p.max, 0)} · ${fmt(p.fraction * 100, 0)}%`}
                          {weak && <span className="sr-only"> — weakest part</span>}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* What it takes to reach the next band. */}
          {target && (
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: target.tone, borderTop: '1px solid var(--cad-border-dim)', paddingTop: '6px' }}>
              <span aria-hidden="true">▸ </span>{target.text}
            </div>
          )}
          {!target && grade.gradedWeight === 0 && (
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', borderTop: '1px solid var(--cad-border-dim)', paddingTop: '6px' }}>
              // NOTHING GRADED YET — ENTER A MARK TO SEE WHERE THIS SUBJECT IS HEADING
            </div>
          )}

          {/* Awarded result. Universities publish a letter for the subject and
              never release the external paper's mark, so the mark cannot be
              recovered — but it is bounded, and the bound is worth showing. */}
          <div style={{ borderTop: '1px solid var(--cad-border-dim)', marginTop: '8px', paddingTop: '8px' }}>
            <label
              htmlFor={`awarded-${subject.id}`}
              className="cad-label"
              style={{ display: 'block', marginBottom: '4px' }}
            >AWARDED GRADE (FROM RESULTS)</label>
            <select
              id={`awarded-${subject.id}`}
              className="cad-input"
              style={{ maxWidth: '220px', cursor: 'pointer' }}
              value={subject.awardedGp ?? ''}
              onChange={e => onUpdateSubject?.(
                subject.id, 'awardedGp',
                e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— NOT DECLARED YET —</option>
              {bands.map(b => (
                <option key={b.gp} value={b.gp}>{b.label} · {b.min}% AND ABOVE</option>
              ))}
            </select>

            {implied && (
              <div
                role="status"
                style={{
                  marginTop: '6px', padding: '6px 8px',
                  border: `1px solid ${implied.possible ? 'var(--cad-accent)' : 'var(--cad-danger)'}`,
                  background: implied.possible ? 'var(--cad-accent-dim)' : 'var(--cad-danger-dim)',
                  borderRadius: 'var(--cad-radius)',
                  fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                  color: implied.possible ? 'var(--cad-accent-text)' : 'var(--cad-danger)',
                  lineHeight: 1.5,
                }}
              >
                {implied.blockedBy.length > 0 ? (
                  <>ENTER {implied.blockedBy.join(' AND ')} MARKS TO NARROW DOWN THE {impliedComponent.label} PAPER</>
                ) : !implied.possible ? (
                  <>GRADE {implied.band.label} DOES NOT FIT THESE MARKS — {fmt(implied.known)} BANKED
                     LEAVES NO VALID {impliedComponent.label} SCORE. CHECK THE INTERNALS.</>
                ) : (
                  <>
                    <span aria-hidden="true">▸ </span>
                    {impliedComponent.label} WAS BETWEEN{' '}
                    <strong>{fmt(implied.min)}</strong> AND{' '}
                    <strong>{fmt(implied.max)}</strong> / {fmt(implied.weight, 0)}
                    {implied.maxInclusive ? ' INCLUSIVE' : ''}
                    <div style={{ opacity: 0.75, marginTop: '2px' }}>
                      {implied.band.label} NEEDS {implied.band.min}%
                      {implied.band.maxInclusive ? ' OR MORE' : `–${implied.band.max}%`} OVERALL,
                      AND {fmt(implied.known)} IS ALREADY BANKED. THE EXACT MARK IS NOT PUBLISHED.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => onEditScheme?.(subject)}
              className="cad-chip btn-mech"
              aria-label={`EDIT SCHEME — ${subject.name}`}
            >EDIT SCHEME</button>
          </div>
        </div>
      )}
    </div>
  )
}
