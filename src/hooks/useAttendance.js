import { useState, useEffect } from 'react'
import { API } from '../data/api.js'

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
    let total = 0
    
    // Find all timetable entries that belong to this subject
    const subjectEntryIds = timetable.filter(t => t.subjectId === subjectId).map(t => t.id)
    
    Object.values(attendance).forEach(dayData => {
      subjectEntryIds.forEach(id => {
        if (dayData[id] === 'PRESENT') {
          present++
          total++
        } else if (dayData[id] === 'ABSENT') {
          total++
        }
        // CANCELLED doesn't count towards total
      })
    })

    return { 
      present, 
      total, 
      percentage: total === 0 ? 100 : Math.round((present / total) * 100) 
    }
  }

  // Calculate overall stats
  const getOverallStats = (subjects, timetable) => {
    let present = 0
    let total = 0
    
    subjects.forEach(subj => {
      const stats = getSubjectStats(subj.id, timetable)
      present += stats.present
      total += stats.total
    })

    return {
      present,
      total,
      percentage: total === 0 ? 100 : Math.round((present / total) * 100)
    }
  }

  return { attendance, markAttendance, getSubjectStats, getOverallStats }
}
