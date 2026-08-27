import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { DAYS, MONTH_NAMES, GRID_START_HOUR, GRID_END_HOUR, pad2, parseTimeToMins, generateSubjectCode, subjectVars, subjectVar } from '../../data/index.js'
import { dateStrFromParts, getDayMeta } from '../../data/calendar.js'
import { DayDetailModal } from '../calendar/DayDetailModal.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'
import { useNow } from '../../hooks/useNow.js'
import { useAttendanceContext } from '../../hooks/useAttendanceContext.jsx'
import { AttendanceToggle } from '../ui/AttendanceToggle.jsx'


const DAY_MIN_W = 80   // px — min width per day column on mobile
const HOUR_PX   = 60   // px — vertical scale, so the scroller is only as tall as the window shown
const TIME_COL_W = 44  // px

// A block's status badge, note marker and quick-mark toggle are absolutely
// positioned on top of its text. `text-overflow: ellipsis` cannot see them:
// the label measures as fitting, renders no ellipsis, and then loses its last
// characters under an opaque badge. It shows up in ALL WEEK, where a column is
// only DAY_MIN_W wide and the badge covers the last ~14px of every label.
// The text lines reserve the gutter instead. e2e/week-label.spec.js asserts no
// overlay overlaps any text line, which is what keeps these numbers honest if
// an overlay changes size.
const BADGE_GUTTER  = 20  // px — status badge (P/A/C) plus its 3px inset
const NOTE_GUTTER   = 18  // px — note marker plus its 3px inset
const TOGGLE_GUTTER = 80  // px — the compact PRESENT/ABSENT/CANCELLED column, measured at 73px + its 4px inset

/** Visible hour window derived from the data, clamped to the hard grid bounds. */
function visibleWindow(timetable, exams) {
  const times = [...timetable, ...exams].flatMap(x => [parseTimeToMins(x.startTime), parseTimeToMins(x.endTime)])
    .filter(n => Number.isFinite(n) && n > 0)
  if (!times.length) return [8, 18]
  const start = Math.max(GRID_START_HOUR, Math.floor(Math.min(...times) / 60) - 1)
  const end   = Math.min(GRID_END_HOUR,   Math.ceil(Math.max(...times) / 60) + 1)
  return [start, Math.max(end, start + 1)]
}

export function TimetableGrid({ subjects, timetable, editMode, onCellClick, onBlockClick, onInstanceClick, exams = [] }) {
  const { settings } = useSettings()
  const { attendance, examDates, semester, markAttendance } = useAttendanceContext()
  // today column stop freezing at mount — leaving the tab open past midnight
  // used to leave all three a day stale.
  const now = useNow()
  const todayIdx = useMemo(() => { const d = now.getDay(); return d === 0 ? 6 : d - 1 }, [now])

  const [weekOffset, setWeekOffset] = useState(0)
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const [fullDay, setFullDay] = useState(false)
  const [activeDayDetail, setActiveDayDetail] = useState(null)  // 'YYYY-MM-DD'

  const baseDate = useMemo(() => {
    const d = new Date(now.getTime())
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [now, weekOffset])

  // ─── Visible time window (P4/U2) ──────────────────────────────
  // 00:00–24:00 rendered 175 absolutely-positioned lines in a 1440px scroller
  // for classes that occupy ~08:00–18:00. GRID_START/END_HOUR stay the hard
  // validation clamp; the grid only paints the hours that have something in them.
  const [dataStart, dataEnd] = useMemo(() => visibleWindow(timetable, exams), [timetable, exams])
  const gridStart = fullDay ? GRID_START_HOUR : dataStart
  const gridEnd   = fullDay ? GRID_END_HOUR   : dataEnd
  const totalMins = (gridEnd - gridStart) * 60
  const tickHours = useMemo(
    () => Array.from({ length: gridEnd - gridStart + 1 }, (_, i) => gridStart + i),
    [gridStart, gridEnd]
  )

  const pct  = useCallback((timeStr) => {
    const offset = parseTimeToMins(timeStr) - gridStart * 60
    return `${Math.max(0, Math.min(100, (offset / totalMins) * 100))}%`
  }, [gridStart, totalMins])
  const pctH = useCallback((start, end) => {
    const s = Math.max(parseTimeToMins(start) - gridStart * 60, 0)
    const e = Math.min(parseTimeToMins(end)   - gridStart * 60, totalMins)
    return `${Math.max(0, ((e - s) / totalMins) * 100)}%`
  }, [gridStart, totalMins])

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
    const frac = Math.max(0, Math.min(1, y / rect.height))
    const mins = gridStart * 60 + frac * totalMins

    // Snap to nearest 30 mins
    const snappedMins = Math.floor(mins / 30) * 30
    // 23:59 is the latest a native time input can hold — 24:00 is rejected
    // by the browser with a console warning.
    const endMins = Math.min(GRID_END_HOUR * 60 - 1, snappedMins + 60)

    onCellClick(day,
      `${pad2(Math.floor(snappedMins / 60))}:${pad2(snappedMins % 60)}`,
      `${pad2(Math.floor(endMins / 60))}:${pad2(endMins % 60)}`)
  }, [editMode, onCellClick, gridStart, totalMins])

  // Keyboard-reachable equivalent of the click-position-to-time affordance.
  const addHour = Math.min(Math.max(gridStart, 9), gridEnd - 1)
  const handleHeaderAdd = useCallback((day) => {
    const end = addHour + 1 >= GRID_END_HOUR ? `${pad2(GRID_END_HOUR - 1)}:59` : `${pad2(addHour + 1)}:00`
    onCellClick?.(day, `${pad2(addHour)}:00`, end)
  }, [onCellClick, addHour])

  const scrollRef = useRef(null)

  // Auto-scroll to the current time — on mount AND whenever the week or the
  // visible window changes (it used to persist wherever you left it).
  // Deliberately not keyed on `now`: re-scrolling every minute would fight the user.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const clock = new Date()
    const nowMins = clock.getHours() * 60 + clock.getMinutes()
    const offset = (nowMins - gridStart * 60) / totalMins
    // Position "now" at ~1/3 from top of visible area
    const scrollTarget = offset * el.scrollHeight - el.clientHeight / 3
    el.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
  }, [weekOffset, gridStart, totalMins])

  const displayDays = useMemo(
    () => (showTodayOnly && weekOffset === 0 ? [DAYS[todayIdx]] : DAYS),
    [showTodayOnly, weekOffset, todayIdx])

  /** Date + holiday/exam facts for a column, from the one shared source. */
  const dayMetaFor = useCallback((day) => {
    const d = new Date(baseDate.getTime())
    d.setDate(d.getDate() + (DAYS.indexOf(day) - todayIdx))
    const dateStr = dateStrFromParts(d.getFullYear(), d.getMonth(), d.getDate())
    return { d, dateStr, meta: getDayMeta(dateStr, { settings, attendance, examDates, semester }) }
  }, [baseDate, todayIdx, settings, attendance, examDates, semester])

  // A week nobody's term covers. The grid happily paints the weekly pattern
  // for any week you navigate to, so without saying so it would show a full
  // timetable for a week whose marks the stats now ignore.
  const weekOutOfTerm = useMemo(
    () => displayDays.every(day => !dayMetaFor(day).meta.inTerm),
    [displayDays, dayMetaFor])

  const isEmpty = timetable.length === 0 && exams.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Bar: Edit Hint + View Filters */}
      {/* Wraps rather than overflowing. The control group needs ~460px; below
          that it used to run off the right edge of a container with
          `overflow-hidden` and no scrollable ancestor, which put ALL WEEK /
          SINGLE DAY / FULL DAY out of reach of a finger on every phone —
          SINGLE DAY, the view meant for exactly that screen, included.
          (Scripted clicks still reached them, so the e2e suite never noticed.)
          The edit hint gives up its row first: it is advisory, the chips are not. */}
      <div className="flex items-center justify-between shrink-0 mb-1 gap-2 flex-wrap">
        <div
          className={`hidden sm:block ${editMode ? 'blink' : ''}`}
          style={{
            fontFamily: 'var(--cad-font-mono)',
            fontSize: 'var(--cad-fs-micro)',
            letterSpacing: 'var(--cad-track-mid)',
            color: editMode ? 'var(--cad-accent)' : 'var(--cad-text-mid)',
          }}
        >
          {editMode
            ? <><span aria-hidden="true">✎ </span>CLICK EMPTY COLUMN OR + ADD · CLICK BLOCK TO EDIT</>
            : <><span aria-hidden="true">▸ </span>CLICK BLOCK TO MARK ATTENDANCE</>}
        </div>

        <div className="flex gap-1 items-center flex-wrap justify-end ml-auto">
          {/* TODAY button — active on the current week, outline elsewhere */}
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="cad-chip btn-mech panel-chamfer-sm mr-0.5"
            data-active={weekOffset === 0 || undefined}
            title={weekOffset === 0 ? "Currently viewing today's week" : "Jump to today's week"}
          >TODAY</button>

          {/* Week navigation: [◀] [ 20–26 JUL 2026 ] [▶] */}
          <button
            type="button"
            onClick={() => setWeekOffset(w => w - 1)}
            aria-label="Previous week"
            className="px-1.5 py-0.5 btn-mech panel-chamfer-sm tap-grow"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)',
              border: '1px solid var(--cad-border)', color: 'var(--cad-text-lo)',
              background: 'transparent', borderRadius: 'var(--cad-radius)',
            }}
          ><span aria-hidden="true">◀</span></button>

          <div
            className="px-2 py-0.5 panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: 'var(--cad-fs-micro)',
              letterSpacing: '0.08em',
              border: '1px solid var(--cad-border)',
              color: weekOutOfTerm ? 'var(--cad-text-lo)' : 'var(--cad-accent)',
              background: 'var(--cad-bg-input)',
              borderRadius: 'var(--cad-radius)',
              whiteSpace: 'nowrap',
            }}
            title={weekOutOfTerm ? `Outside ${semester?.label || 'the semester'} — attendance here is not counted` : undefined}
          >
            {weekRangeStr}
            {weekOutOfTerm && <span className="sr-only">, outside the semester</span>}
          </div>
          {weekOutOfTerm && (
            <span
              aria-hidden="true"
              className="px-1.5 py-0.5 panel-chamfer-sm"
              style={{
                fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                letterSpacing: 'var(--cad-track-mid)', color: 'var(--cad-text-lo)',
                border: '1px dashed var(--cad-border)', borderRadius: 'var(--cad-radius)',
                whiteSpace: 'nowrap',
              }}
            >OFF-TERM</span>
          )}

          <button
            type="button"
            onClick={() => setWeekOffset(w => w + 1)}
            aria-label="Next week"
            className="px-1.5 py-0.5 btn-mech panel-chamfer-sm tap-grow"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)',
              border: '1px solid var(--cad-border)', color: 'var(--cad-text-lo)',
              background: 'transparent', borderRadius: 'var(--cad-radius)',
            }}
          ><span aria-hidden="true">▶</span></button>

          <div aria-hidden="true" style={{ width: '1px', height: '14px', background: 'var(--cad-border-dim)', margin: '0 2px' }} />

          {/* View Mode Filter: All Week vs Single Day, plus the full 24h canvas */}
          {[
            { label: 'ALL WEEK',   active: !showTodayOnly, onClick: () => setShowTodayOnly(false) },
            { label: 'SINGLE DAY', active: showTodayOnly,  onClick: () => setShowTodayOnly(true) },
            { label: 'FULL DAY',   active: fullDay,        onClick: () => setFullDay(v => !v),
              title: `Show all 24 hours instead of ${pad2(dataStart)}:00–${pad2(dataEnd)}:00` },
          ].map(mode => (
            <button key={mode.label}
              type="button"
              onClick={mode.onClick}
              title={mode.title}
              aria-pressed={mode.active}
              className="cad-chip btn-mech panel-chamfer-sm"
              data-active={mode.active || undefined}
            >{mode.label}</button>
          ))}
        </div>
      </div>

      {isEmpty && (
        <div
          className="shrink-0 mb-1 px-3 py-2 panel-chamfer-sm"
          style={{
            border: '1px dashed var(--cad-border)', background: 'var(--cad-bg-elevated)',
            fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)',
          }}
        >
          // NO CLASSES IN THIS SEMESTER — {editMode ? 'USE + ADD IN A DAY COLUMN' : 'ENABLE EDIT MODE TO ADD ONE'}
        </div>
      )}

      {/* Scrollable Container (Both X and Y) */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0 min-w-0" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', minHeight: `${(gridEnd - gridStart) * HOUR_PX}px`, height: '100%', minWidth: `${TIME_COL_W + displayDays.length * DAY_MIN_W}px`, display: 'flex', flexDirection: 'column' }}>

          {/* Sticky Day Header */}
          <div className="shrink-0 flex" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--cad-bg-primary)', borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div style={{ width: `${TIME_COL_W}px`, flexShrink: 0, borderRight: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }} />
            {displayDays.map((day) => {
              const isToday = weekOffset === 0 && DAYS.indexOf(day) === todayIdx
              const { d, dateStr, meta } = dayMetaFor(day)
              const dateLabel = `${pad2(d.getDate())} ${MONTH_NAMES[d.getMonth()]?.substring(0, 3)}`

              const headerBody = (
                <>
                  <span className="font-bold">{day}</span>
                  <span style={{ fontSize: 'var(--cad-fs-micro)', color: isToday ? 'var(--cad-accent)' : 'var(--cad-text-lo)', letterSpacing: '0.05em' }}>
                    {dateLabel}
                  </span>
                  {isToday && <span className="blink" style={{ fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)' }}><span aria-hidden="true">▸</span>NOW</span>}
                  {meta.isHoliday && (
                    <span className="px-1 rounded" style={{ fontSize: 'var(--cad-fs-micro)', border: '1px solid var(--cad-danger)', color: 'var(--cad-danger)', background: 'var(--cad-danger-dim)' }}>
                      HOLIDAY
                    </span>
                  )}
                </>
              )

              return (
                <div key={day}
                  className="flex-1 text-center py-1.5 flex flex-col items-center justify-center gap-0.5 relative group"
                  style={{
                    minWidth:     `${DAY_MIN_W}px`,
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     'var(--cad-fs-xs)',
                    letterSpacing:'var(--cad-track-wide)',
                    textTransform:'uppercase',
                    color:        isToday ? 'var(--cad-accent)'   : 'var(--cad-text-mid)',
                    background:   isToday ? 'var(--cad-accent-dim)' : 'transparent',
                  }}
                >
                  {editMode ? (
                    <>
                      {headerBody}
                      {!meta.isHoliday && !meta.isExamDay && onCellClick && (
                        <button
                          type="button"
                          onClick={() => handleHeaderAdd(day)}
                          className="cad-chip btn-mech"
                          style={{ fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)', borderColor: 'var(--cad-accent)' }}
                          aria-label={`Add a class on ${day} at ${pad2(addHour)}:00`}
                        >+ ADD</button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveDayDetail(dateStr)}
                      aria-label={`View schedule for ${day} ${dateLabel}${meta.isHoliday ? ' (holiday)' : ''}`}
                      className="btn-mech flex flex-col items-center gap-0.5 w-full"
                      style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit' }}
                    >
                      {headerBody}
                      {!meta.isHoliday && (
                        <span aria-hidden="true" className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
                          ● VIEW
                        </span>
                      )}
                    </button>
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
              {tickHours.map(h => (
                <div
                  key={h}
                  style={{
                    position:    'absolute',
                    top:         `${((h - gridStart) / (gridEnd - gridStart)) * 100}%`,
                    left:        0,
                    right:       0,
                    transform:   'translateY(-50%)',
                    textAlign:   'center',
                    fontFamily:  'var(--cad-font-mono)',
                    fontSize:    'var(--cad-fs-micro)',
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
                const { dateStr, meta } = dayMetaFor(day)
                const dayData    = attendance[dateStr] ?? {}
                const isHoliday  = meta.isHoliday
                const dayExams   = exams.filter(e => e.date === dateStr)
                const isExamDay  = dayExams.length > 0

                return (
                  <div
                    key={day}
                    style={{
                      flex:       1,
                      minWidth:   `${DAY_MIN_W}px`,
                      position:   'relative',
                      borderRight:'1px solid var(--cad-border-dim)',
                      background: isToday ? 'var(--cad-accent-dim)' : 'transparent',
                      cursor:     editMode && !isHoliday && !isExamDay ? 'crosshair' : 'default',
                    }}
                    onClick={editMode && !isHoliday && !isExamDay ? e => handleColClick(day, e) : undefined}
                  >
                    {/* Hour grid lines */}
                    {tickHours.map(h => (
                      <div
                        key={h}
                        style={{
                          position:   'absolute',
                          left:       0, right: 0,
                          top:        `${((h - gridStart) / (gridEnd - gridStart)) * 100}%`,
                          height:     '1px',
                          background: 'var(--cad-border-dim)',
                          pointerEvents: 'none',
                        }}
                      />
                    ))}

                    {/* Now line */}
                    {weekOffset === 0 && DAYS.indexOf(day) === todayIdx && (() => {
                      const nowMins = now.getHours() * 60 + now.getMinutes()
                      const nowPct = ((nowMins - gridStart * 60) / totalMins) * 100
                      if (nowPct < 0 || nowPct > 100) return null
                      return (
                        <div style={{
                          position: 'absolute', left: 0, right: 0,
                          top: `${nowPct}%`,
                          height: '2px',
                          background: 'var(--cad-danger)',
                          zIndex: 4,
                          pointerEvents: 'none',
                          boxShadow: '0 0 6px var(--cad-danger)',
                        }} />
                      )
                    })()}

                    {/* Event blocks — hidden on exam days (classes suspended, exams shown instead) */}
                    {!isExamDay && dayEntries.map(entry => {
                      // Check for substitute subject on this specific date
                      const subId = dayData[`${entry.id}_sub`]
                      const displaySubj = subId ? subjectMap[subId] : subjectMap[entry.subjectId]
                      if (!displaySubj) return null
                      const isSubstitute = !!subId
                      const durMins  = parseTimeToMins(entry.endTime) - parseTimeToMins(entry.startTime)
                      const isShort  = durMins <= 45

                      const status  = dayData[entry.id]
                      const hasNote = !!dayData[`${entry.id}_note`]
                      const code    = displaySubj.code || generateSubjectCode(displaySubj.name)

                      // Must mirror the render conditions of the two top-right
                      // overlays below; they are mutually exclusive (the toggle
                      // needs showTodayOnly && !editMode, which excludes both
                      // arms of the badge).
                      const hasToggle = !editMode && showTodayOnly && !isHoliday
                      const hasBadge  = editMode || (!showTodayOnly && status)
                      const topRightGutter = hasToggle ? TOGGLE_GUTTER : hasBadge ? BADGE_GUTTER : 0

                      const handleBlockAction = (e) => {
                        e.stopPropagation()
                        if (isHoliday) return
                        if (editMode) onBlockClick(entry)
                        else if (onInstanceClick) onInstanceClick(entry, dateStr)
                      }

                      const label = [
                        displaySubj.name,
                        `${entry.startTime} to ${entry.endTime}`,
                        entry.room ? `room ${entry.room}` : null,
                        isSubstitute ? 'substituted class' : null,
                        status ? `marked ${status.toLowerCase()}` : 'not marked',
                        hasNote ? 'has a note' : null,
                        isHoliday ? 'holiday' : editMode ? 'edit entry' : 'open class',
                      ].filter(Boolean).join(', ')

                      return (
                        <div
                          key={entry.id}
                          className="tt-block"
                          data-holiday={isHoliday || undefined}
                          style={{
                            ...subjectVars(displaySubj.colorIdx),
                            position:     'absolute',
                            left:         '3px',
                            right:        '3px',
                            top:          pct(entry.startTime),
                            height:       pctH(entry.startTime, entry.endTime),
                            background:   'linear-gradient(var(--subj-bg), var(--subj-bg)), var(--cad-bg-primary)',
                            borderLeft:   '3px solid var(--subj-border)',
                            boxShadow:    'inset 0 0 0 1px var(--tt-edge)',
                            overflow:     'hidden',
                            borderRadius: '0 2px 2px 0',
                            opacity:      isHoliday ? 0.3 : 1,
                            filter:       isHoliday ? 'grayscale(100%)' : 'none',
                          }}
                        >
                          <button
                            type="button"
                            onClick={handleBlockAction}
                            disabled={isHoliday}
                            aria-label={label}
                            title={`${displaySubj.name} · ${entry.room} · ${entry.startTime}–${entry.endTime}`}
                            className="tt-block-action btn-mech"
                            style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', flexDirection: 'column',
                              cursor: isHoliday ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--cad-font-mono)',
                                fontSize:   'var(--cad-fs-micro)',
                                fontWeight: '700',
                                color:      'var(--subj-text)',
                                overflow:   'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                paddingRight: `${topRightGutter}px`,
                              }}
                            >{isSubstitute && <span aria-hidden="true">⇄ </span>}{code}</span>
                            {!isShort && (
                              <>
                                <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--subj-text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: `${topRightGutter}px` }}>
                                  {entry.room}
                                </span>
                                <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--subj-text)', marginTop: 'auto', paddingTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: `${Math.max(hasNote ? NOTE_GUTTER : 0, hasToggle ? TOGGLE_GUTTER : 0)}px` }}>
                                  {entry.startTime}–{entry.endTime}
                                </span>
                              </>
                            )}
                          </button>

                          {editMode && (
                            <span aria-hidden="true" style={{ position: 'absolute', bottom: '3px', left: '6px', pointerEvents: 'none', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)' }}>✎</span>
                          )}
                          {!editMode && showTodayOnly && !isHoliday && (
                            <div style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 10 }}>
                              <AttendanceToggle dateStr={dateStr} entryId={entry.id} activeStatus={status} onMark={markAttendance} />
                            </div>
                          )}
                          {(editMode || (!showTodayOnly && status)) && (
                            <div style={{
                              position: 'absolute', top: '3px', right: '3px', pointerEvents: 'none',
                              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', fontWeight: 'bold',
                              padding: '1px 3px', borderRadius: '2px',
                              background: status === 'PRESENT' ? 'color-mix(in srgb, var(--cad-success) 15%, transparent)' : status === 'ABSENT' ? 'var(--cad-danger-dim)' : 'var(--cad-bg-primary)',
                              color: status === 'PRESENT' ? 'var(--cad-success)' : status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-lo)',
                              border: `1px solid ${status === 'PRESENT' ? 'var(--cad-success)' : status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-lo)'}`,
                            }}>
                              <span aria-hidden="true">{status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : 'C'}</span>
                            </div>
                          )}
                          {hasNote && (
                            <div style={{
                              position: 'absolute', bottom: '3px', right: '3px', pointerEvents: 'none',
                              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)',
                              color: 'var(--cad-accent)',
                            }}>
                              <span aria-hidden="true">📝</span>
                              <span className="sr-only">Has a note</span>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Exam blocks (date-specific — distinct dashed accent style) */}
                    {dayExams.map(exam => {
                      const subj = subjectMap[exam.subjectId]
                      if (!subj) return null
                      const short = parseTimeToMins(exam.endTime) - parseTimeToMins(exam.startTime) <= 45
                      return (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={e => { e.stopPropagation(); setActiveDayDetail(dateStr) }}
                          aria-label={`Exam: ${subj.name}, ${exam.startTime} to ${exam.endTime}${exam.room ? `, room ${exam.room}` : ''}. Open day detail`}
                          title={`EXAM · ${subj.name}${exam.room ? ` · ${exam.room}` : ''} · ${exam.startTime}–${exam.endTime}${exam.notes ? ` · ${exam.notes}` : ''}`}
                          className="btn-mech"
                          style={{
                            ...subjectVars(subj.colorIdx),
                            position: 'absolute',
                            left: '3px',
                            right: '3px',
                            top: pct(exam.startTime),
                            height: pctH(exam.startTime, exam.endTime),
                            background: 'linear-gradient(var(--subj-bg), var(--subj-bg)), var(--cad-bg-primary)',
                            border: '1px dashed var(--cad-accent)',
                            borderLeft: '3px solid var(--cad-accent)',
                            boxShadow: '0 0 6px var(--cad-accent-glow)',
                            padding: '4px 6px',
                            overflow: 'hidden',
                            zIndex: 3,
                            borderRadius: '0 2px 2px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', fontWeight: '700', color: 'var(--cad-accent)', letterSpacing: 'var(--cad-track-mid)' }}>
                            <span aria-hidden="true">✎ </span>EXAM
                          </span>
                          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', fontWeight: '700', color: 'var(--subj-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subj.code || generateSubjectCode(subj.name)}
                          </span>
                          {!short && (
                            <>
                              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--subj-text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {exam.room}
                              </span>
                              <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--subj-text)', marginTop: 'auto', paddingTop: '4px' }}>
                                {exam.startTime}–{exam.endTime}
                              </span>
                            </>
                          )}
                        </button>
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
        {subjects.map(s => (
          <div key={s.id} className="flex items-center gap-1.5 shrink-0">
            <span aria-hidden="true" style={{
              width: '8px', height: '8px', display: 'inline-block',
              background: subjectVar(s.colorIdx, 'border'),
              boxShadow: `0 0 4px ${subjectVar(s.colorIdx, 'border')}`,
            }} />
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-mid)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s.name}</span>
          </div>
        ))}
      </div>

      {/* Day detail modal */}
      {activeDayDetail && (
        <DayDetailModal
          dateStr={activeDayDetail}
          timetable={timetable}
          subjects={subjects}
          onClose={() => setActiveDayDetail(null)}
        />
      )}
    </div>
  )
}
