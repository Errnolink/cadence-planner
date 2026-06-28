import { SUBJECT_COLORS, DAYS, WEEK_LABELS, MONTH_NAMES, parseTimeToMins } from '../../data/index.js'

/**
 * DayDetailModal — opens when a calendar date is clicked.
 * Shows all timetable entries for that weekday, sorted by start time.
 * Slide-up on mobile, centered overlay on desktop.
 */
export function DayDetailModal({ date, weekday, timetable, subjects, onClose }) {
  // weekday: 'MON','TUE', etc. — null means no classes (weekend or no match)
  const entries = timetable
    .filter(t => t.day === weekday)
    .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime))

  const subjectMap = {}
  subjects.forEach(s => { subjectMap[s.id] = s })

  const dayName  = date ? new Date(date.year, date.month, date.day).toLocaleDateString('en-US', { weekday: 'long' }) : ''
  const dateFull = date ? new Date(date.year, date.month, date.day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />

      {/* Panel — slides up on mobile, centered on desktop */}
      <div
        className="fixed z-50 left-0 right-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="w-full md:max-w-sm panel-chamfer"
          style={{
            background:  'var(--cad-bg-panel)',
            border:      '2px solid var(--cad-accent)',
            boxShadow:   'var(--cad-shadow-panel)',
            borderRadius:'var(--cad-radius) var(--cad-radius) 0 0',
            maxHeight:   '80vh',
            display:     'flex',
            flexDirection:'column',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--cad-border)', background: 'var(--cad-bg-header)' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '14px', color: 'var(--cad-accent)', letterSpacing: '0.1em' }}>
                {dayName.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)', marginTop: '2px' }}>
                {dateFull}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-lo)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-danger)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
            >✕ CLOSE</button>
          </div>

          {/* Entry list */}
          <div className="overflow-y-auto flex-1 p-3">
            {entries.length === 0 ? (
              <div
                style={{
                  textAlign:  'center',
                  padding:    '32px 0',
                  fontFamily: 'var(--cad-font-mono)',
                  fontSize:   '11px',
                  color:      'var(--cad-text-lo)',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.3 }}>◎</div>
                {weekday ? `// NO CLASSES ON ${weekday}` : '// NO CLASSES THIS DAY'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map(entry => {
                  const subj  = subjectMap[entry.subjectId]
                  if (!subj) return null
                  const color = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display:     'flex',
                        gap:         '12px',
                        alignItems:  'stretch',
                        padding:     '10px 12px',
                        background:  color.bg,
                        borderLeft:  `4px solid ${color.border}`,
                        borderRadius:'0 var(--cad-radius) var(--cad-radius) 0',
                      }}
                    >
                      {/* Time column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '64px' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '13px', color: color.text, fontWeight: '700' }}>
                          {entry.startTime}
                        </span>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
                          – {entry.endTime}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: color.text, fontWeight: '600', letterSpacing: '0.05em' }}>
                          {subj.name}
                        </span>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                          {entry.room}
                        </span>
                      </div>

                      {/* Duration badge */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
                          {Math.round((parseTimeToMins(entry.endTime) - parseTimeToMins(entry.startTime)))}m
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer stats */}
          {entries.length > 0 && (
            <div
              className="shrink-0 px-4 py-2"
              style={{ borderTop: '1px solid var(--cad-border)', background: 'var(--cad-bg-header)' }}
            >
              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)' }}>
                {entries.length} CLASS{entries.length !== 1 ? 'ES' : ''} ∥{' '}
                {entries.reduce((acc, e) => acc + (parseTimeToMins(e.endTime) - parseTimeToMins(e.startTime)), 0)}min TOTAL
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
