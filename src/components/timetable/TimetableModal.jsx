import { useState } from 'react'
import { subjectVars, DAYS, GRID_START_HOUR, GRID_END_HOUR, pad2, parseTimeToMins } from '../../data/index.js'
import { Modal } from '../ui/Modal.jsx'
import { ConfirmDeleteButton } from '../ui/ConfirmDeleteButton.jsx'

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
      const cs = subjects.find(s => String(s.id) === String(conflict.subjectId))
      return `CONFLICT: ${cs?.name ?? '??'} @ ${conflict.startTime}–${conflict.endTime}`
    }
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    onSave({ id: initialData?.id ?? crypto.randomUUID(), ...form })
  }

  const previewSubj = subjects.find(s => String(s.id) === String(form.subjectId))

  const labelStyle = { marginBottom: '4px' }
  const sectionStyle = { marginBottom: '12px' }

  return (
    <Modal title={mode === 'add' ? 'ADD ENTRY' : 'EDIT ENTRY'} hex={mode === 'add' ? '0xC001' : '0xC002'} onClose={onClose}>
      <div>
        {/* Subject */}
        <div style={sectionStyle}>
          <div className="cad-label" style={labelStyle}>SUBJECT</div>
          <select
            value={form.subjectId ?? ''}
            onChange={e => {
              const selected = subjects.find(s => String(s.id) === String(e.target.value))
              upd('subjectId', selected ? selected.id : e.target.value)
            }}
            style={{
              width:       '100%',
              fontFamily:  'var(--cad-font-mono)',
              fontSize:    'var(--cad-fs-sm)',
              background:  'var(--cad-bg-input)',
              border:      '1px solid var(--cad-border)',
              color:       'var(--cad-accent-text)',
              padding:     '6px 8px',
              borderRadius:'var(--cad-radius)',
            }}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id} style={{ ...subjectVars(s.colorIdx), color: 'var(--subj-text)' }}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Day */}
        <div style={sectionStyle}>
          <div className="cad-label" style={labelStyle}>DAY</div>
          <div className="flex gap-1">
            {DAYS.map(d => (
              <button
                key={d}
                onClick={() => upd('day', d)}
                className="flex-1 py-1 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     'var(--cad-fs-xs)',
                  letterSpacing:'var(--cad-track-mid)',
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
          <div>
            <div className="cad-label" style={labelStyle}>START TIME</div>
            <input
              type="time"
              value={form.startTime}
              onChange={e => handleStartChange(e.target.value)}
              min={`${pad2(GRID_START_HOUR)}:00`}
              max={`${pad2(GRID_END_HOUR)}:00`}
              style={{
                width:        '100%',
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     'var(--cad-fs-sm)',
                color:        'var(--cad-accent-text)',
                background:   'var(--cad-bg-input)',
                border:       '1px solid var(--cad-border)',
                padding:      '6px 8px',
                borderRadius: 'var(--cad-radius)',
              }}
            />
          </div>
          <div>
            <div className="cad-label" style={labelStyle}>END TIME</div>
            <input
              type="time"
              value={form.endTime}
              onChange={e => upd('endTime', e.target.value)}
              min={`${pad2(GRID_START_HOUR)}:00`}
              max={`${pad2(GRID_END_HOUR)}:00`}
              style={{
                width:        '100%',
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     'var(--cad-fs-sm)',
                color:        'var(--cad-accent-text)',
                background:   'var(--cad-bg-input)',
                border:       '1px solid var(--cad-border)',
                padding:      '6px 8px',
                borderRadius: 'var(--cad-radius)',
              }}
            />
          </div>
        </div>

        {/* Room - Conditional based on Settings */}
        {settings.showLocation && (
          <div style={sectionStyle}>
            <div className="cad-label" style={labelStyle}>ROOM / LOCATION</div>
            <input
              value={form.room}
              onChange={e => upd('room', e.target.value)}
              placeholder="LH-301"
              style={{
                width:        '100%',
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     'var(--cad-fs-sm)',
                color:        'var(--cad-accent-text)',
                background:   'var(--cad-bg-input)',
                border:       '1px solid var(--cad-border)',
                padding:      '6px 8px',
                letterSpacing:'var(--cad-track-mid)',
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
              fontSize:     'var(--cad-fs-xs)',
              color:        'var(--cad-text-mid)',
              border:       '1px solid var(--cad-border)',
              padding:      '6px 8px',
              background:   'var(--cad-bg-input)',
              letterSpacing:'var(--cad-track-mid)',
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
              fontSize:    'var(--cad-fs-xs)',
              color:       'var(--cad-danger)',
              border:      '1px solid var(--cad-danger)',
              background:  'var(--cad-danger-dim)',
              padding:     '6px 8px',
              letterSpacing:'var(--cad-track-mid)',
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
              fontSize:     'var(--cad-fs-micro)',
              letterSpacing:'var(--cad-track-wide)',
              border:       '1px solid var(--cad-accent)',
              color:        'var(--cad-accent-text)',
              background:   'var(--cad-accent-dim)',
              borderRadius: 'var(--cad-radius)',
            }}
          >SAVE</button>

          {mode === 'edit' && (
            <ConfirmDeleteButton onConfirm={() => onDelete(initialData.id)} />
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     'var(--cad-fs-micro)',
              letterSpacing:'var(--cad-track-wide)',
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
