import { useState, useEffect, useRef } from 'react'
import { useSettings } from '../../hooks/useSettings.jsx'
import { useTheme } from '../../themes/ThemeContext.jsx'

export function GpaBadge({ label, hex, value, gradedCount, totalCount }) {
  const [glitching, setGlitching] = useState(true)
  const [displayValue, setDisplayValue] = useState("---")
  const { settings } = useSettings()
  const { currentTheme } = useTheme()
  const badgeRef = useRef(null)

  useEffect(() => {
    // Glitch is a NERV-style flourish — only play it on non-minimal themes.
    // (themeMode is 'dark' | 'light', so we key off the active theme id instead.)
    const shouldGlitch = settings.enableGlitch !== false && currentTheme?.id !== 'minimal'
    let t1, t2;
    
    if (!shouldGlitch) {
      setDisplayValue(value)
      setGlitching(false)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setGlitching(true)
        setDisplayValue("---")
        
        clearTimeout(t1)
        clearTimeout(t2)
        
        t1 = setTimeout(() => setDisplayValue(value), 75)
        t2 = setTimeout(() => setGlitching(false), 150)
      }
    }, { threshold: 0.1 })

    if (badgeRef.current) {
      observer.observe(badgeRef.current)
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      observer.disconnect()
    }
  }, [value, settings.enableGlitch, currentTheme?.id])
  const gpaFloat = value !== null && value !== undefined ? parseFloat(value) : null

  const colorStyle = gpaFloat === null
    ? 'var(--cad-text-lo)'
    : gpaFloat >= 8 ? 'var(--cad-success)'
    : gpaFloat >= 6 ? 'var(--cad-accent)'
    : 'var(--cad-danger)'

  const glowClass = gpaFloat === null ? ''
    : gpaFloat >= 8 ? 'glow-success'
    : gpaFloat >= 6 ? 'glow-accent'
    : 'glow-danger'

  const rankLabel = gpaFloat === null ? null
    : gpaFloat >= 9 ? 'DISTINGUISHED'
    : gpaFloat >= 8 ? 'FIRST CLASS'
    : gpaFloat >= 6 ? 'SECOND CLASS'
    : 'PASS'

  return (
    <div
      ref={badgeRef}
      className="shrink-0 px-2 py-2 panel-chamfer-sm"
      style={{ border: '1px solid var(--cad-border)', background: 'var(--cad-bg-input)', overflow: 'hidden' }}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>
          {label}
        </span>
        {hex && (
          <span className="hex-val" style={{ color: 'var(--cad-hex-color)', fontSize: 'var(--cad-fs-micro)', fontFamily: 'var(--cad-font-mono)' }}>{hex}</span>
        )}
      </div>

      {value !== null && value !== undefined ? (
        <>
          <div className="flex items-baseline gap-2">
            <span 
              className={`${glowClass} glitch-num ${glitching ? 'transitioning' : ''}`} 
              data-text={displayValue}
              style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '24px', lineHeight: 1, color: colorStyle }}
            >
              {displayValue}
            </span>
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>/ 10.0</span>
            {rankLabel && (
              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-mid)', marginLeft: 'auto' }}>
                {rankLabel}
              </span>
            )}
          </div>
          {gradedCount !== undefined && (
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', marginTop: '4px' }}>
              {gradedCount}/{totalCount} GRADES RECORDED
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>
          AWAITING GRADE INPUT
        </div>
      )}
    </div>
  )
}
