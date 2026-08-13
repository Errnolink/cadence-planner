import { useState, useEffect } from 'react'
import { SUBJECT_COLORS, GRADE_MAP, gpToLabel, generateSubjectCode, subjectVars, subjectIdx } from '../../data/index.js'
import { ColorPicker } from '../ui/ColorPicker.jsx'

/** Non-colour signal for the grade tier, so the tier isn't colour-only. */
const gradeTier = (gp) =>
  gp === null || gp === undefined ? { color: 'var(--cad-text-lo)', mark: '', label: 'no grade' }
  : gp >= 8 ? { color: 'var(--cad-success)', mark: '▲', label: 'high' }
  : gp >= 6 ? { color: 'var(--cad-accent)',  mark: '■', label: 'mid'  }
  : { color: 'var(--cad-danger)', mark: '▼', label: 'low' }

export function SubjectRow({ subject, grade, editMode, onUpdate, onRemove, staggerIndex = 0 }) {
  const colorName = SUBJECT_COLORS.find(c => c.id === subjectIdx(subject.colorIdx))?.name
  const [showColors, setShowColors] = useState(false)
  // Local draft so keystrokes don't re-render the whole app + write storage per keypress
  const [draft, setDraft] = useState(() => ({ name: subject.name, code: subject.code ?? '', credits: subject.credits }))
  const [focused, setFocused] = useState(null)

  // Resync draft after external updates (cloud pull) while the row isn't being edited
  useEffect(() => {
    if (!focused) setDraft({ name: subject.name, code: subject.code ?? '', credits: subject.credits })
  }, [subject.name, subject.code, subject.credits, focused])

  const commitField = (key, value) => {
    const parsed = key === 'credits' ? (parseFloat(value) || 0) : value
    const current = key === 'credits' ? (parseFloat(subject.credits) || 0) : (subject[key] ?? '')
    if (parsed !== current) onUpdate(subject.id, key, parsed)
  }
  const commitOnBlur = (key) => (e) => {
    setFocused(null)
    commitField(key, e.target.value)
  }
  const commitOnEnter = (key) => (e) => {
    if (e.key === 'Enter') { commitField(key, e.target.value); e.currentTarget.blur() }
  }

  // The effective grade: derived from marks when they exist, otherwise the
  // value typed into the dropdown.
  const derived  = grade?.source === 'derived'
  const shownGp  = grade?.gp ?? subject.gradePoint
  const tier     = gradeTier(shownGp)

  return (
    <div
      className="mb-1.5 anim-stagger-row"
      style={{
        ...subjectVars(subject.colorIdx),
        borderLeft: '3px solid var(--subj-border)',
        background: 'linear-gradient(90deg, var(--subj-bg) 0%, transparent 70%)',
        '--stagger-delay': `${staggerIndex * 40}ms`,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 px-2 py-1.5">
        {/* Line 1: Color swatch + Full name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Color swatch */}
          <button
            type="button"
            onClick={() => editMode && setShowColors(v => !v)}
            disabled={!editMode}
            aria-expanded={editMode ? showColors : undefined}
            className={`w-3 h-3 shrink-0 transition-transform ${editMode ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
            style={{ background: 'var(--subj-border)', boxShadow: '0 0 4px var(--subj-border)', borderRadius: '1px' }}
            title={editMode ? 'CHANGE COLOR' : colorName}
            aria-label={editMode ? `Change colour (currently ${colorName})` : colorName}
          />

          {/* Name */}
          <input
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            onBlur={commitOnBlur('name')}
            onKeyDown={commitOnEnter('name')}
            onFocus={() => setFocused('name')}
            disabled={!editMode}
            spellCheck={false}
            aria-label="Subject name"
            className="flex-1 min-w-0 bg-transparent cad-underline"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    'var(--cad-fs-sm)',
              letterSpacing:'0.05em',
              color:       'var(--subj-text)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
              transition:  'border-color 0.15s',
            }}
          />
        </div>

        {/* Line 2: Code · Credits · Grade · Remove (right-aligned on mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-1.5 pl-5 sm:pl-0 shrink-0">
          {/* Code */}
          <input
            value={draft.code}
            placeholder={generateSubjectCode(subject.name)}
            onChange={e => setDraft(d => ({ ...d, code: e.target.value }))}
            onBlur={commitOnBlur('code')}
            onKeyDown={commitOnEnter('code')}
            onFocus={() => setFocused('code')}
            disabled={!editMode}
            spellCheck={false}
            aria-label="Subject code"
            className="w-12 shrink-0 bg-transparent text-center cad-underline"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    'var(--cad-fs-xs)',
              color:       'var(--cad-accent)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
              transition:  'border-color 0.15s',
            }}
          />

          {/* Credits — drop the redundant "CR" label per-row */}
          <input
            type="number" min="0.5" max="8" step="0.5"
            value={draft.credits}
            onChange={e => setDraft(d => ({ ...d, credits: e.target.value }))}
            onFocus={() => setFocused('credits')}
            onBlur={commitOnBlur('credits')}
            onKeyDown={commitOnEnter('credits')}
            disabled={!editMode}
            aria-label="Credits"
            className="w-8 text-right bg-transparent cad-underline"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    'var(--cad-fs-sm)',
              color:       'var(--cad-accent-text)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
            }}
          />

          {/* Grade */}
          <div className="shrink-0 w-10 text-right">
            {editMode ? (
              <select
                value={subject.gradePoint ?? ''}
                onChange={e => onUpdate(subject.id, 'gradePoint', e.target.value === '' ? null : Number(e.target.value))}
                aria-label={derived ? `Grade point for ${subject.name} — currently computed from marks, this overrides it` : `Grade point for ${subject.name}`}
                className="w-full text-right bg-transparent cursor-pointer"
                style={{
                  fontFamily:  'var(--cad-font-mono)',
                  fontSize:    'var(--cad-fs-xs)',
                  color:       'var(--cad-text-hi)',
                  borderBottom:'1px solid var(--cad-border)',
                }}
              >
                <option value="" style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>—</option>
                {GRADE_MAP.map(g => <option key={g.gp} value={g.gp} style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>{g.label}</option>)}
              </select>
            ) : (
              <span
                title={derived
                  ? `Grade ${gpToLabel(shownGp)} (${tier.label}) — computed from ${grade.pct.toFixed(1)}% of entered marks`
                  : `Grade ${gpToLabel(shownGp)} (${tier.label}) — entered by hand`}
                style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: tier.color }}
              >
                {tier.mark && <span aria-hidden="true" style={{ marginRight: '2px' }}>{tier.mark}</span>}
                {gpToLabel(shownGp)}
                {/* A dot marks a grade the app worked out from marks, so a
                    typed value is never mistaken for a computed one. */}
                {derived && <span aria-hidden="true" style={{ color: 'var(--cad-accent)', marginLeft: '2px' }}>•</span>}
                {derived && <span className="sr-only"> computed from marks</span>}
              </span>
            )}
          </div>

          {/* Remove */}
          {editMode && (
            <button
              type="button"
              onClick={() => onRemove(subject.id)}
              aria-label={`Remove ${subject.name}`}
              className="w-4 text-center shrink-0 cad-x btn-mech"
              style={{ fontSize: 'var(--cad-fs-xs)' }}
            >✕</button>
          )}
        </div>
      </div>

      {showColors && editMode && (
        <div className="mx-2 mb-1.5">
          <ColorPicker value={subject.colorIdx} onChange={idx => { onUpdate(subject.id, 'colorIdx', idx); setShowColors(false) }} />
        </div>
      )}
    </div>
  )
}
