import { useEffect, useRef, useState, useCallback } from 'react'
import { Dot } from './Dot.jsx'

/**
 * Theme-aware modal with NERV mechanical transition.
 */
export function Modal({ title, hex, onClose, children }) {
  const backdropRef = useRef(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => onClose(), 200) // matches exit animation duration
  }, [closing, onClose])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleClose])

  const backdropAnimClass = closing ? 'anim-modal-backdrop-exit' : 'anim-modal-backdrop-enter'
  const panelAnimClass = closing ? 'anim-modal-panel-exit' : 'anim-modal-panel-enter'

  return (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropAnimClass}`}
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === backdropRef.current) handleClose() }}
    >
      <div
        className={`w-full max-w-sm panel-chamfer overflow-hidden ${panelAnimClass}`}
        style={{
          border: '2px solid var(--cad-accent)',
          background: 'var(--cad-bg-panel)',
          boxShadow: 'var(--cad-shadow-panel)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 shrink-0"
          style={{
            borderBottom: '1px solid var(--cad-border)',
            background:   'var(--cad-bg-header)',
          }}
        >
          <div className="flex items-center gap-2">
            <Dot on />
            <span
              className="text-[10px] tracking-widest uppercase font-semibold"
              style={{ color: 'var(--cad-accent)', fontFamily: 'var(--cad-font-mono)' }}
            >{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {hex && (
              <span className="hex-val" style={{ color: 'var(--cad-hex-color)', fontSize: '10px', fontFamily: 'var(--cad-font-mono)' }}>
                {hex}
              </span>
            )}
            <button
              onClick={handleClose}
              className="text-xs transition-colors"
              style={{ color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-danger)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: '82vh' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
