# Cadence Planner — Optimisation Plan (`perf-upgrade`)

Audit date: 2026-08-05. Scope: YAGNI / performance / UI-UX, whole repo.
Findings were verified against source; every item cites `file:line`.

**Baseline (measured `npm run build`, before any change):**
- `dist/assets/index-*.js` — **519.34 kB** (gzip **140.88 kB**) — Vite warns >500 kB
- `dist/assets/index-*.css` — **19.77 kB** (gzip **5.40 kB**)
- App source is only ~150 kB total — the JS weight is `react-dom` + `supabase-js`, not app code.

---

## Phase 0 — Pre-flight

- [ ] Branch `perf-upgrade` (created) checked out
- [ ] `npm run build` → record baseline sizes above into this file
- [ ] `npm run lint` → record baseline (should be clean)

---

## Phase 1 — Deletions (zero-risk, ~-120 lines)

> **STATUS: DONE** — commit `3dd99cf`. JS 519.34 → 518.02 kB after this phase.

Do these first; each is independent and safe. Re-run `npm run build` after the phase and note the delta.

### 1.1 Dead `sourceRect` plumbing (end-to-end)
`Modal.jsx:6` accepts only `{ title, hex, onClose, children }` — it never reads `sourceRect`, yet it is threaded through three modals and computed with `getBoundingClientRect` in three views. Delete all of it.

- [ ] `src/components/timetable/ClassInstanceModal.jsx:5,32` — drop the destructure + forward
- [ ] `src/components/timetable/TimetableModal.jsx:7,77` — drop the destructure + forward
- [ ] `src/components/attendance/SubjectAttendanceModal.jsx:4,32` — drop the destructure + forward
- [ ] `src/components/attendance/AttendanceView.jsx:102,145` — drop the `getBoundingClientRect()` call + prop
- [ ] `src/components/calendar/CalendarView.jsx:54-55,294` — drop `const rect = ...` and `sourceRect` from the `setDetail` payload
- [ ] `src/components/timetable/TimetableGrid.jsx:386-389` — pass only `(entry)` / `(entry, dateStr)`; drop the rect computation

Verify: grep `sourceRect` → zero hits. Modals open/close normally.

### 1.2 Unused assets (grep-verified zero references)
- [ ] Delete `src/assets/vite.svg`, `src/assets/react.svg`, `src/assets/hero.png`
- [ ] Delete `public/icons.svg` (6-symbol social sprite, never referenced)

### 1.3 Broken favicon
- [ ] `index.html:5` — change `href="/vite.svg"` → `href="/favicon.svg"` (`public/favicon.svg` exists and is unused today)

Verify: `/favicon.svg` returns 200, no 404 in devtools.

### 1.4 Dead utils exports
`src/data/utils.js` exports `minsToTimeStr` (15-19), `timeFraction` (22-26), `dateToDayLabel` (51-54) — zero importers. They are reimplemented locally.
- [ ] Delete the three functions + stale comment on line 4
- [ ] Delete the now-unused `GRID_START_HOUR`/`GRID_END_HOUR` import on line 2 (only consumed by `timeFraction`)
- [ ] **Keep** the local copies in `TimetableGrid.jsx:11-19` (`pct`/`pctH`) and `CalendarView.jsx:9-13` (`dayLabel`) — do not churn working code

Verify: `npm run lint` + dev server boots; grid renders blocks at correct positions.

### 1.5 Tailwind config dead weight
The app styles via `--cad-*` CSS variables + inline styles; these Tailwind extensions have zero class usages.
- [ ] `tailwind.config.js:15-31` — delete `colors.nerv` block (all 15 classes unused)
- [ ] `tailwind.config.js:9-13` — delete `fontFamily` override (no `font-sans`/`font-mono` classes anywhere)
- [ ] `tailwind.config.js:33-47` — delete `animation` + `keyframes` block (`animate-pulse-slow`/`animate-blink`/`animate-scan` unused; app ships its own `.blink`)
- [ ] `src/index.css:10` — drop **Rajdhani** from the Google Fonts `@import` (unused; the tailwind `fontFamily` that referenced it is being deleted). Keep Share Tech Mono, Inter, IBM Plex Mono, Bebas Neue.

Verify: `npm run build` succeeds; `npm run lint` clean. No visual diff in dev.

### 1.6 Duplicate sync chip
App.jsx re-implements the sync-status feature that already exists as `SyncChip.jsx` (only used in `SettingsModal.jsx:289` today).
- [ ] Delete `syncStatus` state + listener in `App.jsx:42,45-59`
- [ ] Replace the inline chip markup `App.jsx:153-161` with `<SyncChip />` in the panel header
- [ ] Confirm `SyncChip.jsx` still renders in SettingsModal

Bonus: this also removes a whole-App re-render on every cloud push (see 2.3).

### 1.7 `useAuth` write-only `loading`
- [ ] `src/hooks/useAuth.jsx:11,25` — delete `loading` state + `setLoading(false)`, or gate the Auth screen on it. Only `session` is consumed (`Auth.jsx:7`).

### 1.8 `DAYS === WEEK_LABELS`
- [ ] `src/data/constants.js:6-7` — delete `WEEK_LABELS`; update its single consumer `CalendarView.jsx:138` to import `DAYS`

### 1.9 Duplicate constants / drift risks
- [ ] `src/hooks/useAttendance.js:186-190` — `getStatusTier` hardcodes 75/85; compare against `ATTENDANCE_THRESHOLD` and `ATTENDANCE_THRESHOLD + 0.1` instead
- [ ] `src/components/attendance/AttendanceView.jsx:121-128` — hardcoded `left: 75%` marker → `left: ${ATTENDANCE_THRESHOLD * 100}%`
- [ ] `src/data/api.js` — add `THEME: 'cadence-theme'` to the `KEYS` map (11-19); use `KEYS.THEME` at lines 65, 100, 177, 219, 223; pick one encoding for the theme key (raw) so sync doesn't store `"nerv"` with quotes

### 1.10 Dead branches
- [ ] `src/components/ui/Dot.jsx:1-9` — delete the `warn` prop branch (all callers pass only `<Dot on />`; App.jsx:125,151, Modal.jsx:51)
- [ ] `src/components/layout/SemDropdown.jsx:22-26` — `open ? 'var(--cad-accent-dim)' : 'var(--cad-accent-dim)'` → the constant
- [ ] `src/components/calendar/DayDetailModal.jsx:28,50` — delete unused `backdropRef` + `ref={backdropRef}`

### 1.11 Single-use wrappers
- [ ] `src/VercelAnalytics.jsx` — render `<Analytics />` and `<SpeedInsights />` directly in `main.jsx`; delete the file
- [ ] `src/App.jsx:16-20` — inline the `AnimatedTab` wrapper (one div): `<div key={activeTab} className="anim-tab-enter flex flex-col flex-1 overflow-hidden min-h-0">` at the call site (183); delete the component

---

## Phase 2 — Performance core

> **STATUS: DONE** — commit `60af971` (+ lint fix `ec6ada8`).

### 2.1 Per-keystroke full-app persistence (highest ROI)
`SubjectRow.jsx:38-44,58-63` → `onChange` calls `onUpdate` → `setSemesters` at App root re-renders every child, and `useSemesters.js:41-49` then `JSON.stringify`s + writes the whole tree — twice per keystroke (guard + `api.js:131-148`'s 2-3 `setItem`s incl. a redundant USER_ID rewrite at 134-138).

- [ ] `SubjectRow.jsx` — hold each field in local `useState`; commit via `onUpdate` on `onBlur` (and Enter). Inputs are disabled unless `editMode`, so the blur commit is safe.
- [ ] `src/data/api.js:134-138` — drop the redundant USER_ID rewrite in `set()` (only needed at login)

Verify: type in a subject name — no jank on a throttled CPU; DevTools Performance shows no synchronous `setItem` per keypress.

### 2.2 Double serialization in persistence guards
- [ ] `useSemesters.js:46-48`, `useAttendance.js:25-27`, `useSettings.jsx:32-35` — replace the read-back + `JSON.stringify` compare with a `lastSavedRef` (stringify once, compare strings) or a dirty flag. **Keep the guard itself** — it prevents pull-write-back loops; only cheapen it.

### 2.3 App-root syncStatus re-render
Covered by 1.6 — every debounced cloud push currently re-renders the whole App subtree for a chip hidden on mobile.

### 2.4 `crt-scroll` full-viewport repaint loop
`src/themes/nerv/styles.css:7-19` — `body::after` fixed overlay (`inset: 0`, `z-index: 9999`) animates `background-position` every frame (10s infinite) while `data-fx-crt-scanlines` is on. Single biggest paint cost in the app when enabled. Also ignores `prefers-reduced-motion`.
- [ ] Animate `transform: translateY` on a pseudo-element stretched to 200% height instead of `background-position`
- [ ] Gate the rule behind `@media (prefers-reduced-motion: no-preference)`

### 2.5 Fonts
- [ ] `src/index.css:10` — Rajdhani removal already in 1.5
- [ ] `index.html` `<head>` — add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`

### 2.6 Unmemoized hook object
- [ ] `src/hooks/useAttendance.js:192` — wrap `markAttendance`/`markDayAttendance`/`toggleHoliday`/`setNote`/`setSubstitute`/`setExamDayPresent`/stat fns in `useCallback`; `useMemo` the returned object keyed on attendance. Consumers get stable identities → enables memoization downstream.

### 2.7 View rebuilds (bounded by small data — do if convenient)
- [ ] `AttendanceView.jsx:23-31` — `useMemo` the `sortedSubjects` computation keyed on `[subjects, timetable, examDates, attendanceHook.attendance]`
- [ ] `SubjectAttendanceModal.jsx:9-23` — precompute `Map(id → entry)` once; drop the `timetable.find` inside the loop (O(entries × timetable) → O(n))
- [ ] `DayDetailModal.jsx:18-23` — `useMemo` the entries filter/sort + subjectMap on `[timetable, subjects, weekday]`
- [ ] Optional: extract the per-block quick-mark overlay in `TimetableGrid.jsx` (453-512) into a memoized child so one attendance mark doesn't rebuild the whole 7-column grid

### 2.8 Bundle (optional, after 2.1-2.2)
519 kB JS / 140.9 kB gzip is deps, not app code (`react-dom` + `supabase-js`).
- [ ] Lazy-load non-initial tab views (`calendar`, `attendance`, `exams`) with `React.lazy` — they render behind tabs anyway
- [ ] Or lazy-load `supabaseClient` only when authenticated
- [ ] Re-check `npm run build` — goal: clear the 500 kB warning

### 2.9 24-hour grid (optional)
- [ ] `src/data/constants.js:2-3` — bound `GRID_START_HOUR`/`GRID_END_HOUR` to the active timetable's actual min/max hours instead of 0-24 (16 absolute hour-lines/column today)

---

## Phase 3 — Theme correctness

> **STATUS: DONE** — commit `f7e4b82`.

### 3.1 Theme FOUC on every load (high)
`index.html:3` hardcodes `data-theme="nerv"`; `ThemeContext.jsx:102-122` applies the saved theme via `useEffect` **after** first paint — minimal/light users flash dark NERV on every reload. Same for `data-mode` (`useSettings.jsx:35-39`).
- [ ] Add a tiny inline `<script>` in `index.html` `<head>`: read `localStorage['cadence-theme']` → set `data-theme` (default `nerv`); read `localStorage['cadence-mode']` → set `data-mode` — **before** CSS paints
- [ ] Keep the existing `useEffect` as the post-mount sync (it already handles persistence); the inline script only needs to pre-set attributes
- [ ] Update `<meta name="theme-color">` (`index.html:7`, hardcoded `#0a0a0a`) when theme/themeMode changes — set it in ThemeContext's effect (light minimal → `#f8fafc` or similar)

### 3.2 White-on-white breaks minimal theme (high)
Hardcoded `rgba(255,255,255,…)` text/borders on light backgrounds → near-invisible.
- [ ] `DayDetailModal.jsx:237,250,257,282-283` — replace with `var(--cad-text-mid)` / `var(--cad-text-lo)` / `var(--cad-border)`
- [ ] `TimetableGrid.jsx:472-473,505` — same swap
- [ ] Grep for remaining `rgba(255,255,255` in components and swap any that sit on `var(--cad-bg-*)` surfaces

Verify: switch to minimal theme → modal text, borders, quick-mark buttons legible.

---

## Phase 4 — A11y baseline (all small)

> **STATUS: DONE** — commit `18fb18e`. (EventDetailModal item dropped: file does not exist in repo.)

### 4.1 Shared Modal a11y — one fix, 4 modals inherit
`src/components/ui/Modal.jsx:26-77`: no focus trap, no `role="dialog"`/`aria-modal`/`aria-labelledby`, no initial focus/restore, bare `✕` without accessible name, no body scroll lock. (Escape + backdrop close already work.)
- [ ] `role="dialog"` `aria-modal="true"` `aria-labelledby` on the panel (title span gets the id)
- [ ] `aria-label="Close"` on `✕` (62-68)
- [ ] Focus the panel on open; restore focus to the trigger on close; trap Tab within the panel
- [ ] Lock background scroll while open (`overflow: hidden` on `document.body` in the open effect)

### 4.2 Auth form
- [ ] `Auth.jsx:112-185` — wrap inputs+buttons in a real `<form onSubmit={handleLogin}>`; make buttons `type="submit"` (signup: separate form or second submit button)
- [ ] `Auth.jsx:33,51` — wrap `API.syncFromServer` in `try/catch` with `setError(...)` and `finally { setLoading(false) }` — a rejected sync currently leaves both buttons stuck on `'...'`
- [ ] `aria-label` on both inputs (placeholder-only labels today)

### 4.3 Focus visibility
- [ ] `src/index.css` — add global `:focus-visible { outline: 2px solid var(--cad-accent); outline-offset: 2px; }` (zero focus styles exist today)
- [ ] `ExamModal.jsx:10` — remove `outline: 'none'` from the input style object

### 4.4 Reduced motion
- [ ] Wrap `.blink` (`index.css:91`, flashing confirm-delete buttons), `status-pulse` (`nerv/styles.css:70-72`, `minimal/styles.css:21-23`), `hud-flicker` (`nerv/styles.css:65-67`), and `crt-scroll` (2.4) in `@media (prefers-reduced-motion: no-preference)` — or extend the existing reduce block at `index.css:262-277`

### 4.5 Contrast (med)
- [ ] `nerv/tokens.css:22-23` — brighten `text-lo` (#665a48, ~3:1) and `text-xlo` (#4D4436, ~2.4:1) to pass 4.5:1 (e.g. #8a7a5c / #6b5f4b)
- [ ] `minimal/tokens.css:22-23` — darken `text-lo` (#64748b, borderline) → #475569
- [ ] Raise the smallest 7-9px font sizes to ≥10px where they carry content (quick-mark buttons, micro-labels)

### 4.6 Calendar a11y + wheel hijack
- [ ] `CalendarView.jsx:162-230` — day cells: `role="gridcell"` + `tabIndex={0}` + Enter/Space handler
- [ ] `CalendarView.jsx:74-124` — `aria-label="Previous month"` / `"Next month"` on the ◀▶ buttons
- [ ] `CalendarView.jsx:59-67` — only hijack `onWheel` for month navigation when the grid isn't scrollable (`scrollHeight <= clientHeight`), and `preventDefault` with `{ passive: false }`

### 4.7 Substitute hint bug
- [ ] `ClassInstanceModal.jsx:121` — `s.id === currentSubId` fails for numeric seed ids vs string select values → renders `Substitute: undefined`. Use `String(s.id) === String(currentSubId)` (matches the `otherSubjects` filter at line 26)

### 4.8 Small UX fixes
- [ ] `TimetableGrid.jsx:451-513` + `DayDetailModal.jsx:263-300` — quick-mark buttons ≥28px hit area on coarse pointers (`@media (pointer: coarse)`)
- [ ] `ClassInstanceModal.jsx:15,154` — save the note on ANY close path (✕/backdrop/Escape) or show a dirty indicator when `currentNote !== note` — typing a note then closing via ✕ silently discards it today
- [ ] `SubjectRow.jsx:124-130` — `aria-label="Remove subject"` on the ✕
- [ ] `AttendanceView.jsx:39-61` — empty state for subject-less semester (`100% / PERFECT RECORD` is misleading); `// NO SUBJECTS — ADD ONE IN ROSTER` card
- [ ] `MobileTabBar.jsx:15-28` — `py-2.5` → `py-3` (~40px → ≥44px touch target), `aria-current="page"` on active tab, `transition-all` → `transition-colors`
- [ ] `SettingsModal.jsx` — 365 lines, 6 `setTimeout` message timers leak on unmount: clear them in a `useEffect` cleanup or collapse into one message-state + effect
- [ ] `ErrorBoundary.jsx:52-66` — remount children on recovery (reset counter as `key`) — persistent render errors loop-crash today; reuse theme vars in the fallback (23-51) instead of hardcoded dark colors

---

## Phase 5 — Consolidations (biggest diff, do last, on a separate commit)

> **STATUS: DONE** — commit `2df8036`.

- [ ] **`AttendanceToggle`** — PRESENT/ABSENT/CANCELLED segmented control with identical active-color mapping copy-pasted 3×: `ClassInstanceModal.jsx:60-89`, `DayDetailModal.jsx:263-300`, `TimetableGrid.jsx:453-512`. Extract one `<AttendanceToggle status onChange compact? />` (accept the active color vars as props or map inside)
- [ ] **`useModalDismiss`** — DayDetailModal's backdrop + Escape + 200ms closing animation + `anim-*` classes (`DayDetailModal.jsx:28-70`) duplicate `Modal.jsx:8-47` verbatim. Extract a shared hook (or a bottom-sheet variant of Modal)
- [ ] **FormModal shell** — `ExamModal.jsx` ≈ `TimetableModal.jsx` (form state / validate / error banner / confirmDelete 2.5s timeout / SAVE-DELETE-ABORT footer / subject-select + preview). Share a `useConfirmDelete()` hook at minimum; a FormModal shell if it stays clean
- [ ] **`HudButton`** — `ControlBar.jsx:68-123` has three near-identical ~15-line style objects; extract one local button component
- [ ] **`ThemeButton`** — `SettingsModal.jsx:138-160,172-192,201-215` — three copies of the same button style object for built-in/custom/minimal theme pickers
- [ ] **Shared TABS constant** — `App.jsx` desktop tab list vs `MobileTabBar.jsx:1-6` `TABS` (mobile adds 'roster') — export one constant, derive both

---

## Phase 6 — Verify (end of day)

> **STATUS: DONE** — final build: JS **519.33 kB** (gzip 141.47), CSS **20.04 kB** (gzip 5.51). JS ≈ baseline (consolidation offset a11y additions); CSS +0.27 kB from focus-visible + reduced-motion selectors. Lint clean (3 pre-existing fast-refresh warnings). Smoke (headless Edge via CDP): tabs switch, calendar keyboard a11y, quick-mark toggle persists, note saves on Escape-close, modal focus trap + focus restore, theme cycle + theme-color meta (#f8fafc light / #0a0a0a dark), two-step DELETE works.

- [ ] `npm run lint` — clean
- [ ] `npm run build` — record new sizes; compare vs baseline (goal: JS well under 500 kB if 2.8 landed, CSS ≤ 19.77 kB)
- [ ] Manual smoke (dev server):
  - Roster: type in name/code/credits → instant, no jank; blur commits; reload keeps data
  - Modals: open Timetable / Exam / DayDetail / SubjectAttendance — focus lands in modal, Tab trapped, Escape closes, focus returns to trigger
  - Theme: reload with minimal saved → no dark flash; light-mode minimal readable everywhere (esp. DayDetailModal + TimetableGrid quick-mark)
  - Auth: login + signup via Enter key; kill network mid-sync → buttons recover, error shown
  - Calendar: keyboard-navigate day cells; wheel over grid scrolls (doesn't jump months) on short viewports
  - Attendance: mark present/absent on seed data → substitute hint shows real name, no `Substitute: undefined`
  - Reduced motion on: no blink on confirm-delete, no crt-scroll scanlines
  - Sync: make an edit → `SYNCING...` → `SYNCED` chip appears only where SyncChip renders (SettingsModal + panel header), no whole-app re-render
- [ ] Commit in logical chunks (deletions → perf → theme → a11y → consolidations), one per phase, with the measured build numbers in the merge/PR description

---

## Do NOT touch

- The stringify guard in the persistence effects — it prevents pull-write-back loops. Cheapen it (2.2), don't remove it.
- The `minimal` theme, the settings surface (glitch / 2nd-4th Sat / location / themeMode are all wired to real behavior), `postcss.config.js`, `vite.config.js`.
- `ControlBar.jsx:6-27` Clock's isolated 1s interval (good pattern — ticks don't re-render the bar).
- ThemeContext's CSS-injection sanitization and `data-theme-switching` transition suppression (both are deliberate and correct).
- README mentions a Konami-code easter egg — grep finds no implementation. Resolve the doc/feature mismatch separately; do not add or remove code for it here.

## Known follow-ups (out of scope for this branch)

- `Auth.jsx` logout clears ALL local data + reloads even if cloud sync previously failed — data-loss risk; needs a confirmation or a sync check.
- `syncFromServer` writes 7 keys with raw `setItem` bypassing `API.set`; UPDATED_AT/encode conventions differ per key — normalize in a later pass.
- `useSemesters.addSemester` (60-71) omits `exams: []` although `INITIAL_SEMESTERS` includes it — add for shape consistency.

## Follow-up batch — resolved after branch merge (commit on `perf-upgrade`)

All items above plus the wider "anything else" list were shipped as one commit
after Phase 6:

1. **Logout wipe confirm** — `Auth.jsx` DISCONNECT is now a two-step `ConfirmDeleteButton`
   (DISCONNECT → CONFIRM WIPE?, 2.5s auto-disarm). `ConfirmDeleteButton` gained
   optional `className`/`style` passthrough.
2. **syncFromServer normalization** — the 7 pulls route through one `write` helper
   mirroring `API.set`'s encoding (raw for THEME, JSON otherwise) + legacy
   `theme_id` JSON-quote strip for rows pushed by the pre-fix client; `syncToServer`
   reads theme/updated_at via `API.get`.
3. **Focus-ring sweep** — all remaining inline `outline: 'none'` on form controls
   removed (Auth, CalendarView, SettingsModal, ClassInstanceModal, TimetableModal,
   SubjectRow); global `:focus-visible` ring now applies everywhere. Modal panel's
   own `outline: 'none'` kept (programmatic focus target).
4. **`addSemester`** now includes `exams: []`.
5. **Konami easter egg implemented** — `App.jsx` keydown listener
   (↑↑↓↓←→←→BA, lowercased compare, input-field guard) opens `ClassifiedPanel.jsx`
   (new): two-step PURGE ALL ROOM LOCATIONS clears `room` from every timetable
   entry + exam across all semesters via `setSemesters`, reports the count.
6. **PWA offline** — `public/manifest.webmanifest` + `public/sw.js` (cache-first
   for hashed `/assets/`, network-first navigations with cached index fallback),
   registered in `main.jsx` (PROD only).
7. **Playwright e2e** — `@playwright/test` dev dep + `playwright.config.js`
   (webServer via direct node vite on 127.0.0.1:5199) + `e2e/smoke.spec.js`
   (8 happy-path tests: boot/tabs, calendar keyboard + day modal, quick-mark
   persistence, theme cycle, settings focus restore, auth form, Konami purge,
   mobile tab bar). `npm run test:e2e`.
8. **Lazy supabase** — `supabaseClient.js` → `getSupabase()` dynamic-import
   factory; api.js/useAuth/Auth consume it. supabase-js split into its own
   201 kB chunk (gzip 51.5): main bundle 519.3 → 319.4 kB (gzip 90.9), the
   >500 kB Vite warning is gone. Session bootstrap still pulls the chunk
   post-paint (off critical path).
9. **CSP fix** — Vercel analytics scripts were blocked by `script-src 'self'`;
   added `https://va.vercel-scripts.com` (script) + `https://vitals.vercel-insights.com`
   (connect).
10. **Mobile easter egg** (`bd61294`) — ControlBar logo is always visible
   (was `hidden sm:flex`); 5 taps within 1.5s opens the ClassifiedPanel. Safe
   because the purge is now two-step confirmed.
11. **Auto-resync on reconnect** (`3694d0e`) — `_syncFailed` flag set on push
   failure; a `window 'online'` listener pushes once connectivity returns.
   No spurious pushes: only after an actual failure, only while logged in.
12. **Sync hardening** — serialize all pulls/pushes through a promise queue
   (an in-flight debounced push can no longer land after a boot pull and
   regress the server to stale data); `syncFromServer` now surfaces failures
   via `cadence-sync` events + `_syncFailed` (previously silent) and retries
   once after 10s while online; ThemeContext's racy `isSyncUpdate` setTimeout
   guard replaced with stored-value comparison so a pull-write no longer
   re-stamps `cadence_updated_at`/re-arms a redundant push; pull's
   `updated_at` write is raw (JSON-quoted timestamps broke `new Date()`
   comparisons → NaN → pull always won). Verified by 5 route-stubbed e2e
   tests (`e2e/sync.spec.js`, 14 total).

