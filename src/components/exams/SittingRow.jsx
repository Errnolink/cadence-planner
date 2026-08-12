import { useState, useEffect, useId } from 'react'
import { isGraded } from '../../data/grading.js'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton.jsx'

/** 19.5 → "19.5" · 20 → "20" · null → "—". Marks are read, not computed on. */
const fmt = (v, digits = 1) => {
  const n = Number(v)
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—'
  return String(Math.round(n * 10 ** digits) / 10 ** digits)
}

// A sitting of the internals component is a "MID" in every Indian handbook
// this app has been pointed at; anything else is named after its component
// so a custom scheme reads sensibly without a translation table.
const SITTING_WORD = { internal: 'MID', internals: 'MID', mid: 'MID', mids: 'MID' }

const sittingLabel = (component, attempt) => {
  const key = String(component?.id ?? '').toLowerCase()
  const word = SITTING_WORD[key] ?? String(component?.label ?? 'SITTING').toUpperCase()
  return `${word} ${attempt}`
}

/**
 * Why the rule discarded a sitting. A student who sat a mid must never be
 * left wondering why it is missing from the total, so the reason is spelled
 * out rather than implied by a grey row.
 */
const droppedReason = (rule) => {
  if (rule?.mode === 'best') {
    const n = Math.max(1, Number(rule.n) || 1)
    return `DROPPED — THIS SCHEME KEEPS THE BEST ${n} SITTING${n > 1 ? 'S' : ''}, AND A HIGHER SITTING WAS KEPT INSTEAD.`
  }
  if (rule?.mode === 'latest') return 'DROPPED — THIS SCHEME COUNTS ONLY THE MOST RECENT SITTING.'
  return 'DROPPED — THE CURRENT RULE DID NOT COUNT THIS SITTING.'
}

const cellStyle = {
  width: '52px',
  textAlign: 'right',
  padding: '2px 4px',
  fontFamily: 'var(--cad-font-mono)',
  fontSize: 'var(--cad-fs-sm)',
  color: 'var(--cad-text-hi)',
  background: 'var(--cad-bg-input)',
  border: '1px solid var(--cad-border)',
  borderRadius: 'var(--cad-radius)',
}

/**
 * One mark. Keeps a local draft so a keystroke doesn't write storage — the
 * same pattern SubjectRow uses for the roster fields.
 *
 * Out-of-range and non-numeric input is REJECTED and flagged, never silently
 * clamped: a typo'd 80 in a 10-mark box has to be seen, not turned into 10.
 */
function PartInput({ ariaLabel, part, entry, onSetScore }) {
  const id = useId()
  const max = Number(entry?.maxScore ?? part?.max) || 0
  const score = entry?.score ?? null
  const [draft, setDraft] = useState(score === null ? '' : String(score))
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState('')

  // Resync after an external write (cloud pull, scheme switch) unless the
  // field is being typed into.
  useEffect(() => {
    if (!focused) {
      setDraft(score === null || score === undefined ? '' : String(score))
      setError('')
    }
  }, [score, focused])

  const commit = (raw) => {
    const text = String(raw).trim()
    if (text === '') { setError(''); onSetScore(entry.id, ''); return }
    const n = Number(text)
    if (!Number.isFinite(n)) { setError('NUMBERS ONLY'); return }
    if (n < 0) { setError('MIN 0'); return }
    if (n > max) { setError(`MAX ${max}`); return }
    setError('')
    onSetScore(entry.id, n)
  }

  if (!entry) {
    // The scheme grew a part after this sitting was created. Show the gap
    // rather than pretending the mark is zero.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>{part?.label}</span>
        <span
          title="NO ENTRY FOR THIS PART IN THIS SITTING — DELETE AND RE-ADD THE SITTING TO PICK UP THE NEW SPLIT"
          style={{ ...cellStyle, color: 'var(--cad-text-xlo)', display: 'inline-block' }}
        >—</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <label htmlFor={id} className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>{part?.label ?? entry.partId}</label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          max={max}
          step="0.5"
          value={draft}
          placeholder="—"
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={e => { setFocused(false); commit(e.target.value) }}
          onKeyDown={e => { if (e.key === 'Enter') { commit(e.target.value); e.currentTarget.blur() } }}
          style={{ ...cellStyle, borderColor: error ? 'var(--cad-danger)' : 'var(--cad-border)' }}
        />
        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-xlo)' }}>
          /{max}
        </span>
      </div>
      {error && (
        <span role="alert" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-danger)' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * One sitting — MID 1, MID 2 — with a numeric box per part, the sitting
 * total, and (in edit mode) a two-step delete.
 *
 * Marks stay editable outside edit mode: entering a returned mark is ordinary
 * use, not structural editing. Only adding and deleting sittings is gated.
 */
export function SittingRow({
  subjectName, component, attempt, entries = [], computed,
  editMode, onSetScore, onRemoveSitting,
}) {
  const label = sittingLabel(component, attempt)
  const parts = component?.parts ?? []
  const dropped = computed ? computed.counted === false : false

  const graded = entries.filter(isGraded)
  const scored = graded.reduce((a, e) => a + Number(e.score), 0)
  const total = (component?.parts ?? []).reduce((a, p) => a + (Number(p.max) || 0), 0)
  const partial = graded.length > 0 && graded.length < entries.length

  return (
    <div
      role="group"
      aria-label={`${subjectName} ${label}`}
      style={{
        padding: '6px 8px',
        background: 'var(--cad-bg-elevated)',
        border: '1px solid var(--cad-border-dim)',
        borderRadius: 'var(--cad-radius)',
        opacity: dropped ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: '4px' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', letterSpacing: 'var(--cad-track-mid)', color: 'var(--cad-text-hi)' }}>
            {label}
          </span>
          {dropped && (
            <span
              title={droppedReason(component?.rule)}
              style={{
                fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-mid)',
                padding: '1px 5px', color: 'var(--cad-danger)', border: '1px solid var(--cad-danger)',
                background: 'var(--cad-danger-dim)', borderRadius: 'var(--cad-radius)',
              }}
            >DROPPED</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            title={partial ? `${graded.length} OF ${entries.length} PARTS MARKED` : undefined}
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: graded.length ? 'var(--cad-text-hi)' : 'var(--cad-text-xlo)' }}
          >
            {graded.length ? fmt(scored) : '—'} / {fmt(total, 0)}
          </span>
          {editMode && (
            <ConfirmDeleteButton
              onConfirm={() => onRemoveSitting?.(attempt)}
              label="DEL"
              confirmLabel="SURE?"
              style={{ padding: '1px 6px', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-mid)' }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        {parts.map(part => (
          <PartInput
            key={part.id}
            part={part}
            entry={entries.find(e => e.partId === part.id)}
            onSetScore={onSetScore}
            ariaLabel={`${subjectName} · ${label} · ${part.label} marks, out of ${part.max}`}
          />
        ))}
        {parts.length === 0 && (
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
            // THIS COMPONENT DECLARES NO PARTS
          </span>
        )}
      </div>

      {dropped && (
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', marginTop: '4px' }}>
          {droppedReason(component?.rule)}
        </div>
      )}
    </div>
  )
}
