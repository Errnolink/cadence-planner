import { useEffect, useRef, useState } from 'react'

/**
 * DELETE button with a two-step confirm: first click arms it (blinks,
 * auto-disarms after 2.5s), second click fires onConfirm.
 */
export function ConfirmDeleteButton({ onConfirm, label = 'DELETE', confirmLabel = 'CONFIRM?', ariaLabel, className = '', style = {} }) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true)
      timerRef.current = setTimeout(() => setConfirming(false), 2500)
      return
    }
    clearTimeout(timerRef.current)
    onConfirm()
  }

  return (
    <button
      aria-label={ariaLabel}
      onClick={handleClick}
      className={`px-3 py-1.5 btn-mech panel-chamfer-sm ${confirming ? 'blink' : ''} ${className}`}
      style={{
        fontFamily:   'var(--cad-font-mono)',
        fontSize:     '10px',
        letterSpacing:'0.15em',
        border:       confirming ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
        color:        confirming ? 'var(--cad-danger)'           : 'var(--cad-text-mid)',
        background:   confirming ? 'var(--cad-danger-dim)'       : 'transparent',
        borderRadius: 'var(--cad-radius)',
        ...style,
      }}
    >{confirming ? confirmLabel : label}</button>
  )
}
