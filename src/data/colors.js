// Subject color palettes — theme-agnostic (border/bg/text are always explicit colors
// so the timetable blocks stay vibrant regardless of the active UI theme)
export const SUBJECT_COLORS = [
  { id: 0,  name: 'ORANGE', bg: 'rgba(249,115,22,0.22)',  border: '#f97316', text: '#fb923c' },
  { id: 1,  name: 'RED',    bg: 'rgba(239,68,68,0.22)',   border: '#ef4444', text: '#f87171' },
  { id: 2,  name: 'GREEN',  bg: 'rgba(34,197,94,0.22)',   border: '#22c55e', text: '#4ade80' },
  { id: 3,  name: 'BLUE',   bg: 'rgba(59,130,246,0.22)',  border: '#3b82f6', text: '#60a5fa' },
  { id: 4,  name: 'AMBER',  bg: 'rgba(245,158,11,0.22)',  border: '#f59e0b', text: '#fcd34d' },
  { id: 5,  name: 'TEAL',   bg: 'rgba(20,184,166,0.22)',  border: '#14b8a6', text: '#2dd4bf' },
  { id: 6,  name: 'PINK',   bg: 'rgba(236,72,153,0.22)',  border: '#ec4899', text: '#f472b6' },
  { id: 7,  name: 'PURPLE', bg: 'rgba(168,85,247,0.22)',  border: '#a855f7', text: '#c084fc' },
  { id: 8,  name: 'INDIGO', bg: 'rgba(99,102,241,0.24)',  border: '#6366f1', text: '#818cf8' },
  { id: 9,  name: 'CYAN',   bg: 'rgba(6,182,212,0.22)',   border: '#06b6d4', text: '#22d3ee' },
  { id: 10, name: 'LIME',   bg: 'rgba(132,204,22,0.22)',  border: '#84cc16', text: '#a3e635' },
  { id: 11, name: 'ROSE',   bg: 'rgba(244,63,94,0.22)',   border: '#f43f5e', text: '#fb7185' },
]

// Legacy alias kept for any code that still imports NERV_COLORS
export const NERV_COLORS = SUBJECT_COLORS
