import { PANEL_TABS } from '../../data/index.js'

const TAB_ICONS = { timetable: '⊞', exams: '✎', calendar: '◫', attendance: '✓' }
const TABS = [
  { id: 'roster', icon: '☰', label: 'ROSTER' },
  ...PANEL_TABS.map(t => ({ ...t, icon: TAB_ICONS[t.id] })),
]

export function MobileTabBar({ activeTab, onTabChange }) {
  return (
    // aria-current="page" is for navigation links; a tab set uses
    // role="tab" + aria-selected, which is what assistive tech announces
    // as "tab, 2 of 5, selected".
    <nav
      aria-label="Views"
      className="shrink-0 md:hidden"
      style={{ borderTop: '2px solid var(--cad-accent)', background: 'var(--cad-bg-header)' }}
    >
      <div role="tablist" className="flex">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            id={`mtab-${t.id}`}
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={t.id === 'roster' ? 'roster-panel' : 'panel-view'}
            onClick={() => onTabChange(t.id)}
            className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors"
            style={{
              color:      activeTab === t.id ? 'var(--cad-accent)'   : 'var(--cad-text-lo)',
              background: activeTab === t.id ? 'var(--cad-accent-dim)' : 'transparent',
            }}
          >
            <span aria-hidden="true" className="text-base leading-none">{t.icon}</span>
            <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', letterSpacing: 'var(--cad-track-wide)' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
