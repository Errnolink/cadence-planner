import { useState, useMemo } from 'react'
import { SUBJECT_COLORS, DAYS, parseTimeToMins } from '../../data/index.js'
import { SubjectAttendanceModal } from './SubjectAttendanceModal.jsx'

function dayLabel(year, month, day) {
  const js = new Date(year, month, day).getDay()
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][js]
}

export function AttendanceView({ timetable, subjects, attendanceHook }) {
  const { attendance, getSubjectStats, getOverallStats } = attendanceHook
  const [selectedSubject, setSelectedSubject] = useState(null)
  
  const overallStats = getOverallStats(subjects, timetable)

  const sectionStyle = { marginBottom: '24px' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '8px' }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      
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
              <div 
                key={subj.id} 
                className="p-2 cursor-pointer btn-mech" 
                style={{ border: '1px solid var(--cad-border-dim)', borderLeft: `3px solid ${color.border}`, borderRadius: '0 var(--cad-radius) var(--cad-radius) 0', background: 'var(--cad-bg-elevated)', textAlign: 'left' }}
                onClick={() => setSelectedSubject(subj)}
              >
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

      {selectedSubject && (
        <SubjectAttendanceModal
          subject={selectedSubject}
          timetable={timetable}
          attendanceHook={attendanceHook}
          onClose={() => setSelectedSubject(null)}
        />
      )}

    </div>
  )
}
