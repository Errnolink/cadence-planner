import { SUBJECT_COLORS, calcGPA, calcCGPA } from '../../data/index.js'
import { DataHr } from '../ui/DataHr.jsx'
import { SubjectRow } from './SubjectRow.jsx'
import { GpaBadge } from './GpaBadge.jsx'
import { Dot } from '../ui/Dot.jsx'

export function SubjectRoster({ sem, semesters, editMode, onAddSubject, onUpdate, onRemove }) {
  const subjects  = sem?.subjects ?? []
  const totalCr   = subjects.reduce((a, s) => a + (parseFloat(s.credits) || 0), 0)
  const semGpa    = calcGPA(subjects)
  const gradedCnt = subjects.filter(s => s.gradePoint !== null && s.gradePoint !== undefined).length
  const cgpa      = semesters ? calcCGPA(semesters) : semGpa

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2">

      {/* Credits summary */}
      <div
        className="shrink-0 px-2 py-2 panel-chamfer-sm"
        style={{ border: '1px solid var(--cad-border)', background: 'var(--cad-bg-elevated)' }}
      >
        <div className="flex justify-between">
          <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>TOTAL CREDITS</span>
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)' }}>{subjects.length} SUBJ</span>
        </div>
        <div className="flex items-end gap-2 mt-0.5">
          <span className="glow-accent" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '20px', lineHeight: 1, color: 'var(--cad-accent)' }}>
            {totalCr.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <div className="w-3 shrink-0" />
        <span style={{ flex: 1, fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)' }}>SUBJECT</span>
        <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', width: '32px', textAlign: 'right' }}>CR</span>
        <span style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', width: '32px', textAlign: 'right' }}>GP</span>
        {editMode && <span className="w-4" />}
      </div>
      <DataHr />

      {/* Subject list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {subjects.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-lo)' }}>// NO SUBJECTS</div>
          : subjects.map(s => (
            <SubjectRow key={s.id} subject={s} editMode={editMode} onUpdate={onUpdate} onRemove={onRemove} />
          ))
        }
      </div>

      {editMode && (
        <>
          <DataHr />
          <button
            onClick={onAddSubject}
            className="shrink-0 w-full py-1.5 panel-chamfer-sm btn-mech uppercase"
            style={{
              border:       '1px solid var(--cad-accent)',
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '9px',
              letterSpacing:'0.15em',
              color:        'var(--cad-accent)',
              background:   'var(--cad-accent-dim)',
            }}
          >+ ADD SUBJECT</button>
        </>
      )}

      <DataHr />

      {/* Current CGPA (all semesters) */}
      <GpaBadge label="CURRENT CGPA" hex="0xD000" value={cgpa} />

      {/* Semester GPA (active semester only) */}
      <GpaBadge
        label="SEMESTER GPA"
        hex="0xD001"
        value={semGpa}
        gradedCount={gradedCnt}
        totalCount={subjects.length}
      />
    </div>
  )
}
