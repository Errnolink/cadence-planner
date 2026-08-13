import { useMemo } from 'react'
import { computeSemesterGPA, computeCGPA, gradeCoverage, scaleOf, resolveScheme, subjectGradePoint } from '../../data/grading.js'

import { SubjectRow } from './SubjectRow.jsx'
import { GpaBadge } from './GpaBadge.jsx'

export function SubjectRoster({ sem, semesters, editMode, onUpdateSem, onAddSubject, onUpdate, onRemove }) {
  const subjects  = sem?.subjects ?? []
  const startDate = sem?.startDate || ''
  const endDate   = sem?.endDate || ''
  const totalCr   = subjects.reduce((a, s) => a + (parseFloat(s.credits) || 0), 0)

  // GPA is derived from entered marks where they exist, falling back to the
  // hand-typed gradePoint. It used to read the typed value only, so these
  // badges showed whatever arithmetic the student had done in their head.
  const semGpa   = useMemo(() => computeSemesterGPA(sem), [sem])
  const cgpa     = useMemo(() => semesters ? computeCGPA(semesters) : semGpa, [semesters, semGpa])
  const coverage = useMemo(() => gradeCoverage(sem), [sem])
  const scale    = scaleOf(resolveScheme(sem, null)?.bands)

  const fmt = (v) => (v === null || v === undefined ? null : v.toFixed(2))

  // Per-subject grade point, so a row can show that its grade came from
  // entered marks rather than from the dropdown.
  // Keyed on `sem` alone: `subjects` is `sem?.subjects ?? []`, so the `??`
  // allocates a new array for a semester with none and would defeat the memo.
  const gradeBySubject = useMemo(() => {
    const m = new Map()
    for (const s of (sem?.subjects ?? [])) {
      m.set(String(s.id), subjectGradePoint(s, sem?.assessments ?? [], resolveScheme(sem, s)))
    }
    return m
  }, [sem])

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2">

      {/* Credits summary */}
      <div
        className="shrink-0 px-2 py-2 panel-chamfer-sm"
        style={{ border: '1px solid var(--cad-border)', background: 'var(--cad-bg-elevated)' }}
      >
        <div className="flex justify-between">
          <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>TOTAL CREDITS</span>
          <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)' }}>{subjects.length} SUBJ</span>
        </div>
        <div className="flex items-end gap-2 mt-0.5">
          <span className="glow-accent" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-lg)', lineHeight: 1, color: 'var(--cad-accent)' }}>
            {totalCr.toFixed(1)}
          </span>
        </div>

        {editMode ? (
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              value={startDate}
              aria-label="Semester start date"
              onChange={e => onUpdateSem(s => ({ ...s, startDate: e.target.value }))}
              style={{ flex: 1, fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', padding: '2px 4px', background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)', color: 'var(--cad-text-hi)' }}
            />
            <input
              type="date"
              value={endDate}
              aria-label="Semester end date"
              onChange={e => onUpdateSem(s => ({ ...s, endDate: e.target.value }))}
              style={{ flex: 1, fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', padding: '2px 4px', background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)', color: 'var(--cad-text-hi)' }}
            />
          </div>
        ) : (startDate && endDate) ? (
          <div className="mt-2" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-mid)' }}>
            {Math.min(
              Math.max(0, Math.round((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24))),
              Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
            )} / {Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} DAYS ELAPSED
          </div>
        ) : null}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <div className="w-3 shrink-0" />
        <span className="cad-label" style={{ flex: 1, fontSize: 'var(--cad-fs-micro)' }}>SUBJECT</span>
        <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)', width: '32px', textAlign: 'right' }}>CR</span>
        <span className="cad-label" style={{ fontSize: 'var(--cad-fs-micro)', width: '40px', textAlign: 'right' }}>GP</span>
        {editMode && <span className="w-4" />}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--cad-border-dim)', margin: '4px 0' }} />

      {/* Subject list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {subjects.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-lo)' }}>// NO SUBJECTS{editMode ? '' : ' — ENABLE EDIT MODE TO ADD ONE'}</div>
          : subjects.map((s, i) => (
            <SubjectRow key={s.id} subject={s} grade={gradeBySubject.get(String(s.id))} editMode={editMode} onUpdate={onUpdate} onRemove={onRemove} staggerIndex={i} />
          ))
        }
      </div>

      {editMode && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--cad-border-dim)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={onAddSubject}
            className="shrink-0 w-full py-1.5 panel-chamfer-sm btn-mech uppercase"
            style={{
              border:       '1px solid var(--cad-accent)',
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     'var(--cad-fs-xs)',
              letterSpacing:'var(--cad-track-wide)',
              color:        'var(--cad-accent)',
              background:   'var(--cad-accent-dim)',
            }}
          >+ ADD SUBJECT</button>
        </>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--cad-border-dim)', margin: '4px 0' }} />

      {/* Current CGPA (all semesters) */}
      <GpaBadge label="CURRENT CGPA" hex="0xD000" value={fmt(cgpa)} scale={scale} />

      {/* Semester GPA (active semester only) */}
      <GpaBadge
        label="SEMESTER GPA"
        hex="0xD001"
        value={fmt(semGpa)}
        scale={scale}
        gradedCount={coverage.graded}
        totalCount={coverage.total}
        derivedCount={coverage.derived}
      />
    </div>
  )
}
