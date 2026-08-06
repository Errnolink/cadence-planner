import { useMemo } from 'react'
import { Modal } from '../ui/Modal.jsx'

export function SubjectAttendanceModal({ subject, timetable, attendanceHook, examDates, onClose }) {
  const { attendance, getSubjectStats } = attendanceHook
  
  const stats = getSubjectStats(subject.id, timetable, examDates)

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
    <Modal title={`${subject.name} :: ATTENDANCE`} hex={`${stats.percentage}%`} onClose={onClose}>
      <div className="flex flex-col gap-2">
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
    </Modal>
  )
}
