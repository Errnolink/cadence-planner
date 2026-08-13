import { useState, useRef, useEffect, useId } from 'react'
import { useTheme } from '../../themes/ThemeContext.jsx'
import { useSettings } from '../../hooks/useSettings.jsx'
import { Modal } from '../ui/Modal.jsx'
import { API } from '../../data/api.js'
import { SyncChip } from '../ui/SyncChip.jsx'
import {
  ROUNDING_MODES,
  ROUNDING_LABELS,
  ROUNDING_BLURBS,
  DEFAULT_SCHEME,
} from '../../data/grading.js'

/**
 * Settings used to be one scrolling column inside a `max-w-sm` modal: five
 * unrelated concerns stacked in ~380px of width, with the theme importer and
 * the backup buttons fighting for the same fold. It is a page now, and the
 * sections are addressable — a rail on a wide screen, a scrollable strip on a
 * phone.
 */
const SECTIONS = [
  { id: 'preferences', label: 'PREFERENCES' },
  { id: 'grading',     label: 'GRADING'     },
  { id: 'themes',      label: 'THEMES'      },
  { id: 'data',        label: 'DATA'        },
  { id: 'about',       label: 'ABOUT'       },
]

const headingStyle = {
  marginBottom:  '12px',
  paddingBottom: '4px',
  borderBottom:  '1px solid var(--cad-border-dim)',
}

const checkboxRowStyle = {
  fontFamily: 'var(--cad-font-mono)',
  fontSize:   'var(--cad-fs-xs)',
  color:      'var(--cad-text-hi)',
  background: 'var(--cad-bg-elevated)',
  border:     '1px solid var(--cad-border-dim)',
}

const checkboxStyle = { accentColor: 'var(--cad-accent)', width: '14px', height: '14px' }

const helpTextStyle = {
  fontFamily: 'var(--cad-font-mono)',
  fontSize:   'var(--cad-fs-micro)',
  color:      'var(--cad-text-lo)',
  lineHeight: '1.5',
}

/**
 * Shared theme-selection button (built-in themes, custom themes, mode toggle).
 * Module level so switching sections doesn't remount every theme button.
 */
function ThemeButton({ active, onClick, children, className = '', style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-mech panel-chamfer-sm ${className}`}
      style={{
        fontFamily:    'var(--cad-font-mono)',
        fontSize:      'var(--cad-fs-micro)',
        letterSpacing: 'var(--cad-track-wide)',
        border:        active ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border)',
        color:         active ? 'var(--cad-accent-text)'      : 'var(--cad-text-mid)',
        background:    active ? 'var(--cad-accent-dim)'       : 'var(--cad-bg-elevated)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/**
 * The one grading knob that is a *preference* rather than a course structure.
 *
 * Components, weights, sitting rules and grade bands stay in the EXAMS tab
 * editor — they describe a syllabus, they change per semester, and duplicating
 * that editor here would mean two places to keep in sync. Rounding is the
 * exception: it is a house style that applies to every subject at once, and
 * users look for it in settings.
 */
function GradingSection({ semester, onSetScheme }) {
  if (!semester) {
    return (
      <p style={{ ...helpTextStyle, color: 'var(--cad-text-mid)' }}>
        NO ACTIVE SEMESTER. CREATE ONE FROM THE CONTROL BAR TO SET ITS GRADING RULES.
      </p>
    )
  }

  const scheme     = semester.gradingScheme ?? DEFAULT_SCHEME
  const rounding   = semester.gradingScheme?.rounding ?? 'none'
  const components = scheme.components ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="cad-label" style={{ marginBottom: '6px' }}>ROUNDING</div>
        <div role="group" aria-label="Rounding mode" className="flex flex-wrap gap-1.5">
          {ROUNDING_MODES.map(mode => (
            <button
              key={mode}
              type="button"
              className="cad-chip btn-mech"
              data-active={rounding === mode || undefined}
              aria-pressed={rounding === mode}
              style={{ padding: '8px 12px' }}
              onClick={() => onSetScheme({ ...(semester.gradingScheme ?? DEFAULT_SCHEME), rounding: mode })}
            >{ROUNDING_LABELS[mode]}</button>
          ))}
        </div>
        <p style={{ ...helpTextStyle, marginTop: '8px' }}>{ROUNDING_BLURBS[rounding]}</p>
      </div>

      <div>
        <div className="cad-label" style={{ marginBottom: '6px' }}>COMPONENTS</div>
        <p className="cad-value" style={{ letterSpacing: 'var(--cad-track-mid)' }}>
          {components.length === 0
            ? 'NONE DEFINED'
            : components.map((c, i) => (
                <span key={c.id ?? i}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  {c.label} {c.weight}
                </span>
              ))}
        </p>
        <p style={{ ...helpTextStyle, marginTop: '8px' }}>
          Read-only here. Components, weights, sitting rules and grade bands are
          edited in the EXAMS tab, under SCHEME.
        </p>
      </div>
    </div>
  )
}

export function SettingsPage({ semester, onSetScheme, onClose }) {
  const { currentTheme, setTheme, themes, customThemes, addCustomTheme, removeCustomTheme } = useTheme()
  const { settings, updateSettings } = useSettings()

  const [section, setSection] = useState('preferences')
  const [themeImportText, setThemeImportText] = useState('')
  const [themeSyncMsg, setThemeSyncMsg] = useState('')
  const [dataSyncMsg, setDataSyncMsg] = useState('')
  // Validation messages are free text now, so the colour can't be inferred
  // from the wording any more.
  const [dataSyncErr, setDataSyncErr] = useState(false)
  const fileInputRef = useRef(null)
  const msgTimer = useRef(null)
  const tabRefs = useRef({})
  const uid = useId()
  useEffect(() => () => clearTimeout(msgTimer.current), [])

  const tabId   = id => `${uid}-tab-${id}`
  const panelId = id => `${uid}-panel-${id}`

  /**
   * Arrow-key roving focus. Both axes are handled because the same tablist is
   * a vertical rail at `sm` and a horizontal strip below it — there is no
   * single orientation to declare.
   */
  const handleTabKeyDown = (e) => {
    const i = SECTIONS.findIndex(s => s.id === section)
    let next = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % SECTIONS.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + SECTIONS.length) % SECTIONS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = SECTIONS.length - 1
    if (next === null) return
    e.preventDefault()
    const id = SECTIONS[next].id
    setSection(id)
    tabRefs.current[id]?.focus()
  }

  const handleThemeImport = () => {
    try {
      const data = JSON.parse(themeImportText)
      if (!data.id || !data.label || !data.tokens) throw new Error('Invalid format')
      addCustomTheme(data)
      setThemeImportText('')
      setThemeSyncMsg('THEME IMPORTED!')
      msgTimer.current = setTimeout(() => setThemeSyncMsg(''), 3000)
    } catch (e) {
      setThemeSyncMsg(e.message || 'INVALID THEME JSON.')
      msgTimer.current = setTimeout(() => setThemeSyncMsg(''), 4000)
    }
  }

  const handleCopyPrompt = () => {
    const prompt = `Generate a valid Cadence Theme JSON object following this exact schema:
{
  "id": "theme-unique-id",
  "label": "DISPLAY NAME",
  "effects": ["glow", "crt-scanlines"], // Optional array of effects
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

Allowed effects are: "crt-scanlines", "grid-background", "hazard-border", "chamfer", "glow", "hud-flicker", "status-pulse", "hex-labels", "force-uppercase".

Please output ONLY the raw JSON format without markdown wrapping or codeblocks.`

    navigator.clipboard.writeText(prompt).then(() => {
      setThemeSyncMsg('PROMPT COPIED!')
      msgTimer.current = setTimeout(() => setThemeSyncMsg(''), 3000)
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
      setDataSyncErr(false)
      setDataSyncMsg('BACKUP DOWNLOADED.')
      msgTimer.current = setTimeout(() => setDataSyncMsg(''), 3000)
    } catch {
      setDataSyncErr(true)
      setDataSyncMsg('DOWNLOAD FAILED.')
      msgTimer.current = setTimeout(() => setDataSyncMsg(''), 3000)
    }
  }

  const handleRestoreBackup = (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        setDataSyncErr(false)
        setDataSyncMsg('RESTORING…')
        // Awaited so the cloud push completes before the reload kills it.
        await API.importAllData(JSON.parse(ev.target.result))
        window.location.reload()
      } catch (err) {
        // Surface the real reason ("Unsupported backup version", "Semester 2
        // has no id", …) instead of a blanket INVALID BACKUP FILE.
        setDataSyncErr(true)
        setDataSyncMsg(String(err?.message || 'INVALID BACKUP FILE.').toUpperCase())
        msgTimer.current = setTimeout(() => setDataSyncMsg(''), 4000)
      } finally {
        input.value = '' // let the same file be picked again
      }
    }
    reader.onerror = () => {
      setDataSyncErr(true)
      setDataSyncMsg('COULD NOT READ FILE.')
      msgTimer.current = setTimeout(() => setDataSyncMsg(''), 4000)
      input.value = ''
    }
    reader.readAsText(file)
  }

  const themeImportBlocked = customThemes.length >= 5
  const canImport = Boolean(themeImportText) && !themeImportBlocked

  return (
    <Modal variant="page" title="SYSTEM SETTINGS" hex="0xS001" onClose={onClose}>
      <div className="flex flex-col sm:flex-row min-h-full">

        {/* Section navigation — horizontal strip below `sm`, rail above it.
            Sticky either way: on a phone the strip is what tells you which of
            five sections you are in once the pane has scrolled. */}
        <div
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={handleTabKeyDown}
          className="flex sm:flex-col gap-1 p-2 shrink-0 overflow-x-auto sm:overflow-visible
                     w-full sm:w-40 sticky top-0 z-10 self-start
                     border-b sm:border-b-0 sm:border-r"
          // The divider sits under the strip and beside the rail; only the width
          // flips per breakpoint, so the colour can stay a single declaration.
          style={{ background: 'var(--cad-bg-panel)', borderColor: 'var(--cad-border-dim)' }}
        >
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              ref={el => { tabRefs.current[s.id] = el }}
              id={tabId(s.id)}
              role="tab"
              aria-selected={section === s.id}
              // Only the selected panel is mounted, so pointing an inactive tab
              // at it would be a dangling reference.
              aria-controls={section === s.id ? panelId(s.id) : undefined}
              tabIndex={section === s.id ? 0 : -1}
              onClick={() => setSection(s.id)}
              className="cad-chip btn-mech shrink-0 sm:w-full whitespace-nowrap"
              data-active={section === s.id || undefined}
              style={{ padding: '10px 12px', textAlign: 'left' }}
            >{s.label}</button>
          ))}
        </div>

        {/* Content pane */}
        <div
          key={section}
          id={panelId(section)}
          role="tabpanel"
          aria-labelledby={tabId(section)}
          tabIndex={0}
          // Width-capped: the pane is ~700px on a desktop, and a two-column
          // theme grid stretched across all of it reads as broken, not spacious.
          className="anim-tab-enter flex-1 min-w-0 max-w-xl p-3 sm:p-4"
        >
          <h2 className="cad-label" style={headingStyle}>
            {SECTIONS.find(s => s.id === section)?.label}
          </h2>

          {section === 'preferences' && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer p-2 panel-chamfer-sm transition-colors" style={checkboxRowStyle}>
                <input type="checkbox" checked={settings.showLocation} onChange={e => updateSettings({ showLocation: e.target.checked })} style={checkboxStyle} />
                SHOW ROOM / LOCATION INPUT
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 panel-chamfer-sm transition-colors" style={checkboxRowStyle}>
                <input type="checkbox" checked={settings.holidays2nd4thSat} onChange={e => updateSettings({ holidays2nd4thSat: e.target.checked })} style={checkboxStyle} />
                ENABLE 2ND/4TH SATURDAY HOLIDAYS
              </label>
              <label
                className="flex items-center gap-3 cursor-pointer p-2 panel-chamfer-sm transition-colors"
                style={{ ...checkboxRowStyle, opacity: settings.themeMode === 'minimal' ? 0.5 : 1 }}
              >
                <input
                  type="checkbox"
                  disabled={settings.themeMode === 'minimal'}
                  checked={settings.themeMode !== 'minimal' && settings.enableGlitch}
                  onChange={e => updateSettings({ enableGlitch: e.target.checked })}
                  style={checkboxStyle}
                />
                ENABLE GLITCH EFFECTS
              </label>
            </div>
          )}

          {section === 'grading' && (
            <GradingSection semester={semester} onSetScheme={onSetScheme} />
          )}

          {section === 'themes' && (
            <div>
              {/* Built-in themes */}
              <div className="grid grid-cols-2 gap-2">
                {themes.filter(t => !customThemes.some(ct => ct.id === t.id)).map(t => (
                  <ThemeButton key={t.id} active={currentTheme.id === t.id} onClick={() => setTheme(t.id)} className="py-2">
                    {t.label}
                  </ThemeButton>
                ))}
              </div>

              {/* Custom themes */}
              {customThemes.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="cad-label" style={{ marginBottom: '2px' }}>
                    CUSTOM — {customThemes.length}/5 SLOTS USED
                  </div>
                  {customThemes.map(t => (
                    <div key={t.id} className="flex items-center gap-1.5">
                      <ThemeButton
                        active={currentTheme.id === t.id}
                        onClick={() => setTheme(t.id)}
                        className="flex-1 py-1.5 min-w-0"
                        style={{ textAlign: 'left', paddingLeft: '10px', letterSpacing: 'var(--cad-track-mid)' }}
                      >
                        {t.label}
                      </ThemeButton>
                      <button
                        type="button"
                        onClick={() => removeCustomTheme(t.id)}
                        className="btn-mech panel-chamfer-sm"
                        style={{
                          fontFamily: 'var(--cad-font-mono)',
                          fontSize:   'var(--cad-fs-xs)',
                          width:      '28px',
                          height:     '28px',
                          border:     '1px solid var(--cad-border)',
                          color:      'var(--cad-danger)',
                          background: 'transparent',
                          flexShrink: 0,
                        }}
                        title={`Delete theme ${t.label}`}
                        aria-label={`Delete theme ${t.label}`}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {currentTheme.id === 'minimal' && (
                <div className="flex gap-2 mt-2">
                  {['light', 'dark'].map(mode => (
                    <ThemeButton key={mode} active={settings.themeMode === mode} onClick={() => updateSettings({ themeMode: mode })} className="flex-1 py-1.5">
                      MODE: {mode.toUpperCase()}
                    </ThemeButton>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <label className="cad-label" htmlFor={`${uid}-theme-json`}>CUSTOM THEME JSON</label>
                <input
                  id={`${uid}-theme-json`}
                  value={themeImportText}
                  onChange={e => setThemeImportText(e.target.value)}
                  placeholder="PASTE CUSTOM THEME JSON"
                  disabled={themeImportBlocked}
                  className="cad-input panel-chamfer-sm"
                  style={{
                    color:  themeImportBlocked ? 'var(--cad-text-lo)' : 'var(--cad-text-hi)',
                    cursor: themeImportBlocked ? 'not-allowed' : 'text',
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleThemeImport}
                    disabled={!canImport}
                    className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                    style={{
                      fontFamily:    'var(--cad-font-mono)',
                      fontSize:      'var(--cad-fs-micro)',
                      letterSpacing: 'var(--cad-track-wide)',
                      border:        canImport ? '1px solid var(--cad-accent)' : '1px solid var(--cad-border-dim)',
                      color:         canImport ? 'var(--cad-accent-text)' : 'var(--cad-text-lo)',
                      background:    canImport ? 'var(--cad-accent-dim)' : 'transparent',
                      cursor:        canImport ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {themeImportBlocked ? 'LIMIT REACHED' : 'IMPORT THEME'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex-1 py-1.5 btn-mech panel-chamfer-sm"
                    style={{
                      fontFamily:    'var(--cad-font-mono)',
                      fontSize:      'var(--cad-fs-micro)',
                      letterSpacing: 'var(--cad-track-wide)',
                      border:        '1px solid var(--cad-border)',
                      color:         'var(--cad-text-mid)',
                      background:    'var(--cad-bg-elevated)',
                    }}
                  >COPY AI PROMPT</button>
                </div>
                {themeSyncMsg && (
                  <div
                    role="status"
                    className="text-center mt-1"
                    style={{
                      fontFamily: 'var(--cad-font-mono)',
                      fontSize:   'var(--cad-fs-micro)',
                      color:      themeSyncMsg.includes('INVALID') || themeSyncMsg.includes('MAX') || themeSyncMsg.includes('UNSAFE') ? 'var(--cad-danger)' : 'var(--cad-success)',
                    }}
                  >
                    {themeSyncMsg}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'data' && (
            <div>
              <p style={{ ...helpTextStyle, marginBottom: '8px' }}>
                Backup and restore your entire Cadence dataset as a single .json file. Restoring will overwrite all existing data.
              </p>
              <div className="flex mb-2">
                <SyncChip className="flex-1 py-2" style={{ fontSize: 'var(--cad-fs-micro)' }} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex-1 py-2 btn-mech panel-chamfer-sm"
                  style={{
                    fontFamily:    'var(--cad-font-mono)',
                    fontSize:      'var(--cad-fs-micro)',
                    letterSpacing: 'var(--cad-track-wide)',
                    border:        '1px solid var(--cad-accent)',
                    color:         'var(--cad-accent-text)',
                    background:    'transparent',
                  }}
                >DOWNLOAD BACKUP</button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 btn-mech panel-chamfer-sm"
                  style={{
                    fontFamily:    'var(--cad-font-mono)',
                    fontSize:      'var(--cad-fs-micro)',
                    letterSpacing: 'var(--cad-track-wide)',
                    border:        '1px solid var(--cad-danger)',
                    color:         'var(--cad-danger)',
                    background:    'transparent',
                  }}
                >RESTORE BACKUP</button>
                <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" aria-label="Restore backup file" />
              </div>
              {dataSyncMsg && (
                <div
                  role="status"
                  className="text-center mt-2"
                  style={{
                    fontFamily: 'var(--cad-font-mono)',
                    fontSize:   'var(--cad-fs-xs)',
                    color:      dataSyncErr ? 'var(--cad-danger)' : 'var(--cad-success)',
                  }}
                >
                  {dataSyncMsg}
                </div>
              )}
            </div>
          )}

          {section === 'about' && (
            <a
              href="https://github.com/Errnolink"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 panel-chamfer-sm inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
              style={{
                fontFamily:     'var(--cad-font-mono)',
                fontSize:       'var(--cad-fs-micro)',
                letterSpacing:  'var(--cad-track-mid)',
                border:         '1px solid var(--cad-border)',
                color:          'var(--cad-text-mid)',
                background:     'var(--cad-bg-elevated)',
                textDecoration: 'none',
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              GITHUB PROFILE
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}
