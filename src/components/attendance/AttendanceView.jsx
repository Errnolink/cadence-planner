import { useState, useMemo } from 'react'
import { SUBJECT_COLORS } from '../../data/index.js'
import { ATTENDANCE_THRESHOLD } from '../../data/constants.js'
import { SubjectAttendanceModal } from './SubjectAttendanceModal.jsx'

export function AttendanceView({ timetable, subjects, attendanceHook }) {
  const { attendance, getSubjectStats, getOverallStats, getMarginToThreshold, getRecoveryPath, getStatusTier } = attendanceHook
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [filter, setFilter] = useState('ALL')
  
  const overallStats = getOverallStats(subjects, timetable)

  const sectionStyle = { marginBottom: '24px' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '8px' }

  // Map and sort subjects worst-first
  const sortedSubjects = subjects
    .map(subj => {
      const stats = getSubjectStats(subj.id, timetable)
      const tier = getStatusTier(stats.percentage)
      const margin = getMarginToThreshold(stats.present, stats.total)
      const recovery = getRecoveryPath(stats.present, stats.total)
      const color = SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length]
      return { subj, stats, tier, margin, recovery, color }
    })
    .sort((a, b) => a.stats.percentage - b.stats.percentage)

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      
      {/* Global Stats */}
      <div style={sectionStyle}>
        <div style={labelStyle}>OVERALL ATTENDANCE</div>
        <div className="p-3 panel-chamfer-sm" style={{ background: 'var(--cad-bg-elevated)', borderLeft: '3px solid var(--cad-accent)' }}>
          <div className="flex items-end gap-3 mb-2">
            <div style={{ fontFamily: 'var(--cad-font-ui)', fontSize: '48px', lineHeight: '40px', color: 'var(--cad-accent)' }} className="glow-accent">
              {overallStats.percentage}%
            </div>
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-mid)', marginBottom: '2px' }}>
              {overallStats.present} / {overallStats.total} CLASSES
            </div>
          </div>
          
          {/* Breakdown Chips */}
          <div className="flex gap-2 mt-3">
            <span style={{ fontSize: '9px', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-success)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.present} PRESENT</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-danger)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.absent} ABSENT</span>
            {overallStats.cancelled > 0 && <span style={{ fontSize: '9px', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-text-lo)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.cancelled} CANCELLED</span>}
          </div>
          
          {/* Safe Margin Strip */}
          <div style={{ marginTop: '8px', fontSize: '10px', fontFamily: 'var(--cad-font-mono)', color: 'var(--cad-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>▸</span> SAFE MARGIN — CAN MISS {getMarginToThreshold(overallStats.present, overallStats.total)} MORE BEFORE {ATTENDANCE_THRESHOLD * 100}%
          </div>
        </div>
      </div>

      {/* Subject Stats */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div style={{ ...labelStyle, marginBottom: 0 }}>SUBJECT WISE</div>
          
          {/* Filter Row */}
          <div className="flex gap-2">
            {['ALL', 'AT RISK', 'SAFE'].map(f => {
              const key = f.replace(' ', '_')
              const isActive = filter === key
              return (
                <button key={f} onClick={() => setFilter(key)}
                  className="px-2 py-0.5 btn-mech"
                  style={{
                    fontFamily: 'var(--cad-font-mono)', fontSize: '9px', letterSpacing: '0.15em',
                    border: isActive ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                    color: isActive ? 'var(--cad-accent-text)' : 'var(--cad-text-lo)',
                    background: isActive ? 'var(--cad-accent-dim)' : 'transparent',
                    borderRadius: 'var(--cad-radius)',
                  }}
                >{f}</button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sortedSubjects
            .filter(({ tier }) => {
              if (filter === 'ALL') return true
              if (filter === 'AT_RISK') return tier === 'watch' || tier === 'critical'
              return tier === 'safe'
            })
            .map(({ subj, stats, tier, margin, recovery, color }) => (
              <div 
                key={subj.id} 
                className="p-2 cursor-pointer btn-mech" 
                style={{ border: '1px solid var(--cad-border-dim)', borderLeft: `3px solid ${color.border}`, borderRadius: '0 var(--cad-radius) var(--cad-radius) 0', background: 'var(--cad-bg-elevated)', textAlign: 'left' }}
                onClick={() => setSelectedSubject(subj)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: color.text, fontWeight: 'bold' }}>{subj.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ 
                      fontSize: '8px', fontFamily: 'var(--cad-font-mono)', padding: '1px 4px', borderRadius: 'var(--cad-radius)', 
                      background: tier === 'safe' ? 'var(--cad-success)' : tier === 'watch' ? 'var(--cad-accent)' : 'var(--cad-danger)', 
                      color: '#000' 
                    }}>
                      {tier === 'safe' ? 'SAFE' : tier === 'watch' ? 'WATCH' : 'BELOW MIN'}
                    </span>
                    <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '12px', color: 'var(--cad-text-hi)' }}>{stats.percentage}%</div>
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '4px', background: 'var(--cad-bg-primary)', borderRadius: '2px', overflow: 'visible' }}>
                  <div style={{ width: `${stats.percentage}%`, height: '100%', background: color.border, transition: 'width 0.3s', borderRadius: '2px' }} />
                  {/* 75% threshold marker */}
                  <div style={{
                    position: 'absolute', left: '75%', top: '-3px', width: '1px', height: '10px',
                    background: 'var(--cad-danger)', opacity: 0.6,
                  }} />
                  <div style={{
                    position: 'absolute', left: '75%', top: '-12px', transform: 'translateX(-50%)',
                    fontFamily: 'var(--cad-font-mono)', fontSize: '7px', color: 'var(--cad-danger)', opacity: 0.6,
                  }}>{ATTENDANCE_THRESHOLD * 100}%</div>
                </div>

                <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)', marginTop: '6px' }}>
                  {tier === 'safe' ? (margin === Infinity ? "PERFECT RECORD" : `CAN MISS ${margin} MORE`) 
                    : tier === 'watch' ? <span style={{ color: 'var(--cad-accent)' }}>⚠ {margin} MORE ABSENCES → {ATTENDANCE_THRESHOLD * 100}%</span> 
                    : <span style={{ color: 'var(--cad-danger)' }}>✕ ATTEND NEXT {recovery} STRAIGHT → {ATTENDANCE_THRESHOLD * 100}%</span>}
                </div>
              </div>
            ))
          }
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
