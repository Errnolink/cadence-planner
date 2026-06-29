import { useState, useMemo } from 'react'
import { SUBJECT_COLORS, WEEK_LABELS, MONTH_NAMES, DAYS, parseTimeToMins, generateSubjectCode, isSecondOrFourthSaturday } from '../../data/index.js'
import { DayDetailModal } from './DayDetailModal.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'

const DAYS_SET = new Set(DAYS)

function dayLabel(year, month, day) {
  const js = new Date(year, month, day).getDay()  // 0=Sun
  // Convert JS getDay() to our DAYS label
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][js]
}

export function CalendarView({ timetable, subjects, attendanceHook }) {
  const { settings } = useSettings()
  const today      = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [detail, setDetail] = useState(null) // { year, month, day, weekday }

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

  const handleDayClick = (day) => {
    const wday = dayLabel(year, month, day)
    const isHoliday = settings.holidays2nd4thSat && isSecondOrFourthSaturday(year, month, day)
    setDetail({ year, month, day, weekday: (!isHoliday && DAYS_SET.has(wday)) ? wday : null, isHoliday })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Month navigator */}
      <div className="flex items-center justify-between shrink-0 py-2 px-1">
        <button
          onClick={prevMonth}
          className="btn-mech"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '14px', color: 'var(--cad-text-mid)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--cad-radius)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-mid)' }}
        >◀</button>

        <div className="flex gap-2 text-center items-center">
          <select 
            value={month} 
            onChange={e => setMonth(Number(e.target.value))}
            className="btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '13px', letterSpacing: '0.1em', color: 'var(--cad-accent)', background: 'transparent', border: '1px solid var(--cad-border)', padding: '2px 12px', outline: 'none', cursor: 'pointer', appearance: 'none', textAlign: 'center' }}
          >
            {MONTH_NAMES.map((m, i) => <option key={i} value={i} style={{color: 'var(--cad-text-hi)', background: 'var(--cad-bg-panel)'}}>{m}</option>)}
          </select>
          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            className="btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '13px', letterSpacing: '0.1em', color: 'var(--cad-accent)', background: 'transparent', border: '1px solid var(--cad-border)', padding: '2px 12px', outline: 'none', cursor: 'pointer', appearance: 'none', textAlign: 'center' }}
          >
            {Array.from({length: 20}, (_, i) => today.getFullYear() - 10 + i).map(y => <option key={y} value={y} style={{color: 'var(--cad-text-hi)', background: 'var(--cad-bg-panel)'}}>{y}</option>)}
          </select>
        </div>

        <button
          onClick={nextMonth}
          className="btn-mech"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '14px', color: 'var(--cad-text-mid)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--cad-radius)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--cad-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--cad-text-mid)' }}
        >▶</button>
      </div>

      {/* Weekday header row */}
      <div className="grid shrink-0" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--cad-border-dim)' }}>
        {WEEK_LABELS.map(d => (
          <div key={d} style={{
            textAlign:   'center',
            padding:     '4px 0',
            fontFamily:  'var(--cad-font-mono)',
            fontSize:    '8px',
            letterSpacing:'0.15em',
            color:       DAYS_SET.has(d) ? 'var(--cad-text-mid)' : 'var(--cad-text-xlo)',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div
          className="grid auto-rows-[minmax(48px,1fr)] md:auto-rows-[minmax(64px,1fr)]"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            height:              '100%',
          }}
        >
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ borderRight: '1px solid var(--cad-border-dim)', borderBottom: '1px solid var(--cad-border-dim)' }} />

            const wday    = dayLabel(year, month, day)
            let entries = DAYS_SET.has(wday) ? (eventsByWeekday[wday] ?? []) : []
            const todayCell = isToday(day)
            const isWeekend = !DAYS_SET.has(wday)
            
            const isHoliday = settings.holidays2nd4thSat && isSecondOrFourthSaturday(year, month, day)
            if (isHoliday) entries = []

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                style={{
                  borderRight:  '1px solid var(--cad-border-dim)',
                  borderBottom: '1px solid var(--cad-border-dim)',
                  padding:      '4px',
                  cursor:       'pointer',
                  background:   'transparent',
                  outline:      todayCell ? '1px solid var(--cad-accent)' : 'none',
                  outlineOffset:'-1px',
                  transition:   'background 0.15s',
                  overflow:     'hidden',
                }}
                onMouseEnter={e => { if (!todayCell) e.currentTarget.style.background = 'var(--cad-bg-elevated)' }}
                onMouseLeave={e => { if (!todayCell) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Day number */}
                <div style={{
                  fontFamily:  'var(--cad-font-mono)',
                  fontSize:    '11px',
                  marginBottom:'3px',
                  color:       todayCell  ? 'var(--cad-accent)'
                             : isHoliday ? 'var(--cad-danger)'
                             : isWeekend ? 'var(--cad-text-lo)'
                             : 'var(--cad-text-mid)',
                  fontWeight:  todayCell ? '700' : '400',
                }}>{day}</div>

                {isHoliday && (
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-danger)', opacity: 0.8 }}>
                    HOLIDAY
                  </div>
                )}

                {/* Event chips (max 3 shown) */}
                {!isHoliday && entries.slice(0, 3).map(entry => {
                  const subj  = subjectMap[entry.subjectId]
                  if (!subj) return null
                  const color = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
                  return (
                    <div
                      key={entry.id}
                      style={{
                        fontFamily:   'var(--cad-font-mono)',
                        fontSize:     '8px',
                        background:   color.bg,
                        borderLeft:   `3px solid ${color.border}`,
                        color:        color.text,
                        padding:      '1px 4px',
                        marginBottom: '2px',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                        borderRadius: '0 2px 2px 0',
                      }}
                    >
                      {entry.startTime} {subj.code || generateSubjectCode(subj.name)}
                    </div>
                  )
                })}
                {!isHoliday && entries.length > 3 && (
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: 'var(--cad-text-lo)', paddingLeft: '4px' }}>
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
          <div style={{ width: '8px', height: '8px', background: 'var(--cad-accent-dim)', border: '1px solid var(--cad-accent)' }} />
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)' }}>TODAY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'rgba(249,115,22,0.3)', borderLeft: '2px solid var(--cad-accent)' }} />
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)' }}>SCHEDULED</span>
        </div>
        <div
          className="ml-auto"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', letterSpacing: '0.1em' }}
        >
          CADENCE v3 ∷ TAP DAY TO VIEW SCHEDULE
        </div>
      </div>

      {/* Day detail modal */}
      {detail && (
        <DayDetailModal
          date={detail}
          weekday={detail.weekday}
          timetable={timetable}
          subjects={subjects}
          attendanceHook={attendanceHook}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
