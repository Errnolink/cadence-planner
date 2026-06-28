import { useState } from 'react'
import { SUBJECT_COLORS, GRADE_MAP, gpToLabel } from '../../data/index.js'
import { ColorPicker } from '../ui/ColorPicker.jsx'

export function SubjectRow({ subject, editMode, onUpdate, onRemove }) {
  const color = SUBJECT_COLORS[subject.colorIdx % SUBJECT_COLORS.length]
  const [showColors, setShowColors] = useState(false)

  return (
    <div
      className="mb-1.5"
      style={{
        borderLeft: `3px solid ${color.border}`,
        background: `linear-gradient(90deg, ${color.bg} 0%, transparent 70%)`,
      }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
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
          value={subject.name}
          onChange={e => onUpdate(subject.id, 'name', e.target.value.toUpperCase())}
          disabled={!editMode}
          spellCheck={false}
          className="flex-1 min-w-0 uppercase bg-transparent"
          style={{
            fontFamily:  'var(--cad-font-mono)',
            fontSize:    '11px',
            letterSpacing:'0.05em',
            color:       color.text,
            borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
            outline:     'none',
            transition:  'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--cad-accent)' }}
          onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--cad-border)'  }}
        />

        {/* Credits */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span style={{ fontSize: '8px', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>CR</span>
          <input
            type="number" min="0.5" max="8" step="0.5"
            value={subject.credits}
            onChange={e => onUpdate(subject.id, 'credits', parseFloat(e.target.value) || 0)}
            disabled={!editMode}
            className="w-8 text-right bg-transparent"
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '11px',
              color:       'var(--cad-accent-text)',
              borderBottom: editMode ? '1px solid var(--cad-border)' : '1px solid transparent',
              outline:     'none',
            }}
          />
        </div>

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
                outline:     'none',
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
            className="w-4 text-center transition-colors shrink-0"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-lo)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-danger)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
          >✕</button>
        )}
      </div>

      {showColors && editMode && (
        <div className="mx-2 mb-1.5">
          <ColorPicker value={subject.colorIdx} onChange={idx => { onUpdate(subject.id, 'colorIdx', idx); setShowColors(false) }} />
        </div>
      )}
    </div>
  )
}
