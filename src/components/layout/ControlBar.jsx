import { useState, useEffect } from 'react'
import { pad2 } from '../../data/index.js'
import { useTheme } from '../../themes/ThemeContext.jsx'
import { SemDropdown } from './SemDropdown.jsx'

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="text-right shrink-0">
      <div
        className="glow-accent"
        style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-sm)', color: 'var(--cad-accent)', letterSpacing: 'var(--cad-track-mid)' }}
      >
        <span className="hidden sm:inline">{pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}</span>
        <span className="sm:hidden">{pad2(now.getHours())}:{pad2(now.getMinutes())}</span>
      </div>
      <div style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-text-lo)' }}>
        {now.getFullYear()}.{pad2(now.getMonth() + 1)}.{pad2(now.getDate())}
      </div>
    </div>
  )
}

/**
 * Shared control-bar button — accent variant for the theme switch,
 * danger (active) variant for the edit toggle.
 */
function HudButton({ onClick, title, variant = 'plain', active = false, pressed, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      // min-w/h 40px below sm: these collapse to icon-only on a phone, and a
      // 34x32 icon button is below any usable tap target.
      className="flex items-center justify-center gap-1.5 shrink-0 min-w-[40px] min-h-[40px]
                 px-2 sm:px-2.5 py-1.5 sm:min-w-0 sm:min-h-0 panel-chamfer-sm btn-mech"
      style={{
        border:       active ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border)',
        color:        active ? 'var(--cad-danger)' : variant === 'accent' ? 'var(--cad-accent-text)' : 'var(--cad-text-mid)',
        background:   active ? 'var(--cad-danger-dim)' : variant === 'accent' ? 'var(--cad-accent-dim)' : 'transparent',
        fontFamily:   'var(--cad-font-mono)',
        fontSize:     'var(--cad-fs-xs)',
        letterSpacing:'var(--cad-track-wide)',
        borderRadius: 'var(--cad-radius)',
        transition:   'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export function ControlBar({ semesters, activeSemId, onSemChange, onRemoveSem, editMode, onToggleEdit, onAddSem, onOpenSettings, onSecretTap }) {
  const { currentTheme, cycleTheme } = useTheme()

  return (
    <header
      className="flex items-center gap-2 px-3 py-2 shrink-0 hud-flicker"
      style={{
        // Edit mode is a modal state that changes what tapping a block does;
        // tint the whole bar so it is unmissable at every breakpoint (U8).
        borderBottom: `2px solid ${editMode ? 'var(--cad-danger)' : 'var(--cad-accent)'}`,
        background:   'var(--cad-bg-header)',
        boxShadow:    '0 2px 20px var(--cad-accent-glow)',
        zIndex:       50,
      }}
    >
      {/* Logo — also the mobile easter-egg target (tap 5×) */}
      <div
        onClick={onSecretTap}
        className="flex items-center gap-1.5 px-2 py-1 panel-chamfer-sm shrink-0"
        style={{
          border:    '1px solid var(--cad-accent)',
          background:'var(--cad-accent-dim)',
          boxShadow: 'var(--cad-shadow-glow)',
          cursor:    'pointer',
        }}
      >
        <h1
          className="glow-accent"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-accent)', letterSpacing: '0.2em' }}
        >CADENCE</h1>
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

      {/* Theme cycle — instant switch, keeps NERV as the default active theme */}
      <HudButton
        onClick={cycleTheme}
        title={`Switch theme (currently: ${currentTheme.label})`}
        variant="accent"
      >
        <span aria-hidden="true" style={{ fontSize: 'var(--cad-fs-sm)' }}>◈</span>
        <span className="hidden sm:inline" style={{ textTransform: 'uppercase' }}>{currentTheme.label}</span>
        <span className="sr-only sm:hidden">Theme</span>
      </HudButton>

      {/* Settings toggle — icon-only below sm */}
      <HudButton onClick={onOpenSettings} title="Settings">
        <span aria-hidden="true" style={{ fontSize: 'var(--cad-fs-sm)' }}>⚙</span>
        <span className="hidden sm:inline">SETTINGS</span>
        <span className="sr-only sm:hidden">Settings</span>
      </HudButton>

      {/* Edit toggle — icon-only below sm. This used to sit at x=450 on a
          390px screen, i.e. entirely off-screen, which made edit mode
          unreachable on a phone and with it every add/delete in the app. */}
      <HudButton
        onClick={onToggleEdit}
        active={editMode}
        pressed={editMode}
        title={editMode ? 'Lock (leave edit mode)' : 'Edit'}
      >
        <span aria-hidden="true" style={{ fontSize: 'var(--cad-fs-sm)' }}>{editMode ? '⊠' : '✎'}</span>
        <span className="hidden sm:inline">{editMode ? 'LOCK' : 'EDIT'}</span>
        <span className="sr-only sm:hidden">{editMode ? 'Lock, leave edit mode' : 'Edit'}</span>
      </HudButton>

      {/* Clock — desktop only. A phone already shows the time in its own
          status bar, and this was the widest thing pushing EDIT off-screen. */}
      <div className="hidden sm:block">
        <Clock />
      </div>
    </header>
  )
}
