import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSemesters } from './hooks/useSemesters.js'
import { useAttendance } from './hooks/useAttendance.js'
import { PANEL_TABS } from './data/index.js'
import { classBlockingDates } from './data/grading.js'
import { Dot } from './components/ui/Dot.jsx'
import { SyncChip } from './components/ui/SyncChip.jsx'
import { ControlBar }   from './components/layout/ControlBar.jsx'
import { MobileTabBar } from './components/layout/MobileTabBar.jsx'
import { SubjectRoster } from './components/roster/SubjectRoster.jsx'
import { TimetableGrid } from './components/timetable/TimetableGrid.jsx'
import { TimetableModal } from './components/timetable/TimetableModal.jsx'
import { ClassInstanceModal } from './components/timetable/ClassInstanceModal.jsx'
import { SettingsPage } from './components/layout/SettingsPage.jsx'
import { CalendarView }  from './components/calendar/CalendarView.jsx'
import { AttendanceView } from './components/attendance/AttendanceView.jsx'
import { ExamsView } from './components/exams/ExamsView.jsx'
import { ClassifiedPanel } from './components/layout/ClassifiedPanel.jsx'

const EMPTY_ASSESSMENTS = []

// Konami code (↑↑↓↓←→←→BA) — opens the CLASSIFIED OPERATIONS panel
const KONAMI_SEQ = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a']

export default function App() {
  const {
    semesters, setSemesters, activeSemId, activeSem,
    setActiveSemId, addSemester, updateSem, removeSemester,
    addSubject, updateSubject, removeSubject,
    saveTimetableEntry, deleteTimetableEntry,
    addSitting, updateAssessment, setAssessmentScore, removeAssessment, removeSitting,
    setGradingScheme, setSubjectScheme,
  } = useSemesters()


  const attendanceHook = useAttendance()

  const [editMode,  setEditMode]  = useState(false)
  const [ttModal,   setTtModal]   = useState(null)
  const [instanceModal, setInstanceModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('timetable')
  const [showClassified, setShowClassified] = useState(false)

  const konamiIdx = useRef(0)
  const secretTaps = useRef(0)
  const secretTimer = useRef(null)

  // Mobile trigger: 5 quick taps on the CADENCE logo
  const handleSecretTap = useCallback(() => {
    secretTaps.current += 1
    clearTimeout(secretTimer.current)
    secretTimer.current = setTimeout(() => { secretTaps.current = 0 }, 1500)
    if (secretTaps.current >= 5) {
      secretTaps.current = 0
      setShowClassified(true)
    }
  }, [])

  useEffect(() => () => clearTimeout(secretTimer.current), [])

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

  // Dates where teaching is suspended, used to skip those days in attendance.
  // Only assessments flagged blocksClasses count: a sit-down paper replaces
  // the day's classes, an assignment deadline does not. Deriving this from
  // every dated assessment would let an assignment silently cancel a day of
  // teaching and move the attendance percentage.
  // Memoized: `?? []` allocates a fresh array whenever a semester has no
  // assessments, which would defeat both useMemos below on every render.
  const assessments = useMemo(() => activeSem?.assessments ?? EMPTY_ASSESSMENTS, [activeSem])
  const examDates = useMemo(() => classBlockingDates(assessments), [assessments])

  // Sit-down papers only — the grid draws these as exam blocks.
  const scheduledExams = useMemo(
    () => assessments.filter(a => a.blocksClasses && a.date),
    [assessments])

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
        onSecretTap={handleSecretTap}
      />

      {/* Status strip — visible at every breakpoint. It used to be hidden below
          `sm`, so on mobile the only signal that edit mode was on was a button
          that is easy to miss — while edit mode changes what tapping a class
          block does. The mobile variant drops the credit counts, not the mode. */}
      <div
        className="flex items-center px-3 py-0.5 shrink-0"
        style={{
          borderBottom: editMode ? '1px solid var(--cad-danger)' : '1px solid var(--cad-border-dim)',
          background: 'var(--cad-bg-panel)',
        }}
      >
        <span
          role="status"
          style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: editMode ? 'var(--cad-danger)' : 'var(--cad-text-lo)', letterSpacing: 'var(--cad-track-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span className="hidden sm:inline">
            {activeSem?.label} <span aria-hidden="true">∥</span> {totalCr} CR{' '}
            <span aria-hidden="true">∥</span> {activeSem?.subjects.length ?? 0} SUBJ{' '}
            <span aria-hidden="true">∥</span>{' '}
          </span>
          {editMode ? 'MODE :: EDIT' : 'MODE :: VIEW'}
        </span>
        {editMode && <span aria-hidden="true" style={{ fontFamily: 'var(--cad-font-mono)', fontSize: 'var(--cad-fs-micro)', color: 'var(--cad-danger)', marginLeft: '8px', flexShrink: 0 }} className="blink">■</span>}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Roster */}
        <aside
          id="roster-panel"
          aria-label="Subject roster"
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
              <h2 className="cad-label" style={{ color: 'var(--cad-accent)' }}>ROSTER</h2>
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
        </aside>

        {/* Right — Timetable / Calendar */}
        <main
          className={`flex-col flex-1 overflow-hidden
            ${activeTab !== 'roster' ? 'flex' : 'hidden'}
            md:flex`}
          style={{ background: 'var(--cad-bg-primary)', padding: '8px 8px 6px' }}
        >
          {/* Panel header + tab switcher */}
          <div className="flex items-center justify-between mb-2 pb-1.5 shrink-0" style={{ borderBottom: '1px solid var(--cad-border-dim)' }}>
            <div className="flex items-center gap-1.5">
              <Dot on />
              <h2 className="cad-label" style={{ color: 'var(--cad-accent)' }}>PANEL-B</h2>
              <SyncChip />
            </div>
            <nav aria-label="Panel views" className="hidden md:block">
              <div role="tablist" className="flex gap-1">
                {PANEL_TABS.map(tab => (
                  <button key={tab.id}
                    type="button"
                    id={`tab-${tab.id}`}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls="panel-view"
                    onClick={() => setActiveTab(tab.id)}
                    className="cad-chip btn-mech"
                    data-active={activeTab === tab.id || undefined}
                  >{tab.label}</button>
                ))}
              </div>
            </nav>
          </div>

          <div
            key={activeTab}
            id="panel-view"
            role="tabpanel"
            aria-labelledby={activeTab === 'roster' ? undefined : `tab-${activeTab}`}
            className="anim-tab-enter flex flex-col flex-1 overflow-hidden min-h-0"
          >
            {activeTab === 'calendar' ? (
              <CalendarView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} examDates={examDates} semester={activeSem} />
            ) : activeTab === 'attendance' ? (
              <AttendanceView timetable={activeSem?.timetable ?? []} subjects={activeSem?.subjects ?? []} attendanceHook={attendanceHook} examDates={examDates} semester={activeSem} />
            ) : activeTab === 'exams' ? (
              <ExamsView
                subjects={activeSem?.subjects ?? []}
                semester={activeSem}
                assessments={assessments}
                editMode={editMode}
                onAddSitting={addSitting}
                onUpdateAssessment={updateAssessment}
                onSetScore={setAssessmentScore}
                onRemoveAssessment={removeAssessment}
                onRemoveSitting={removeSitting}
                onSetScheme={setGradingScheme}
                onSetSubjectScheme={setSubjectScheme}
                onUpdateSubject={updateSubject}
              />
            ) : (
              <TimetableGrid
                subjects={activeSem?.subjects ?? []}
                timetable={activeSem?.timetable ?? []}
                exams={scheduledExams}
                editMode={editMode}
                attendanceHook={attendanceHook}
                examDates={examDates}
                semester={activeSem}
                onCellClick={(day, startTime, endTime) => setTtModal({ mode: 'add', initialData: { day, startTime, endTime } })}
                onBlockClick={(entry) => setTtModal({ mode: 'edit', initialData: entry })}
                onInstanceClick={(entry, dateStr) => setInstanceModal({ entry, dateStr })}
              />
            )}
          </div>
        </main>
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
        <SettingsPage
          semester={activeSem}
          onSetScheme={setGradingScheme}
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
