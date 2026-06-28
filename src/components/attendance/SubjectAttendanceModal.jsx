import { useMemo } from 'react'
import { SUBJECT_COLORS, generateSubjectCode } from '../../data/index.js'

export function SubjectAttendanceModal({ subject, timetable, attendanceHook, onClose }) {
  const { attendance, getSubjectStats } = attendanceHook
  
  const stats = getSubjectStats(subject.id, timetable)
  const color = SUBJECT_COLORS[subject.colorIdx % SUBJECT_COLORS.length]

  const history = useMemo(() => {
    const subjectEntryIds = timetable.filter(t => t.subjectId === subject.id).map(t => t.id)
    const records = []
    
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      subjectEntryIds.forEach(id => {
        if (dayData[id]) {
          records.push({
            date: dateStr,
            entryId: id,
            status: dayData[id],
            entry: timetable.find(t => t.id === id)
          })
        }
      })
    })

    // Sort descending by date
    records.sort((a, b) => new Date(b.date) - new Date(a.date))
    return records
  }, [attendance, subject.id, timetable])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div 
        className="w-full max-w-sm flex flex-col overflow-hidden panel-chamfer" 
        style={{ background: 'var(--cad-bg-panel)', border: '1px solid var(--cad-border)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 shrink-0" style={{ borderBottom: `2px solid ${color.border}`, background: 'var(--cad-bg-elevated)' }}>
          <div className="flex flex-col">
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '14px', color: color.text, fontWeight: 'bold' }}>{subject.name}</span>
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-mid)' }}>
              ATTENDANCE RECORD ({stats.percentage}%)
            </span>
          </div>
          <button onClick={onClose} className="btn-mech" style={{ color: 'var(--cad-text-lo)', fontSize: '18px', padding: '0 8px' }}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
          {history.length === 0 ? (
            <div className="text-center py-6" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-lo)' }}>
              NO ATTENDANCE RECORDS FOUND
            </div>
          ) : (
            history.map((record, i) => {
              const stColor = record.status === 'PRESENT' ? 'var(--cad-success)' : record.status === 'ABSENT' ? 'var(--cad-danger)' : 'var(--cad-text-mid)'
              return (
                <div key={`${record.date}-${record.entryId}-${i}`} className="flex items-center justify-between p-2 panel-chamfer-sm" style={{ border: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }}>
                  <div className="flex flex-col">
                    <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-hi)' }}>{record.date}</span>
                    <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)' }}>{record.entry?.startTime} - {record.entry?.endTime}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: stColor, letterSpacing: '0.1em' }}>
                    {record.status}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
