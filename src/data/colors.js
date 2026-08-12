// Subject color palette.
//
// The actual colour VALUES live in src/themes/_subjects.css as
// --subj-N-{bg,border,text} custom properties, so each theme can pick shades
// that are legible on its own surfaces. (The old hard-coded dark palette
// measured 1.17:1 – 2.16:1 on the minimal light theme — all twelve failed AA.)
//
// This module keeps the names (for the ColorPicker) and the palette size,
// and exposes subjectVars() to bind a colorIdx to the theme's tokens.

export const SUBJECT_COLORS = [
  { id: 0,  name: 'ORANGE' },
  { id: 1,  name: 'RED'    },
  { id: 2,  name: 'GREEN'  },
  { id: 3,  name: 'BLUE'   },
  { id: 4,  name: 'AMBER'  },
  { id: 5,  name: 'TEAL'   },
  { id: 6,  name: 'PINK'   },
  { id: 7,  name: 'PURPLE' },
  { id: 8,  name: 'INDIGO' },
  { id: 9,  name: 'CYAN'   },
  { id: 10, name: 'LIME'   },
  { id: 11, name: 'ROSE'   },
]

/** Normalize any colorIdx (incl. negative / out-of-range) into 0..11 */
export const subjectIdx = (colorIdx) => {
  const n = Number(colorIdx)
  if (!Number.isFinite(n)) return 0
  return ((Math.trunc(n) % SUBJECT_COLORS.length) + SUBJECT_COLORS.length) % SUBJECT_COLORS.length
}

/**
 * Style fragment binding one subject's accent to the active theme.
 * Spread into a style prop, then reference var(--subj-text|bg|border) inside.
 *
 *   <div style={{ ...subjectVars(s.colorIdx), color: 'var(--subj-text)' }}>
 */
export const subjectVars = (colorIdx) => {
  const i = subjectIdx(colorIdx)
  return {
    '--subj-bg':     `var(--subj-${i}-bg)`,
    '--subj-border': `var(--subj-${i}-border)`,
    '--subj-text':   `var(--subj-${i}-text)`,
  }
}

/** Raw token references, for the rare spot that needs one channel only. */
export const subjectVar = (colorIdx, channel) => `var(--subj-${subjectIdx(colorIdx)}-${channel})`
