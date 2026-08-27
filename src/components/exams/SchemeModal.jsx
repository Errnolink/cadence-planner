import { useEffect, useId, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton.jsx'
import {
  SCHEME_PRESETS, GRADE_BAND_PRESETS, AGGREGATION_MODES, AGGREGATION_LABELS,
  ROUNDING_MODES, ROUNDING_LABELS, ROUNDING_BLURBS,
  DEFAULT_SCHEME, resolveScheme, validateScheme, validateBands, sittingMax, scaleOf, isGraded,
} from '../../data/grading.js'

const section = { marginBottom: '12px' }

const boxStyle = {
  border: '1px solid var(--cad-border-dim)',
  background: 'var(--cad-bg-elevated)',
  borderRadius: 'var(--cad-radius)',
  padding: '8px',
}

const inputStyle = {
  width: '100%',
  minWidth: 0,
  fontFamily: 'var(--cad-font-mono)',
  fontSize: 'var(--cad-fs-sm)',
  color: 'var(--cad-text-hi)',
  background: 'var(--cad-bg-input)',
  border: '1px solid var(--cad-border)',
  borderRadius: 'var(--cad-radius)',
  padding: '3px 6px',
}

const microStyle = {
  fontFamily: 'var(--cad-font-mono)',
  fontSize: 'var(--cad-fs-micro)',
  color: 'var(--cad-text-mid)',
}

const ruleWords = (rule) => rule?.mode === 'best'
  ? `BEST ${Math.max(1, Number(rule.n) || 1)}`
  : (AGGREGATION_LABELS[rule?.mode] ?? AGGREGATION_LABELS.average)

const bandListOf = (b) => (Array.isArray(b) ? b : b?.bands ?? [])

/** Which preset a scheme's components came from, so the picker shows state. */
const matchSchemePreset = (scheme) => SCHEME_PRESETS.find(p =>
  JSON.stringify(p.scheme.components) === JSON.stringify(scheme?.components))?.id ?? null

const matchBandPreset = (scheme) => GRADE_BAND_PRESETS.find(p =>
  JSON.stringify(p.bands) === JSON.stringify(bandListOf(scheme?.bands)))?.id ?? null

// ── Ids ──────────────────────────────────────────────────────────
//
// Assessments reference `componentId` / `partId`, so an id is a foreign key,
// not a display string. It is derived from the label ONCE, at creation, and
// then never changes: renaming INTERNALS to "CONTINUOUS ASSESSMENT" must not
// detach the marks already filed under it. Only removals orphan anything, and
// those are warned about before save.

const slug = (text, fallback) => {
  const s = String(text ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || fallback
}

const uniqueId = (base, taken) => {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

// Band rows have no id in the data model (nothing references them), but the
// editor sorts them by floor, so React needs a stable key that survives a row
// moving. `uid` is an editor-only field and is stripped before anything reads
// the draft — otherwise it would break preset matching by value and leak into
// storage.
let uidSeq = 0
const nextUid = () => `band-${++uidSeq}`
const withUid = (b) => ({ ...b, uid: nextUid() })
const stripUid = ({ uid, ...rest }) => rest // eslint-disable-line no-unused-vars

/** Editor draft → the shape the data layer and storage expect. */
const cleanScheme = (draft) => ({
  ...draft,
  bands: Array.isArray(draft?.bands)
    ? draft.bands.map(stripUid)
    : { ...draft?.bands, bands: bandListOf(draft?.bands).map(stripUid) },
})

/** Normalise whatever came in into an editable band set with keyed rows. */
const toEditableBands = (bands) => ({
  ...(Array.isArray(bands) ? {} : bands),
  scale: scaleOf(bands),
  bands: bandListOf(bands).map(withUid),
})

// ── Fields ───────────────────────────────────────────────────────
//
// Same contract as SittingRow's mark boxes: a local draft so a keystroke never
// writes the scheme, commit on blur/Enter, and out-of-range input is REJECTED
// and flagged rather than silently clamped. Cross-field validity (weights
// summing to 100) is deliberately NOT enforced here — the total has to be
// allowed through 105 on the way to 100, or the editor fights the user.

function TextField({ label, ariaLabel, value, onCommit, flex = '1 1 120px', minWidth = '92px' }) {
  const id = useId()
  const [draft, setDraft] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!focused) { setDraft(value ?? ''); setError('') }
  }, [value, focused])

  const commit = (raw) => {
    const text = String(raw).trim()
    if (text === '') { setError('REQUIRED'); return }
    setError('')
    if (text !== value) onCommit(text)
  }

  return (
    <div style={{ flex, minWidth, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {label && <label htmlFor={id} className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>{label}</label>}
      <input
        id={id}
        type="text"
        value={draft}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={e => { setFocused(false); commit(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') { commit(e.target.value); e.currentTarget.blur() } }}
        style={{ ...inputStyle, borderColor: error ? 'var(--cad-danger)' : 'var(--cad-border)' }}
      />
      {error && <span role="alert" style={{ ...microStyle, color: 'var(--cad-danger)' }}>{error}</span>}
    </div>
  )
}

function NumField({
  label, ariaLabel, value, onCommit, min = 0, max = Infinity, step = '1',
  suffix, flex = '0 0 auto', width = '62px',
}) {
  const id = useId()
  const asText = (v) => (v === null || v === undefined || v === '' ? '' : String(v))
  const [draft, setDraft] = useState(asText(value))
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!focused) { setDraft(asText(value)); setError('') }
  }, [value, focused])

  const commit = (raw) => {
    const text = String(raw).trim()
    if (text === '') { setError('REQUIRED'); return }
    const n = Number(text)
    if (!Number.isFinite(n)) { setError('NUMBERS ONLY'); return }
    if (n < min) { setError(`MIN ${min}`); return }
    if (n > max) { setError(`MAX ${max}`); return }
    setError('')
    if (n !== Number(value)) onCommit(n)
  }

  return (
    <div style={{ flex, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {label && <label htmlFor={id} className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          value={draft}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={e => { setFocused(false); commit(e.target.value) }}
          onKeyDown={e => { if (e.key === 'Enter') { commit(e.target.value); e.currentTarget.blur() } }}
          style={{ ...inputStyle, width, textAlign: 'right', borderColor: error ? 'var(--cad-danger)' : 'var(--cad-border)' }}
        />
        {suffix && <span style={{ ...microStyle, color: 'var(--cad-text-xlo)' }}>{suffix}</span>}
      </div>
      {error && <span role="alert" style={{ ...microStyle, color: 'var(--cad-danger)' }}>{error}</span>}
    </div>
  )
}

// ── Component editor ─────────────────────────────────────────────

/**
 * One component: what it is worth of the subject's 100, how repeated sittings
 * combine, and the split inside a single sitting.
 *
 * `weight` and a part's `max` are the two numbers users conflate — 25 internal
 * marks made of parts worth 10 + 10 + 5 is four numbers on one card. Each is
 * labelled with the unit it is measured in, and the derived sitting total is
 * printed so the split can be checked against the handbook at a glance.
 */
function ComponentEditor({ component, index, onPatch, onRemove, onAddPart, onPatchPart, onRemovePart }) {
  const ruleId = useId()
  const name = component.label || `COMPONENT ${index + 1}`
  const mode = component.rule?.mode ?? 'average'
  const parts = component.parts ?? []
  const total = sittingMax(component)

  return (
    <div style={boxStyle}>
      <div className="flex items-end gap-2 flex-wrap">
        <TextField
          label="NAME"
          ariaLabel={`Component ${index + 1} name`}
          value={component.label ?? ''}
          onCommit={v => onPatch({ label: v })}
        />
        <NumField
          label="WEIGHT"
          ariaLabel={`${name} weight in marks out of 100 for the subject`}
          value={component.weight ?? 0}
          min={0}
          max={100}
          step="0.5"
          suffix="/100"
          onCommit={v => onPatch({ weight: v })}
        />
        <ConfirmDeleteButton
          onConfirm={onRemove}
          label="DEL"
          confirmLabel="SURE?"
          style={{ padding: '3px 6px', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-mid)' }}
        />
      </div>
      <div style={{ ...microStyle, color: 'var(--cad-text-xlo)', marginTop: '2px' }}>
        WEIGHT = MARKS OUT OF 100 FOR THE WHOLE SUBJECT <span aria-hidden="true">∥</span> ID {component.id} (KEPT WHEN RENAMED)
      </div>

      <div className="flex items-end gap-2 flex-wrap" style={{ marginTop: '6px' }}>
        <div style={{ flex: '1 1 150px', minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <label htmlFor={ruleId} className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>RULE</label>
          <select
            id={ruleId}
            value={mode}
            aria-label={`${name} rule for combining repeated sittings`}
            onChange={e => onPatch({
              rule: e.target.value === 'best'
                ? { mode: 'best', n: Math.max(1, Number(component.rule?.n) || 1) }
                : { mode: e.target.value },
            })}
            style={inputStyle}
          >
            {AGGREGATION_MODES.map(m => (
              <option key={m} value={m}>{AGGREGATION_LABELS[m]}</option>
            ))}
          </select>
        </div>
        {mode === 'best' && (
          <NumField
            label="N"
            ariaLabel={`${name} — how many sittings count`}
            value={component.rule?.n ?? 1}
            min={1}
            max={20}
            width="52px"
            onCommit={v => onPatch({ rule: { mode: 'best', n: v } })}
          />
        )}
      </div>

      <div className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)', marginTop: '8px' }}>
        PARTS — MARKS AVAILABLE IN ONE SITTING
      </div>
      <div className="flex flex-col gap-1.5" style={{ marginTop: '4px' }}>
        {parts.map((p, i) => (
          <div key={p.id} className="flex items-end gap-2 flex-wrap">
            <TextField
              label="PART"
              ariaLabel={`${name} part ${i + 1} name`}
              value={p.label ?? ''}
              onCommit={v => onPatchPart(p.id, { label: v })}
            />
            <NumField
              label="MAX"
              ariaLabel={`${name} ${p.label || `part ${i + 1}`} marks available in one sitting`}
              value={p.max ?? 0}
              min={0}
              max={1000}
              step="0.5"
              onCommit={v => onPatchPart(p.id, { max: v })}
            />
            <button
              type="button"
              className="cad-x"
              aria-label={`Remove part ${p.label || i + 1} from ${name}`}
              onClick={() => onRemovePart(p.id)}
              style={{ fontSize: 'var(--cad-fs-sm)', padding: '3px 4px' }}
            >✕</button>
          </div>
        ))}
        {parts.length === 0 && (
          <div style={{ ...microStyle, color: 'var(--cad-text-lo)' }}>// NO PARTS — ONE SITTING IS WORTH 0</div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: '6px' }}>
        <button
          type="button"
          className="cad-chip btn-mech"
          aria-label={`Add a part to ${name}`}
          onClick={onAddPart}
        >＋ ADD PART</button>
        <span style={{ ...microStyle, color: 'var(--cad-text-hi)' }}>
          SITTING TOTAL {total}
          <span style={{ color: 'var(--cad-text-xlo)' }}>
            {parts.length ? ` = ${parts.map(p => Number(p.max) || 0).join(' + ')}` : ''}
          </span>
        </span>
      </div>
    </div>
  )
}

// ── Band editor ──────────────────────────────────────────────────

/**
 * Grade bands. Sorted by floor descending for display, keyed by uid so a row
 * that changes floor slides into place on commit instead of being remounted
 * under the cursor. Storage order is irrelevant — the data layer sorts on read.
 */
function BandEditor({ rows, scale, onPatchRow, onRemoveRow, onAddRow, onSetScale, errors }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => Number(b.min) - Number(a.min)), [rows])

  return (
    <div style={boxStyle}>
      <div className="flex items-end gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
        <NumField
          label="SCALE"
          ariaLabel="Maximum grade point on this scale"
          value={scale}
          min={1}
          max={100}
          step="0.5"
          suffix="MAX GP"
          onCommit={onSetScale}
        />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['FLOOR %', 'LABEL', 'GRADE PT', ''].map(h => (
              <th
                key={h || 'del'}
                scope="col"
                className="cad-label"
                style={{ fontSize: 'var(--cad-fs-micro)', textAlign: 'left', padding: '0 4px 2px 0', fontWeight: 'normal' }}
              >{h || <span className="sr-only">REMOVE</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.uid}>
              <td style={{ padding: '2px 4px 2px 0', width: '30%' }}>
                <NumField
                  ariaLabel={`Grade ${row.label || row.uid} — lowest percentage that earns it`}
                  value={row.min}
                  min={0}
                  max={100}
                  flex="1 1 auto"
                  width="100%"
                  onCommit={v => onPatchRow(row.uid, { min: v })}
                />
              </td>
              <td style={{ padding: '2px 4px 2px 0', width: '38%' }}>
                <TextField
                  ariaLabel={`Grade label for the band starting at ${row.min}%`}
                  value={row.label ?? ''}
                  flex="1 1 auto"
                  minWidth="0"
                  onCommit={v => onPatchRow(row.uid, { label: v })}
                />
              </td>
              <td style={{ padding: '2px 4px 2px 0', width: '24%' }}>
                <NumField
                  ariaLabel={`Grade point for ${row.label || `the band starting at ${row.min}%`}`}
                  value={row.gp}
                  min={0}
                  max={100}
                  step="0.5"
                  flex="1 1 auto"
                  width="100%"
                  onCommit={v => onPatchRow(row.uid, { gp: v })}
                />
              </td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>
                <button
                  type="button"
                  className="cad-x"
                  aria-label={`Remove grade band ${row.label || row.min}`}
                  onClick={() => onRemoveRow(row.uid)}
                  style={{ fontSize: 'var(--cad-fs-sm)', padding: '3px 4px' }}
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: '6px' }}>
        <button type="button" className="cad-chip btn-mech" onClick={onAddRow}>＋ ADD BAND</button>
        <span style={{ ...microStyle, color: 'var(--cad-text-xlo)' }}>
          A BAND CLAIMS EVERY PERCENTAGE FROM ITS FLOOR UP TO THE NEXT ONE
        </span>
      </div>

      {errors.length > 0 && (
        <div role="alert" style={{ ...microStyle, color: 'var(--cad-danger)', marginTop: '6px' }}>
          {errors.map(e => <div key={e}>⚠ {e}</div>)}
        </div>
      )}
    </div>
  )
}

// ── Orphan detection ─────────────────────────────────────────────

/**
 * Marks that the edited scheme would stop counting.
 *
 * Nothing is deleted — the assessments stay in storage — but a mark whose
 * `componentId`/`partId` no longer exists in the scheme contributes to no
 * total and shows up nowhere, which from the user's side is indistinguishable
 * from having lost it. So it gets named and counted before save, not after.
 */
function findOrphans({ assessments, scheme, baseline }) {
  const byKey = new Map()
  for (const a of assessments) {
    if (!isGraded(a)) continue
    const comp = (scheme?.components ?? []).find(c => c.id === a.componentId)
    const part = comp ? (comp.parts ?? []).find(p => p.id === a.partId) : null
    if (comp && (part || !a.partId)) continue

    const oldComp = (baseline?.components ?? []).find(c => c.id === a.componentId)
    const oldPart = (oldComp?.parts ?? []).find(p => p.id === a.partId)
    const key = `${a.componentId}\u0000${a.partId ?? ''}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        missing: comp ? 'PART' : 'COMPONENT',
        name: comp
          ? `${comp.label ?? a.componentId} · ${oldPart?.label ?? a.partId}`
          : `${oldComp?.label ?? a.componentId}${a.partId ? ` · ${oldPart?.label ?? a.partId}` : ''}`,
        count: 0,
        marks: 0,
      })
    }
    const hit = byKey.get(key)
    hit.count += 1
    hit.marks += Number(a.score) || 0
  }
  return [...byKey.values()].sort((a, b) => b.marks - a.marks)
}

/**
 * Grading scheme editor.
 *
 * The switch that matters is AVERAGE-OF-MIDS vs BEST-OF-MIDS — one college
 * averages the two internal sittings, the next keeps the higher one, and the
 * same marks then produce different grades. That is a preset choice, so the
 * presets stay the first thing on the page; below them is the full editor for
 * the colleges no preset fits.
 */
export function SchemeModal({ semester, subjects = [], subjectId = null, onSetScheme, onSetSubjectScheme, onClose }) {
  const subject = subjects.find(s => String(s.id) === String(subjectId)) ?? null
  const hasOverride = Boolean(subject?.gradingScheme)

  const [scope, setScope] = useState(subject ? 'SUBJECT' : 'SEMESTER')
  const [draft, setDraft] = useState(() => {
    const base = subject ? resolveScheme(semester, subject) : (semester?.gradingScheme ?? DEFAULT_SCHEME)
    return { ...base, components: base?.components ?? [], bands: toEditableBands(base?.bands) }
  })
  // The scheme as it was when the modal opened, kept only so a removed
  // component can still be named in the orphan warning.
  const [baseline] = useState(() =>
    subject ? resolveScheme(semester, subject) : (semester?.gradingScheme ?? DEFAULT_SCHEME))
  const [confirmingSave, setConfirmingSave] = useState(false)

  const clean = useMemo(() => cleanScheme(draft), [draft])
  const weights = validateScheme(draft)
  const bandCheck = validateBands(clean.bands)
  const bandRows = bandListOf(draft.bands)
  const scale = scaleOf(draft.bands)
  const rounding = draft?.rounding ?? 'none'

  // Which marks a save would strip of a home. Semester-level edits skip
  // subjects that carry their own override — those are not being changed.
  const orphans = useMemo(() => {
    const all = semester?.assessments ?? []
    const inScope = scope === 'SUBJECT' && subject
      ? all.filter(a => String(a.subjectId) === String(subject.id))
      : all.filter(a => {
          const s = subjects.find(x => String(x.id) === String(a.subjectId))
          return !s?.gradingScheme
        })
    return findOrphans({ assessments: inScope, scheme: draft, baseline })
  }, [semester, subjects, subject, scope, draft, baseline])

  const orphanMarks = orphans.reduce((a, o) => a + o.marks, 0)
  const orphanCount = orphans.reduce((a, o) => a + o.count, 0)

  const canSave = weights.valid && bandCheck.valid && (scope === 'SEMESTER' || Boolean(subject))

  // Any structural change re-arms the confirm — you never confirm a warning
  // and then save something else.
  const mutate = (fn) => { setConfirmingSave(false); setDraft(fn) }

  const applyScheme = (preset) => mutate(d => ({ ...d, components: preset.scheme.components }))
  const applyBands = (preset) => mutate(d => ({ ...d, bands: toEditableBands(preset) }))

  const patchComponent = (id, patch) =>
    mutate(d => ({ ...d, components: (d.components ?? []).map(c => (c.id === id ? { ...c, ...patch } : c)) }))

  const removeComponent = (id) =>
    mutate(d => ({ ...d, components: (d.components ?? []).filter(c => c.id !== id) }))

  const addComponent = () => mutate(d => {
    const list = d.components ?? []
    const label = `COMPONENT ${list.length + 1}`
    const id = uniqueId(slug(label, 'component'), list.map(c => c.id))
    return {
      ...d,
      components: [...list, {
        id, label, weight: 0, rule: { mode: 'average' },
        parts: [{ id: 'paper', label: 'PAPER', max: 10 }],
      }],
    }
  })

  const addPart = (componentId) => mutate(d => ({
    ...d,
    components: (d.components ?? []).map(c => {
      if (c.id !== componentId) return c
      const parts = c.parts ?? []
      const label = `PART ${parts.length + 1}`
      return { ...c, parts: [...parts, { id: uniqueId(slug(label, 'part'), parts.map(p => p.id)), label, max: 10 }] }
    }),
  }))

  const patchPart = (componentId, partId, patch) => mutate(d => ({
    ...d,
    components: (d.components ?? []).map(c => (c.id !== componentId ? c : {
      ...c,
      parts: (c.parts ?? []).map(p => (p.id === partId ? { ...p, ...patch } : p)),
    })),
  }))

  const removePart = (componentId, partId) => mutate(d => ({
    ...d,
    components: (d.components ?? []).map(c => (c.id !== componentId ? c : {
      ...c, parts: (c.parts ?? []).filter(p => p.id !== partId),
    })),
  }))

  const patchBands = (fn) => mutate(d => {
    const set = Array.isArray(d.bands) ? { scale: scaleOf(d.bands), bands: d.bands } : d.bands
    return { ...d, bands: { ...set, bands: fn(set?.bands ?? []) } }
  })

  const patchBandRow = (uid, patch) => patchBands(list => list.map(b => (b.uid === uid ? { ...b, ...patch } : b)))
  const removeBandRow = (uid) => patchBands(list => list.filter(b => b.uid !== uid))

  const addBandRow = () => patchBands(list => {
    const floors = list.map(b => Number(b.min)).filter(Number.isFinite)
    const used = new Set(floors)
    let min = Math.min(100, (floors.length ? Math.max(...floors) : 0) + 5)
    while (used.has(min) && min > 0) min -= 1
    const gp = Math.min(scale, (list.length ? Math.max(...list.map(b => Number(b.gp) || 0)) : 0) + 1)
    return [...list, withUid({ min, gp, label: 'NEW' })]
  })

  const setScale = (v) => mutate(d => {
    const set = Array.isArray(d.bands) ? { scale: v, bands: d.bands } : d.bands
    return { ...d, bands: { ...set, scale: v } }
  })

  const handleSave = () => {
    if (!canSave) return
    if (orphans.length > 0 && !confirmingSave) { setConfirmingSave(true); return }
    const out = cleanScheme(draft)
    if (scope === 'SUBJECT' && subject) onSetSubjectScheme?.(subject.id, out)
    else onSetScheme?.(out)
    onClose()
  }

  const schemeId = matchSchemePreset(draft)
  const bandId = matchBandPreset(clean)

  // A blocked save says which number is wrong, not "invalid" — the whole point
  // of the live total is that you can see the 105 you have to get back to 100.
  const blockedLabel = !weights.valid
    ? `CANNOT SAVE — TOTAL ${weights.total} / 100`
    : !bandCheck.valid
      ? `CANNOT SAVE — ${bandCheck.errors[0]}`
      : 'CANNOT SAVE — PICK A SUBJECT'

  const saveLabel = orphans.length === 0
    ? 'SAVE'
    : confirmingSave
      ? `SAVE ANYWAY — ${orphanMarks} MARKS STOP COUNTING`
      : `SAVE — ${orphanCount} ${orphanCount === 1 ? 'ENTRY' : 'ENTRIES'} AFFECTED`

  return (
    <Modal title="GRADING SCHEME" hex="0xF010" size="lg" onClose={onClose}>
      <div>
        {/* Scope */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>APPLIES TO</div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button" className="cad-chip btn-mech"
              data-active={scope === 'SEMESTER' || undefined} aria-pressed={scope === 'SEMESTER'}
              onClick={() => { setConfirmingSave(false); setScope('SEMESTER') }}
            >WHOLE SEMESTER</button>
            <button
              type="button" className="cad-chip btn-mech"
              data-active={scope === 'SUBJECT' || undefined} aria-pressed={scope === 'SUBJECT'}
              disabled={!subject}
              onClick={() => { setConfirmingSave(false); setScope('SUBJECT') }}
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

        {/* Components */}
        <div style={section}>
          <div className="flex items-baseline justify-between gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
            <div className="cad-label">COMPONENTS</div>
            <div style={{ ...microStyle, color: 'var(--cad-text-xlo)' }}>
              {(draft?.components ?? []).map(c => `${c.label} ${c.weight} (${ruleWords(c.rule)})`).join(' · ')}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {(draft?.components ?? []).map((c, i) => (
              <ComponentEditor
                key={c.id}
                component={c}
                index={i}
                onPatch={patch => patchComponent(c.id, patch)}
                onRemove={() => removeComponent(c.id)}
                onAddPart={() => addPart(c.id)}
                onPatchPart={(partId, patch) => patchPart(c.id, partId, patch)}
                onRemovePart={partId => removePart(c.id, partId)}
              />
            ))}
            {(draft?.components ?? []).length === 0 && (
              <div style={{ ...microStyle, color: 'var(--cad-text-lo)' }}>
                // NO COMPONENTS — PICK A SCHEME ABOVE OR ADD ONE
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: '6px' }}>
            <button type="button" className="cad-chip btn-mech" onClick={addComponent}>＋ ADD COMPONENT</button>
            <div
              role="status"
              style={{
                fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                color: weights.valid ? 'var(--cad-success)' : 'var(--cad-danger)',
              }}
            >
              TOTAL {weights.total} / 100{weights.valid ? '' : ' — WEIGHTS MUST ADD UP TO 100'}
            </div>
          </div>
        </div>

        {/* Rounding — how a component's marks are counted into the 100 */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>COMPONENT MARKS</div>
          <div className="flex gap-2 flex-wrap">
            {ROUNDING_MODES.map(mode => (
              <button
                key={mode}
                type="button"
                className="cad-chip btn-mech"
                data-active={rounding === mode || undefined}
                aria-pressed={rounding === mode}
                onClick={() => mutate(d => ({ ...d, rounding: mode }))}
              >
                {ROUNDING_LABELS[mode]}
              </button>
            ))}
          </div>
          <div style={{ ...microStyle, color: 'var(--cad-text-lo)', marginTop: '4px' }}>
            {ROUNDING_BLURBS[rounding]}
          </div>
        </div>

        {/* Grade bands */}
        <div style={section}>
          <div className="cad-label" style={{ marginBottom: '4px' }}>GRADE BANDS</div>
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
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
          <BandEditor
            rows={bandRows}
            scale={scale}
            errors={bandCheck.valid ? [] : bandCheck.errors}
            onPatchRow={patchBandRow}
            onRemoveRow={removeBandRow}
            onAddRow={addBandRow}
            onSetScale={setScale}
          />
        </div>

        {/* Orphaned marks */}
        {orphans.length > 0 && (
          <div
            role="status"
            style={{
              ...section, ...boxStyle,
              border: '1px solid var(--cad-danger)', background: 'var(--cad-danger-dim)',
            }}
          >
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', letterSpacing: 'var(--cad-track-mid)', color: 'var(--cad-text-hi)' }}>
              ⚠ {orphanCount} MARKED {orphanCount === 1 ? 'ENTRY' : 'ENTRIES'} WOULD STOP COUNTING
            </div>
            <div className="flex flex-col gap-0.5" style={{ marginTop: '4px' }}>
              {orphans.map(o => (
                <div key={o.key} style={{ ...microStyle, color: 'var(--cad-text-hi)' }}>
                  {o.name} — {o.missing} REMOVED <span aria-hidden="true">∥</span> {o.count} {o.count === 1 ? 'ENTRY' : 'ENTRIES'}, {Math.round(o.marks * 100) / 100} MARKS
                </div>
              ))}
            </div>
            <div style={{ ...microStyle, color: 'var(--cad-text-mid)', marginTop: '4px' }}>
              NOTHING IS DELETED. RESTORE THE COMPONENT OR PART WITH THE SAME ID AND THE MARKS COUNT AGAIN.
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 py-1.5 btn-mech panel-chamfer-sm ${confirmingSave ? 'blink' : ''}`}
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)',
              border: `1px solid ${confirmingSave ? 'var(--cad-danger)' : 'var(--cad-accent)'}`,
              color: confirmingSave ? 'var(--cad-danger)' : 'var(--cad-accent-text)',
              background: confirmingSave ? 'var(--cad-danger-dim)' : 'var(--cad-accent-dim)',
              borderRadius: 'var(--cad-radius)',
              opacity: canSave ? 1 : 0.4,
            }}
          >{canSave ? saveLabel : blockedLabel}</button>
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
