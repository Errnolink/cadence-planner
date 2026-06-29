import { useState, useCallback, useEffect } from 'react'
import { useSemesters } from './hooks/useSemesters.js'
import { useAttendance } from './hooks/useAttendance.js'
import { Dot } from './components/ui/Dot.jsx'
import { ControlBar }   from './components/layout/ControlBar.jsx'
import { MobileTabBar } from './components/layout/MobileTabBar.jsx'
import { SubjectRoster } from './components/roster/SubjectRoster.jsx'
import { TimetableGrid } from './components/timetable/TimetableGrid.jsx'
import { TimetableModal } from './components/timetable/TimetableModal.jsx'
import { SettingsModal } from './components/layout/SettingsModal.jsx'
import { CalendarView }  from './components/calendar/CalendarView.jsx'
import { AttendanceView } from './components/attendance/AttendanceView.jsx'

export default function App() {
  const {
    semesters, setSemesters, activeSemId, activeSem,
    setActiveSemId, addSemester, updateSem, removeSemester,
    addSubject, updateSubject, removeSubject,
    saveTimetableEntry, deleteTimetableEntry, clearAllLocations,
  } = useSemesters()


  const attendanceHook = useAttendance()

  const [editMode,  setEditMode]  = useState(false)
  const [ttModal,   setTtModal]   = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('timetable')
  const [showSecretMenu, setShowSecretMenu] = useState(false)
  const [editClickCount, setEditClickCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState(null)

  // Sync Listener
  useEffect(() => {
    let timeout;
    const handleSync = (e) => {
      setSyncStatus(e.detail);
      if (e.detail === 'success' || e.detail === 'error') {
        clearTimeout(timeout);
        timeout = setTimeout(() => setSyncStatus(null), 2500);
      }
    };
    window.addEventListener('cadence-sync', handleSync);
    return () => {
      window.removeEventListener('cadence-sync', handleSync);
      clearTimeout(timeout);
    };
  }, []);

  // Konami Code Listener
  useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    let konamiIndex = 0

    const handleKeyDown = (e) => {
      if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++
        if (konamiIndex === konamiCode.length) {
          setShowSecretMenu(true)
          konamiIndex = 0
        }
      } else {
        konamiIndex = 0
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (editClickCount > 0) {
      const t = setTimeout(() => setEditClickCount(0), 1000)
      return () => clearTimeout(t)
    }
  }, [editClickCount])

  const handleSemChange = id => { setActiveSemId(id); setTtModal(null) }
  const toggleEdit      = ()  => { 
    setEditMode(e => !e)
    setTtModal(null)
    setEditClickCount(c => {
      const newCount = c + 1
      if (newCount >= 5) {
        setShowSecretMenu(true)
        return 0
      }
      return newCount
    })
  }

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
        onRemoveSem={removeSemester}
        editMode={editMode}
        onToggleEdit={toggleEdit}
        onAddSem={addSemester}
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
            onUpdateSem={updateSem}
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
              {syncStatus && (
                <span className={`ml-2 px-1.5 py-0.5 rounded ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`} style={{
                  fontFamily: 'var(--cad-font-mono)', fontSize: '7px', letterSpacing: '0.1em',
                  background: syncStatus === 'error' ? 'var(--cad-danger-dim)' : 'var(--cad-accent-dim)',
                  color: syncStatus === 'error' ? 'var(--cad-danger)' : 'var(--cad-accent)'
                }}>
                  {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'success' ? 'SYNCED' : 'SYNC FAILED'}
                </span>
              )}
            </div>
            <div className="hidden md:flex gap-1">
              {['timetable', 'calendar', 'attendance'].map(tab => (
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
            <CalendarView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} />
          ) : activeTab === 'attendance' ? (
            <AttendanceView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} />
          ) : (
            <TimetableGrid
              subjects={activeSem?.subjects ?? []}
              timetable={activeSem?.timetable ?? []}
              editMode={editMode}
              attendanceHook={attendanceHook}
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
          onClose={() => setShowSettings(false)} 
        />
      )}

      {showSecretMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-xs panel-chamfer overflow-hidden" style={{ border: '2px solid var(--cad-danger)', background: 'var(--cad-bg-panel)', boxShadow: '0 4px 30px var(--cad-danger)' }}>
            <div className="px-3 py-2 text-center" style={{ borderBottom: '1px solid var(--cad-danger)', background: 'var(--cad-danger-dim)' }}>
              <span className="blink" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--cad-danger)', fontWeight: 'bold' }}>CLASSIFIED OPERATIONS</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p style={{ fontFamily: 'var(--cad-font-mono)', fontSize: '10px', color: 'var(--cad-text-mid)', textAlign: 'center' }}>
                WARNING: THIS WILL CLEAR ALL ROOM LOCATIONS ACROSS ALL SEMESTERS.
              </p>
              <button
                onClick={() => { clearAllLocations(); setShowSecretMenu(false); }}
                className="w-full py-2 btn-mech"
                style={{
                  fontFamily: 'var(--cad-font-mono)', fontSize: '12px', letterSpacing: '0.1em',
                  border: '1px solid var(--cad-danger)', color: 'var(--cad-danger)', background: 'transparent'
                }}
              >PURGE ALL LOCATIONS</button>
              <button
                onClick={() => setShowSecretMenu(false)}
                className="w-full py-2 mt-2 btn-mech"
                style={{
                  fontFamily: 'var(--cad-font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                  border: '1px solid var(--cad-border)', color: 'var(--cad-text-lo)', background: 'transparent'
                }}
              >ABORT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
