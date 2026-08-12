#!/usr/bin/env node
/**
 * WCAG contrast guard for the Cadence theme tokens.
 *
 * Parses the custom properties straight out of the theme CSS (no build step,
 * no duplicated palette in JS), composites every translucent value over the
 * surface it actually renders on, and fails the process if any text/background
 * pair the app really uses drops below AA (4.5:1).
 *
 * This exists because U1 shipped a subject palette measuring 1.17:1 on the
 * minimal light theme and nothing in the pipeline noticed.
 *
 *   node scripts/check-contrast.mjs          # table + exit 1 on failure
 *   node scripts/check-contrast.mjs --quiet  # only failures
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AA = 4.5

const FILES = {
  subjects: 'src/themes/_subjects.css',
  nerv: 'src/themes/nerv/tokens.css',
  minimal: 'src/themes/minimal/tokens.css',
}

// ─── CSS parsing ────────────────────────────────────────────────────────────

/** → Map<selector, Map<customProperty, rawValue>> */
function parseBlocks(css) {
  const out = new Map()
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(stripped)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    const decls = out.get(selector) ?? new Map()
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);?/g
    let d
    while ((d = declRe.exec(m[2])) !== null) decls.set(d[1], d[2].trim())
    out.set(selector, decls)
  }
  return out
}

const read = (rel) => parseBlocks(readFileSync(resolve(ROOT, rel), 'utf8'))
const blocks = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, read(v)]))

function pick(fileKey, selector) {
  const b = blocks[fileKey].get(selector)
  if (!b) {
    console.error(`✗ selector not found in ${FILES[fileKey]}: ${selector}`)
    process.exit(2)
  }
  return b
}

const merge = (...maps) => {
  const out = new Map()
  for (const m of maps) for (const [k, v] of m) out.set(k, v)
  return out
}

// ─── Colour maths ───────────────────────────────────────────────────────────

/** "#rgb" | "#rrggbb" | "rgb(a)(...)" → { r, g, b, a } with 0-255 channels */
function parseColor(raw) {
  const v = String(raw).trim()
  let m = /^#([0-9a-f]{3,8})$/i.exec(v)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    }
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v)
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  return null
}

/** Source-over composite of `fg` (may be translucent) onto opaque `bg`. */
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
})

const channel = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

function contrast(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

// ─── Theme assembly ─────────────────────────────────────────────────────────
// Each theme is the flattened cascade a browser would produce for that
// <html> attribute combination, including the subject palette.

const subjDark = pick('subjects', ':root')
const subjLight = pick('subjects', ':root[data-theme="minimal"]:not([data-mode="dark"])')
const nerv = pick('nerv', ':root[data-theme="nerv"]')
const minLight = pick('minimal', ':root[data-theme="minimal"]')
const minDark = pick('minimal', ':root[data-theme="minimal"][data-mode="dark"]')

const THEMES = [
  { name: 'nerv', tokens: merge(subjDark, nerv) },
  { name: 'minimal-light', tokens: merge(subjDark, subjLight, minLight) },
  { name: 'minimal-dark', tokens: merge(subjDark, minLight, minDark) },
]

// ─── Usage matrix ───────────────────────────────────────────────────────────
// Only pairs that exist in the UI. Each entry lists the surfaces a text token
// is actually painted on; the cited file:line is where to look if it fails.

/** Opaque surfaces text is drawn on. */
const SURFACES = ['--cad-bg-primary', '--cad-bg-panel', '--cad-bg-header', '--cad-bg-elevated', '--cad-bg-input']

const TEXT_USAGE = [
  // token                surfaces        where
  ['--cad-text-hi', SURFACES, 'body copy, inputs'],
  ['--cad-text-mid', SURFACES, 'secondary labels, day headers'],
  ['--cad-text-lo', SURFACES, 'micro labels, roster column heads, quick-mark bar'],
  ['--cad-text-xlo', ['--cad-bg-primary', '--cad-bg-panel'], 'exam section counts, calendar weekday heads'],
  ['--cad-accent', SURFACES, 'panel titles, accent glyphs'],
  ['--cad-accent-text', SURFACES, 'active chips, semester label'],
  ['--cad-danger', SURFACES, 'holiday badges, delete affordances'],
  ['--cad-success', SURFACES, 'PRESENT marks, grade tier, GPA badge'],
  ['--cad-hex-color', ['--cad-bg-panel', '--cad-bg-header', '--cad-bg-input'], 'hex-val labels (opt-in fx)'],
]

const SUBJECT_SURFACES = ['--cad-bg-primary', '--cad-bg-panel']

// ─── Run ────────────────────────────────────────────────────────────────────

const quiet = process.argv.includes('--quiet')
const rows = []

function check(theme, fgToken, bgToken, note, { fgOver } = {}) {
  const rawFg = theme.tokens.get(fgToken)
  const rawBg = theme.tokens.get(bgToken)
  if (rawFg === undefined || rawBg === undefined) return
  const fg = parseColor(rawFg)
  let bg = parseColor(rawBg)
  if (!fg || !bg) return
  // Subject tints are translucent: composite them onto the page surface first.
  const baseName = fgOver ? `${bgToken} on ${fgOver.token}` : bgToken
  if (fgOver) {
    const base = parseColor(theme.tokens.get(fgOver.token))
    bg = over(bg, base)
  }
  rows.push({
    theme: theme.name,
    fg: fgToken,
    bg: baseName,
    ratio: contrast(over(fg, bg), bg),
    note,
  })
}

for (const theme of THEMES) {
  for (const [token, surfaces, note] of TEXT_USAGE) {
    for (const surface of surfaces) check(theme, token, surface, note)
  }
  // Subject accents: --subj-N-text over --subj-N-bg composited on the page.
  for (let i = 0; i < 12; i++) {
    for (const surface of SUBJECT_SURFACES) {
      check(theme, `--subj-${i}-text`, `--subj-${i}-bg`, 'subject block / chip / roster row', {
        fgOver: { token: surface },
      })
    }
  }
}

const failures = rows.filter(r => r.ratio < AA)

const pad = (s, n) => String(s).padEnd(n)
const w = {
  theme: Math.max(5, ...rows.map(r => r.theme.length)),
  fg: Math.max(10, ...rows.map(r => r.fg.length)),
  bg: Math.max(10, ...rows.map(r => r.bg.length)),
}

if (!quiet) {
  console.log(`\nWCAG AA (${AA}:1) — ${rows.length} token pairs\n`)
  console.log(`${pad('THEME', w.theme)}  ${pad('TEXT', w.fg)}  ${pad('SURFACE', w.bg)}  RATIO   `)
  console.log('─'.repeat(w.theme + w.fg + w.bg + 16))
  let lastTheme = null
  for (const r of rows) {
    if (lastTheme && lastTheme !== r.theme) console.log('')
    lastTheme = r.theme
    console.log(
      `${pad(r.theme, w.theme)}  ${pad(r.fg, w.fg)}  ${pad(r.bg, w.bg)}  ` +
      `${r.ratio.toFixed(2).padStart(5)}:1  ${r.ratio >= AA ? 'PASS' : 'FAIL'}`
    )
  }
}

console.log('')
if (failures.length) {
  console.log(`✗ ${failures.length}/${rows.length} pairs below AA:\n`)
  for (const f of failures) {
    console.log(`  ${f.theme}  ${f.fg} on ${f.bg}  ${f.ratio.toFixed(2)}:1  — ${f.note}`)
  }
  console.log('')
  process.exit(1)
}
console.log(`✓ all ${rows.length} token pairs meet WCAG AA (${AA}:1)\n`)
