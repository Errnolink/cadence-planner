import { useMemo } from 'react'
import { SUBJECT_COLORS, parseTimeToMins } from '../../data/index.js'
import { AttendanceToggle } from '../ui/AttendanceToggle.jsx'
import { useModalDismiss } from '../../hooks/useModalDismiss.js'

/**
 * DayDetailModal — opens when a calendar date is clicked.
 * Shows all timetable entries for that weekday, sorted by start time.
 * Slide-up on mobile, centered overlay on desktop.
 */
export function DayDetailModal({ date, weekday, timetable, subjects, attendanceHook, examDates = new Set(), onClose }) {
  const { attendance, markAttendance, markDayAttendance, setExamDayPresent } = attendanceHook || {}
  const dateStr = date ? `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}` : ''
  const dayData = attendance && dateStr ? (attendance[dateStr] || {}) : {}
  const isExamDay = dateStr ? examDates.has(dateStr) : false
  const countAsPresent = dayData.examCountAsPresent === true
  // On an exam day, classes are suspended (skipped in stats) UNLESS the user opted to count them as present
  const examSuspended = isExamDay && !countAsPresent
  // weekday: 'MON','TUE', etc. — null means no classes (weekend or no match)
  const entries = useMemo(
    () => timetable
      .filter(t => t.day === weekday)
      .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime)),
    [timetable, weekday]
  )

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  const dayName  = date ? new Date(date.year, date.month, date.day).toLocaleDateString('en-US', { weekday: 'long' }) : ''
  const dateFull = date ? new Date(date.year, date.month, date.day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

  const { closing, handleClose } = useModalDismiss(onClose)

  const backdropAnimClass = closing ? 'anim-modal-backdrop-exit' : 'anim-modal-backdrop-enter'
  const panelAnimClass = closing ? 'anim-modal-panel-exit' : 'anim-modal-panel-enter'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 ${backdropAnimClass}`}
        style={{ background: 'rgba(0,0,0,0.85)' }}
        onClick={handleClose}
      />

      {/* Panel — slides up on mobile, centered on desktop */}
      <div
        className="fixed z-50 left-0 right-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4"
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Day schedule"
          className={`w-full md:max-w-sm panel-chamfer ${panelAnimClass}`}
          style={{
            background:  'var(--cad-bg-panel)',
            border:      '2px solid var(--cad-accent)',
            boxShadow:   'var(--cad-shadow-panel)',
            position:    'relative',
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
            <div className="flex gap-3 items-center">
              {attendanceHook && date && !(date.isHoliday && !date.isManualHoliday) && (
                <button
                  onClick={() => attendanceHook.toggleHoliday(dateStr)}
                  className="px-2 py-1 rounded transition-colors"
                  style={{
                    fontFamily: 'var(--cad-font-mono)',
                    fontSize: '9px',
                    border: '1px solid var(--cad-accent)',
                    background: dayData.isHoliday ? 'var(--cad-accent)' : 'transparent',
                    color: dayData.isHoliday ? 'var(--cad-bg-primary)' : 'var(--cad-accent)',
                    opacity: dayData.isHoliday ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => { if (!dayData.isHoliday) e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { if (!dayData.isHoliday) e.currentTarget.style.opacity = '0.7' }}
                >
                  {dayData.isHoliday ? 'HOLIDAY' : 'SET HOLIDAY'}
                </button>
              )}
              <button
                onClick={handleClose}
                style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-lo)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-lo)' }}
              >✕ CLOSE</button>
            </div>
          </div>
          
          {/* Exam day banner */}
          {isExamDay && (
            <div
              className="flex items-center justify-between gap-2 px-4 py-2 shrink-0"
              style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-accent-dim)' }}
            >
              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-accent)', letterSpacing: '0.1em' }}>
                ✎ EXAM DAY — CLASSES SUSPENDED
              </span>
              {attendanceHook && setExamDayPresent && (
                <button
                  onClick={() => setExamDayPresent(dateStr, !countAsPresent)}
                  title={countAsPresent ? "Count this day's classes as present in attendance" : "Count this day's scheduled classes as PRESENT"}
                  style={{
                    fontFamily: 'var(--cad-font-mono)', fontSize: '8px', letterSpacing: '0.1em',
                    border: `1px solid ${countAsPresent ? 'var(--cad-success)' : 'var(--cad-border)'}`,
                    background: countAsPresent ? 'var(--cad-success)' : 'transparent',
                    color: countAsPresent ? '#000' : 'var(--cad-text-mid)',
                    padding: '2px 6px', borderRadius: 'var(--cad-radius)', cursor: 'pointer',
                  }}
                >
                  {countAsPresent ? 'COUNT AS PRESENT ✓' : 'COUNT DAY AS PRESENT'}
                </button>
              )}
            </div>
          )}

          {/* Quick Mark Toolbar */}
          {entries.length > 0 && !dayData.isHoliday && !examSuspended && markDayAttendance && (
            <div
              className="flex gap-2 px-4 py-2 justify-end shrink-0 items-center"
              style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-elevated)' }}
            >
              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', letterSpacing: '0.05em', marginRight: 'auto' }}>
                QUICK MARK:
              </span>
              <button
                onClick={() => {
                  const entryIds = entries.map(e => e.id)
                  markDayAttendance(dateStr, entryIds, 'PRESENT')
                }}
                className="px-2 py-0.5 rounded transition-colors"
                style={{
                  fontFamily: 'var(--cad-font-mono)',
                  fontSize: '8px',
                  border: '1px solid var(--cad-success)',
                  background: 'transparent',
                  color: 'var(--cad-success)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                ALL PRESENT
              </button>
              <button
                onClick={() => {
                  const entryIds = entries.map(e => e.id)
                  markDayAttendance(dateStr, entryIds, 'ABSENT')
                }}
                className="px-2 py-0.5 rounded transition-colors"
                style={{
                  fontFamily: 'var(--cad-font-mono)',
                  fontSize: '8px',
                  border: '1px solid var(--cad-danger)',
                  background: 'transparent',
                  color: 'var(--cad-danger)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                ALL ABSENT
              </button>
            </div>
          )}

          {/* Entry list */}
          <div className="overflow-y-auto flex-1 p-3">
            {entries.length === 0 ? (
              <div
                style={{
                  textAlign:  'center',
                  padding:    '32px 0',
                  fontFamily: 'var(--cad-font-mono)',
                  fontSize:   '11px',
                  color:      date?.isHoliday ? 'var(--cad-danger)' : 'var(--cad-text-lo)',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.3 }}>◎</div>
                {date?.isHoliday ? '// HOLIDAY (2ND/4TH SAT)' : weekday ? `// NO CLASSES ON ${weekday}` : '// NO CLASSES THIS DAY'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map(entry => {
                  // Check for substitute
                  const subId = dayData[`${entry.id}_sub`]
                  const displaySubj = subId ? subjectMap[subId] : subjectMap[entry.subjectId]
                  if (!displaySubj) return null
                  const isSubstitute = !!subId
                  const color = SUBJECT_COLORS[displaySubj.colorIdx % SUBJECT_COLORS.length]
                  const entryNote = dayData[`${entry.id}_note`]
                  return (
                    <div
                      key={entry.id}
                      style={{
                        background:  color.bg,
                        borderLeft:  `4px solid ${color.border}`,
                        borderRadius:'0 var(--cad-radius) var(--cad-radius) 0',
                      }}
                    >
                      <div style={{
                        display:     'flex',
                        gap:         '12px',
                        alignItems:  'stretch',
                        padding:     '10px 12px',
                      }}>
                      {/* Time column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '64px' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '13px', color: color.text, fontWeight: '700' }}>
                          {entry.startTime}
                        </span>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)' }}>
                          – {entry.endTime}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: color.text, fontWeight: '600', letterSpacing: '0.05em' }}>
                          {isSubstitute ? `⇄ ${displaySubj.name}` : displaySubj.name}
                        </span>
                        {isSubstitute && (
                          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: 'var(--cad-accent)', border: '1px solid var(--cad-accent)', padding: '1px 3px', borderRadius: '2px', alignSelf: 'flex-start' }}>SUB</span>
                        )}
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-mid)' }}>
                          {entry.room}
                        </span>
                      </div>

                      {/* Duration badge and Attendance */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', alignSelf: 'flex-start', marginTop: '2px' }}>
                          {Math.round((parseTimeToMins(entry.endTime) - parseTimeToMins(entry.startTime)))}m
                        </span>
                        
                        {attendanceHook && date && !date.isHoliday && !examSuspended && (
                          <div className="flex flex-col gap-1 ml-2 border-l pl-2" style={{ borderColor: 'var(--cad-border-dim)' }}>
                            <AttendanceToggle dateStr={dateStr} entryId={entry.id} activeStatus={dayData[entry.id]} onMark={markAttendance} />
                          </div>
                        )}
                      </div>
                      </div>
                      {/* Note indicator */}
                      {entryNote && (
                        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)', padding: '2px 12px 6px', opacity: 0.8 }}>
                          📝 {entryNote}
                        </div>
                      )}
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
