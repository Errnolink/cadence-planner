import { useState, useMemo, useCallback, useRef } from 'react'
import { SUBJECT_COLORS, DAYS, GRID_START_HOUR, GRID_END_HOUR, pad2, getTodayDayIdx, parseTimeToMins, generateSubjectCode } from '../../data/index.js'
import { DataHr } from '../ui/DataHr.jsx'

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

export function TimetableGrid({ subjects, timetable, editMode, onCellClick, onBlockClick }) {
  const todayIdx = getTodayDayIdx()

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
    if (!editMode) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const mins  = Math.round((GRID_START_HOUR * 60 + ratio * TOTAL_MINS) / 30) * 30
    const endMs = Math.min(mins + 60, GRID_END_HOUR * 60)
    const fmt   = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
    onCellClick(day, fmt(mins), fmt(endMs))
  }, [editMode, onCellClick])

  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const displayDays = showTodayOnly ? [DAYS[todayIdx]] : DAYS
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
        ) : <div />}
        
        <div className="flex gap-1 shrink-0">
          {['ALL WEEK', 'TODAY'].map(mode => {
            const isActive = (mode === 'TODAY' && showTodayOnly) || (mode === 'ALL WEEK' && !showTodayOnly)
            return (
              <button key={mode}
                onClick={() => setShowTodayOnly(mode === 'TODAY')}
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
              >{mode}</button>
            )
          })}
        </div>
      </div>

      {/* Scrollable Container (Both X and Y) */}
      <div className="flex-1 overflow-auto min-h-0 min-w-0" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', minHeight: '480px', height: '100%', minWidth: `${TIME_COL_W + displayDays.length * DAY_MIN_W}px`, display: 'flex', flexDirection: 'column' }}>

          {/* Sticky Day Header */}
          <div className="shrink-0 flex" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--cad-bg-primary)', borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div style={{ width: `${TIME_COL_W}px`, flexShrink: 0, borderRight: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }} />
            {displayDays.map((day) => {
              const isToday = DAYS.indexOf(day) === todayIdx
              return (
                <div key={day}
                  className="flex-1 text-center py-1"
                  style={{
                    minWidth:     `${DAY_MIN_W}px`,
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     '9px',
                    letterSpacing:'0.15em',
                    textTransform:'uppercase',
                    color:        isToday ? 'var(--cad-accent)'   : 'var(--cad-text-mid)',
                    background:   isToday ? 'var(--cad-accent-dim)' : 'transparent',
                  }}
                >
                  {day}
                  {isToday && <div className="text-[7px] blink" style={{ color: 'var(--cad-accent)', opacity: 0.5 }}>▸NOW</div>}
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
                    fontSize:    '8px',
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
                const isToday    = DAYS.indexOf(day) === todayIdx
                const dayEntries = byDay[day] ?? []

                return (
                  <div
                    key={day}
                    style={{
                      flex:       1,
                      minWidth:   `${DAY_MIN_W}px`,
                      position:   'relative',
                      borderRight:'1px solid var(--cad-border-dim)',
                      background: isToday ? 'var(--cad-accent-dim)' : 'transparent',
                      cursor:     editMode ? 'crosshair' : 'default',
                    }}
                    onClick={editMode ? e => handleColClick(day, e) : undefined}
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

                    {/* Event blocks */}
                    {dayEntries.map(entry => {
                      const subj = subjectMap[entry.subjectId]
                      if (!subj) return null
                      const color    = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
                      const startMs  = parseTimeToMins(entry.startTime) - GRID_START_HOUR * 60
                      const endMs    = parseTimeToMins(entry.endTime)   - GRID_START_HOUR * 60
                      const durMins  = endMs - startMs
                      const isShort  = durMins <= 45

                      return (
                        <div
                          key={entry.id}
                          onClick={editMode ? e => { e.stopPropagation(); onBlockClick(entry) } : undefined}
                          title={`${subj.name} · ${entry.room} · ${entry.startTime}–${entry.endTime}`}
                          style={{
                            position:        'absolute',
                            left:            '3px',
                            right:           '3px',
                            top:             pct(entry.startTime),
                            height:          pctH(entry.startTime, entry.endTime),
                            background:      color.bg,
                            borderLeft:      `3px solid ${color.border}`,
                            boxShadow:       `inset 0 0 0 1px ${color.border}22`,
                            padding:         '4px 6px',
                            overflow:        'hidden',
                            cursor:          editMode ? 'pointer' : 'default',
                            transition:      'filter 0.15s',
                            borderRadius:    '0 2px 2px 0',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
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
                          >{subj.code || generateSubjectCode(subj.name)}</div>
                          {!isShort && (
                            <>
                              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: color.text, opacity: 0.8, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.room}
                              </div>
                              <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: color.text, opacity: 0.6, marginTop: 'auto', paddingTop: '4px' }}>
                                {entry.startTime}–{entry.endTime}
                              </div>
                            </>
                          )}
                          {editMode && <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: 'var(--cad-accent)', opacity: 0.5 }}>✎</div>}
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
      <DataHr />
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
    </div>
  )
}
