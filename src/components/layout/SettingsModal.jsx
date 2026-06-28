import { useState } from 'react'
import { useTheme } from '../../themes/ThemeContext.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'
import { Modal } from '../ui/Modal.jsx'

export function SettingsModal({ semesters, setSemesters, onClose }) {
  const { currentTheme, setTheme, themes } = useTheme()
  const { settings, updateSettings } = useSettings()

  const [importText, setImportText] = useState('')
  const [syncMsg, setSyncMsg] = useState('')

  const handleExport = () => {
    const data = JSON.stringify(semesters)
    navigator.clipboard.writeText(data).then(() => {
      setSyncMsg('DATA COPIED TO CLIPBOARD!')
      setTimeout(() => setSyncMsg(''), 3000)
    }).catch(err => {
      setSyncMsg('FAILED TO COPY.')
    })
  }

  const handlePaste = () => {
    navigator.clipboard.readText().then(text => {
      setImportText(text)
    }).catch(err => {
      setSyncMsg('FAILED TO READ CLIPBOARD.')
      setTimeout(() => setSyncMsg(''), 3000)
    })
  }

  const handleImport = () => {
    try {
      const data = JSON.parse(importText)
      if (!Array.isArray(data)) throw new Error('Invalid format')
      setSemesters(data)
      setImportText('')
      setSyncMsg('DATA IMPORTED SUCCESSFULLY!')
      setTimeout(() => setSyncMsg(''), 3000)
    } catch (e) {
      setSyncMsg('INVALID DATA STRING.')
      setTimeout(() => setSyncMsg(''), 3000)
    }
  }

  const labelStyle = { fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '4px' }
  const sectionStyle = { marginBottom: '16px' }

  return (
    <Modal title="SYSTEM SETTINGS" hex="0xS001" onClose={onClose}>
      <div>
        {/* Theme Selection */}
        <div style={sectionStyle}>
          <div style={labelStyle}>THEME INTERFACE</div>
          <div className="flex gap-2">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '10px',
                  letterSpacing:'0.15em',
                  border:       currentTheme.id === t.id ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                  color:        currentTheme.id === t.id ? 'var(--cad-accent-text)'      : 'var(--cad-text-mid)',
                  background:   currentTheme.id === t.id ? 'var(--cad-accent-dim)'       : 'transparent',
                  borderRadius: 'var(--cad-radius)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Display Mode (Only for minimal theme) */}
        {currentTheme.id === 'minimal' && (
          <div style={sectionStyle}>
            <div style={labelStyle}>DISPLAY MODE</div>
            <div className="flex gap-2">
              {['light', 'dark'].map(mode => (
                <button
                  key={mode}
                  onClick={() => updateSettings({ themeMode: mode })}
                  className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                  style={{
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     '10px',
                    letterSpacing:'0.15em',
                    border:       settings.themeMode === mode ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                    color:        settings.themeMode === mode ? 'var(--cad-accent-text)'      : 'var(--cad-text-mid)',
                    background:   settings.themeMode === mode ? 'var(--cad-accent-dim)'       : 'transparent',
                    borderRadius: 'var(--cad-radius)',
                  }}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preferences */}
        <div style={sectionStyle}>
          <div style={labelStyle}>PREFERENCES</div>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-hi)' }}>
            <input
              type="checkbox"
              checked={settings.showLocation}
              onChange={e => updateSettings({ showLocation: e.target.checked })}
              style={{ accentColor: 'var(--cad-accent)' }}
            />
            SHOW ROOM / LOCATION INPUT
          </label>
        </div>

        {/* Data Sync */}
        <div style={sectionStyle}>
          <div style={labelStyle}>DATA SYNC</div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleExport}
              className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '10px',
                letterSpacing:'0.15em',
                border:       '1px solid var(--cad-accent)',
                color:        'var(--cad-accent-text)',
                background:   'transparent',
                borderRadius: 'var(--cad-radius)',
              }}
            >EXPORT TO CLIPBOARD</button>
          </div>
          
          <div className="flex gap-2">
            <input
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="PASTE JSON HERE"
              className="flex-1 px-2 py-1.5"
              style={{
                fontFamily:  'var(--cad-font-mono)',
                fontSize:    '10px',
                background:  'var(--cad-bg-input)',
                border:      '1px solid var(--cad-border)',
                color:       'var(--cad-text-hi)',
                outline:     'none',
                borderRadius:'var(--cad-radius)',
              }}
            />
            <button
              onClick={handlePaste}
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
            >PASTE</button>
            <button
              onClick={handleImport}
              disabled={!importText}
              className="px-3 py-1.5 btn-mech panel-chamfer-sm"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '10px',
                letterSpacing:'0.15em',
                border:       importText ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border-dim)',
                color:        importText ? 'var(--cad-accent-text)' : 'var(--cad-text-lo)',
                background:   'transparent',
                borderRadius: 'var(--cad-radius)',
                cursor:       importText ? 'pointer' : 'not-allowed',
              }}
            >IMPORT</button>
          </div>
          
          {syncMsg && (
            <div style={{
              fontFamily: 'var(--cad-font-mono)',
              fontSize: '9px',
              color: syncMsg.includes('INVALID') || syncMsg.includes('FAILED') ? 'var(--cad-danger)' : 'var(--cad-success)',
              marginTop: '6px'
            }}>
              {syncMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '10px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-accent)',
              color:        'var(--cad-accent-text)',
              background:   'var(--cad-accent-dim)',
              borderRadius: 'var(--cad-radius)',
            }}
          >CLOSE</button>
        </div>
      </div>
    </Modal>
  )
}
