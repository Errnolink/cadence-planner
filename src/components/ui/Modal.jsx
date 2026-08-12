import { useEffect, useRef, useId } from 'react'
import { Dot } from './Dot.jsx'
import { useModalDismiss } from '../../hooks/useModalDismiss.js'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Theme-aware modal with NERV mechanical transition.
 *
 * variant="center" (default) — centred card.
 * variant="sheet"            — slides up from the bottom on mobile, centred on
 *                              desktop. DayDetailModal used to hand-roll this,
 *                              which meant it silently lost the focus trap,
 *                              initial focus, focus restoration and scroll lock.
 *
 * `headerExtra` renders to the left of the hex label / close button, for the
 * one action (SET HOLIDAY) that belongs in the title bar.
 */
export function Modal({ title, subtitle, hex, onClose, variant = 'center', headerExtra, ariaLabel, children }) {
  const { closing, handleClose } = useModalDismiss(onClose)
  const panelRef = useRef(null)
  const titleId = useId()
  const sheet = variant === 'sheet'

  // Move focus into the modal, trap Tab, restore focus + unlock scroll on unmount
  const restoreFocusRef = useRef(null)
  useEffect(() => {
    restoreFocusRef.current = document.activeElement
    panelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      if (restoreFocusRef.current?.focus) restoreFocusRef.current.focus()
    }
  }, [])

  const handlePanelKeyDown = (e) => {
    if (e.key !== 'Tab') return
    // Disabled and hidden controls are not tab stops; including them stalls the
    // trap (e.g. SettingsModal's IMPORT button while its input is empty).
    const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
      .filter(n => !n.disabled && n.offsetParent !== null)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const backdropAnimClass = closing ? 'anim-modal-backdrop-exit' : 'anim-modal-backdrop-enter'
  const panelAnimClass = closing ? 'anim-modal-panel-exit' : 'anim-modal-panel-enter'

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
        sheet ? 'items-end p-0 md:items-center md:p-4' : 'items-center p-4'
      } ${backdropAnimClass}`}
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        onKeyDown={handlePanelKeyDown}
        className={`w-full panel-chamfer overflow-hidden flex flex-col ${
          sheet ? 'md:max-w-sm' : 'max-w-sm'
        } ${panelAnimClass}`}
        style={{
          border: '2px solid var(--cad-accent)',
          background: 'var(--cad-bg-panel)',
          boxShadow: 'var(--cad-shadow-panel)',
          position: 'relative',
          outline: 'none',
          maxHeight: sheet ? '85vh' : undefined,
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
          <div className="flex items-center gap-2 min-w-0">
            <Dot on />
            <div className="min-w-0">
              <span
                id={titleId}
                className="block tracking-widest uppercase font-semibold"
                style={{ color: 'var(--cad-accent)', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)' }}
              >{title}</span>
              {subtitle && (
                <span
                  className="block"
                  style={{ color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)' }}
                >{subtitle}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerExtra}
            {hex && (
              <span className="hex-val" style={{ color: 'var(--cad-hex-color)', fontSize: 'var(--cad-fs-micro)', fontFamily: 'var(--cad-font-mono)' }}>
                {hex}
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="cad-x"
              style={{ fontSize: 'var(--cad-fs-sm)' }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div
          className={sheet ? 'overflow-y-auto flex-1 min-h-0' : 'p-4 overflow-y-auto'}
          style={sheet ? undefined : { maxHeight: '82vh' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
