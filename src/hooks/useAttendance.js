import { useState, useEffect } from 'react'
import { API } from '../data/api.js'
import { ATTENDANCE_THRESHOLD } from '../data/constants.js'

export function useAttendance() {
  const [attendance, setAttendance] = useState(() => API.getAttendance({}))

  useEffect(() => {
    API.saveAttendance(attendance)
  }, [attendance])

  const markAttendance = (dateStr, entryId, status) => {
    setAttendance(prev => {
      const dayData = prev[dateStr] || {}
      return {
        ...prev,
        [dateStr]: {
          ...dayData,
          [entryId]: status, // 'PRESENT', 'ABSENT', 'CANCELLED'
        }
      }
    })
  }

  // Calculate subject stats across all days
  const getSubjectStats = (subjectId, timetable) => {
    let present = 0
    let absent = 0
    let cancelled = 0
    let total = 0
    
    // Find all timetable entries that belong to this subject
    const subjectEntryIds = timetable.filter(t => t.subjectId === subjectId).map(t => t.id)
    
    Object.values(attendance).forEach(dayData => {
      subjectEntryIds.forEach(id => {
        if (dayData[id] === 'PRESENT') {
          present++
          total++
        } else if (dayData[id] === 'ABSENT') {
          absent++
          total++
        } else if (dayData[id] === 'CANCELLED') {
          cancelled++
        }
      })
    })

    return { 
      present, 
      absent,
      cancelled,
      total, 
      percentage: total === 0 ? 100 : Math.round((present / total) * 100) 
    }
  }

  // Calculate overall stats
  const getOverallStats = (subjects, timetable) => {
    let present = 0, absent = 0, cancelled = 0, total = 0
    
    subjects.forEach(subj => {
      const stats = getSubjectStats(subj.id, timetable)
      present += stats.present
      absent += stats.absent
      cancelled += stats.cancelled
      total += stats.total
    })

    return {
      present, absent, cancelled, total,
      percentage: total === 0 ? 100 : Math.round((present / total) * 100)
    }
  }

  const getMarginToThreshold = (present, total, threshold = ATTENDANCE_THRESHOLD) => {
    // How many more classes can be missed while staying >= threshold
    if (total === 0) return Infinity
    // Solve: present / (total + x) >= threshold  →  x <= present/threshold - total
    return Math.max(0, Math.floor(present / threshold - total))
  }

  const getRecoveryPath = (present, total, threshold = ATTENDANCE_THRESHOLD) => {
    // How many consecutive classes must be attended to reach threshold
    if (total === 0) return 0
    const currentPct = present / total
    if (currentPct >= threshold) return 0
    // Solve: (present + x) / (total + x) >= threshold  →  x >= (threshold*total - present) / (1 - threshold)
    return Math.ceil((threshold * total - present) / (1 - threshold))
  }

  const getStatusTier = (percentage) => {
    if (percentage < 75) return 'critical'
    if (percentage < 85) return 'watch'
    return 'safe'
  }

  return { attendance, markAttendance, getSubjectStats, getOverallStats, getMarginToThreshold, getRecoveryPath, getStatusTier }
}
