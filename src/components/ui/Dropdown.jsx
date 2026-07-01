import { useState, useEffect, useRef } from 'react'

export function Dropdown({ value, options, onChange, renderLabel, minWidth = '100px' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2.5 py-1 panel-chamfer-sm btn-mech"
        style={{
          background:   'transparent',
          border:       '1px solid var(--cad-border)',
          borderRadius: 'var(--cad-radius)',
          minWidth,
          fontFamily:   'var(--cad-font-mono)',
          fontSize:     '13px',
          letterSpacing:'0.1em',
          color:        'var(--cad-accent)',
        }}
      >
        <span style={{ flex: 1, textAlign: 'center' }}>
          {renderLabel ? renderLabel(selectedOption) : selectedOption?.label ?? '—'}
        </span>
        <span style={{
          fontSize: '10px', color: 'var(--cad-accent)',
          transition: 'transform 0.2s', display: 'inline-block',
          transform: open ? 'rotate(-180deg)' : 'none'
        }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30"
          style={{
            border:       '1px solid var(--cad-accent)',
            background:   'var(--cad-bg-panel)',
            boxShadow:    'var(--cad-shadow-panel)',
            minWidth,
            borderRadius: 'var(--cad-radius)',
            overflow:     'hidden',
            maxHeight:    'min(60vh, 300px)',
            overflowY:    'auto',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full px-3 py-1.5 text-left transition-colors"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '12px',
                letterSpacing:'0.1em',
                color:        opt.value === value ? 'var(--cad-accent-text)' : 'var(--cad-text-mid)',
                borderLeft:   opt.value === value ? '2px solid var(--cad-accent)' : '2px solid transparent',
                background:   'transparent',
                border:       'none',
                cursor:       'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--cad-accent-dim)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {renderLabel ? renderLabel(opt) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
