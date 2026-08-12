import { useState, useMemo } from 'react'
import { subjectVars, toDateStr, daysUntil } from '../../data/index.js'
import { useNow } from '../../hooks/useNow.js'
import { ExamModal } from './ExamModal.jsx'

/**
 * ExamsView — lists the active semester's exams split into UPCOMING / COMPLETED,
 * each showing the subject (with its color accent), date, time, room and a live
 * countdown. Add/edit/delete available in edit mode.
 */
export function ExamsView({ exams = [], subjects = [], editMode, onAdd, onUpdate, onRemove }) {
  const [modal, setModal] = useState(null) // { mode: 'add' | 'edit', exam }

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  const sorted = useMemo(() => [...exams].sort((a, b) => a.date.localeCompare(b.date)), [exams])
  // Ticks on a timer, so the UPCOMING/COMPLETED split and the countdowns
  // don't freeze at mount and go stale past midnight.
  const now = useNow()
  const todayStr = toDateStr(now)
  const upcoming = sorted.filter(e => e.date >= todayStr)
  const completed = sorted.filter(e => e.date < todayStr)

  const countdown = (dateStr) => {
    const d = daysUntil(dateStr)
    if (d === null) return ''
    if (d < 0) return 'DONE'
    if (d === 0) return 'TODAY'
    if (d === 1) return 'TOMORROW'
    return `IN ${d} DAYS`
  }

  const renderExam = (exam) => {
    const subj = subjectMap[exam.subjectId]
    // Subject accents come from theme tokens now — see data/colors.js.
    const accent = subj
      ? subjectVars(subj.colorIdx)
      : { '--subj-border': 'var(--cad-border)', '--subj-text': 'var(--cad-text-mid)' }
    const d = daysUntil(exam.date)
    return (
      <div
        key={exam.id}
        onClick={() => editMode && setModal({ mode: 'edit', exam })}
        className="p-2.5 btn-mech"
        style={{
          ...accent,
          border: '1px solid var(--cad-border-dim)',
          borderLeft: '3px solid var(--subj-border)',
          borderRadius: '0 var(--cad-radius) var(--cad-radius) 0',
          background: 'var(--cad-bg-elevated)',
          textAlign: 'left',
        }}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--subj-text)', fontWeight: 'bold' }}>
              {subj?.name || 'UNKNOWN SUBJECT'}
            </div>
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', marginTop: '2px' }}>
              {exam.date} ∥ {exam.startTime}–{exam.endTime}{exam.room ? ` ∥ ${exam.room}` : ''}
            </div>
          </div>
          <span
            className="shrink-0 px-1.5 py-0.5"
            style={{
              fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-mid)',
              color: d === 0 ? 'var(--cad-danger)' : d >= 0 ? 'var(--cad-accent)' : 'var(--cad-text-lo)',
              border: `1px solid ${d >= 0 ? 'var(--cad-accent)' : 'var(--cad-border)'}`,
              borderRadius: 'var(--cad-radius)',
            }}
          >
            {countdown(exam.date)}
          </span>
        </div>
        {exam.notes && (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)', marginTop: '6px', opacity: 0.85 }}>
            📝 {exam.notes}
          </div>
        )}
      </div>
    )
  }

  const renderSection = (title, list, emptyText) => (
    <>
      <div className="cad-label" style={{ marginBottom: '8px' }}>
        {title} <span style={{ color: 'var(--cad-text-xlo)' }}>({list.length})</span>
      </div>
      {list.length === 0 ? (
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)', padding: '12px 0', textAlign: 'center' }}>{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2">{list.map(renderExam)}</div>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="cad-label">
          EXAM SCHEDULE ∷ {todayStr}
        </div>
        {editMode && (
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="px-2 py-1 btn-mech panel-chamfer-sm"
            style={{ border: '1px solid var(--cad-accent)', background: 'var(--cad-accent-dim)', color: 'var(--cad-accent-text)', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', letterSpacing: 'var(--cad-track-wide)', borderRadius: 'var(--cad-radius)' }}
          >＋ ADD EXAM</button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {renderSection('UPCOMING', upcoming, '// NO UPCOMING EXAMS')}
        {renderSection('COMPLETED', completed, '// NO PAST EXAMS')}
      </div>

      {modal && (
        <ExamModal
          mode={modal.mode}
          initial={modal.exam}
          subjects={subjects}
          exams={exams}
          onSave={(exam) => {
            if (modal.mode === 'add') onAdd(exam)
            else onUpdate(exam)
            setModal(null)
          }}
          onDelete={modal.mode === 'edit' ? (id) => { onRemove(id); setModal(null) } : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
