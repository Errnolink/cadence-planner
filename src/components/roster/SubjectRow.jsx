import { useState, useEffect } from 'react'
import { SUBJECT_COLORS, GRADE_MAP, gpToLabel, generateSubjectCode } from '../../data/index.js'
import { ColorPicker } from '../ui/ColorPicker.jsx'

export function SubjectRow({ subject, editMode, onUpdate, onRemove, staggerIndex = 0 }) {
  const color = SUBJECT_COLORS[subject.colorIdx % SUBJECT_COLORS.length]
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
    e.currentTarget.style.borderBottomColor = 'var(--cad-border)'
  }
  const commitOnEnter = (key) => (e) => {
    if (e.key === 'Enter') { commitField(key, e.target.value); e.currentTarget.blur() }
  }

  return (
    <div
      className="mb-1.5 anim-stagger-row"
      style={{
        borderLeft: `3px solid ${color.border}`,
        background: `linear-gradient(90deg, ${color.bg} 0%, transparent 70%)`,
        '--stagger-delay': `${staggerIndex * 40}ms`,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 px-2 py-1.5">
        {/* Line 1: Color swatch + Full name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Color swatch */}
          <button
            onClick={() => editMode && setShowColors(v => !v)}
            disabled={!editMode}
            className={`w-3 h-3 shrink-0 transition-transform ${editMode ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
            style={{ background: color.border, boxShadow: `0 0 4px ${color.border}80`, borderRadius: '1px' }}
            title={editMode ? 'CHANGE COLOR' : color.name}
          />

          {/* Name */}
          <input
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            onBlur={commitOnBlur('name')}
            onKeyDown={commitOnEnter('name')}
            disabled={!editMode}
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '11px',
              letterSpacing:'0.05em',
              color:       color.text,
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
              transition:  'border-color 0.15s',
            }}
            onFocus={e => { setFocused('name'); e.currentTarget.style.borderBottomColor = 'var(--cad-accent)' }}
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
            disabled={!editMode}
            spellCheck={false}
            className="w-12 shrink-0 bg-transparent text-center"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '10px',
              color:       'var(--cad-accent)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
              transition:  'border-color 0.15s',
            }}
            onFocus={e => { setFocused('code'); e.currentTarget.style.borderBottomColor = 'var(--cad-accent)' }}
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
            className="w-8 text-right bg-transparent"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '11px',
              color:       'var(--cad-accent-text)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
            }}
          />

          {/* Grade */}
          <div className="shrink-0 w-8 text-right">
            {editMode ? (
              <select
                value={subject.gradePoint ?? ''}
                onChange={e => onUpdate(subject.id, 'gradePoint', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full text-right bg-transparent cursor-pointer"
                style={{
                  fontFamily:  'var(--cad-font-mono)',
                  fontSize:    '9px',
                  color:       'var(--cad-text-hi)',
                  borderBottom:'1px solid var(--cad-border)',
                }}
              >
                <option value="" style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>—</option>
                {GRADE_MAP.map(g => <option key={g.gp} value={g.gp} style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>{g.label}</option>)}
              </select>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--cad-font-mono)',
                  fontSize:   '10px',
                  color:      subject.gradePoint === null
                    ? 'var(--cad-text-lo)'
                    : subject.gradePoint >= 8 ? 'var(--cad-success)'
                    : subject.gradePoint >= 6 ? 'var(--cad-accent)'
                    : 'var(--cad-danger)',
                }}
              >{gpToLabel(subject.gradePoint)}</span>
            )}
          </div>

          {/* Remove */}
          {editMode && (
            <button
              onClick={() => onRemove(subject.id)}
              aria-label={`Remove ${subject.name}`}
              className="w-4 text-center transition-colors shrink-0"
              style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-lo)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-danger)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
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
