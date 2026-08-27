import { useMemo } from 'react'
import { parseTimeToMins, subjectVars } from '../../data/index.js'
import { getDayMeta, dateFromStr } from '../../data/calendar.js'
import { AttendanceToggle } from '../ui/AttendanceToggle.jsx'
import { Modal } from '../ui/Modal.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'
import { useAttendanceContext } from '../../hooks/useAttendanceContext.jsx'

/**
 * DayDetailModal — opens when a calendar date or a grid day header is clicked.
 *
 * Takes ONE date prop. It used to take `{date, weekday}` where `date` was
 * sometimes `{year,month,day}` and sometimes also carried `isHoliday` /
 * `isManualHoliday` depending on which call site opened it — so the same
 * 2nd-Saturday showed live attendance toggles from the grid and "// HOLIDAY"
 * from the calendar. Everything is now derived from `getDayMeta(dateStr)`.
 */
export function DayDetailModal({ dateStr, timetable, subjects, onClose }) {
  const { settings } = useSettings()
  const { attendance, examDates, semester, markAttendance, markDayAttendance, setExamDayPresent, toggleHoliday } = useAttendanceContext()

  const meta = useMemo(
    () => getDayMeta(dateStr, { settings, attendance, examDates, semester }),
    [dateStr, settings, attendance, examDates, semester]
  )

  const dayData = attendance[dateStr] ?? {}
  const countAsPresent = meta.examCountAsPresent
  // On an exam day, classes are suspended (skipped in stats) UNLESS the user opted in
  const examSuspended = meta.isExamDay && !countAsPresent
  // A holiday has no classes, whichever route opened the modal.
  const weekday = meta.isHoliday ? null : meta.weekday

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

  const date = dateFromStr(dateStr)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const dateFull = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const holidayButton = !(meta.isAutoHoliday && !meta.isManualHoliday) ? (
    <button
      type="button"
      onClick={() => toggleHoliday(dateStr)}
      aria-pressed={meta.isManualHoliday}
      className="cad-chip btn-mech"
      data-active={meta.isManualHoliday || undefined}
    >
      {meta.isManualHoliday ? 'HOLIDAY' : 'SET HOLIDAY'}
    </button>
  ) : null

  return (
    <Modal
      variant="sheet"
      ariaLabel="Day schedule"
      title={dayName}
      subtitle={dateFull}
      onClose={onClose}
      headerExtra={holidayButton}
    >
      {/* Out-of-term banner. Marking is still allowed — the dates are the
          user's to get wrong, and silently discarding a mark would be worse
          than one that plainly says it does not count. */}
      {!meta.inTerm && (
        <div
          className="px-4 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }}
        >
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)', letterSpacing: 'var(--cad-track-mid)' }}>
            <span aria-hidden="true">▸ </span>OUTSIDE {semester?.label || 'THE SEMESTER'} — MARKS HERE ARE NOT COUNTED
          </span>
        </div>
      )}

      {/* Exam day banner */}
      {meta.isExamDay && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-accent-dim)' }}
        >
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-accent)', letterSpacing: 'var(--cad-track-mid)' }}>
            <span aria-hidden="true">✎ </span>EXAM DAY — CLASSES SUSPENDED
          </span>
          {setExamDayPresent && (
            <button
              type="button"
              onClick={() => setExamDayPresent(dateStr, !countAsPresent)}
              aria-pressed={countAsPresent}
              title="Count this day's scheduled classes as PRESENT in attendance"
              className="btn-mech"
              style={{
                fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-mid)',
                border: `1px solid ${countAsPresent ? 'var(--cad-success)' : 'var(--cad-border)'}`,
                background: countAsPresent ? 'var(--cad-success)' : 'transparent',
                color: countAsPresent ? 'var(--cad-bg-primary)' : 'var(--cad-text-mid)',
                padding: '2px 6px', borderRadius: 'var(--cad-radius)', whiteSpace: 'nowrap',
              }}
            >
              {countAsPresent ? 'COUNT AS PRESENT ✓' : 'COUNT DAY AS PRESENT'}
            </button>
          )}
        </div>
      )}

      {/* Quick Mark Toolbar */}
      {entries.length > 0 && !meta.isHoliday && !examSuspended && markDayAttendance && (
        <div
          className="flex gap-2 px-4 py-2 justify-end shrink-0 items-center"
          style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-elevated)' }}
        >
          <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)', marginRight: 'auto' }}>
            QUICK MARK:
          </span>
          {[
            { label: 'ALL PRESENT', status: 'PRESENT', color: 'var(--cad-success)', hover: 'cad-hover-success' },
            { label: 'ALL ABSENT',  status: 'ABSENT',  color: 'var(--cad-danger)',  hover: 'cad-hover-danger'  },
          ].map(action => (
            <button
              key={action.status}
              type="button"
              onClick={() => markDayAttendance(dateStr, entries.map(e => e.id), action.status)}
              className={`px-2 py-0.5 rounded btn-mech ${action.hover}`}
              style={{
                fontFamily: 'var(--cad-font-mono)',
                fontSize: 'var(--cad-fs-micro)',
                border: `1px solid ${action.color}`,
                background: 'transparent',
                color: action.color,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Entry list */}
      <div className="p-3">
        {entries.length === 0 ? (
          <div
            style={{
              textAlign:  'center',
              padding:    '32px 0',
              fontFamily: 'var(--cad-font-mono)',
              fontSize:   'var(--cad-fs-sm)',
              color:      meta.isHoliday ? 'var(--cad-danger)' : 'var(--cad-text-lo)',
            }}
          >
            <div aria-hidden="true" style={{ fontSize: 'var(--cad-fs-lg)', marginBottom: '8px', opacity: 0.3 }}>◎</div>
            {meta.isManualHoliday ? '// HOLIDAY (MARKED)'
              : meta.isAutoHoliday ? '// HOLIDAY (2ND/4TH SAT)'
              : weekday ? `// NO CLASSES ON ${weekday}`
              : '// NO CLASSES THIS DAY'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map(entry => {
              // Check for substitute
              const subId = dayData[`${entry.id}_sub`]
              const displaySubj = subId ? subjectMap[subId] : subjectMap[entry.subjectId]
              if (!displaySubj) return null
              const isSubstitute = !!subId
              const entryNote = dayData[`${entry.id}_note`]
              return (
                <div
                  key={entry.id}
                  style={{
                    ...subjectVars(displaySubj.colorIdx),
                    background:  'var(--subj-bg)',
                    borderLeft:  '4px solid var(--subj-border)',
                    borderRadius:'0 var(--cad-radius) var(--cad-radius) 0',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', padding: '10px 12px' }}>
                    {/* Time column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '64px' }}>
                      <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-md)', color: 'var(--subj-text)', fontWeight: '700' }}>
                        {entry.startTime}
                      </span>
                      <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>
                        – {entry.endTime}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--subj-text)', fontWeight: '600', letterSpacing: '0.05em' }}>
                        {isSubstitute && <span aria-hidden="true">⇄ </span>}
                        {displaySubj.name}
                      </span>
                      {isSubstitute && (
                        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)', border: '1px solid var(--cad-accent)', padding: '1px 3px', borderRadius: '2px', alignSelf: 'flex-start' }}>
                          SUB<span className="sr-only">STITUTED CLASS</span>
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-mid)' }}>
                        {entry.room}
                      </span>
                    </div>

                    {/* Duration badge and Attendance */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', alignSelf: 'flex-start', marginTop: '2px' }}>
                        {parseTimeToMins(entry.endTime) - parseTimeToMins(entry.startTime)}m
                      </span>

                      {!meta.isHoliday && !examSuspended && (
                        <div className="flex flex-col gap-1 ml-2 border-l pl-2" style={{ borderColor: 'var(--cad-border-dim)' }}>
                          <AttendanceToggle dateStr={dateStr} entryId={entry.id} activeStatus={dayData[entry.id]} onMark={markAttendance} />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Note indicator */}
                  {entryNote && (
                    <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)', padding: '2px 12px 6px' }}>
                      <span aria-hidden="true">📝 </span><span className="sr-only">Note: </span>{entryNote}
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
          className="px-4 py-2"
          style={{ borderTop: '1px solid var(--cad-border)', background: 'var(--cad-bg-header)' }}
        >
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>
            {entries.length} CLASS{entries.length !== 1 ? 'ES' : ''} <span aria-hidden="true">∥</span>{' '}
            {entries.reduce((acc, e) => acc + (parseTimeToMins(e.endTime) - parseTimeToMins(e.startTime)), 0)}min TOTAL
          </div>
        </div>
      )}
    </Modal>
  )
}
