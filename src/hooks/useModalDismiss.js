import { useCallback, useEffect, useState } from 'react'

/**
 * Shared dismiss machinery for modals: closing state to drive exit
 * animations, Escape-to-close, and a 200ms delay before onClose fires
 * (matches the exit animation duration).
 */
export function useModalDismiss(onClose) {
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => onClose(), 200)
  }, [closing, onClose])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleClose])

  return { closing, handleClose }
}
