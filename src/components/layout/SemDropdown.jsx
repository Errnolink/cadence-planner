import { useState, useEffect, useRef, useCallback } from 'react'

export function SemDropdown({ semesters, activeSemId, onChange, onRemove, onAdd, editMode }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [deleteStage, setDeleteStage] = useState({})
  const ref    = useRef(null)
  const active = semesters.find(s => String(s.id) === String(activeSemId))

  const closeDropdown = useCallback(() => {
    if (closing || !open) return
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false); setDeleteStage({}) }, 120)
  }, [closing, open])

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) closeDropdown() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [closeDropdown])

  const btnStyle = {
    background:   'var(--cad-accent-dim)',
    border:       '1px solid var(--cad-accent)',
    borderRadius: 'var(--cad-radius)',
    minWidth:     '110px',
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => open ? closeDropdown() : setOpen(true)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Semester: ${active?.label ?? 'none'}`}
        className="flex items-center gap-2 px-2.5 py-1.5 panel-chamfer-sm btn-mech"
        style={btnStyle}
      >
        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--cad-accent-text)', letterSpacing: 'var(--cad-track-mid)', flex: 1, textAlign: 'left' }}>
          {active?.label ?? '—'}
        </span>
        <span aria-hidden="true" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)', transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)', display: 'inline-block', transform: open ? 'rotate(-180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full mt-1 z-30 ${closing ? 'anim-dropdown-exit' : 'anim-dropdown-enter'}`}
          style={{
            border:       '1px solid var(--cad-accent)',
            background:   'var(--cad-bg-panel)',
            boxShadow:    'var(--cad-shadow-panel)',
            minWidth:     '140px',
            borderRadius: 'var(--cad-radius)',
            overflow:     'hidden',
            maxHeight:    'min(60vh, 400px)',
            overflowY:    'auto',
          }}
        >
          {semesters.map(s => (
              <div
                key={s.id}
                className="w-full flex items-center justify-between px-3 py-2 cad-hover-row"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     'var(--cad-fs-sm)',
                  letterSpacing:'var(--cad-track-mid)',
                  borderLeft:   String(s.id) === String(activeSemId) ? '2px solid var(--cad-accent)' : '2px solid transparent',
                  color:        String(s.id) === String(activeSemId) ? 'var(--cad-accent-text)' : 'var(--cad-text-mid)',
                  background:   'transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => { onChange(s.id); closeDropdown() }}
                  aria-current={String(s.id) === String(activeSemId) || undefined}
                  className="flex-1 text-left"
                  style={{ background: 'none', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}
                >
                  {s.label}
                </button>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--cad-text-lo)', fontSize: 'var(--cad-fs-micro)' }}>
                    {s.subjects.reduce((a, x) => a + (parseFloat(x.credits)||0), 0).toFixed(1)}CR
                  </span>
                  {editMode && semesters.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const stage = deleteStage[s.id] || 0
                        if (stage === 0) {
                          setDeleteStage(prev => ({ ...prev, [s.id]: 1 }))
                        } else if (stage === 1) {
                          setDeleteStage(prev => ({ ...prev, [s.id]: 2 }))
                        } else {
                          onRemove(s.id)
                          if (s.id === activeSemId) closeDropdown()
                        }
                      }}
                      className="btn-mech"
                      style={{ background: 'none', border: 'none', color: 'var(--cad-danger)', fontSize: 'var(--cad-fs-micro)', cursor: 'pointer', padding: '0 2px' }}
                      title="Delete Semester"
                      aria-label={`Delete ${s.label}`}
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
                type="button"
                onClick={() => { onAdd(); closeDropdown(); }}
                className="w-full px-3 py-2 text-center cad-hover-row"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     'var(--cad-fs-micro)',
                  letterSpacing:'var(--cad-track-wide)',
                  color:        'var(--cad-accent)',
                  background:   'transparent',
                  border:       'none',
                  cursor:       'pointer'
                }}
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
