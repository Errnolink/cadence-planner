import { useState } from 'react'
import { SUBJECT_COLORS, generateSubjectCode } from '../../data/index.js'
import { Modal } from '../ui/Modal.jsx'

export function ClassInstanceModal({ entry, dateStr, sourceRect, subjects, attendanceHook, onClose }) {
  const subj = subjects.find(s => s.id === entry.subjectId)
  const color = subj ? SUBJECT_COLORS[subj.colorIdx % SUBJECT_COLORS.length] : { bg: '#000', text: '#fff', border: '#fff' }
  const code = subj ? (subj.code || generateSubjectCode(subj.name)) : '???'

  const dayData = attendanceHook.attendance[dateStr] || {}
  const status = dayData[entry.id]
  const note = dayData[`${entry.id}_note`] || ''

  const [currentNote, setCurrentNote] = useState(note)

  const handleStatusChange = (newStatus) => {
    attendanceHook.markAttendance(dateStr, entry.id, newStatus)
  }

  const handleSaveNote = () => {
    attendanceHook.setNote(dateStr, entry.id, currentNote)
    onClose()
  }

  const labelStyle = { fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '4px' }
  const sectionStyle = { marginBottom: '16px' }

  return (
    <Modal title={`CLASS INSTANCE :: ${dateStr}`} hex="0xC003" onClose={onClose} sourceRect={sourceRect}>
      <div>
        {/* Header Details */}
        <div style={{ ...sectionStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '12px', height: '12px', background: color.border, boxShadow: `0 0 4px ${color.border}`
          }} />
          <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '14px', color: color.text, fontWeight: 'bold' }}>
            {subj?.name || 'Unknown'} ({code})
          </div>
        </div>

        <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)', padding: '6px 8px', borderRadius: 'var(--cad-radius)' }}>
            <div style={labelStyle}>TIME</div>
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '12px', color: 'var(--cad-text-mid)' }}>
              {entry.startTime}–{entry.endTime}
            </div>
          </div>
          <div style={{ background: 'var(--cad-bg-input)', border: '1px solid var(--cad-border)', padding: '6px 8px', borderRadius: 'var(--cad-radius)' }}>
            <div style={labelStyle}>ROOM</div>
            <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '12px', color: 'var(--cad-text-mid)' }}>
              {entry.room || 'N/A'}
            </div>
          </div>
        </div>

        {/* Attendance */}
        <div style={sectionStyle}>
          <div style={labelStyle}>ATTENDANCE</div>
          <div className="flex gap-1">
            {['PRESENT', 'ABSENT', 'CANCELLED'].map(type => {
              const isActive = status === type
              let colorVar = '--cad-text-mid'
              let bg = 'transparent'
              if (isActive) {
                if (type === 'PRESENT') { colorVar = '--cad-success'; bg = 'rgba(80,255,80,0.1)' }
                else if (type === 'ABSENT') { colorVar = '--cad-danger'; bg = 'var(--cad-danger-dim)' }
                else { colorVar = '--cad-text-lo'; bg = 'var(--cad-bg-primary)' }
              }
              
              return (
                <button
                  key={type}
                  onClick={() => handleStatusChange(isActive ? null : type)}
                  className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                  style={{
                    fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                    border: isActive ? `1px solid var(${colorVar})` : '1px solid var(--cad-border)',
                    color: isActive ? `var(${colorVar})` : 'var(--cad-text-mid)',
                    background: bg,
                    borderRadius: 'var(--cad-radius)',
                  }}
                >
                  {type}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={sectionStyle}>
          <div style={labelStyle}>NOTES (SPECIFIC TO THIS DATE)</div>
          <textarea
            value={currentNote}
            onChange={e => setCurrentNote(e.target.value)}
            placeholder="Note down what was covered, assignments, etc."
            rows={4}
            style={{
              width: '100%',
              fontFamily: 'var(--cad-font-mono)',
              fontSize: '12px',
              color: 'var(--cad-accent-text)',
              background: 'var(--cad-bg-input)',
              border: '1px solid var(--cad-border)',
              padding: '8px',
              outline: 'none',
              borderRadius: 'var(--cad-radius)',
              resize: 'vertical',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--cad-accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--cad-border)' }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveNote}
            className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.15em',
              border: '1px solid var(--cad-accent)',
              color: 'var(--cad-accent-text)',
              background: 'var(--cad-accent-dim)',
              borderRadius: 'var(--cad-radius)',
            }}
          >SAVE & CLOSE</button>
          
          <button
            onClick={onClose}
            className="px-3 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.15em',
              border: '1px solid var(--cad-border)',
              color: 'var(--cad-text-mid)',
              background: 'transparent',
              borderRadius: 'var(--cad-radius)',
            }}
          >ABORT</button>
        </div>
      </div>
    </Modal>
  )
}
