import { useMemo } from 'react'
import { Modal } from '../ui/Modal.jsx'

/**
 * The history list used to be a naive scan of the attendance map, which
 * disagreed with the percentage in this modal's own title bar: it showed
 * classes substituted AWAY (not counted), omitted classes substituted INTO
 * this subject (counted), and listed exam-day rows the percentage skipped.
 * The engine now emits the rows it actually counted, so the two halves of the
 * modal can no longer contradict each other.
 */
export function SubjectAttendanceModal({ subject, timetable, attendanceHook, examDates, onClose }) {
  const { getSubjectStats } = attendanceHook

  const stats = useMemo(
    () => getSubjectStats(subject.id, timetable, examDates, { withHistory: true }),
    [getSubjectStats, subject.id, timetable, examDates])

  const history = stats.history || []

  return (
    <Modal title={`${subject.name} :: ATTENDANCE`} hex={`${stats.percentage}%`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {history.length === 0 ? (
          <div className="text-center py-6" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
            NO ATTENDANCE RECORDS FOUND
          </div>
        ) : (
          history.map((record, i) => {
            const stColor = record.status === 'PRESENT' ? 'var(--cad-success)'
              : record.status === 'ABSENT' ? 'var(--cad-danger)'
                : 'var(--cad-text-mid)'
            return (
              <div key={`${record.date}-${record.entryId}-${i}`} className="flex items-center justify-between gap-2 p-2 panel-chamfer-sm" style={{ border: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-primary)' }}>
                <div className="flex flex-col min-w-0">
                  <span className="cad-value">{record.date}</span>
                  <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
                    {record.entry?.day} ∥ {record.entry?.startTime} - {record.entry?.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {record.substituted && (
                    <span className="cad-chip" style={{ color: 'var(--cad-accent)', borderColor: 'var(--cad-accent)' }} title="This slot was substituted into this subject">
                      ⇄ SUB
                    </span>
                  )}
                  {record.examCredited && (
                    <span className="cad-chip" title="Credited by COUNT DAY AS PRESENT on an exam day">
                      ✎ EXAM
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: stColor, letterSpacing: 'var(--cad-track-mid)' }}>
                    {record.status}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
