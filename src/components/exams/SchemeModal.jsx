import { useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import {
  SCHEME_PRESETS, GRADE_BAND_PRESETS, AGGREGATION_LABELS,
  DEFAULT_SCHEME, resolveScheme, validateScheme, validateBands, sittingMax, scaleOf,
} from '../../data/grading.js'

const section = { marginBottom: '12px' }

const ruleWords = (rule) => rule?.mode === 'best'
  ? `BEST ${Math.max(1, Number(rule.n) || 1)}`
  : (AGGREGATION_LABELS[rule?.mode] ?? AGGREGATION_LABELS.average)

const bandListOf = (b) => (Array.isArray(b) ? b : b?.bands ?? [])

/** Which preset a scheme's components came from, so the picker shows state. */
const matchSchemePreset = (scheme) => SCHEME_PRESETS.find(p =>
  JSON.stringify(p.scheme.components) === JSON.stringify(scheme?.components))?.id ?? null

const matchBandPreset = (scheme) => GRADE_BAND_PRESETS.find(p =>
  JSON.stringify(p.bands) === JSON.stringify(bandListOf(scheme?.bands)))?.id ?? null

/**
 * Grading scheme picker.
 *
 * The switch that matters is AVERAGE-OF-MIDS vs BEST-OF-MIDS — one college
 * averages the two internal sittings, the next keeps the higher one, and the
 * same marks then produce different grades. That is a preset choice, so the
 * presets are the whole surface here; the component/part/band editor is a
 * later addition on top of this shape.
 */
export function SchemeModal({ semester, subjects = [], subjectId = null, onSetScheme, onSetSubjectScheme, onClose }) {
  const subject = subjects.find(s => String(s.id) === String(subjectId)) ?? null
  const hasOverride = Boolean(subject?.gradingScheme)

  const [scope, setScope] = useState(subject ? 'SUBJECT' : 'SEMESTER')
  const [draft, setDraft] = useState(() =>
    subject ? resolveScheme(semester, subject) : (semester?.gradingScheme ?? DEFAULT_SCHEME))

  const weights = validateScheme(draft)
  const bandCheck = validateBands(draft?.bands ?? [])
  const canSave = weights.valid && bandCheck.valid && (scope === 'SEMESTER' || Boolean(subject))

  const applyScheme = (preset) => setDraft(d => ({ ...d, components: preset.scheme.components }))
  const applyBands = (preset) => setDraft(d => ({ ...d, bands: preset }))

  const handleSave = () => {
    if (!canSave) return
    if (scope === 'SUBJECT' && subject) onSetSubjectScheme?.(subject.id, draft)
    else onSetScheme?.(draft)
    onClose()
  }

  const schemeId = matchSchemePreset(draft)
  const bandId = matchBandPreset(draft)

  return (
    <Modal title="GRADING SCHEME" hex="0xF010" onClose={onClose}>
      <div>
        {/* Scope */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>APPLIES TO</div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button" className="cad-chip btn-mech"
              data-active={scope === 'SEMESTER' || undefined} aria-pressed={scope === 'SEMESTER'}
              onClick={() => setScope('SEMESTER')}
            >WHOLE SEMESTER</button>
            <button
              type="button" className="cad-chip btn-mech"
              data-active={scope === 'SUBJECT' || undefined} aria-pressed={scope === 'SUBJECT'}
              disabled={!subject}
              onClick={() => setScope('SUBJECT')}
            >{subject ? `ONLY ${subject.name}` : 'ONE SUBJECT'}</button>
          </div>
          {scope === 'SUBJECT' && hasOverride && (
            <button
              type="button"
              onClick={() => { onSetSubjectScheme?.(subject.id, null); onClose() }}
              className="cad-chip btn-mech"
              style={{ marginTop: '6px', borderColor: 'var(--cad-danger)', color: 'var(--cad-danger)' }}
            >CLEAR OVERRIDE — INHERIT SEMESTER</button>
          )}
        </div>

        {/* Scheme presets */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>SCHEME</div>
          <div className="flex flex-col gap-1.5">
            {SCHEME_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyScheme(p)}
                aria-pressed={schemeId === p.id}
                className="btn-mech cad-hover-row"
                style={{
                  textAlign: 'left', padding: '6px 8px', borderRadius: 'var(--cad-radius)',
                  border: schemeId === p.id ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                  background: schemeId === p.id ? 'var(--cad-accent-dim)' : 'transparent',
                }}
              >
                <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', letterSpacing: 'var(--cad-track-mid)', color: schemeId === p.id ? 'var(--cad-accent-text)' : 'var(--cad-text-hi)' }}>
                  {p.label}
                </div>
                <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', marginTop: '2px' }}>
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* What the chosen scheme actually does */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>COMPONENTS</div>
          <div className="flex flex-col gap-1">
            {(draft?.components ?? []).map(c => (
              <div key={c.id} className="flex items-baseline justify-between gap-2" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)' }}>
                <span style={{ color: 'var(--cad-text-hi)' }}>{c.label}</span>
                <span>
                  {c.weight} MARKS <span aria-hidden="true">∥</span> {ruleWords(c.rule)} <span aria-hidden="true">∥</span> SITTING {sittingMax(c)} ({(c.parts ?? []).map(p => `${p.label} ${p.max}`).join(' + ') || 'NO PARTS'})
                </span>
              </div>
            ))}
            {(draft?.components ?? []).length === 0 && (
              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
                // NO COMPONENTS — PICK A SCHEME ABOVE
              </div>
            )}
          </div>
          <div
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', marginTop: '6px',
              color: weights.valid ? 'var(--cad-success)' : 'var(--cad-danger)',
            }}
          >
            TOTAL {weights.total} / 100{weights.valid ? '' : ' — WEIGHTS MUST ADD UP TO 100'}
          </div>
        </div>

        {/* Grade bands */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>GRADE BANDS</div>
          <div className="flex gap-2 flex-wrap">
            {GRADE_BAND_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyBands(p)}
                className="cad-chip btn-mech"
                data-active={bandId === p.id || undefined}
                aria-pressed={bandId === p.id}
              >{p.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-1" style={{ marginTop: '6px' }}>
            {bandListOf(draft?.bands).map(b => (
              <span key={`${b.min}-${b.label}`} style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)' }}>
                {b.label} ≥ {b.min}% ({b.gp})
              </span>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-xlo)', marginTop: '4px' }}>
            SCALE {scaleOf(draft?.bands)}
          </div>
          {!bandCheck.valid && (
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-danger)', marginTop: '4px' }}>
              {bandCheck.errors.map(e => <div key={e}>⚠ {e}</div>)}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)',
              border: '1px solid var(--cad-accent)', color: 'var(--cad-accent-text)',
              background: 'var(--cad-accent-dim)', borderRadius: 'var(--cad-radius)',
              opacity: canSave ? 1 : 0.4,
            }}
          >SAVE</button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)',
              border: '1px solid var(--cad-border)', color: 'var(--cad-text-mid)', background: 'transparent',
              borderRadius: 'var(--cad-radius)',
            }}
          >ABORT</button>
        </div>
      </div>
    </Modal>
  )
}
