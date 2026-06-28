import { useState, useEffect, useRef } from 'react'

export function SemDropdown({ semesters, activeSemId, onChange }) {
  const [open, setOpen] = useState(false)
  const ref    = useRef(null)
  const active = semesters.find(s => s.id === activeSemId)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const btnStyle = {
    background:   open ? 'var(--cad-accent-dim)' : 'var(--cad-accent-dim)',
    border:       '1px solid var(--cad-accent)',
    borderRadius: 'var(--cad-radius)',
    minWidth:     '110px',
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 panel-chamfer-sm btn-mech"
        style={btnStyle}
      >
        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-accent-text)', letterSpacing: '0.1em', flex: 1, textAlign: 'left' }}>
          {active?.label ?? '—'}
        </span>
        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-accent)', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(-180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30"
          style={{
            border:       '1px solid var(--cad-accent)',
            background:   'var(--cad-bg-panel)',
            boxShadow:    'var(--cad-shadow-panel)',
            minWidth:     '140px',
            borderRadius: 'var(--cad-radius)',
          }}
        >
          {semesters.map(s => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 transition-colors"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '11px',
                letterSpacing:'0.1em',
                borderLeft:   s.id === activeSemId ? '2px solid var(--cad-accent)' : '2px solid transparent',
                color:        s.id === activeSemId ? 'var(--cad-accent-text)' : 'var(--cad-text-mid)',
                background:   'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--cad-accent-dim)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span>{s.label}</span>
              <span style={{ color: 'var(--cad-text-lo)', fontSize: '9px' }}>
                {s.subjects.reduce((a, x) => a + x.credits, 0).toFixed(1)}CR
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
