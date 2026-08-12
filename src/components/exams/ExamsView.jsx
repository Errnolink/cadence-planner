import { useState, useMemo } from 'react'
import { subjectVars, toDateStr, daysUntil } from '../../data/index.js'
import { resolveScheme } from '../../data/grading.js'
import { useNow } from '../../hooks/useNow.js'
import { ExamModal } from './ExamModal.jsx'
import { SchemeModal } from './SchemeModal.jsx'
import { SubjectGradeCard } from './SubjectGradeCard.jsx'

const noop = () => {}

/** The component a scheduled sit-down paper belongs to. */
const theoryComponent = (scheme) =>
  (scheme?.components ?? []).find(c => c.id === 'theory')
  ?? { id: 'theory', label: 'THEORY', weight: 75, rule: { mode: 'average' }, parts: [{ id: 'paper', label: 'PAPER', max: 75 }] }

/**
 * ExamsView — two modes over the same assessment list.
 *
 * MARKS    — the gradebook: a card per subject, marks entered per part per
 *            sitting, rolled up by the subject's scheme.
 * SCHEDULE — the sit-down papers only (`blocksClasses && date`), split into
 *            UPCOMING / COMPLETED with a live countdown. Those are the ones
 *            that suspend a day's classes; an assignment deadline must not.
 */
export function ExamsView({
  subjects = [], semester, assessments = [], editMode,
  onAddSitting = noop, onUpdateAssessment = noop, onSetScore = noop,
  onRemoveAssessment = noop, onRemoveSitting = noop,
  onSetScheme = noop, onSetSubjectScheme = noop,
}) {
  const [mode, setMode] = useState('MARKS')
  const [modal, setModal] = useState(null)        // { mode: 'add' | 'edit', exam }
  const [schemeFor, setSchemeFor] = useState(null) // null | { subjectId }

  const subjectMap = useMemo(() => {
    const m = {}
    subjects.forEach(s => { m[s.id] = s })
    return m
  }, [subjects])

  // Only class-blocking, dated assessments belong on the schedule.
  const scheduled = useMemo(
    () => assessments.filter(a => a.blocksClasses && a.date),
    [assessments])

  const bySubject = useMemo(() => {
    const m = new Map()
    for (const a of assessments) {
      const key = String(a.subjectId)
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(a)
    }
    return m
  }, [assessments])

  const sorted = useMemo(() => [...scheduled].sort((a, b) => a.date.localeCompare(b.date)), [scheduled])
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

  /** ExamModal hands back a full record; adding one means adding a sitting. */
  const handleExamSave = (exam) => {
    if (modal?.mode === 'add') {
      const subject = subjectMap[exam.subjectId] ?? subjects.find(s => String(s.id) === String(exam.subjectId))
      const component = theoryComponent(resolveScheme(semester, subject))
      const existing = assessments.filter(a =>
        String(a.subjectId) === String(exam.subjectId) && a.componentId === component.id)
      const nums = existing.map(a => Number(a.attempt)).filter(Number.isFinite)
      const attempt = nums.length ? Math.max(...nums) + 1 : 1
      onAddSitting(component, exam.subjectId, attempt, {
        title: exam.title ?? `${component.label} ${attempt}`,
        date: exam.date, startTime: exam.startTime, endTime: exam.endTime,
        room: exam.room, notes: exam.notes, blocksClasses: true,
      })
    } else {
      onUpdateAssessment(exam)
    }
    setModal(null)
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
    <div>
      <div className="cad-label" style={{ marginBottom: '8px' }}>
        {title} <span style={{ color: 'var(--cad-text-xlo)' }}>({list.length})</span>
      </div>
      {list.length === 0 ? (
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)', padding: '12px 0', textAlign: 'center' }}>{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2">{list.map(renderExam)}</div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 min-h-0">
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0 flex-wrap">
        <div className="flex gap-2">
          {['MARKS', 'SCHEDULE'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="cad-chip btn-mech"
              data-active={mode === m || undefined}
              aria-pressed={mode === m}
            >{m}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="cad-label">∷ {todayStr}</span>
          <button
            type="button"
            onClick={() => setSchemeFor({ subjectId: null })}
            className="cad-chip btn-mech"
          >SCHEME</button>
          {mode === 'SCHEDULE' && editMode && (
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="px-2 py-1 btn-mech panel-chamfer-sm"
              style={{ border: '1px solid var(--cad-accent)', background: 'var(--cad-accent-dim)', color: 'var(--cad-accent-text)', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', letterSpacing: 'var(--cad-track-wide)', borderRadius: 'var(--cad-radius)' }}
            >＋ ADD EXAM</button>
          )}
        </div>
      </div>

      {subjects.length === 0 && (
        <div className="p-3 mb-2 panel-chamfer-sm text-center" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)', border: '1px dashed var(--cad-border)' }}>
          // NO SUBJECTS YET — ADD ONE IN THE ROSTER
        </div>
      )}

      {mode === 'MARKS' ? (
        <div className="flex flex-col gap-2">
          {subjects.map(subject => (
            <SubjectGradeCard
              key={subject.id}
              subject={subject}
              scheme={resolveScheme(semester, subject)}
              hasOverride={Boolean(subject.gradingScheme)}
              assessments={bySubject.get(String(subject.id)) ?? []}
              editMode={editMode}
              onAddSitting={onAddSitting}
              onSetScore={onSetScore}
              onRemoveSitting={onRemoveSitting}
              onEditScheme={(s) => setSchemeFor({ subjectId: s.id })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {renderSection('UPCOMING', upcoming, '// NO UPCOMING EXAMS')}
          {renderSection('COMPLETED', completed, '// NO PAST EXAMS')}
        </div>
      )}

      {modal && (
        <ExamModal
          mode={modal.mode}
          initial={modal.exam}
          subjects={subjects}
          exams={scheduled}
          onSave={handleExamSave}
          onDelete={modal.mode === 'edit' ? (id) => { onRemoveAssessment(id); setModal(null) } : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {schemeFor && (
        <SchemeModal
          semester={semester}
          subjects={subjects}
          subjectId={schemeFor.subjectId}
          onSetScheme={onSetScheme}
          onSetSubjectScheme={onSetSubjectScheme}
          onClose={() => setSchemeFor(null)}
        />
      )}
    </div>
  )
}
