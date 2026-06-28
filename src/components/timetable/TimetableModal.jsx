import { useState, useRef } from 'react'
import { SUBJECT_COLORS, DAYS, GRADE_MAP, GRID_START_HOUR, GRID_END_HOUR, genId, pad2, parseTimeToMins } from '../../data/index.js'
import { Modal } from '../ui/Modal.jsx'
import { TimeInput } from '../ui/TimeInput.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'

export function TimetableModal({ mode, initialData, subjects, timetable, onSave, onDelete, onClose }) {
  const { settings } = useSettings()
  const defaultStart = initialData?.startTime ?? `${pad2(GRID_START_HOUR + 1)}:00`
  const defaultEnd   = initialData?.endTime   ?? `${pad2(GRID_START_HOUR + 2)}:00`

  const [form, setForm] = useState({
    subjectId: initialData?.subjectId ?? subjects[0]?.id ?? null,
    day:       initialData?.day       ?? 'MON',
    startTime: defaultStart,
    endTime:   defaultEnd,
    room:      initialData?.room      ?? '',
  })
  const [error,      setError]      = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const delRef = useRef(null)

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleStartChange = v => {
    const startMins = parseTimeToMins(v)
    const endMins   = parseTimeToMins(form.endTime)
    if (endMins <= startMins) {
      const newEndMins = Math.min(startMins + 60, GRID_END_HOUR * 60)
      upd('startTime', v)
      upd('endTime', `${pad2(Math.floor(newEndMins / 60))}:${pad2(newEndMins % 60)}`)
    } else {
      upd('startTime', v)
    }
  }

  const validate = () => {
    if (!form.subjectId)   return 'SELECT A SUBJECT'
    if (settings.showLocation && !form.room.trim()) return 'ROOM REQUIRED'
    const startMins = parseTimeToMins(form.startTime)
    const endMins   = parseTimeToMins(form.endTime)
    if (endMins <= startMins)             return 'END TIME MUST BE AFTER START'
    if (endMins   > GRID_END_HOUR   * 60) return `END EXCEEDS ${pad2(GRID_END_HOUR)}:00`
    if (startMins < GRID_START_HOUR * 60) return `START BEFORE ${pad2(GRID_START_HOUR)}:00`
    const existId = initialData?.id
    const conflict = timetable.find(t => {
      if (t.id === existId || t.day !== form.day) return false
      const ts = parseTimeToMins(t.startTime)
      const te = parseTimeToMins(t.endTime)
      return !(endMins <= ts || startMins >= te)
    })
    if (conflict) {
      const cs = subjects.find(s => s.id === conflict.subjectId)
      return `CONFLICT: ${cs?.name ?? '??'} @ ${conflict.startTime}–${conflict.endTime}`
    }
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    onSave({ id: initialData?.id ?? genId(), ...form })
  }

  const handleDelete = () => {
    if (confirmDel) { clearTimeout(delRef.current); onDelete(initialData.id) }
    else { setConfirmDel(true); delRef.current = setTimeout(() => setConfirmDel(false), 2500) }
  }

  const previewSubj = subjects.find(s => s.id === form.subjectId)

  const labelStyle = { fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '4px' }
  const sectionStyle = { marginBottom: '12px' }

  return (
    <Modal title={mode === 'add' ? 'ADD ENTRY' : 'EDIT ENTRY'} hex={mode === 'add' ? '0xC001' : '0xC002'} onClose={onClose}>
      <div>
        {/* Subject */}
        <div style={sectionStyle}>
          <div style={labelStyle}>SUBJECT</div>
          <select
            value={form.subjectId ?? ''}
            onChange={e => upd('subjectId', Number(e.target.value))}
            style={{
              width:       '100%',
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '12px',
              background:  'var(--cad-bg-input)',
              border:      '1px solid var(--cad-border)',
              color:       'var(--cad-accent-text)',
              padding:     '6px 8px',
              outline:     'none',
              borderRadius:'var(--cad-radius)',
            }}
          >
            {subjects.map(s => {
              const c = SUBJECT_COLORS[s.colorIdx % SUBJECT_COLORS.length]
              return <option key={s.id} value={s.id} style={{ color: c.text }}>{s.name}</option>
            })}
          </select>
        </div>

        {/* Day */}
        <div style={sectionStyle}>
          <div style={labelStyle}>DAY</div>
          <div className="flex gap-1">
            {DAYS.map(d => (
              <button
                key={d}
                onClick={() => upd('day', d)}
                className="flex-1 py-1 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '9px',
                  letterSpacing:'0.1em',
                  border:       form.day === d ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                  color:        form.day === d ? 'var(--cad-accent-text)'      : 'var(--cad-text-mid)',
                  background:   form.day === d ? 'var(--cad-accent-dim)'       : 'transparent',
                  borderRadius: 'var(--cad-radius)',
                }}
              >{d}</button>
            ))}
          </div>
        </div>

        {/* Start / End time */}
        <div className="grid grid-cols-2 gap-3" style={sectionStyle}>
          <TimeInput
            label="START TIME"
            value={form.startTime}
            onChange={handleStartChange}
            minHour={GRID_START_HOUR}
            maxHour={GRID_END_HOUR}
          />
          <TimeInput
            label="END TIME"
            value={form.endTime}
            onChange={v => upd('endTime', v)}
            minHour={GRID_START_HOUR}
            maxHour={GRID_END_HOUR}
            minValue={form.startTime}
          />
        </div>

        {/* Room - Conditional based on Settings */}
        {settings.showLocation && (
          <div style={sectionStyle}>
            <div style={labelStyle}>ROOM / LOCATION</div>
            <input
              value={form.room}
              onChange={e => upd('room', e.target.value.toUpperCase())}
              placeholder="LH-301"
              style={{
                width:        '100%',
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '12px',
                color:        'var(--cad-accent-text)',
                background:   'var(--cad-bg-input)',
                border:       '1px solid var(--cad-border)',
                padding:      '6px 8px',
                outline:      'none',
                letterSpacing:'0.1em',
                borderRadius: 'var(--cad-radius)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cad-accent)' }}
              onBlur={e  => { e.currentTarget.style.borderColor = 'var(--cad-border)' }}
            />
          </div>
        )}

        {/* Preview */}
        {previewSubj && (
          <div
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '9px',
              color:        'var(--cad-text-mid)',
              border:       '1px solid var(--cad-border)',
              padding:      '6px 8px',
              background:   'var(--cad-bg-input)',
              letterSpacing:'0.1em',
              marginBottom: '12px',
              borderRadius: 'var(--cad-radius)',
            }}
          >
            {form.day} ∥ {form.startTime}–{form.endTime} ∥ {previewSubj.name}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    '9px',
              color:       'var(--cad-danger)',
              border:      '1px solid var(--cad-danger)',
              background:  'var(--cad-danger-dim)',
              padding:     '6px 8px',
              letterSpacing:'0.1em',
              marginBottom:'12px',
              borderRadius:'var(--cad-radius)',
            }}
          >⚠ {error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '10px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-accent)',
              color:        'var(--cad-accent-text)',
              background:   'var(--cad-accent-dim)',
              borderRadius: 'var(--cad-radius)',
            }}
          >SAVE</button>

          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              className={`px-3 py-1.5 btn-mech panel-chamfer-sm ${confirmDel ? 'blink' : ''}`}
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '10px',
                letterSpacing:'0.15em',
                border:       confirmDel ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
                color:        confirmDel ? 'var(--cad-danger)'           : 'var(--cad-text-mid)',
                background:   confirmDel ? 'var(--cad-danger-dim)'       : 'transparent',
                borderRadius: 'var(--cad-radius)',
              }}
            >{confirmDel ? 'CONFIRM?' : 'DELETE'}</button>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '10px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-border)',
              color:        'var(--cad-text-mid)',
              background:   'transparent',
              borderRadius: 'var(--cad-radius)',
            }}
          >ABORT</button>
        </div>
      </div>
    </Modal>
  )
}
