const TABS = [
  { id: 'roster',    icon: '☰', label: 'ROSTER'    },
  { id: 'timetable', icon: '⊞', label: 'TIMETABLE' },
  { id: 'calendar',  icon: '◫', label: 'CALENDAR'  },
]

export function MobileTabBar({ activeTab, onTabChange }) {
  return (
    <div
      className="flex shrink-0 md:hidden"
      style={{ borderTop: '2px solid var(--cad-accent)', background: 'var(--cad-bg-header)' }}
    >
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all"
          style={{
            color:      activeTab === t.id ? 'var(--cad-accent)'   : 'var(--cad-text-lo)',
            background: activeTab === t.id ? 'var(--cad-accent-dim)' : 'transparent',
          }}
        >
          <span className="text-base leading-none">{t.icon}</span>
          <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '7px', letterSpacing: '0.15em' }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
