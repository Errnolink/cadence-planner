import { useId } from 'react'
import { SUBJECT_COLORS, subjectVar } from '../../data/index.js'

export function ColorPicker({ value, onChange }) {
  const labelId = useId()
  return (
    <div className="p-2" style={{ background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)' }}>
      <div className="cad-label mb-2" id={labelId}>
        SELECT COLOR // {SUBJECT_COLORS.find(c => c.id === value)?.name}
      </div>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-labelledby={labelId}>
        {SUBJECT_COLORS.map(c => (
          <button key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            title={c.name}
            aria-label={c.name}
            aria-pressed={value === c.id}
            className="w-7 h-7"
            style={{
              // Swatch colours come from the theme layer so they match what the
              // timetable will actually render for this index.
              background:    subjectVar(c.id, 'bg'),
              border:        `2px solid ${subjectVar(c.id, 'border')}`,
              boxShadow:     value === c.id ? `0 0 10px ${subjectVar(c.id, 'border')}` : 'none',
              outline:       value === c.id ? '1px solid var(--cad-text-hi)' : 'none',
              outlineOffset: '1px',
              transform:     value === c.id ? 'scale(1.15)' : 'scale(1)',
              transition:    'transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms ease-out',
              borderRadius:  'var(--cad-radius)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
