import { useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton.jsx'
import { toDateStr, parseTimeToMins, GRID_END_HOUR, pad2 } from '../../data/index.js'

const sectionStyle = { marginBottom: '12px' }
const labelGap = { marginBottom: '4px' }

/** ExamModal — add / edit / delete a single exam (rides the existing Modal). */
export function ExamModal({ mode, initial, subjects = [], exams = [], onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    subjectId: initial?.subjectId ?? subjects[0]?.id ?? null,
    date: initial?.date ?? toDateStr(new Date()),
    startTime: initial?.startTime ?? '09:00',
    endTime: initial?.endTime ?? '11:00',
    room: initial?.room ?? '',
    notes: initial?.notes ?? '',
  })
  const [error, setError] = useState('')

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    if (!form.subjectId) return 'SELECT A SUBJECT'
    if (!form.date) return 'SELECT A DATE'
    const start = parseTimeToMins(form.startTime)
    const end = parseTimeToMins(form.endTime)
    if (end <= start) return 'END TIME MUST BE AFTER START'
    if (end > GRID_END_HOUR * 60) return `END EXCEEDS ${pad2(GRID_END_HOUR)}:00`
    // Same interval-overlap rule the timetable modal applies to classes.
    const clash = exams.find(x =>
      String(x.id) !== String(initial?.id) &&
      x.date === form.date &&
      !(end <= parseTimeToMins(x.startTime) || start >= parseTimeToMins(x.endTime)))
    if (clash) return `CLASH WITH EXAM @ ${clash.startTime}–${clash.endTime}`
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form })
  }

  const previewSubj = subjects.find(s => String(s.id) === String(form.subjectId))

  return (
    <Modal title={mode === 'add' ? 'ADD EXAM' : 'EDIT EXAM'} hex={mode === 'add' ? '0xF001' : '0xF002'} onClose={onClose}>
      <div>
        <div style={sectionStyle}>
          <div className="cad-label" style={labelGap}>SUBJECT</div>
          <select
            value={form.subjectId ?? ''}
            // Map back to the ORIGINAL id so a numeric subject id stays a
            // number — object-key coercion hides the drift today, but a Map
            // or a === comparison downstream would not.
            onChange={e => {
              const selected = subjects.find(s => String(s.id) === String(e.target.value))
              upd('subjectId', selected ? selected.id : e.target.value)
            }}
            className="cad-input"
            style={{ cursor: 'pointer' }}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id} style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={sectionStyle}>
          <div className="cad-label" style={labelGap}>DATE</div>
          <input type="date" value={form.date} onChange={e => upd('date', e.target.value)} className="cad-input" />
        </div>

        <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div className="cad-label" style={labelGap}>START</div>
            <input type="time" value={form.startTime} onChange={e => upd('startTime', e.target.value)} className="cad-input" max={`${pad2(GRID_END_HOUR)}:00`} />
          </div>
          <div>
            <div className="cad-label" style={labelGap}>END</div>
            <input type="time" value={form.endTime} onChange={e => upd('endTime', e.target.value)} className="cad-input" max={`${pad2(GRID_END_HOUR)}:00`} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div className="cad-label" style={labelGap}>ROOM (OPTIONAL)</div>
          <input value={form.room} onChange={e => upd('room', e.target.value)} placeholder="HALL A / C4-202" className="cad-input" />
        </div>

        <div style={sectionStyle}>
          <div className="cad-label" style={labelGap}>NOTES (OPTIONAL)</div>
          <textarea
            value={form.notes}
            onChange={e => upd('notes', e.target.value)}
            rows={3}
            placeholder="Syllabus, weightage, prep notes…"
            className="cad-input"
            style={{ resize: 'vertical' }}
          />
        </div>

        {previewSubj && (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-text-mid)', border: '1px solid var(--cad-border)', padding: '6px 8px', background: 'var(--cad-bg-input)', borderRadius: 'var(--cad-radius)', marginBottom: '12px' }}>
            {form.date} ∥ {form.startTime}–{form.endTime} ∥ {previewSubj.name}
          </div>
        )}


        {error && (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-xs)', color: 'var(--cad-danger)', border: '1px solid var(--cad-danger)', background: 'var(--cad-danger-dim)', padding: '6px 8px', borderRadius: 'var(--cad-radius)', marginBottom: '12px' }}>⚠ {error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)', border: '1px solid var(--cad-accent)', color: 'var(--cad-accent-text)', background: 'var(--cad-accent-dim)', borderRadius: 'var(--cad-radius)' }}
          >SAVE</button>
          {mode === 'edit' && onDelete && (
            <ConfirmDeleteButton onConfirm={() => onDelete(initial.id)} />
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)', border: '1px solid var(--cad-border)', color: 'var(--cad-text-mid)', background: 'transparent', borderRadius: 'var(--cad-radius)' }}
          >ABORT</button>
        </div>
      </div>
    </Modal>
  )
}
