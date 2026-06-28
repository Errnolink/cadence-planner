import { SUBJECT_COLORS } from '../../data/index.js'

export function ColorPicker({ value, onChange }) {
  return (
    <div className="p-2" style={{ background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)' }}>
      <div className="text-[9px] tracking-widest uppercase mb-2"
        style={{ color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>
        SELECT COLOR // {SUBJECT_COLORS[value]?.name}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {SUBJECT_COLORS.map(c => (
          <button key={c.id} onClick={() => onChange(c.id)} title={c.name}
            className="w-7 h-7 transition-all"
            style={{
              background:    c.bg,
              border:        `2px solid ${c.border}`,
              boxShadow:     value === c.id ? `0 0 10px ${c.border}` : 'none',
              outline:       value === c.id ? '1px solid white' : 'none',
              outlineOffset: '1px',
              transform:     value === c.id ? 'scale(1.15)' : 'scale(1)',
              borderRadius:  'var(--cad-radius)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
