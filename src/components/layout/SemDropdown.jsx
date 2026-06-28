import { useState, useEffect, useRef } from 'react'

export function SemDropdown({ semesters, activeSemId, onChange, onRemove, onAdd, editMode }) {
  const [open, setOpen] = useState(false)
  const [deleteStage, setDeleteStage] = useState({})
  const ref    = useRef(null)
  const active = semesters.find(s => s.id === activeSemId)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setDeleteStage({}) } }
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
            overflow:     'hidden',
          }}
        >
          {semesters.map(s => (
              <div
                key={s.id}
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
                <button
                  onClick={() => { onChange(s.id); setOpen(false) }}
                  className="flex-1 text-left"
                  style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}
                >
                  {s.label}
                </button>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--cad-text-lo)', fontSize: '9px' }}>
                    {s.subjects.reduce((a, x) => a + (parseFloat(x.credits)||0), 0).toFixed(1)}CR
                  </span>
                  {editMode && semesters.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const stage = deleteStage[s.id] || 0
                        if (stage === 0) {
                          setDeleteStage(prev => ({ ...prev, [s.id]: 1 }))
                        } else if (stage === 1) {
                          setDeleteStage(prev => ({ ...prev, [s.id]: 2 }))
                        } else {
                          onRemove(s.id)
                          if (s.id === activeSemId) setOpen(false)
                        }
                      }}
                      className="btn-mech"
                      style={{ background: 'none', border: 'none', color: 'var(--cad-danger)', fontSize: '10px', cursor: 'pointer', padding: '0 2px' }}
                      title="Delete Semester"
                    >
                      {deleteStage[s.id] === 2 ? 'REALLY?' : deleteStage[s.id] === 1 ? 'SURE?' : '×'}
                    </button>
                  )}
                </div>
              </div>
          ))}
          
          {editMode && (
            <div className="w-full" style={{ borderTop: '1px solid var(--cad-border-dim)' }}>
              <button
                onClick={() => { onAdd(); setOpen(false); }}
                className="w-full px-3 py-2 text-center transition-colors"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '10px',
                  letterSpacing:'0.15em',
                  color:        'var(--cad-accent)',
                  background:   'transparent',
                  border:       'none',
                  cursor:       'pointer'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--cad-accent-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                + ADD SEMESTER
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
