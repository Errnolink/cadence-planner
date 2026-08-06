import { useState, useEffect, useCallback, useRef } from 'react'
import { API } from '../data/api.js'
import { ATTENDANCE_THRESHOLD } from '../data/constants.js'

const EMPTY_EXAM_DATES = new Set()

export function useAttendance() {
  const [attendance, setAttendance] = useState(() => API.getAttendance({}))

  useEffect(() => {
    const handleSync = () => {
      setAttendance(API.getAttendance({}))
    }
    window.addEventListener('cadence-data-updated', handleSync)
    return () => window.removeEventListener('cadence-data-updated', handleSync)
  }, [])

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const currentLocal = API.getAttendance(null)
    if (JSON.stringify(currentLocal) === JSON.stringify(attendance)) return
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

  const markDayAttendance = (dateStr, entryIds, status) => {
    setAttendance(prev => {
      const dayData = { ...(prev[dateStr] || {}) }
      entryIds.forEach(id => {
        dayData[id] = status // 'PRESENT' or 'ABSENT'
      })
      return {
        ...prev,
        [dateStr]: dayData
      }
    })
  }

  const toggleHoliday = (dateStr) => {
    setAttendance(prev => {
      const dayData = prev[dateStr] || {}
      return {
        ...prev,
        [dateStr]: {
          ...dayData,
          isHoliday: !dayData.isHoliday
        }
      }
    })
  }

  const setNote = (dateStr, entryId, note) => {
    setAttendance(prev => {
      const dayData = prev[dateStr] || {}
      return {
        ...prev,
        [dateStr]: {
          ...dayData,
          [`${entryId}_note`]: note,
        }
      }
    })
  }

  const setSubstitute = (dateStr, entryId, substituteSubjectId) => {
    setAttendance(prev => {
      const dayData = prev[dateStr] || {}
      const updated = { ...dayData }
      if (substituteSubjectId) {
        updated[`${entryId}_sub`] = substituteSubjectId
      } else {
        delete updated[`${entryId}_sub`]
      }
      return { ...prev, [dateStr]: updated }
    })
  }

  const setExamDayPresent = (dateStr, value) => {
    setAttendance(prev => {
      const dayData = { ...(prev[dateStr] || {}) }
      if (value) dayData.examCountAsPresent = true
      else delete dayData.examCountAsPresent
      return { ...prev, [dateStr]: dayData }
    })
  }

  // Calculate subject stats across all days
  // Accounts for substitutes: if entry X has a sub pointing to subjectId, count that attendance toward subjectId
  // Exam days (dates in examDates): skipped by default (classes don't occur). If the user opted the day
  // in via "count as present", that day's scheduled classes are credited as PRESENT instead.
  const getSubjectStats = useCallback((subjectId, timetable, examDates = EMPTY_EXAM_DATES) => {
    let present = 0
    let absent = 0
    let cancelled = 0
    let total = 0
    
    const subjectEntryIds = timetable.filter(t => t.subjectId === subjectId).map(t => t.id)
    const allEntryIds = timetable.map(t => t.id)
    
    Object.entries(attendance).forEach(([dateStr, dayData]) => {
      if (dayData.isHoliday) return

      const isExamDay = examDates.has(dateStr)
      if (isExamDay && dayData.examCountAsPresent !== true) return
      const examAsPresent = isExamDay

      // Count entries that originally belong to this subject (and aren't substituted away)
      subjectEntryIds.forEach(id => {
        if (dayData[`${id}_sub`]) return // substituted away, don't count here
        if (examAsPresent) { present++; total++; return }
        if (dayData[id] === 'PRESENT') { present++; total++ }
        else if (dayData[id] === 'ABSENT') { absent++; total++ }
        else if (dayData[id] === 'CANCELLED') { cancelled++ }
      })

      // Count entries substituted INTO this subject
      allEntryIds.forEach(id => {
        if (dayData[`${id}_sub`] !== subjectId) return
        if (examAsPresent) { present++; total++; return }
        if (dayData[id] === 'PRESENT') { present++; total++ }
        else if (dayData[id] === 'ABSENT') { absent++; total++ }
        else if (dayData[id] === 'CANCELLED') { cancelled++ }
      })
    })

    return { 
      present, 
      absent,
      cancelled,
      total, 
      percentage: total === 0 ? 100 : Math.round((present / total) * 100) 
    }
  }, [attendance])

  // Calculate overall stats
  const getOverallStats = useCallback((subjects, timetable, examDates = EMPTY_EXAM_DATES) => {
    let present = 0, absent = 0, cancelled = 0, total = 0
    
    subjects.forEach(subj => {
      const stats = getSubjectStats(subj.id, timetable, examDates)
      present += stats.present
      absent += stats.absent
      cancelled += stats.cancelled
      total += stats.total
    })

    return {
      present, absent, cancelled, total,
      percentage: total === 0 ? 100 : Math.round((present / total) * 100)
    }
  }, [getSubjectStats])

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
    if (percentage < ATTENDANCE_THRESHOLD * 100) return 'critical'
    if (percentage < (ATTENDANCE_THRESHOLD + 0.1) * 100) return 'watch'
    return 'safe'
  }

  return { attendance, markAttendance, markDayAttendance, toggleHoliday, setNote, setSubstitute, setExamDayPresent, getSubjectStats, getOverallStats, getMarginToThreshold, getRecoveryPath, getStatusTier }
}
