import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { SUBJECT_COLORS, DAYS, MONTH_NAMES, GRID_START_HOUR, GRID_END_HOUR, pad2, getTodayDayIdx, parseTimeToMins, generateSubjectCode, isSecondOrFourthSaturday } from '../../data/index.js'
import { DayDetailModal } from '../calendar/DayDetailModal.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'


const TOTAL_MINS = (GRID_END_HOUR - GRID_START_HOUR) * 60
const TICK_HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i)
const DAY_MIN_W  = 80  // px — min width per day column on mobile

function pct(timeStr) {
  const offset = parseTimeToMins(timeStr) - GRID_START_HOUR * 60
  return `${Math.max(0, Math.min(100, (offset / TOTAL_MINS) * 100))}%`
}
function pctH(start, end) {
  const s = Math.max(parseTimeToMins(start) - GRID_START_HOUR * 60, 0)
  const e = Math.min(parseTimeToMins(end)   - GRID_START_HOUR * 60, TOTAL_MINS)
  return `${Math.max(0, ((e - s) / TOTAL_MINS) * 100)}%`
}

export function TimetableGrid({ subjects, timetable, editMode, onCellClick, onBlockClick, onInstanceClick, attendanceHook }) {
  const { settings } = useSettings()
  const todayIdx = getTodayDayIdx()
  const [weekOffset, setWeekOffset] = useState(0)
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const baseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])
  const [activeDayDetail, setActiveDayDetail] = useState(null)

  const weekRangeStr = useMemo(() => {
    const monday = new Date(baseDate.getTime())
    monday.setDate(monday.getDate() + (0 - todayIdx))
    const sunday = new Date(baseDate.getTime())
    sunday.setDate(sunday.getDate() + (6 - todayIdx))

    const mMonth = MONTH_NAMES[monday.getMonth()]?.substring(0, 3)
    const sMonth = MONTH_NAMES[sunday.getMonth()]?.substring(0, 3)

    if (showTodayOnly && weekOffset === 0) {
      const todayDate = new Date(baseDate.getTime())
      return `${todayDate.getDate()} ${MONTH_NAMES[todayDate.getMonth()]?.substring(0, 3)} ${todayDate.getFullYear()}`
    }

    if (monday.getFullYear() !== sunday.getFullYear()) {
      return `${monday.getDate()} ${mMonth} ${monday.getFullYear()} – ${sunday.getDate()} ${sMonth} ${sunday.getFullYear()}`
    }
    if (monday.getMonth() !== sunday.getMonth()) {
      return `${monday.getDate()} ${mMonth} – ${sunday.getDate()} ${sMonth} ${sunday.getFullYear()}`
    }
    return `${monday.getDate()}–${sunday.getDate()} ${mMonth} ${sunday.getFullYear()}`
  }, [baseDate, todayIdx, showTodayOnly, weekOffset])

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  const byDay = useMemo(() => {
    const m = {}
    DAYS.forEach(d => { m[d] = [] })
    timetable.forEach(entry => { if (m[entry.day]) m[entry.day].push(entry) })
    return m
  }, [timetable])

  const handleColClick = useCallback((day, e) => {
    if (!editMode || !onCellClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const pct = Math.max(0, Math.min(1, y / rect.height))
    const mins = GRID_START_HOUR * 60 + pct * TOTAL_MINS
    
    // Snap to nearest 30 mins
    const snappedMins = Math.floor(mins / 30) * 30
    const startH = Math.floor(snappedMins / 60)
    const startM = snappedMins % 60
    
    const endMins = Math.min(GRID_END_HOUR * 60, snappedMins + 60)
    const endH = Math.floor(endMins / 60)
    const endM = endMins % 60
    
    const startTime = `${pad2(startH)}:${pad2(startM)}`
    const endTime = `${pad2(endH)}:${pad2(endM)}`
    
    onCellClick(day, startTime, endTime)
  }, [editMode, onCellClick])

  const scrollRef = useRef(null)

  // Auto-scroll to current time on mount
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const now = new Date(baseDate.getTime())
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const offset = (nowMins - GRID_START_HOUR * 60) / TOTAL_MINS
    // Position "now" at ~1/3 from top of visible area
    const scrollTarget = offset * el.scrollHeight - el.clientHeight / 3
    el.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
  }, [baseDate])

  const displayDays = showTodayOnly && weekOffset === 0 ? [DAYS[todayIdx]] : DAYS
  const TIME_COL_W = 44 // px

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Bar: Edit Hint + Today Toggle */}
      <div className="flex items-center justify-between shrink-0 mb-1">
        {editMode ? (
          <div
            className="text-[9px] tracking-wider blink"
            style={{ fontFamily: 'var(--cad-font-mono)', color: 'var(--cad-accent)', opacity: 0.6 }}
          >
            ✎ CLICK EMPTY COLUMN TO ADD · CLICK BLOCK TO EDIT
          </div>
        ) : (
          <div
            className="text-[9px] tracking-wider"
            style={{ fontFamily: 'var(--cad-font-mono)', color: 'var(--cad-text-mid)', opacity: 0.8 }}
          >
            ▸ CLICK BLOCK TO MARK ATTENDANCE
          </div>
        )}
        
        <div className="flex gap-1 shrink-0 items-center">
          {/* TODAY button — highlighted/active on current week, outline when viewing other weeks */}
          <button
            onClick={() => setWeekOffset(0)}
            className="px-2 py-0.5 btn-mech panel-chamfer-sm mr-0.5"
            title={weekOffset === 0 ? "Currently viewing today's week" : "Jump to today's week"}
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: '8px', letterSpacing: '0.1em',
              border: weekOffset === 0 ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
              color: weekOffset === 0 ? 'var(--cad-accent-text)' : 'var(--cad-text-mid)',
              background: weekOffset === 0 ? 'var(--cad-accent-dim)' : 'transparent',
              borderRadius: 'var(--cad-radius)',
              cursor: weekOffset !== 0 ? 'pointer' : 'default',
            }}
          >TODAY</button>

          {/* Week navigation: [◀] [ 20–26 JUL 2026 ] [▶] */}
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="px-1.5 py-0.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: '9px',
              border: '1px solid var(--cad-border)', color: 'var(--cad-text-lo)',
              background: 'transparent', borderRadius: 'var(--cad-radius)',
            }}
          >◀</button>

          <div
            className="px-2 py-0.5 panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: '8px',
              letterSpacing: '0.08em',
              border: '1px solid var(--cad-border)',
              color: 'var(--cad-accent)',
              background: 'var(--cad-bg-input)',
              borderRadius: 'var(--cad-radius)',
              whiteSpace: 'nowrap',
            }}
          >
            {weekRangeStr}
          </div>

          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="px-1.5 py-0.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: '9px',
              border: '1px solid var(--cad-border)', color: 'var(--cad-text-lo)',
              background: 'transparent', borderRadius: 'var(--cad-radius)',
            }}
          >▶</button>

          <div style={{ width: '1px', height: '14px', background: 'var(--cad-border-dim)', margin: '0 2px' }} />

          {/* View Mode Filter: All Week vs Single Day */}
          {[
            { label: 'ALL WEEK', todayOnly: false },
            { label: 'SINGLE DAY', todayOnly: true },
          ].map(mode => {
            const isActive = (mode.todayOnly && showTodayOnly) || (!mode.todayOnly && !showTodayOnly)
            return (
              <button key={mode.label}
                onClick={() => setShowTodayOnly(mode.todayOnly)}
                className="px-2 py-0.5 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '8px',
                  letterSpacing:'0.15em',
                  textTransform:'uppercase',
                  border:       isActive ? '1px solid var(--cad-accent)'  : '1px solid var(--cad-border)',
                  color:        isActive ? 'var(--cad-accent-text)'        : 'var(--cad-text-lo)',
                  background:   isActive ? 'var(--cad-accent-dim)'         : 'transparent',
                  borderRadius: 'var(--cad-radius)',
                }}
              >{mode.label}</button>
            )
          })}
        </div>
      </div>

      {/* Scrollable Container (Both X and Y) */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0 min-w-0" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', minHeight: '1440px', height: '100%', minWidth: `${TIME_COL_W + displayDays.length * DAY_MIN_W}px`, display: 'flex', flexDirection: 'column' }}>

          {/* Sticky Day Header */}
          <div className="shrink-0 flex" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--cad-bg-primary)', borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div style={{ width: `${TIME_COL_W}px`, flexShrink: 0, borderRight: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }} />
            {displayDays.map((day) => {
              const isToday = weekOffset === 0 && DAYS.indexOf(day) === todayIdx
              const colIdx = DAYS.indexOf(day)
              const diff = colIdx - todayIdx
              const d = new Date(baseDate.getTime())
              d.setDate(d.getDate() + diff)
              const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
              const isManualHoliday = attendanceHook?.attendance?.[dateStr]?.isHoliday
              const isHoliday = (settings.holidays2nd4thSat && isSecondOrFourthSaturday(d.getFullYear(), d.getMonth(), d.getDate())) || isManualHoliday

              return (
                <div key={day}
                  className="flex-1 text-center py-1.5 flex flex-col items-center justify-center gap-0.5 relative group"
                  onClick={() => {
                    if (!editMode) {
                      setActiveDayDetail({
                        date: { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() },
                        weekday: day
                      })
                    }
                  }}
                  style={{
                    minWidth:     `${DAY_MIN_W}px`,
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     '9px',
                    letterSpacing:'0.15em',
                    textTransform:'uppercase',
                    color:        isToday ? 'var(--cad-accent)'   : 'var(--cad-text-mid)',
                    background:   isToday ? 'var(--cad-accent-dim)' : 'transparent',
                    cursor:       !editMode ? 'pointer' : 'default',
                  }}
                >
                  <div className="font-bold">{day}</div>
                  <div style={{ fontSize: '7.5px', color: isToday ? 'var(--cad-accent)' : 'var(--cad-text-lo)', opacity: 0.85, letterSpacing: '0.05em' }}>
                    {pad2(d.getDate())} {MONTH_NAMES[d.getMonth()]?.substring(0, 3)}
                  </div>
                  {isToday && <div className="text-[7px] blink" style={{ color: 'var(--cad-accent)', opacity: 0.5 }}>▸NOW</div>}
                  {isHoliday ? (
                    <div className="text-[7px] px-1 py-0.5 rounded" style={{ fontSize: '7px', border: '1px solid var(--cad-danger)', color: 'var(--cad-danger)', background: 'rgba(239,68,68,0.1)' }}>
                      HOLIDAY
                    </div>
                  ) : (
                    !editMode && (
                      <div className="text-[6px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--cad-text-lo)', fontSize: '6px' }}>
                        ● VIEW
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>

          {/* Grid Body */}
          <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
            
            {/* Sticky time axis */}
            <div style={{
              position:   'sticky',
              left:       0,
              width:      `${TIME_COL_W}px`,
              flexShrink: 0,
              height:     '100%',
              borderRight:'1px solid var(--cad-border-dim)',
              background: 'var(--cad-bg-primary)',
              zIndex:     5,
            }}>
              {TICK_HOURS.map(h => (
                <div
                  key={h}
                  style={{
                    position:    'absolute',
                    top:         `${((h - GRID_START_HOUR) / (GRID_END_HOUR - GRID_START_HOUR)) * 100}%`,
                    left:        0,
                    right:       0,
                    transform:   'translateY(-50%)',
                    textAlign:   'center',
                    fontFamily:  'var(--cad-font-mono)',
                    fontSize:    'clamp(8px, 1.2vw, 11px)',
                    color:       'var(--cad-text-lo)',
                    pointerEvents:'none',
                    userSelect:  'none',
                  }}
                >{pad2(h)}</div>
              ))}
            </div>

            {/* Day columns */}
            <div style={{ display: 'flex', flex: 1, height: '100%' }}>
              {displayDays.map((day) => {
                const isToday    = weekOffset === 0 && DAYS.indexOf(day) === todayIdx
                const dayEntries = byDay[day] ?? []
                
                const colIdx = DAYS.indexOf(day)
                const diff = colIdx - todayIdx
                const d = new Date(baseDate.getTime())
                d.setDate(d.getDate() + diff)
                const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
                const dayData = attendanceHook?.attendance?.[dateStr] || {}
                const isManualHoliday = dayData.isHoliday
                const isHoliday = (settings.holidays2nd4thSat && isSecondOrFourthSaturday(d.getFullYear(), d.getMonth(), d.getDate())) || isManualHoliday

                return (
                  <div
                    key={day}
                    style={{
                      flex:       1,
                      minWidth:   `${DAY_MIN_W}px`,
                      position:   'relative',
                      borderRight:'1px solid var(--cad-border-dim)',
                      background: isToday ? 'var(--cad-accent-dim)' : 'transparent',
                      cursor:     editMode && !isHoliday ? 'crosshair' : 'default',
                    }}
                    onClick={editMode && !isHoliday ? e => handleColClick(day, e) : undefined}
                  >
                    {/* Hour grid lines */}
                    {TICK_HOURS.map(h => (
                      <div
                        key={h}
                        style={{
                          position:   'absolute',
                          left:       0, right: 0,
                          top:        `${((h - GRID_START_HOUR) / (GRID_END_HOUR - GRID_START_HOUR)) * 100}%`,
                          height:     '1px',
                          background: 'var(--cad-border-dim)',
                          pointerEvents: 'none',
                        }}
                      />
                    ))}

                    {/* Now line */}
                    {weekOffset === 0 && DAYS.indexOf(day) === todayIdx && (() => {
                      const now = new Date(baseDate.getTime())
                      const nowMins = now.getHours() * 60 + now.getMinutes()
                      const nowPct = ((nowMins - GRID_START_HOUR * 60) / TOTAL_MINS) * 100
                      return (
                        <div style={{
                          position: 'absolute', left: 0, right: 0,
                          top: `${Math.max(0, Math.min(100, nowPct))}%`,
                          height: '2px',
                          background: 'var(--cad-danger)',
                          zIndex: 4,
                          pointerEvents: 'none',
                          boxShadow: '0 0 6px var(--cad-danger)',
                        }} />
                      )
                    })()}

                    {/* Event blocks */}
                    {dayEntries.map(entry => {
                      // Check for substitute subject on this specific date
                      const subId = dayData[`${entry.id}_sub`]
                      const displaySubj = subId ? subjectMap[subId] : subjectMap[entry.subjectId]
                      if (!displaySubj) return null
                      const isSubstitute = !!subId
                      const color    = SUBJECT_COLORS[displaySubj.colorIdx % SUBJECT_COLORS.length]
                      const startMs  = parseTimeToMins(entry.startTime) - GRID_START_HOUR * 60
                      const endMs    = parseTimeToMins(entry.endTime)   - GRID_START_HOUR * 60
                      const durMins  = endMs - startMs
                      const isShort  = durMins <= 45

                      const status = dayData[entry.id]
                      const hasNote = !!dayData[`${entry.id}_note`]

                      const handleBlockAction = (e) => {
                        e.stopPropagation()
                        if (isHoliday) return
                        
                        const rect = e.currentTarget.getBoundingClientRect()
                        if (editMode) {
                          onBlockClick(entry, rect)
                        } else if (attendanceHook && onInstanceClick) {
                          onInstanceClick(entry, dateStr, rect)
                        }
                      }

                      return (
                        <div
                          key={entry.id}
                          onClick={handleBlockAction}
                          title={`${displaySubj.name} · ${entry.room} · ${entry.startTime}–${entry.endTime}`}
                          style={{
                            position:        'absolute',
                            left:            '3px',
                            right:           '3px',
                            top:             pct(entry.startTime),
                            height:          pctH(entry.startTime, entry.endTime),
                            background:      `linear-gradient(${color.bg}, ${color.bg}), var(--cad-bg-primary)`,
                            borderLeft:      `3px solid ${color.border}`,
                            boxShadow:       `inset 0 0 0 1px ${color.border}22`,
                            padding:         '4px 6px',
                            overflow:        'hidden',
                            cursor:          isHoliday ? 'not-allowed' : 'pointer',
                            transition:      'transform 0.18s ease-out, box-shadow 0.18s ease-out, opacity 0.3s',
                            borderRadius:    '0 2px 2px 0',
                            opacity:         isHoliday ? 0.3 : 1,
                            filter:          isHoliday ? 'grayscale(100%)' : 'none',
                          }}
                          onMouseEnter={e => {
                            if (!isHoliday && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color.border}22, 0 4px 12px ${color.border}40`
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isHoliday && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color.border}22`
                            }
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--cad-font-mono)',
                              fontSize:   '10px',
                              fontWeight: '700',
                              color:      color.text,
                              overflow:   'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >{isSubstitute ? `⇄ ${displaySubj.code || generateSubjectCode(displaySubj.name)}` : (displaySubj.code || generateSubjectCode(displaySubj.name))}</div>
                          {!isShort && (
                            <>
                              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'clamp(8px, 1.1vw, 10px)', color: color.text, opacity: 0.85, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.room}
                              </div>
                              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'clamp(7px, 1vw, 10px)', color: color.text, opacity: 0.85, marginTop: 'auto', paddingTop: '4px' }}>
                                {entry.startTime}–{entry.endTime}
                              </div>
                            </>
                          )}
                          {editMode && <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: 'var(--cad-accent)', opacity: 0.5 }}>✎</div>}
                          {!editMode && attendanceHook && showTodayOnly && !isHoliday && (
                            <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 10 }}>
                              {['PRESENT', 'ABSENT', 'CANCELLED'].map(type => {
                                const isActive = status === type
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      attendanceHook.markAttendance(dateStr, entry.id, isActive ? null : type)
                                    }}
                                    style={{
                                      fontFamily: 'var(--cad-font-mono)', fontSize: '7px', letterSpacing: '0.1em',
                                      border: isActive ? `1px solid var(${colorVar})` : '1px solid rgba(255,255,255,0.1)',
                                      color: isActive ? `var(${colorVar})` : 'rgba(255,255,255,0.3)',
                                      background: bg,
                                      padding: '2px 4px',
                                      borderRadius: '2px',
                                      textAlign: 'center',
                                      cursor: 'pointer',
                                      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isActive) {
                                        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.3)'
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      if (!isActive) {
                                        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
                                      }
                                    }}
                                  >
                                    {type}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          {(editMode || (!showTodayOnly && status)) && (
                            <div style={{
                              position: 'absolute', top: '3px', right: '3px',
                              fontFamily: 'var(--cad-font-mono)', fontSize: '7px', fontWeight: 'bold',
                              padding: '1px 3px', borderRadius: '2px',
                              background: status === 'PRESENT' ? 'rgba(80,255,80,0.15)' : status === 'ABSENT' ? 'var(--cad-danger-dim)' : 'var(--cad-bg-primary)',
                              color: status === 'PRESENT' ? 'var(--cad-success)' : status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-lo)',
                              border: `1px solid ${status === 'PRESENT' ? 'var(--cad-success)' : status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-lo)'}`
                            }}>
                              {status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : 'C'}
                            </div>
                          )}
                          {hasNote && (
                            <div style={{
                              position: 'absolute', bottom: '3px', right: '3px',
                              fontFamily: 'var(--cad-font-mono)', fontSize: '7px',
                              color: 'var(--cad-accent)', opacity: 0.7,
                            }}>📝</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--cad-border-dim)', margin: '4px 0' }} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 pb-0.5 shrink-0 overflow-x-auto">
        {subjects.map(s => {
          const c = SUBJECT_COLORS[s.colorIdx % SUBJECT_COLORS.length]
          return (
            <div key={s.id} className="flex items-center gap-1.5 shrink-0">
              <span style={{ width: '8px', height: '8px', background: c.border, boxShadow: `0 0 4px ${c.border}`, display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-mid)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s.name}</span>
            </div>
          )
        })}
      </div>
      
      {/* Day detail modal */}
      {activeDayDetail && (
        <DayDetailModal
          date={activeDayDetail.date}
          weekday={activeDayDetail.weekday}
          timetable={timetable}
          subjects={subjects}
          attendanceHook={attendanceHook}
          onClose={() => setActiveDayDetail(null)}
        />
      )}
    </div>
  )
}
