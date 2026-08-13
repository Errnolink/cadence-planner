import { useState, useEffect, useMemo } from 'react'
import { subjectVars } from '../../data/index.js'
import { ATTENDANCE_THRESHOLD } from '../../data/constants.js'
import { computeAllStats } from '../../data/attendanceMath.js'
import { SubjectAttendanceModal } from './SubjectAttendanceModal.jsx'

export function AttendanceView({ timetable, subjects, attendanceHook, examDates, semester }) {
  const { attendance, getMarginToThreshold, getRecoveryPath, getStatusTier } = attendanceHook
  const [selectedSubjectData, setSelectedSubjectData] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(t)
  }, [])

  // ONE traversal for the roll-up and every subject. This used to be an
  // unmemoized getOverallStats() in the render body plus a second
  // getSubjectStats() per subject — 2 × subjects × dates × entries on every
  // keystroke elsewhere in the app.
  const { overall: overallStats, bySubject } = useMemo(
    () => computeAllStats(attendance, subjects, timetable, examDates, semester),
    [attendance, subjects, timetable, examDates, semester])

  const sectionStyle = { marginBottom: '24px' }

  // Map and sort subjects worst-first
  const sortedSubjects = useMemo(() => subjects
    .map(subj => {
      const stats = bySubject.get(String(subj.id))
      return {
        subj,
        stats,
        tier: getStatusTier(stats.percentage),
        margin: getMarginToThreshold(stats.present, stats.total),
        recovery: getRecoveryPath(stats.present, stats.total),
      }
    })
    .sort((a, b) => a.stats.percentage - b.stats.percentage), [subjects, bySubject, getStatusTier, getMarginToThreshold, getRecoveryPath])

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      
      {/* Global Stats */}
      <div style={sectionStyle}>
        <div className="cad-label" style={{ marginBottom: '8px' }}>OVERALL ATTENDANCE</div>
        <div className="p-3 panel-chamfer-sm" style={{ background: 'var(--cad-bg-elevated)', borderLeft: '3px solid var(--cad-accent)' }}>
          <div className="flex items-end gap-3 mb-2">
            <div style={{ fontFamily: 'var(--cad-font-ui)', fontSize: 'var(--cad-fs-hero)', lineHeight: '40px', color: 'var(--cad-accent)' }} className="glow-accent">
              {overallStats.percentage}%
            </div>
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', marginBottom: '2px' }}>
              {overallStats.present} / {overallStats.total} CLASSES
            </div>
          </div>
          
          {/* Breakdown Chips */}
          <div className="flex gap-2 mt-3">
            <span style={{ fontSize: 'var(--cad-fs-xs)', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-success)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.present} PRESENT</span>
            <span style={{ fontSize: 'var(--cad-fs-xs)', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-danger)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.absent} ABSENT</span>
            {overallStats.cancelled > 0 && <span style={{ fontSize: 'var(--cad-fs-xs)', fontFamily: 'var(--cad-font-mono)', padding: '2px 6px', background: 'var(--cad-text-lo)', color: '#000', borderRadius: 'var(--cad-radius)' }}>{overallStats.cancelled} CANCELLED</span>}
          </div>
          
          {/* Margin strip.

              This used to be hardcoded green and hardcoded "SAFE MARGIN", so
              it announced safety to someone already below the threshold — and
              on a fresh install it read "CAN MISS Infinity MORE", because
              marginToThreshold returns Infinity for a record of 0 / 0. It now
              branches the same way the per-subject line below does. */}
          {(() => {
            const tier = getStatusTier(overallStats.percentage)
            const margin = getMarginToThreshold(overallStats.present, overallStats.total)
            const recovery = getRecoveryPath(overallStats.present, overallStats.total)
            const color = overallStats.total === 0 ? 'var(--cad-text-lo)'
              : tier === 'safe' ? 'var(--cad-success)'
              : tier === 'watch' ? 'var(--cad-accent)' : 'var(--cad-danger)'
            return (
              <div style={{ marginTop: '8px', fontSize: 'var(--cad-fs-micro)', fontFamily: 'var(--cad-font-mono)', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span aria-hidden="true">{overallStats.total === 0 ? '▸' : tier === 'safe' ? '▸' : tier === 'watch' ? '⚠' : '✕'}</span>
                {overallStats.total === 0
                  ? 'NO CLASSES RECORDED YET'
                  : tier === 'critical'
                    ? `BELOW MIN — ATTEND NEXT ${recovery} STRAIGHT → ${ATTENDANCE_THRESHOLD * 100}%`
                    : margin === Infinity
                      ? 'PERFECT RECORD'
                      : `SAFE MARGIN — CAN MISS ${margin} MORE BEFORE ${ATTENDANCE_THRESHOLD * 100}%`}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Subject Stats */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="cad-label">SUBJECT WISE</div>

          {/* Filter Row */}
          <div className="flex gap-2">
            {['ALL', 'AT RISK', 'SAFE'].map(f => {
              const key = f.replace(' ', '_')
              return (
                <button key={f} type="button" onClick={() => setFilter(key)}
                  className="cad-chip btn-mech tap-44"
                  data-active={filter === key || undefined}
                  aria-pressed={filter === key}
                >{f}</button>
              )
            })}
          </div>
        </div>

        {subjects.length === 0 && (
          <div className="p-3 mb-2 panel-chamfer-sm text-center" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', border: '1px dashed var(--cad-border)' }}>
            // NO SUBJECTS YET — ADD ONE IN THE ROSTER
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sortedSubjects
            .filter(({ tier }) => {
              if (filter === 'ALL') return true
              if (filter === 'AT_RISK') return tier === 'watch' || tier === 'critical'
              return tier === 'safe'
            })
            .map(({ subj, stats, tier, margin, recovery }) => (
              <button
                key={subj.id}
                type="button"
                className="p-2 w-full btn-mech"
                style={{ ...subjectVars(subj.colorIdx), border: '1px solid var(--cad-border-dim)', borderLeft: '3px solid var(--subj-border)', borderRadius: '0 var(--cad-radius) var(--cad-radius) 0', background: 'var(--cad-bg-elevated)', textAlign: 'left', cursor: 'pointer' }}
                aria-label={`${subj.name}, ${stats.percentage}% attendance, ${tier === 'safe' ? 'safe' : tier === 'watch' ? 'watch' : 'below minimum'} — open record`}
                onClick={() => setSelectedSubjectData({ subject: subj })}
              >
                <div className="flex justify-between items-start mb-2">
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--subj-text)', fontWeight: 'bold' }}>{subj.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{
                      fontSize: 'var(--cad-fs-micro)', fontFamily: 'var(--cad-font-mono)', padding: '1px 4px', borderRadius: 'var(--cad-radius)',
                      background: tier === 'safe' ? 'var(--cad-success)' : tier === 'watch' ? 'var(--cad-accent)' : 'var(--cad-danger)', 
                      color: '#000' 
                    }}>
                      {tier === 'safe' ? 'SAFE' : tier === 'watch' ? 'WATCH' : 'BELOW MIN'}
                    </span>
                    <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--cad-text-hi)' }}>{stats.percentage}%</div>
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '4px', background: 'var(--cad-bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--subj-border)', transform: `scaleX(${animated ? stats.percentage / 100 : 0})`, transformOrigin: 'left', transition: 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)', borderRadius: '2px' }} />
                  {/* 75% threshold marker */}
                  <div style={{
                    position: 'absolute', left: `${ATTENDANCE_THRESHOLD * 100}%`, top: '-3px', width: '1px', height: '10px',
                    background: 'var(--cad-danger)', opacity: 0.6,
                  }} />
                  <div style={{
                    position: 'absolute', left: `${ATTENDANCE_THRESHOLD * 100}%`, top: '-12px', transform: 'translateX(-50%)',
                    fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-danger)', opacity: 0.6,
                  }}>{ATTENDANCE_THRESHOLD * 100}%</div>
                </div>

                <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', marginTop: '6px' }}>
                  {tier === 'safe' ? (margin === Infinity ? "PERFECT RECORD" : `CAN MISS ${margin} MORE`) 
                    : tier === 'watch' ? <span style={{ color: 'var(--cad-accent)' }}>⚠ {margin} MORE ABSENCES → {ATTENDANCE_THRESHOLD * 100}%</span> 
                    : <span style={{ color: 'var(--cad-danger)' }}>✕ ATTEND NEXT {recovery} STRAIGHT → {ATTENDANCE_THRESHOLD * 100}%</span>}
                </div>
              </button>
            ))
          }
        </div>
      </div>

      {selectedSubjectData && (
        <SubjectAttendanceModal
          subject={selectedSubjectData.subject}
          timetable={timetable}
          examDates={examDates}
          attendanceHook={attendanceHook}
          semester={semester}
          onClose={() => setSelectedSubjectData(null)}
        />
      )}

    </div>
  )
}
