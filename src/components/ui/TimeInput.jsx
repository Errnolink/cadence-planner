import { useState, useCallback } from 'react'
import { pad2, parseTimeToMins, minsToTimeStr, GRID_START_HOUR, GRID_END_HOUR } from '../../data/index.js'

/**
 * Custom HH:MM time spinner. No native browser time picker involved.
 *
 * Props:
 *   value      – "HH:MM" string
 *   onChange   – (newValue: string) => void
 *   minHour    – minimum hour (default: GRID_START_HOUR)
 *   maxHour    – maximum hour (default: GRID_END_HOUR)
 *   label      – optional label string shown above
 *   minValue   – optional minimum "HH:MM" constraint (for end-time)
 */
export function TimeInput({ value, onChange, minHour = GRID_START_HOUR, maxHour = GRID_END_HOUR, label, minValue }) {
  const parsed = value ? value.split(':').map(Number) : [minHour, 0]
  const hours  = parsed[0] ?? minHour
  const mins   = parsed[1] ?? 0

  const [hFocused, setHFocused] = useState(false)
  const [mFocused, setMFocused] = useState(false)

  const clamp = useCallback((h, m) => {
    let ch = Math.max(minHour, Math.min(maxHour, h))
    let cm = Math.max(0, Math.min(59, m))
    const totalMins = ch * 60 + cm
    if (minValue) {
      const minMins = parseTimeToMins(minValue)
      if (totalMins <= minMins) {
        const bumped = minMins + 5
        ch = Math.floor(bumped / 60)
        cm = bumped % 60
      }
    }
    onChange(minsToTimeStr(Math.min(ch * 60 + cm, maxHour * 60)))
  }, [minHour, maxHour, minValue, onChange])

  const changeH = delta => clamp(hours + delta, mins)
  const changeM = delta => {
    let newM = mins + delta
    if (newM > 59) { clamp(hours + 1, newM - 60) }
    else if (newM < 0) { clamp(hours - 1, 60 + newM) }
    else clamp(hours, newM)
  }

  const handleHKey = e => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); changeH(1)  }
    if (e.key === 'ArrowDown') { e.preventDefault(); changeH(-1) }
  }
  const handleMKey = e => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); changeM(5)  }
    if (e.key === 'ArrowDown') { e.preventDefault(); changeM(-5) }
  }

  const inputBase = {
    fontFamily:  'var(--cad-font-mono)',
    fontSize:    '22px',
    fontWeight:  '700',
    color:       'var(--cad-accent-text)',
    background:  'transparent',
    border:      'none',
    outline:     'none',
    width:       '40px',
    textAlign:   'center',
    letterSpacing: '0.05em',
    MozAppearance: 'textfield',
  }

  const btnStyle = {
    color:      'var(--cad-text-lo)',
    fontFamily: 'var(--cad-font-mono)',
    fontSize:   '10px',
    lineHeight: 1,
    padding:    '2px 6px',
    cursor:     'pointer',
    background: 'none',
    border:     'none',
    transition: 'color 0.1s',
    userSelect: 'none',
  }

  return (
    <div>
      {label && (
        <div className="text-[9px] tracking-widest uppercase mb-1"
          style={{ color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>
          {label}
        </div>
      )}
      <div
        className="flex items-center justify-center gap-1"
        style={{
          background:   'var(--cad-bg-input)',
          border:       '1px solid var(--cad-border)',
          borderRadius: 'var(--cad-radius)',
          padding:      '6px 8px',
          transition:   'border-color 0.15s',
          borderColor:  (hFocused || mFocused) ? 'var(--cad-accent)' : 'var(--cad-border)',
          boxShadow:    (hFocused || mFocused) ? '0 0 0 1px var(--cad-accent-dim)' : 'none',
        }}
      >
        {/* ── Hours ── */}
        <div className="flex flex-col items-center">
          <button
            style={btnStyle}
            onClick={() => changeH(1)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
          >▲</button>
          <input
            type="number"
            value={pad2(hours)}
            min={minHour}
            max={maxHour}
            onChange={e => clamp(parseInt(e.target.value) || 0, mins)}
            onKeyDown={handleHKey}
            onFocus={() => setHFocused(true)}
            onBlur={() => setHFocused(false)}
            style={inputBase}
          />
          <button
            style={btnStyle}
            onClick={() => changeH(-1)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
          >▼</button>
        </div>

        {/* Colon separator */}
        <span style={{ color: 'var(--cad-accent)', fontFamily: 'var(--cad-font-mono)', fontSize: '20px', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>:</span>

        {/* ── Minutes ── */}
        <div className="flex flex-col items-center">
          <button
            style={btnStyle}
            onClick={() => changeM(5)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
          >▲</button>
          <input
            type="number"
            value={pad2(mins)}
            min={0}
            max={59}
            step={5}
            onChange={e => clamp(hours, parseInt(e.target.value) || 0)}
            onKeyDown={handleMKey}
            onFocus={() => setMFocused(true)}
            onBlur={() => setMFocused(false)}
            style={inputBase}
          />
          <button
            style={btnStyle}
            onClick={() => changeM(-5)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
          >▼</button>
        </div>
      </div>
    </div>
  )
}
