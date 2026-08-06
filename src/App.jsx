import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSemesters } from './hooks/useSemesters.js'
import { useAttendance } from './hooks/useAttendance.js'
import { PANEL_TABS } from './data/index.js'
import { Dot } from './components/ui/Dot.jsx'
import { SyncChip } from './components/ui/SyncChip.jsx'
import { ControlBar }   from './components/layout/ControlBar.jsx'
import { MobileTabBar } from './components/layout/MobileTabBar.jsx'
import { SubjectRoster } from './components/roster/SubjectRoster.jsx'
import { TimetableGrid } from './components/timetable/TimetableGrid.jsx'
import { TimetableModal } from './components/timetable/TimetableModal.jsx'
import { ClassInstanceModal } from './components/timetable/ClassInstanceModal.jsx'
import { SettingsModal } from './components/layout/SettingsModal.jsx'
import { CalendarView }  from './components/calendar/CalendarView.jsx'
import { AttendanceView } from './components/attendance/AttendanceView.jsx'
import { ExamsView } from './components/exams/ExamsView.jsx'
import { ClassifiedPanel } from './components/layout/ClassifiedPanel.jsx'

// Konami code (↑↑↓↓←→←→BA) — opens the CLASSIFIED OPERATIONS panel
const KONAMI_SEQ = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a']

export default function App() {
  const {
    semesters, setSemesters, activeSemId, activeSem,
    setActiveSemId, addSemester, updateSem, removeSemester,
    addSubject, updateSubject, removeSubject,
    saveTimetableEntry, deleteTimetableEntry,
    addExam, updateExam, removeExam,
  } = useSemesters()


  const attendanceHook = useAttendance()

  const [editMode,  setEditMode]  = useState(false)
  const [ttModal,   setTtModal]   = useState(null)
  const [instanceModal, setInstanceModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('timetable')
  const [showClassified, setShowClassified] = useState(false)

  const konamiIdx = useRef(0)

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      if (key === KONAMI_SEQ[konamiIdx.current]) {
        konamiIdx.current += 1
        if (konamiIdx.current === KONAMI_SEQ.length) {
          konamiIdx.current = 0
          setShowClassified(true)
        }
      } else {
        konamiIdx.current = key === KONAMI_SEQ[0] ? 1 : 0
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSemChange = id => { setActiveSemId(id); setTtModal(null) }
  const toggleEdit      = ()  => { 
    setEditMode(e => !e)
    setTtModal(null)
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

  // Exam dates for the active semester — used to treat exam days as "no classes" in attendance
  const examDates = useMemo(() => new Set((activeSem?.exams ?? []).map(e => e.date)), [activeSem])

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
              <SyncChip />
            </div>
            <div className="hidden md:flex gap-1">
              {PANEL_TABS.map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-2 py-0.5 btn-mech"
                  style={{
                    fontFamily:   'var(--cad-font-mono)',
                    fontSize:     '8px',
                    letterSpacing:'0.15em',
                    textTransform:'uppercase',
                    border:       activeTab === tab.id ? '1px solid var(--cad-accent)'  : '1px solid var(--cad-border)',
                    color:        activeTab === tab.id ? 'var(--cad-accent-text)'        : 'var(--cad-text-lo)',
                    background:   activeTab === tab.id ? 'var(--cad-accent-dim)'         : 'transparent',
                    borderRadius: 'var(--cad-radius)',
                  }}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          <div key={activeTab} className="anim-tab-enter flex flex-col flex-1 overflow-hidden min-h-0">
            {activeTab === 'calendar' ? (
              <CalendarView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} examDates={examDates} />
            ) : activeTab === 'attendance' ? (
              <AttendanceView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} examDates={examDates} />
            ) : activeTab === 'exams' ? (
              <ExamsView
                exams={activeSem?.exams ?? []}
                subjects={activeSem?.subjects ?? []}
                editMode={editMode}
                onAdd={addExam}
                onUpdate={updateExam}
                onRemove={removeExam}
              />
            ) : (
              <TimetableGrid
                subjects={activeSem?.subjects ?? []}
                timetable={activeSem?.timetable ?? []}
                exams={activeSem?.exams ?? []}
                editMode={editMode}
                attendanceHook={attendanceHook}
                examDates={examDates}
                onCellClick={(day, startTime, endTime) => setTtModal({ mode: 'add', initialData: { day, startTime, endTime } })}
                onBlockClick={(entry) => setTtModal({ mode: 'edit', initialData: entry })}
                onInstanceClick={(entry, dateStr) => setInstanceModal({ entry, dateStr })}
              />
            )}
          </div>
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

      {/* Class Instance modal */}
      {instanceModal && (
        <ClassInstanceModal
          entry={instanceModal.entry}
          dateStr={instanceModal.dateStr}
          subjects={activeSem?.subjects ?? []}
          attendanceHook={attendanceHook}
          onClose={() => setInstanceModal(null)}
        />
      )}

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
        />
      )}

      {showClassified && (
        <ClassifiedPanel
          semesters={semesters}
          onPurge={setSemesters}
          onClose={() => setShowClassified(false)}
        />
      )}
    </div>
  )
}
