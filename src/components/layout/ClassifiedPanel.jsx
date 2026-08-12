import { useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton.jsx'

/**
 * CLASSIFIED OPERATIONS — hidden Konami-code panel.
 * Purges every room/location field from every timetable entry and exam
 * across all semesters at once. Two-step confirm, per app convention.
 */
export function ClassifiedPanel({ semesters, onPurge, onClose }) {
  const [result, setResult] = useState(null)

  const handlePurge = () => {
    let purged = 0
    const next = semesters.map(sem => {
      const timetable = (sem.timetable ?? []).map(t => {
        if (!t.room) return t
        purged++
        return { ...t, room: '' }
      })
      // Rooms live on assessments now; `exams` is only kept as a legacy
      // snapshot for downgrades, but purge it too so a rollback doesn't
      // resurrect the locations this just cleared.
      const exams = (sem.exams ?? []).map(x => {
        if (!x.room) return x
        return { ...x, room: '' }
      })
      const assessments = (sem.assessments ?? []).map(a => {
        if (!a.room) return a
        purged++
        return { ...a, room: '' }
      })
      return { ...sem, timetable, exams, assessments }
    })
    onPurge(next)
    setResult(
      `PURGED ${purged} LOCATION FIELD${purged === 1 ? '' : 'S'} ACROSS ${semesters.length} SEMESTER${semesters.length === 1 ? '' : 'S'}`
    )
  }

  return (
    <Modal title="CLASSIFIED OPERATIONS" hex="#ef4444" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-mid)', lineHeight: 1.7 }}>
          KONAMI PROTOCOL ACCEPTED. AUTHORIZED TO PURGE ALL ROOM / LOCATION DATA FROM EVERY TIMETABLE ENTRY AND EXAM ACROSS ALL SEMESTERS.
        </p>
        {result ? (
          <p style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-success)', letterSpacing: '0.1em' }}>
            {result}
          </p>
        ) : (
          <ConfirmDeleteButton
            onConfirm={handlePurge}
            label="PURGE ALL ROOM LOCATIONS"
            confirmLabel="CONFIRM PURGE?"
            style={{
              border:     '1px solid var(--cad-danger)',
              color:      'var(--cad-danger)',
              background: 'transparent',
            }}
          />
        )}
      </div>
    </Modal>
  )
}
