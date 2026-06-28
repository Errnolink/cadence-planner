// Timetable entries use { startTime: "HH:MM", endTime: "HH:MM" }
export const INITIAL_SEMESTERS = [
  {
    id: 1, label: 'SEM 01',
    subjects: [
      { id: 1, name: 'MATHEMATICS III',      credits: 4,   colorIdx: 0, gradePoint: 8  },
      { id: 2, name: 'DATA STRUCTURES',      credits: 3,   colorIdx: 1, gradePoint: 9  },
      { id: 3, name: 'DIGITAL CIRCUITS',     credits: 3,   colorIdx: 2, gradePoint: 7  },
      { id: 4, name: 'PHYSICS LAB',          credits: 1.5, colorIdx: 3, gradePoint: 10 },
      { id: 5, name: 'COMMUNICATION SKILLS', credits: 2,   colorIdx: 4, gradePoint: null },
    ],
    timetable: [
      { id: 1, subjectId: 1, day: 'MON', startTime: '08:00', endTime: '10:00', room: '' },
      { id: 2, subjectId: 2, day: 'MON', startTime: '11:00', endTime: '12:00', room: '' },
      { id: 3, subjectId: 3, day: 'TUE', startTime: '09:00', endTime: '10:00', room: '' },
      { id: 4, subjectId: 1, day: 'WED', startTime: '10:00', endTime: '12:00', room: '' },
      { id: 5, subjectId: 4, day: 'WED', startTime: '14:00', endTime: '16:00', room: '' },
      { id: 6, subjectId: 2, day: 'THU', startTime: '08:00', endTime: '09:00', room: '' },
      { id: 7, subjectId: 5, day: 'THU', startTime: '13:00', endTime: '14:00', room: '' },
      { id: 8, subjectId: 3, day: 'FRI', startTime: '09:00', endTime: '11:00', room: '' },
      { id: 9, subjectId: 5, day: 'FRI', startTime: '14:00', endTime: '15:00', room: '' },
    ],
  },
  {
    id: 2, label: 'SEM 02',
    subjects: [
      { id: 10, name: 'ALGORITHMS',        credits: 4, colorIdx: 0, gradePoint: null },
      { id: 11, name: 'DATABASE SYSTEMS',  credits: 3, colorIdx: 5, gradePoint: null },
      { id: 12, name: 'OPERATING SYSTEMS', credits: 3, colorIdx: 2, gradePoint: null },
      { id: 13, name: 'NETWORKS',          credits: 3, colorIdx: 3, gradePoint: null },
      { id: 14, name: 'DISCRETE MATH',     credits: 2, colorIdx: 6, gradePoint: null },
    ],
    timetable: [
      { id: 10, subjectId: 10, day: 'MON', startTime: '09:00', endTime: '11:00', room: ''  },
      { id: 11, subjectId: 11, day: 'TUE', startTime: '08:00', endTime: '09:00', room: ''  },
      { id: 12, subjectId: 12, day: 'TUE', startTime: '11:00', endTime: '13:00', room: ''  },
      { id: 13, subjectId: 13, day: 'WED', startTime: '10:00', endTime: '11:00', room: '' },
      { id: 14, subjectId: 10, day: 'THU', startTime: '08:00', endTime: '10:00', room: ''  },
      { id: 15, subjectId: 14, day: 'THU', startTime: '14:00', endTime: '15:00', room: ''  },
      { id: 16, subjectId: 11, day: 'FRI', startTime: '09:00', endTime: '11:00', room: ''  },
      { id: 17, subjectId: 12, day: 'FRI', startTime: '13:00', endTime: '14:00', room: ''  },
    ],
  },
  {
    id: 3, label: 'SEM 03',
    subjects: [
      { id: 20, name: 'MACHINE LEARNING', credits: 4, colorIdx: 7, gradePoint: null },
      { id: 21, name: 'COMPUTER VISION',  credits: 3, colorIdx: 0, gradePoint: null },
      { id: 22, name: 'CLOUD COMPUTING',  credits: 3, colorIdx: 5, gradePoint: null },
      { id: 23, name: 'COMPILER DESIGN',  credits: 3, colorIdx: 1, gradePoint: null },
      { id: 24, name: 'MINI PROJECT',     credits: 2, colorIdx: 2, gradePoint: null },
    ],
    timetable: [
      { id: 20, subjectId: 20, day: 'MON', startTime: '10:00', endTime: '12:00', room: '' },
      { id: 21, subjectId: 21, day: 'TUE', startTime: '09:00', endTime: '11:00', room: '' },
      { id: 22, subjectId: 22, day: 'WED', startTime: '08:00', endTime: '09:00', room: '' },
      { id: 23, subjectId: 23, day: 'WED', startTime: '13:00', endTime: '15:00', room: '' },
      { id: 24, subjectId: 24, day: 'THU', startTime: '14:00', endTime: '16:00', room: '' },
      { id: 25, subjectId: 20, day: 'FRI', startTime: '10:00', endTime: '12:00', room: '' },
      { id: 26, subjectId: 22, day: 'FRI', startTime: '14:00', endTime: '15:00', room: '' },
    ],
  },
]
