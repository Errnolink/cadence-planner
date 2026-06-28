import { useState, useCallback } from 'react'
import { useSemesters } from './hooks/useSemesters.js'
import { Dot } from './components/ui/Dot.jsx'
import { ControlBar }   from './components/layout/ControlBar.jsx'
import { MobileTabBar } from './components/layout/MobileTabBar.jsx'
import { SubjectRoster } from './components/roster/SubjectRoster.jsx'
import { TimetableGrid } from './components/timetable/TimetableGrid.jsx'
import { TimetableModal } from './components/timetable/TimetableModal.jsx'
import { SettingsModal } from './components/layout/SettingsModal.jsx'
import { CalendarView }  from './components/calendar/CalendarView.jsx'

export default function App() {
  const {
    semesters, setSemesters, activeSemId, activeSem,
    setActiveSemId,
    addSubject, updateSubject, removeSubject,
    saveTimetableEntry, deleteTimetableEntry,
  } = useSemesters()

  const [editMode,  setEditMode]  = useState(false)
  const [ttModal,   setTtModal]   = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('timetable')

  const handleSemChange = id => { setActiveSemId(id); setTtModal(null) }
  const toggleEdit      = ()  => { setEditMode(e => !e); setTtModal(null) }

  const handleSave = useCallback(entry => {
    saveTimetableEntry(entry)
    setTtModal(null)
  }, [saveTimetableEntry])

  const handleDelete = useCallback(id => {
    deleteTimetableEntry(id)
    setTtModal(null)
  }, [deleteTimetableEntry])

  const totalCr = activeSem?.subjects.reduce((a, s) => a + (parseFloat(s.credits) || 0), 0).toFixed(1) ?? '0.0'

  return (
    <div
      className="theme-bg flex flex-col h-[100dvh] overflow-hidden"
      style={{ background: 'var(--cad-bg-primary)' }}
    >
      <ControlBar
        semesters={semesters}
        activeSemId={activeSemId}
        onSemChange={handleSemChange}
        editMode={editMode}
        onToggleEdit={toggleEdit}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Status strip — hidden on very small screens */}
      <div
        className="hidden sm:flex items-center px-3 py-0.5 shrink-0"
        style={{ borderBottom: '1px solid var(--cad-border-dim)', background: 'var(--cad-bg-panel)' }}
      >
        <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-text-lo)', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeSem?.label} ∥ {totalCr} CR ∥ {activeSem?.subjects.length ?? 0} SUBJ ∥ {editMode ? 'MODE :: EDIT' : 'MODE :: VIEW'}
        </span>
        {editMode && <span style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '9px', color: 'var(--cad-danger)', marginLeft: '8px', flexShrink: 0 }} className="blink">■</span>}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Roster */}
        <div
          className={`flex-col border-r-2 shrink-0 overflow-hidden
            ${activeTab === 'roster' ? 'flex w-full' : 'hidden'}
            md:flex md:w-72`}
          style={{
            borderRightColor: 'var(--cad-border-panel)',
            background:       'var(--cad-bg-panel)',
            padding:          '10px 8px',
          }}
        >
          <div className="flex items-center justify-between mb-2 pb-1.5 shrink-0" style={{ borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div className="flex items-center gap-1.5">
              <Dot on />
              <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-accent)', fontFamily: 'var(--cad-font-mono)' }}>ROSTER</span>
            </div>
            <span className="hex-val">0xA001</span>
          </div>
          <SubjectRoster
            sem={activeSem}
            semesters={semesters}
            editMode={editMode}
            onAddSubject={addSubject}
            onUpdate={updateSubject}
            onRemove={removeSubject}
          />
        </div>

        {/* Right — Timetable / Calendar */}
        <div
          className={`flex-col flex-1 overflow-hidden
            ${activeTab !== 'roster' ? 'flex' : 'hidden'}
            md:flex`}
          style={{ background: 'var(--cad-bg-primary)', padding: '8px 8px 6px' }}
        >
          {/* Panel header + tab switcher */}
          <div className="flex items-center justify-between mb-2 pb-1.5 shrink-0" style={{ borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div className="flex items-center gap-1.5">
              <Dot on />
              <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cad-accent)', fontFamily: 'var(--cad-font-mono)' }}>PANEL-B</span>
            </div>
            <div className="flex gap-1">
              {['timetable', 'calendar'].map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-2 py-0.5 btn-mech"
                  style={{
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     '8px',
                    letterSpacing:'0.15em',
                    textTransform:'uppercase',
                    border:       activeTab === tab ? '1px solid var(--cad-accent)'  : '1px solid var(--cad-border)',
                    color:        activeTab === tab ? 'var(--cad-accent-text)'        : 'var(--cad-text-lo)',
                    background:   activeTab === tab ? 'var(--cad-accent-dim)'         : 'transparent',
                    borderRadius: 'var(--cad-radius)',
                  }}
                >{tab.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {activeTab === 'calendar' ? (
            <CalendarView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} />
          ) : (
            <TimetableGrid
              subjects={activeSem?.subjects ?? []}
              timetable={activeSem?.timetable ?? []}
              editMode={editMode}
              onCellClick={(day, startTime, endTime) => setTtModal({ mode: 'add', initialData: { day, startTime, endTime } })}
              onBlockClick={entry => setTtModal({ mode: 'edit', initialData: entry })}
            />
          )}
        </div>
      </div>

      {/* Mobile tab bar */}
      <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Timetable modal */}
      {ttModal && (
        <TimetableModal
          mode={ttModal.mode}
          initialData={ttModal.initialData}
          subjects={activeSem?.subjects ?? []}
          timetable={activeSem?.timetable ?? []}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setTtModal(null)}
        />
      )}

      {showSettings && (
        <SettingsModal 
          semesters={semesters} 
          setSemesters={setSemesters} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  )
}
