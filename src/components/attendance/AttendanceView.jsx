import { useState, useMemo } from 'react'
import { SUBJECT_COLORS, DAYS, parseTimeToMins } from '../../data/index.js'

function dayLabel(year, month, day) {
  const js = new Date(year, month, day).getDay()
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][js]
}

export function AttendanceView({ timetable, subjects, attendanceHook }) {
  const { attendance, markAttendance, getSubjectStats, getOverallStats } = attendanceHook
  
  const today = new Date()
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )

  const selectedDate = new Date(selectedDateStr)
  const wday = dayLabel(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
  
  // Entries for the selected day
  const dayEntries = useMemo(() => {
    return timetable
      .filter(t => t.day === wday)
      .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime))
  }, [timetable, wday])

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  const overallStats = getOverallStats(subjects, timetable)
  const dayData = attendance[selectedDateStr] || {}

  const sectionStyle = { marginBottom: '24px' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '8px' }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      
      {/* Date Picker */}
      <div style={sectionStyle}>
        <div style={labelStyle}>MARK ATTENDANCE FOR</div>
        <input 
          type="date"
          value={selectedDateStr}
          onChange={e => e.target.value && setSelectedDateStr(e.target.value)}
          style={{
            width: '100%',
            fontFamily: 'var(--cad-font-mono)',
            fontSize: '13px',
            color: 'var(--cad-accent-text)',
            background: 'var(--cad-bg-input)',
            border: '1px solid var(--cad-border)',
            padding: '8px',
            outline: 'none',
            borderRadius: 'var(--cad-radius)'
          }}
        />
      </div>

      {/* Daily Checklist */}
      <div style={sectionStyle}>
        <div style={labelStyle}>CLASSES ({wday})</div>
        {dayEntries.length === 0 ? (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-lo)', padding: '12px 0', textAlign: 'center', border: '1px solid var(--cad-border-dim)', borderRadius: 'var(--cad-radius)' }}>
            // NO CLASSES SCHEDULED
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEntries.map(entry => {
              const subj = subjectMap[entry.subjectId]
              if (!subj) return null
              const color = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
              const status = dayData[entry.id]

              return (
                <div key={entry.id} className="flex flex-col md:flex-row gap-2 md:items-center justify-between p-2" style={{ border: '1px solid var(--cad-border-dim)', borderRadius: 'var(--cad-radius)', background: 'var(--cad-bg-elevated)' }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: '4px', height: '24px', background: color.bg }} />
                    <div>
                      <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '12px', color: color.text, fontWeight: 'bold' }}>{subj.name}</div>
                      <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)' }}>{entry.startTime} - {entry.endTime} {entry.room ? `| ${entry.room}` : ''}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 mt-2 md:mt-0">
                    <button
                      onClick={() => markAttendance(selectedDateStr, entry.id, status === 'PRESENT' ? null : 'PRESENT')}
                      className="px-2 py-1 btn-mech"
                      style={{
                        fontFamily: 'var(--cad-font-mono)', fontSize: '9px', letterSpacing: '0.1em',
                        border: status === 'PRESENT' ? '1px solid var(--cad-success)' : '1px solid var(--cad-border)',
                        color: status === 'PRESENT' ? 'var(--cad-success)' : 'var(--cad-text-mid)',
                        background: status === 'PRESENT' ? 'rgba(80,255,80,0.1)' : 'transparent',
                        borderRadius: 'var(--cad-radius)'
                      }}
                    >PRESENT</button>
                    <button
                      onClick={() => markAttendance(selectedDateStr, entry.id, status === 'ABSENT' ? null : 'ABSENT')}
                      className="px-2 py-1 btn-mech"
                      style={{
                        fontFamily: 'var(--cad-font-mono)', fontSize: '9px', letterSpacing: '0.1em',
                        border: status === 'ABSENT' ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
                        color: status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-mid)',
                        background: status === 'ABSENT' ? 'var(--cad-danger-dim)' : 'transparent',
                        borderRadius: 'var(--cad-radius)'
                      }}
                    >ABSENT</button>
                    <button
                      onClick={() => markAttendance(selectedDateStr, entry.id, status === 'CANCELLED' ? null : 'CANCELLED')}
                      className="px-2 py-1 btn-mech"
                      style={{
                        fontFamily: 'var(--cad-font-mono)', fontSize: '9px', letterSpacing: '0.1em',
                        border: status === 'CANCELLED' ? '1px solid var(--cad-text-lo)' : '1px solid var(--cad-border)',
                        color: status === 'CANCELLED' ? 'var(--cad-text-mid)' : 'var(--cad-text-lo)',
                        background: status === 'CANCELLED' ? 'var(--cad-bg-primary)' : 'transparent',
                        borderRadius: 'var(--cad-radius)'
                      }}
                    >CANCELLED</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Global Stats */}
      <div style={sectionStyle}>
        <div style={labelStyle}>OVERALL ATTENDANCE</div>
        <div className="flex items-end gap-3 p-3 panel-chamfer-sm" style={{ background: 'var(--cad-bg-elevated)', borderLeft: '3px solid var(--cad-accent)' }}>
          <div style={{ fontFamily: 'var(--cad-font-ui)', fontSize: '48px', lineHeight: '40px', color: 'var(--cad-accent)' }} className="glow-accent">
            {overallStats.percentage}%
          </div>
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-mid)', marginBottom: '2px' }}>
            {overallStats.present} / {overallStats.total} CLASSES ATTENDED
          </div>
        </div>
      </div>

      {/* Subject Stats */}
      <div>
        <div style={labelStyle}>SUBJECT WISE</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {subjects.map(subj => {
            const stats = getSubjectStats(subj.id, timetable)
            const color = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
            return (
              <div key={subj.id} className="p-2" style={{ border: '1px solid var(--cad-border-dim)', borderLeft: `3px solid ${color.border}`, borderRadius: '0 var(--cad-radius) var(--cad-radius) 0', background: 'var(--cad-bg-elevated)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: color.text, fontWeight: 'bold' }}>{subj.name}</div>
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '12px', color: 'var(--cad-text-hi)' }}>{stats.percentage}%</div>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'var(--cad-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.percentage}%`, height: '100%', background: color.border, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', marginTop: '4px' }}>
                  {stats.present} / {stats.total} CLASSES
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
