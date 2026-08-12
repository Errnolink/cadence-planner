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
          if (type === 'PRESENT') { colorVar = '--cad-success'; bg = 'color-mix(in srgb, var(--cad-success) 12%, transparent)' }
          else if (type === 'ABSENT') { colorVar = '--cad-danger'; bg = 'var(--cad-danger-dim)' }
          else { colorVar = '--cad-text-lo'; bg = 'var(--cad-bg-primary)' }
        }

        return (
          <button
            key={type}
            type="button"
            aria-pressed={isActive}
            className={`cad-toggle btn-mech ${large ? 'panel-chamfer-sm' : ''}`}
            data-active={isActive || undefined}
            onClick={(e) => {
              e.stopPropagation()
              onMark(dateStr, entryId, isActive ? null : type)
            }}
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: large ? 'var(--cad-fs-xs)' : 'var(--cad-fs-micro)',
              letterSpacing: 'var(--cad-track-mid)',
              flex: large ? 1 : undefined,
              padding: large ? '6px 8px' : '2px 4px',
              borderRadius: large ? 'var(--cad-radius)' : '2px',
              border: isActive ? `1px solid var(${colorVar})` : (large ? '1px solid var(--cad-border)' : '1px solid var(--cad-border-dim)'),
              color: isActive ? `var(${colorVar})` : (large ? 'var(--cad-text-mid)' : 'var(--cad-text-lo)'),
              background: bg,
              textAlign: 'center',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {type}
          </button>
        )
      })}
    </div>
  )
}
