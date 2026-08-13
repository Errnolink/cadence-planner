import { useState, useMemo, useRef } from 'react'
import { MONTH_NAMES, DAYS, generateSubjectCode, subjectVars } from '../../data/index.js'
import { dateStrFromParts, getDayMeta } from '../../data/calendar.js'
import { DayDetailModal } from './DayDetailModal.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'


const DAYS_SET = new Set(DAYS)

export function CalendarView({ timetable, subjects, attendanceHook, examDates = new Set(), semester }) {
  const { settings } = useSettings()
  const today      = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [detailDate, setDetailDate] = useState(null) // 'YYYY-MM-DD'

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const daysInMonth   = new Date(year, month + 1, 0).getDate()
  const firstDayJS    = new Date(year, month, 1).getDay()   // 0=Sun
  const firstOffset   = (firstDayJS + 6) % 7                // Mon=0 offset

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Build event map: { dayOfWeek label => [entries] }
  const eventsByWeekday = useMemo(() => {
    const m = {}
    DAYS.forEach(d => { m[d] = [] })
    timetable.forEach(e => { if (m[e.day]) m[e.day].push(e) })
    return m
  }, [timetable])

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  const cells = []
  for (let i = 0; i < firstOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const wheelTimeout = useRef(null)
  const handleWheel = (e) => {
    if (e.target.closest('.calendar-scroll')) return
    if (wheelTimeout.current) return
    if (e.deltaY > 20) {
      nextMonth()
      wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null }, 300)
    } else if (e.deltaY < -20) {
      prevMonth()
      wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null }, 300)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" onWheel={handleWheel}>

      {/* Month navigator */}
      <div className="flex items-center justify-between shrink-0 py-2 px-1">
        <button
          type="button"
          onClick={prevMonth}
          className="btn-mech cad-hover-accent tap-44"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-md)', color: 'var(--cad-text-mid)', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 'var(--cad-radius)' }}
          aria-label="Previous month"
        ><span aria-hidden="true">◀</span></button>

        <div className="flex gap-2 text-center items-center">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            aria-label="Month"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     'var(--cad-fs-sm)',
              background:   'var(--cad-bg-input)',
              border:       '1px solid var(--cad-border)',
              color:        'var(--cad-accent)',
              padding:      '4px 8px',
              borderRadius: 'var(--cad-radius)',
              cursor:       'pointer',
              minWidth:     '130px',
            }}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            aria-label="Year"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     'var(--cad-fs-sm)',
              background:   'var(--cad-bg-input)',
              border:       '1px solid var(--cad-border)',
              color:        'var(--cad-accent)',
              padding:      '4px 8px',
              borderRadius: 'var(--cad-radius)',
              cursor:       'pointer',
              minWidth:     '80px',
            }}
          >
            {Array.from({length: 20}, (_, i) => {
              const y = today.getFullYear() - 10 + i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="btn-mech cad-hover-accent tap-44"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-md)', color: 'var(--cad-text-mid)', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 'var(--cad-radius)' }}
          aria-label="Next month"
        ><span aria-hidden="true">▶</span></button>
      </div>

      {/* Weekday header row */}
      <div className="grid shrink-0" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--cad-border-dim)' }}>
        {DAYS.map(d => (
          <div key={d} style={{
            textAlign:   'center',
            padding:     '4px 0',
            fontFamily:  'var(--cad-font-mono)',
            fontSize:    'var(--cad-fs-micro)',
            letterSpacing:'var(--cad-track-wide)',
            color:       DAYS_SET.has(d) ? 'var(--cad-text-mid)' : 'var(--cad-text-xlo)',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="calendar-scroll flex-1 overflow-y-auto min-h-0">
        <div
          className="grid auto-rows-[minmax(48px,1fr)] md:auto-rows-[minmax(64px,1fr)]"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            height:              '100%',
          }}
        >
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ borderRight: '1px solid var(--cad-border-dim)', borderBottom: '1px solid var(--cad-border-dim)' }} />

            const dateStr = dateStrFromParts(year, month, day)
            const meta    = getDayMeta(dateStr, { settings, attendance: attendanceHook?.attendance, examDates, semester })
            const todayCell = isToday(day)
            const isWeekend = !DAYS_SET.has(meta.weekday)
            // Outside the semester's dates there are no classes to show. The
            // weekly pattern used to repeat forever in both directions, so a
            // term running Jan–May still drew its classes the previous
            // December — and now that the stats honour the bounds, drawing
            // them would promise a class that cannot count.
            const entries = meta.isHoliday || isWeekend || !meta.inTerm ? [] : (eventsByWeekday[meta.weekday] ?? [])
            const dayAtt  = attendanceHook?.attendance?.[dateStr] ?? {}

            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                aria-label={`${MONTH_NAMES[month]} ${day}, ${year}${todayCell ? ', today' : ''}${!meta.inTerm ? ', outside the semester' : ''}${meta.isHoliday ? ', holiday' : ''}${meta.isExamDay ? ', exam day' : ''}${entries.length ? `, ${entries.length} classes` : ''}`}
                onClick={() => setDetailDate(dateStr)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailDate(dateStr) } }}
                className="cad-hover-cell"
                data-today={todayCell || undefined}
                style={{
                  borderRight:  '1px solid var(--cad-border-dim)',
                  borderBottom: '1px solid var(--cad-border-dim)',
                  padding:      '4px',
                  cursor:       'pointer',
                  // Dimmed, not hidden: the day is still markable and still
                  // opens, it just does not belong to this term.
                  background:   meta.inTerm ? 'transparent' : 'var(--cad-bg-primary)',
                  opacity:      meta.inTerm ? 1 : 0.45,
                  outline:      todayCell ? '1px solid var(--cad-accent)' : 'none',
                  outlineOffset:'-1px',
                  overflow:     'hidden',
                }}
              >
                {/* Day number */}
                <div style={{
                  fontFamily:  'var(--cad-font-mono)',
                  fontSize:    'var(--cad-fs-sm)',
                  marginBottom:'3px',
                  color:       todayCell      ? 'var(--cad-accent)'
                             : meta.isHoliday ? 'var(--cad-danger)'
                             : isWeekend      ? 'var(--cad-text-lo)'
                             : 'var(--cad-text-mid)',
                  fontWeight:  todayCell ? '700' : '400',
                }}>{day}</div>

                {meta.isHoliday && (
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-danger)' }}>
                    HOLIDAY
                  </div>
                )}

                {meta.isExamDay && !meta.isHoliday && (
                  <div style={{
                    fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)',
                    border: '1px solid var(--cad-accent)', borderRadius: '2px',
                    padding: '0 3px', display: 'inline-block', marginBottom: '2px',
                  }}>
                    <span aria-hidden="true">✎ </span>EXAM
                  </div>
                )}

                {/* Event chips (max 3 shown) */}
                {entries.slice(0, 3).map(entry => {
                  // Check for substitute on this date
                  const subId = dayAtt[`${entry.id}_sub`]
                  const displaySubj = subId ? subjectMap[subId] : subjectMap[entry.subjectId]
                  if (!displaySubj) return null
                  const hasNote = !!dayAtt[`${entry.id}_note`]
                  return (
                    <div
                      key={entry.id}
                      style={{
                        ...subjectVars(displaySubj.colorIdx),
                        fontFamily:   'var(--cad-font-mono)',
                        fontSize:     'var(--cad-fs-micro)',
                        background:   'var(--subj-bg)',
                        borderLeft:   '3px solid var(--subj-border)',
                        color:        'var(--subj-text)',
                        padding:      '1px 4px',
                        marginBottom: '2px',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                        borderRadius: '0 2px 2px 0',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '2px',
                      }}
                    >
                      {/* The time is desktop-only. A month cell is ~34px wide
                          at 375px and "09:00 CS100" needs 66px, so the chip
                          truncated away the subject code and kept the clock —
                          losing the only part that says which class it is.
                          Screen readers still get the time; tapping the day
                          shows it too. */}
                      <span className="hidden sm:inline">{entry.startTime}{' '}</span>
                      <span className="sr-only sm:hidden">{entry.startTime} </span>
                      {subId && <><span aria-hidden="true">⇄</span><span className="sr-only">substituted: </span></>}
                      {/* The code needs its own truncating box: `text-overflow`
                          does not apply to a flex container, so the ellipsis
                          set on the chip never rendered and a 7-character code
                          was cut mid-glyph ("MATH101" → "MATH10") with nothing
                          to show that anything was missing. */}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displaySubj.code || generateSubjectCode(displaySubj.name)}
                      </span>
                      {hasNote && <span aria-hidden="true" style={{ fontSize: 'var(--cad-fs-micro)', opacity: 0.7 }}>📝</span>}
                      {hasNote && <span className="sr-only">has a note</span>}
                    </div>
                  )
                })}
                {entries.length > 3 && (
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', paddingLeft: '4px' }}>
                    +{entries.length - 3} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex gap-3 shrink-0 px-2 py-1.5 flex-wrap"
        style={{ borderTop: '1px solid var(--cad-border-dim)' }}
      >
        <div className="flex items-center gap-1.5">
          <div aria-hidden="true" style={{ width: '8px', height: '8px', background: 'var(--cad-accent-dim)', border: '1px solid var(--cad-accent)' }} />
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)' }}>TODAY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div aria-hidden="true" style={{ width: '8px', height: '8px', background: 'var(--cad-accent-dim)', borderLeft: '2px solid var(--cad-accent)' }} />
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)' }}>SCHEDULED</span>
        </div>
        <div
          className="ml-auto"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', letterSpacing: 'var(--cad-track-mid)' }}
        >
          CADENCE v3 <span aria-hidden="true">∷</span> TAP DAY TO VIEW SCHEDULE
        </div>
      </div>

      {/* Day detail modal */}
      {detailDate && (
        <DayDetailModal
          dateStr={detailDate}
          timetable={timetable}
          subjects={subjects}
          attendanceHook={attendanceHook}
          examDates={examDates}
          semester={semester}
          onClose={() => setDetailDate(null)}
        />
      )}
    </div>
  )
}
