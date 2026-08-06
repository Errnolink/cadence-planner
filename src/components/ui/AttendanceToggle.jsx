import React from 'react'

const QUICK_MARK_TYPES = ['PRESENT', 'ABSENT', 'CANCELLED']

/**
 * PRESENT/ABSENT/CANCELLED toggle shared by the timetable grid,
 * day-detail modal, and class-instance modal. Tapping the active
 * status clears it. `size="lg"` switches to the large modal row
 * variant (flex-1 buttons); default is the compact overlay column.
 */
export function AttendanceToggle({ dateStr, entryId, activeStatus, onMark, size = 'sm', className = '' }) {
  const large = size === 'lg'
  return (
    <div className={className} style={{ display: 'flex', flexDirection: large ? 'row' : 'column', gap: large ? 4 : 2 }}>
      {QUICK_MARK_TYPES.map(type => {
        const isActive = activeStatus === type
        let colorVar = '--cad-text-mid'
        let bg = 'transparent'
        if (isActive) {
          if (type === 'PRESENT') { colorVar = '--cad-success'; bg = 'rgba(80,255,80,0.1)' }
          else if (type === 'ABSENT') { colorVar = '--cad-danger'; bg = 'var(--cad-danger-dim)' }
          else { colorVar = '--cad-text-lo'; bg = 'var(--cad-bg-primary)' }
        }

        return (
          <button
            key={type}
            className={large ? 'panel-chamfer-sm' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onMark(dateStr, entryId, isActive ? null : type)
            }}
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: large ? '10px' : '8px',
              letterSpacing: '0.1em',
              flex: large ? 1 : undefined,
              padding: large ? '6px 8px' : '4px 6px',
              borderRadius: large ? 'var(--cad-radius)' : '2px',
              border: isActive ? `1px solid var(${colorVar})` : (large ? '1px solid var(--cad-border)' : '1px solid var(--cad-border-dim)'),
              color: isActive ? `var(${colorVar})` : (large ? 'var(--cad-text-mid)' : 'var(--cad-text-lo)'),
              background: bg,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.border = '1px solid var(--cad-border)'
                e.currentTarget.style.color = 'var(--cad-text-hi)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.border = large ? '1px solid var(--cad-border)' : '1px solid var(--cad-border-dim)'
                e.currentTarget.style.color = large ? 'var(--cad-text-mid)' : 'var(--cad-text-lo)'
              }
            }}
          >
            {type}
          </button>
        )
      })}
    </div>
  )
}
