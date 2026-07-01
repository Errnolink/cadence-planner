import { useState, useEffect } from 'react'
import { pad2 } from '../../data/index.js'
import { useTheme } from '../../themes/ThemeContext.jsx'
import { SemDropdown } from './SemDropdown.jsx'

export function ControlBar({ semesters, activeSemId, onSemChange, onRemoveSem, editMode, onToggleEdit, onAddSem, onOpenSettings }) {
  const [now, setNow] = useState(new Date())
  const { currentTheme, cycleTheme, themes } = useTheme()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const nextTheme = themes[(themes.findIndex(t => t.id === currentTheme.id) + 1) % themes.length]

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 hud-flicker"
      style={{
        borderBottom: '2px solid var(--cad-accent)',
        background:   'var(--cad-bg-header)',
        boxShadow:    '0 2px 20px var(--cad-accent-glow)',
        zIndex:       50,
      }}
    >
      {/* Logo — hidden on very small screens */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2 py-1 panel-chamfer-sm shrink-0"
        style={{
          border:    '1px solid var(--cad-accent)',
          background:'var(--cad-accent-dim)',
          boxShadow: 'var(--cad-shadow-glow)',
        }}
      >
        <span
          className="glow-accent"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-accent)', letterSpacing: '0.2em' }}
        >CADENCE</span>
      </div>

      <SemDropdown
        semesters={semesters}
        activeSemId={activeSemId}
        onChange={onSemChange}
        onRemove={onRemoveSem}
        onAdd={onAddSem}
        editMode={editMode}
      />
      <div className="flex-1" />

      {/* Settings toggle */}
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 px-2.5 py-1.5 panel-chamfer-sm btn-mech"
        style={{
          border:       '1px solid var(--cad-border)',
          color:        'var(--cad-text-mid)',
          background:   'transparent',
          fontFamily:   'var(--cad-font-mono)',
          fontSize:     '9px',
          letterSpacing:'0.15em',
          borderRadius: 'var(--cad-radius)',
          transition:   'all 0.15s',
        }}
      >
        <span style={{ fontSize: '11px' }}>⚙</span>
        <span>SETTINGS</span>
      </button>

      {/* Edit toggle */}
      <button
        onClick={onToggleEdit}
        className="flex items-center gap-1.5 px-2.5 py-1.5 panel-chamfer-sm btn-mech"
        style={{
          border:       editMode ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
          color:        editMode ? 'var(--cad-danger)'           : 'var(--cad-text-mid)',
          background:   editMode ? 'var(--cad-danger-dim)'       : 'transparent',
          fontFamily:   'var(--cad-font-mono)',
          fontSize:     '9px',
          letterSpacing:'0.15em',
          borderRadius: 'var(--cad-radius)',
          transition:   'all 0.15s',
        }}
      >
        <span style={{ fontSize: '11px' }}>{editMode ? '⊠' : '✎'}</span>
        <span>{editMode ? 'LOCK' : 'EDIT'}</span>
      </button>

      {/* Clock — HH:MM:SS on desktop, HH:MM on mobile */}
      <div className="text-right shrink-0">
        <div
          className="glow-accent"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '11px', color: 'var(--cad-accent)', letterSpacing: '0.1em' }}
        >
          <span className="hidden sm:inline">{pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}</span>
          <span className="sm:hidden">{pad2(now.getHours())}:{pad2(now.getMinutes())}</span>
        </div>
        <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '8px', color: 'var(--cad-text-lo)' }}>
          {now.getFullYear()}.{pad2(now.getMonth() + 1)}.{pad2(now.getDate())}
        </div>
      </div>
    </div>
  )
}
