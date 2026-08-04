import { useState, useRef } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { toDateStr } from '../../data/index.js'

const labelStyle = { fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '4px' }
const sectionStyle = { marginBottom: '12px' }
const inputStyle = {
  width: '100%', fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-hi)',
  background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)', padding: '6px 8px',
  outline: 'none', borderRadius: 'var(--cad-radius)',
}

/** ExamModal — add / edit / delete a single exam (rides the existing Modal). */
export function ExamModal({ mode, initial, subjects = [], onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    subjectId: initial?.subjectId ?? subjects[0]?.id ?? null,
    date: initial?.date ?? toDateStr(new Date()),
    startTime: initial?.startTime ?? '09:00',
    endTime: initial?.endTime ?? '11:00',
    room: initial?.room ?? '',
    notes: initial?.notes ?? '',
  })
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const delRef = useRef(null)

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    if (!form.subjectId) return 'SELECT A SUBJECT'
    if (!form.date) return 'SELECT A DATE'
    const start = parseInt(form.startTime.replace(':', ''), 10)
    const end = parseInt(form.endTime.replace(':', ''), 10)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'END TIME MUST BE AFTER START'
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    onSave({ id: initial?.id ?? crypto.randomUUID(), ...form })
  }

  const handleDelete = () => {
    if (confirmDel) { clearTimeout(delRef.current); onDelete(initial.id) }
    else { setConfirmDel(true); delRef.current = setTimeout(() => setConfirmDel(false), 2500) }
  }

  const previewSubj = subjects.find(s => String(s.id) === String(form.subjectId))

  return (
    <Modal title={mode === 'add' ? 'ADD EXAM' : 'EDIT EXAM'} hex={mode === 'add' ? '0xF001' : '0xF002'} onClose={onClose}>
      <div>
        <div style={sectionStyle}>
          <div style={labelStyle}>SUBJECT</div>
          <select
            value={form.subjectId ?? ''}
            onChange={e => upd('subjectId', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id} style={{ background: 'var(--cad-bg-panel)', color: 'var(--cad-text-hi)' }}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>DATE</div>
          <input type="date" value={form.date} onChange={e => upd('date', e.target.value)} style={inputStyle} />
        </div>

        <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={labelStyle}>START</div>
            <input type="time" value={form.startTime} onChange={e => upd('startTime', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>END</div>
            <input type="time" value={form.endTime} onChange={e => upd('endTime', e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>ROOM (OPTIONAL)</div>
          <input value={form.room} onChange={e => upd('room', e.target.value)} placeholder="HALL A / C4-202" style={inputStyle} />
        </div>

        <div style={sectionStyle}>
          <div style={labelStyle}>NOTES (OPTIONAL)</div>
          <textarea
            value={form.notes}
            onChange={e => upd('notes', e.target.value)}
            rows={3}
            placeholder="Syllabus, weightage, prep notes…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {previewSubj && (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-mid)', border: '1px solid var(--cad-border)', padding: '6px 8px', background: 'var(--cad-bg-input)', borderRadius: 'var(--cad-radius)', marginBottom: '12px' }}>
            {form.date} ∥ {form.startTime}–{form.endTime} ∥ {previewSubj.name}
          </div>
        )}


        {error && (
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-danger)', border: '1px solid var(--cad-danger)', background: 'var(--cad-danger-dim)', padding: '6px 8px', borderRadius: 'var(--cad-radius)', marginBottom: '12px' }}>⚠ {error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.15em', border: '1px solid var(--cad-accent)', color: 'var(--cad-accent-text)', background: 'var(--cad-accent-dim)', borderRadius: 'var(--cad-radius)' }}
          >SAVE</button>
          {mode === 'edit' && onDelete && (
            <button
              onClick={handleDelete}
              className={`px-3 py-1.5 btn-mech panel-chamfer-sm ${confirmDel ? 'blink' : ''}`}
              style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.15em', border: confirmDel ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)', color: confirmDel ? 'var(--cad-danger)' : 'var(--cad-text-mid)', background: confirmDel ? 'var(--cad-danger-dim)' : 'transparent', borderRadius: 'var(--cad-radius)' }}
            >{confirmDel ? 'CONFIRM?' : 'DELETE'}</button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.15em', border: '1px solid var(--cad-border)', color: 'var(--cad-text-mid)', background: 'transparent', borderRadius: 'var(--cad-radius)' }}
          >ABORT</button>
        </div>
      </div>
    </Modal>
  )
}
