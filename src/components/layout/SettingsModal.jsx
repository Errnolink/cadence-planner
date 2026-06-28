import { useState, useRef } from 'react'
import { useTheme } from '../../themes/ThemeContext.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'
import { Modal } from '../ui/Modal.jsx'
import { API } from '../../data/api.js'

export function SettingsModal({ onClose }) {
  const { currentTheme, setTheme, themes, addCustomTheme } = useTheme()
  const { settings, updateSettings } = useSettings()

  const [themeImportText, setThemeImportText] = useState('')
  const [themeSyncMsg, setThemeSyncMsg] = useState('')
  const [dataSyncMsg, setDataSyncMsg] = useState('')
  const fileInputRef = useRef(null)

  const handleThemeImport = () => {
    try {
      const data = JSON.parse(themeImportText)
      if (!data.id || !data.label || !data.tokens) throw new Error('Invalid format')
      addCustomTheme(data)
      setThemeImportText('')
      setThemeSyncMsg('THEME IMPORTED!')
      setTimeout(() => setThemeSyncMsg(''), 3000)
    } catch (e) {
      setThemeSyncMsg('INVALID THEME JSON.')
      setTimeout(() => setThemeSyncMsg(''), 3000)
    }
  }

  const handleCopyPrompt = () => {
    const prompt = `Generate a valid Cadence Theme JSON object following this exact schema:
{
  "id": "theme-unique-id",
  "label": "DISPLAY NAME",
  "tokens": {
    "cad-bg-primary": "#0a0a0a",
    "cad-bg-panel": "#111111",
    "cad-bg-elevated": "#1a1a1a",
    "cad-bg-input": "#000000",
    "cad-border": "#333333",
    "cad-border-dim": "#222222",
    "cad-border-panel": "#444444",
    "cad-accent": "#f97316",
    "cad-accent-dim": "rgba(249,115,22,0.15)",
    "cad-accent-text": "#f97316",
    "cad-text-hi": "#ffffff",
    "cad-text-mid": "#a3a3a3",
    "cad-text-lo": "#525252",
    "cad-text-xlo": "#262626",
    "cad-danger": "#ef4444",
    "cad-danger-dim": "rgba(239,68,68,0.15)",
    "cad-success": "#22c55e",
    "cad-radius": "2px",
    "cad-font-mono": "'Share Tech Mono', monospace",
    "cad-font-ui": "'Share Tech Mono', monospace"
  }
}
Please output ONLY the raw JSON format without markdown wrapping or codeblocks.`
    
    navigator.clipboard.writeText(prompt).then(() => {
      setThemeSyncMsg('PROMPT COPIED!')
      setTimeout(() => setThemeSyncMsg(''), 3000)
    })
  }

  const handleDownloadBackup = () => {
    try {
      const data = API.exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cadence_backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDataSyncMsg('BACKUP DOWNLOADED.')
      setTimeout(() => setDataSyncMsg(''), 3000)
    } catch (e) {
      setDataSyncMsg('DOWNLOAD FAILED.')
      setTimeout(() => setDataSyncMsg(''), 3000)
    }
  }

  const handleRestoreBackup = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        API.importAllData(data)
        window.location.reload()
      } catch (err) {
        setDataSyncMsg('INVALID BACKUP FILE.')
        setTimeout(() => setDataSyncMsg(''), 3000)
      }
    }
    reader.readAsText(file)
  }

  const labelStyle = { fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-text-lo)', fontFamily: 'var(--cad-font-mono)', marginBottom: '8px', borderBottom: '1px solid var(--cad-border-dim)', paddingBottom: '4px' }
  const sectionStyle = { marginBottom: '24px' }

  return (
    <Modal title="SYSTEM SETTINGS" hex="0xS001" onClose={onClose}>
      <div className="p-1">
        
        {/* PREFERENCES */}
        <div style={sectionStyle}>
          <div style={labelStyle}>PREFERENCES</div>
          <div className="flex flex-col gap-3 mt-3">
            <label className="flex items-center gap-3 cursor-pointer p-2 panel-chamfer-sm transition-colors" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-hi)', background: 'var(--cad-bg-elevated)', border: '1px solid var(--cad-border-dim)' }}>
              <input type="checkbox" checked={settings.showLocation} onChange={e => updateSettings({ showLocation: e.target.checked })} style={{ accentColor: 'var(--cad-accent)', width: '14px', height: '14px' }} />
              SHOW ROOM / LOCATION INPUT
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-2 panel-chamfer-sm transition-colors" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-text-hi)', background: 'var(--cad-bg-elevated)', border: '1px solid var(--cad-border-dim)' }}>
              <input type="checkbox" checked={settings.holidays2nd4thSat} onChange={e => updateSettings({ holidays2nd4thSat: e.target.checked })} style={{ accentColor: 'var(--cad-accent)', width: '14px', height: '14px' }} />
              ENABLE 2ND/4TH SATURDAY HOLIDAYS
            </label>
          </div>
        </div>

        {/* THEMES */}
        <div style={sectionStyle}>
          <div style={labelStyle}>THEME INTERFACE</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="py-2 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '10px',
                  letterSpacing:'0.15em',
                  border:       currentTheme.id === t.id ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
                  color:        currentTheme.id === t.id ? 'var(--cad-accent-text)'      : 'var(--cad-text-mid)',
                  background:   currentTheme.id === t.id ? 'var(--cad-accent-dim)'       : 'var(--cad-bg-elevated)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {currentTheme.id === 'minimal' && (
            <div className="flex gap-2 mt-2">
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
                    background:   settings.themeMode === mode ? 'var(--cad-accent-dim)'       : 'var(--cad-bg-elevated)',
                  }}
                >
                  MODE: {mode.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <input
              value={themeImportText}
              onChange={e => setThemeImportText(e.target.value)}
              placeholder='PASTE CUSTOM THEME JSON'
              className="w-full px-3 py-2 panel-chamfer-sm"
              style={{
                fontFamily:  'var(--cad-font-mono)',
                fontSize:    '10px',
                background:  'var(--cad-bg-input)',
                border:      '1px solid var(--cad-border)',
                color:       'var(--cad-text-hi)',
                outline:     'none',
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleThemeImport}
                disabled={!themeImportText}
                className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '10px',
                  letterSpacing:'0.15em',
                  border:       themeImportText ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border-dim)',
                  color:        themeImportText ? 'var(--cad-accent-text)' : 'var(--cad-text-lo)',
                  background:   themeImportText ? 'var(--cad-accent-dim)' : 'transparent',
                  cursor:       themeImportText ? 'pointer' : 'not-allowed',
                }}
              >IMPORT THEME</button>
              <button
                onClick={handleCopyPrompt}
                className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                style={{
                  fontFamily:   'var(--cad-font-mono)',
                  fontSize:     '10px',
                  letterSpacing:'0.15em',
                  border:       '1px solid var(--cad-border)',
                  color:        'var(--cad-text-mid)',
                  background:   'var(--cad-bg-elevated)',
                }}
              >COPY AI PROMPT</button>
            </div>
            {themeSyncMsg && (
              <div className="text-center mt-1" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: themeSyncMsg.includes('INVALID') ? 'var(--cad-danger)' : 'var(--cad-success)' }}>
                {themeSyncMsg}
              </div>
            )}
          </div>
        </div>

        {/* DATA SYNC */}
        <div style={sectionStyle}>
          <div style={labelStyle}>DATA SYNC</div>
          <p style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)', marginBottom: '8px', lineHeight: '1.4' }}>
            Backup and restore your entire Cadence dataset as a single .json file. Restoring will overwrite all existing data.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadBackup}
              className="flex-1 py-2 btn-mech panel-chamfer-sm"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '10px',
                letterSpacing:'0.15em',
                border:       '1px solid var(--cad-accent)',
                color:        'var(--cad-accent-text)',
                background:   'transparent',
              }}
            >DOWNLOAD BACKUP</button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 btn-mech panel-chamfer-sm"
              style={{
                fontFamily:   'var(--cad-font-mono)',
                fontSize:     '10px',
                letterSpacing:'0.15em',
                border:       '1px solid var(--cad-danger)',
                color:        'var(--cad-danger)',
                background:   'transparent',
              }}
            >RESTORE BACKUP</button>
            <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" />
          </div>
          {dataSyncMsg && (
            <div className="text-center mt-2" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: dataSyncMsg.includes('FAILED') || dataSyncMsg.includes('INVALID') ? 'var(--cad-danger)' : 'var(--cad-success)' }}>
              {dataSyncMsg}
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end mt-6 pt-4" style={{ borderTop: '1px solid var(--cad-border-dim)' }}>
          <button
            onClick={onClose}
            className="px-6 py-2 btn-mech panel-chamfer-sm"
            style={{
              fontFamily:   'var(--cad-font-mono)',
              fontSize:     '11px',
              letterSpacing:'0.15em',
              border:       '1px solid var(--cad-accent)',
              color:        'var(--cad-bg-primary)',
              background:   'var(--cad-accent)',
              fontWeight:   'bold'
            }}
          >CLOSE</button>
        </div>
      </div>
    </Modal>
  )
}
