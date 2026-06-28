import { useEffect, useRef } from 'react'
import { Dot } from './Dot.jsx'

/**
 * Theme-aware modal wrapper. Replaces NervModal.
 * Uses CSS variables so it looks correct in any theme.
 */
export function Modal({ title, hex, onClose, children }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div
        className="w-full max-w-sm panel-chamfer overflow-hidden"
        style={{
          border:     '2px solid var(--cad-accent)',
          background: 'var(--cad-bg-panel)',
          boxShadow:  'var(--cad-shadow-panel)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2"
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
              onClick={onClose}
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
