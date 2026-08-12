# Cadence Planner: Technical Documentation

## Overview

Cadence Planner is a client-side React application (Vite) for academic planning: semesters,
subject rosters, weekly timetables, exams, and daily attendance. It is **local-first** —
every read and write hits `localStorage` first, so the app is fully usable offline and with
no account. When a Supabase session exists, state is synced to a single row per user in the
background.

There is no state-management library. State lives in a handful of domain hooks and three
React contexts; the pure logic (attendance math, calendar helpers, GPA) lives in
`src/data/` with no React dependency so it can be unit-tested directly.

---

## Directory Structure

```text
src/
├── components/
│   ├── attendance/   # AttendanceView, SubjectAttendanceModal
│   ├── calendar/     # CalendarView, DayDetailModal
│   ├── exams/        # ExamsView, ExamModal
│   ├── layout/       # ControlBar, MobileTabBar, SemDropdown, SettingsModal, ClassifiedPanel
│   ├── roster/       # SubjectRoster, SubjectRow, GpaBadge
│   ├── timetable/    # TimetableGrid, TimetableModal, ClassInstanceModal
│   ├── ui/           # Modal, AttendanceToggle, ColorPicker, ConfirmDeleteButton, Dot, SyncChip
│   ├── Auth.jsx
│   └── ErrorBoundary.jsx
├── data/             # Pure logic + persistence. No React.
│   ├── api.js            # localStorage wrapper + Supabase sync
│   ├── attendanceMath.js # attendance statistics (pure)
│   ├── calendar.js       # date/weekday/day-metadata helpers (pure)
│   ├── colors.js         # subject palette names + theme-token binding
│   ├── constants.js      # DAYS, GRADE_MAP, PANEL_TABS, ATTENDANCE_THRESHOLD, grid bounds
│   ├── initialData.js    # first-run seed semesters
│   ├── supabaseClient.js # lazy-loaded Supabase client
│   ├── utils.js          # GPA, time parsing, date formatting
│   └── index.js          # barrel re-export
├── hooks/            # useSemesters, useAttendance, useSettings, useAuth, useNow, useModalDismiss
├── themes/           # ThemeContext, theme registry, token/style CSS, subject colour tokens
│   ├── _subjects.css
│   ├── nerv/         # meta.js + tokens.css + styles.css
│   └── minimal/      # meta.js + tokens.css + styles.css
├── App.jsx           # Layout shell, tab switching, modal orchestration
├── index.css         # Reset, type scale, shared `.cad-*` classes, animations
└── main.jsx          # Entry point; mounts providers, registers the service worker
```

Other top-level directories:

```text
e2e/                     # Playwright specs (smoke.spec.js, sync.spec.js)
public/                  # favicon.svg, manifest.webmanifest, sw.js
supabase/migrations/     # SQL to run by hand in the Supabase dashboard
```

---

## Data Model

A semester is a self-contained container. All semesters live in one array under the
`cadence_data` storage key.

```js
Semester = {
  id, label,                  // 'SEM 01'
  startDate, endDate,         // 'YYYY-MM-DD' | ''
  subjects:  [Subject],
  timetable: [TimetableEntry],
  exams:     [Exam],
}

Subject       = { id, name, code, credits, colorIdx, gradePoint }   // gradePoint: 0-10 | null
TimetableEntry= { id, subjectId, day, startTime, endTime, room }    // day: 'MON'…'SUN', times 'HH:MM'
Exam          = { id, subjectId, date, startTime, endTime, room, notes }
```

Ids are mixed by design: seed data uses numbers, everything created at runtime uses
`crypto.randomUUID()`. Comparisons therefore normalise with `String(...)`.

### The attendance map

Attendance is the least obvious structure in the app. It is stored **separately** from
semesters (`cadence_attendance`), is **global across semesters**, and is keyed by
**timetable entry id** — not by subject:

```js
attendance = {
  "YYYY-MM-DD": {
    "<entryId>":         "PRESENT" | "ABSENT" | "CANCELLED",
    "<entryId>_note":    string,        // free text for that class on that date
    "<entryId>_sub":     "<subjectId>", // this slot was substituted to another subject
    "isHoliday":          true,         // manual holiday override for the whole day
    "examCountAsPresent": true,         // credit this exam day's scheduled classes as present
  }
}
```

Consequences worth knowing before touching this code:

- **Entry ids and suffixed keys share one namespace.** `_note` and `_sub` are recognised by
  suffix convention, so any traversal must skip those keys (and the two day-level flags)
  before treating a key as an entry id.
- **A substitution redirects the credit.** `"e7_sub": "s3"` means the slot normally taught
  as entry `e7`'s subject counted toward subject `s3` on that date. The mark itself still
  lives under `"e7"`.
- **Records outlive their entries.** Deleting a subject or a timetable slot does not remove
  its attendance keys; `pruneOrphans` in `attendanceMath.js` exists to sweep them.
- **Days are not term-scoped by storage.** Scoping to a semester's `startDate`/`endDate` is
  the caller's job, via `getDayMeta(...).inTerm`.
- **Absence is the cleared state.** Clearing a mark, emptying a note, removing a substitute,
  or toggling a holiday off *deletes* the key rather than storing `null`/`false`, and a date
  left with no keys at all is dropped from the map. Nothing should write a falsy placeholder.

---

## The Data Layer (`src/data/`)

### `api.js` — persistence and sync

All storage access goes through the `API` object; nothing else touches `localStorage`.

| Storage key | Contents |
|---|---|
| `cadence_data` | semesters array |
| `cadence_active_sem` | active semester id |
| `cadence_settings` | user settings |
| `cadence_attendance` | attendance map |
| `cadence_custom_themes` | imported custom themes |
| `cadence-theme` | active theme id (stored raw, not JSON) |
| `cadence_updated_at` | whole-row last-write timestamp |
| `cadence_key_stamps` | per-key timestamp map, for the merge |
| `cadence_user_id` | Supabase user id the local data belongs to |
| `cadence_pruned_at` | Schema version of the last orphaned-attendance sweep |

`API.set(key, value)` writes locally, stamps both `cadence_updated_at` and the per-key entry
in `cadence_key_stamps`, and — only when signed in — arms the debounced push.

### `attendanceMath.js` — attendance statistics (pure)

One traversal of the attendance map emits a record per counted class instance; every public
function is a wrapper over it, so a history list can never disagree with the percentage
printed beside it.

- `computeSubjectStats(attendance, subjectId, timetable, examDates, { withHistory })`
- `computeAllStats(attendance, subjects, timetable, examDates)` → `{ overall, bySubject }`
  in a single pass
- `computeOverallStats(...)`
- `marginToThreshold(present, total)` — how many more classes can be missed
- `recoveryPath(present, total)` — consecutive classes needed to climb back
- `statusTier(percentage)` → `'critical' | 'watch' | 'safe'` (threshold: 75 %)
- `pruneOrphans(attendance, allEntryIds)` — drops keys whose entry no longer exists;
  returns the *same* object when nothing changed, so callers can test identity

Counting rules: manual holidays are skipped entirely; exam days are skipped unless the user
opted in with `examCountAsPresent`, in which case only the slots that actually fall on that
date's weekday are credited, and only where the user left no explicit mark. `CANCELLED`
counts toward neither `present` nor `total`.

`useAttendance` runs `pruneOrphans` once per page load, gated by the `cadence_pruned_at`
schema stamp, to clear records left behind by deletes that happened before the sweep existed.
It is deliberately conservative — if the semester list cannot be read or contains no
timetable entries at all, nothing is pruned.

### `calendar.js` — "what kind of day is this?"

`getDayMeta(dateStr, { settings, attendance, examDates, semester })` is the single source of
truth. It returns `{ dateStr, year, month0, day, weekday, isManualHoliday, isAutoHoliday,
isHoliday, isExamDay, examCountAsPresent, inTerm }`, folding together the manual
`isHoliday` flag, the `holidays2nd4thSat` setting, the exam-date set, and the semester's
optional date bounds.

Supporting helpers, all local-time and free of UTC drift: `weekdayOf(dateStr)`,
`dateStrFromParts(year, month0, day)`, `partsFromDateStr(dateStr)`, `dateFromStr(dateStr)`.

### `colors.js` — subject accents

Holds names only (`SUBJECT_COLORS = [{ id, name }]`, used by the `ColorPicker`). The colour
values live in the theme layer — see [Subject colours](#subject-colours).

- `subjectVars(colorIdx)` → a style fragment binding `--subj-bg` / `--subj-border` /
  `--subj-text` to the active theme's tokens for that index.
- `subjectVar(colorIdx, channel)` → a single `var(--subj-N-channel)` reference.
- `subjectIdx(colorIdx)` normalises any input (negative, out of range, non-numeric) into
  `0..11`.

### `utils.js` / `constants.js`

`calcGPA`, `calcCGPA`, `gpToLabel`, `generateSubjectCode`, `parseTimeToMins`, `toDateStr`,
`daysUntil`, `isSecondOrFourthSaturday`, `getTodayDayIdx`, `pad2` — plus `DAYS`,
`MONTH_NAMES`, `GRADE_MAP`, `PANEL_TABS`, `ATTENDANCE_THRESHOLD` (0.75), and
`GRID_START_HOUR` / `GRID_END_HOUR`.

---

## State Management

Three providers are mounted in `main.jsx`, outermost first: `AuthProvider` →
`SettingsProvider` → `ThemeProvider`. Domain state is held by hooks called inside `App`.

| Module | Responsibility |
|---|---|
| `hooks/useSemesters.js` | Semester → Subject → TimetableEntry → Exam CRUD, active semester |
| `hooks/useAttendance.js` | Attendance state + marking/notes/substitutes/holiday actions |
| `hooks/useSettings.jsx` | `SettingsProvider` + `useSettings()` — global preferences |
| `hooks/useAuth.jsx` | `AuthProvider` + Supabase session |
| `themes/ThemeContext.jsx` | `ThemeProvider` + `useTheme()` — active theme, custom themes |
| `hooks/useNow.js` | Shared ticker for time-dependent UI |
| `hooks/useModalDismiss.js` | Escape / backdrop dismissal |

Settings are `showLocation`, `themeMode` (`'dark'` / `'light'`), `holidays2nd4thSat`, and
`enableGlitch`.

### `useNow`

`useNow(intervalMs = 60_000)` re-renders its consumer on an interval **and** on
`visibilitychange` and `window.focus`. The listeners matter more than the interval: mobile
browsers suspend timers, so returning to a backgrounded PWA is the usual way to end up
looking at yesterday's highlighted column. Use it for anything that reads the clock — the
now-line, "today" highlighting, exam countdowns.

### The persistence write guard

Each stateful provider persists via an effect that first compares the serialised state with
what is already stored, and bails if they match. This is **load-bearing**: a server pull
writes `localStorage` and then dispatches `cadence-data-updated`, and without the guard the
resulting `setState` would immediately re-persist, bump `updated_at`, and arm a push —
a pull-write-back loop. `e2e/sync.spec.js` depends on this behaviour.

---

## Cloud Sync Contract (`src/data/api.js`)

Sync is opt-in: with no Supabase session the app is purely local.

**Server shape.** One row per user in `public.user_data`, with columns `user_id`,
`semesters`, `active_sem_id`, `settings`, `attendance`, `custom_themes`, `theme_id`,
`updated_at`, and `key_updated_at`.

**Write path.** `API.set` → local write → 2 s debounce (`SYNC_DEBOUNCE_MS`) → `syncToServer()`.
Any further edit inside the window resets the timer.

**Serialization.** Every pull and push goes through one promise queue, so they can never
overlap — an in-flight push landing after a pull would regress the server to stale data. The
queue swallows rejections, so one failure cannot wedge later syncs.

**Failure handling.** A failed pull or push sets an internal failed flag and schedules a
single bounded retry 10 s later (only if still online and signed in). Separately, an `online`
event listener pushes immediately when connectivity returns after offline edits.

**Per-key merge.** Six payload keys are merged independently: `semesters`, `active_sem_id`,
`settings`, `attendance`, `custom_themes`, `theme_id`. On pull, each key's local stamp (from
`cadence_key_stamps`) is compared with the server's stamp from `key_updated_at`:

- server newer → adopt the server value and its stamp locally
- local newer → the server is stale for that key
- equal → values match; nothing to do

If any key was pulled, `cadence-data-updated` is dispatched and the providers re-read
storage. If any key was locally newer, the merged state is pushed back in the same
serialization slot. The practical effect: attendance marked on a phone and a timetable edited
on a laptop both survive, instead of one clobbering the other.

### Required migration

Per-key merging needs one column that Supabase projects do not have by default. Run
[`supabase/migrations/20260806_add_key_updated_at.sql`](supabase/migrations/20260806_add_key_updated_at.sql)
once (Supabase dashboard → SQL Editor → paste → Run; the statement is idempotent):

```sql
alter table public.user_data
  add column if not exists key_updated_at jsonb;
```

Until it is run, the client **auto-detects the column's absence** on the first pull and stays
in legacy whole-row last-write-wins mode; pushes omit `key_updated_at` entirely so a
pre-migration project never sees a `42703` unknown-column error. Nothing breaks either way.
Once the column exists, the next pull flips the client into per-key mode and populates the
stamp map from the whole-row timestamp.

### Row-level security

The Supabase anon key is public by design in a client app, so **RLS is the only thing
protecting user data**. Confirm it is enabled on `user_data`:

```sql
alter table public.user_data enable row level security;
create policy "own row" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Events

| Event | Meaning |
|---|---|
| `cadence-sync` (`detail: 'syncing' \| 'success' \| 'error'`) | Drives `SyncChip` |
| `cadence-data-updated` | Storage changed underneath React; providers re-read |

### Import / export

`API.exportAllData()` produces a versioned JSON blob (semesters, active semester, settings,
attendance, custom themes, theme id).

`API.importAllData(data)` is async. It validates the version, the shape of every top-level
field, and semester id presence/uniqueness *before* writing anything, so a malformed backup
cannot half-apply — and the thrown message names the actual problem, which the settings UI
surfaces verbatim. After writing it **awaits a full push** when signed in: the individual
saves only arm the 2 s debounce, and the caller reloads immediately afterwards, which would
otherwise destroy the timer and leave the restore stranded on one device.

---

## UI & Styling System ("Mech Aesthetic")

- **Tailwind CSS** handles layout, spacing, and structural utilities.
- **CSS custom properties** (`--cad-bg-primary`, `--cad-accent`, `--cad-text-hi`, …) carry
  every colour, border, and font decision. Components reference tokens, never literals.

### Theme switching — two mechanisms

Both are driven by the `data-theme` attribute on `<html>`, but they get their values from
different places:

1. **Built-in themes** (`nerv`, `minimal`) are static CSS. Each lives in
   `src/themes/<id>/` as `meta.js` (registry entry + effects list), `tokens.css`
   (`:root[data-theme="<id>"] { --cad-*: … }`), and `styles.css` (effect-specific rules).
   All of them are `@import`ed once from `index.css`. Switching a built-in theme changes
   nothing but the attribute — the CSS is already parsed and the cascade does the rest.
2. **Custom themes** are JSON objects (`{ id, label, tokens, effects }`) imported by the
   user. `ThemeContext.jsx` sanitises them and serialises the survivors into a single
   `<style id="cadence-custom-themes">` block as
   `:root[data-theme="<id>"] { --token: value; … }`.

Sanitisation is a security boundary, not a formality: theme ids and token keys must match
strict patterns, values are length-capped and rejected if they contain `url(`, `@import`,
`expression(`, `javascript:`, `behavior:`, `binding:`, `<` or `>`; a theme is capped at 50
tokens, and at most 5 custom themes may be stored. Effects are checked against the
`ALLOWED_EFFECTS` allowlist in `themes/effects.js`. Custom themes may not reuse a built-in id.

`ThemeProvider` also sets `data-theme-switching` on `<html>` for one frame during a switch to
suppress the transition ripple, applies active effects as `data-fx-*` attributes, and keeps
the `<meta name="theme-color">` tag in sync. `settings.themeMode` (`dark`/`light`) is applied
separately as `data-mode`. An inline script in `index.html` restores both attributes before
first paint to avoid a flash of the wrong theme.

### Subject colours

Subject accents are theme tokens, defined in `src/themes/_subjects.css` as
`--subj-0-bg` / `--subj-0-border` / `--subj-0-text` through `--subj-11-*`, with an override
block for the minimal light theme.

They used to be hard-coded hex values in JS, described as "theme-agnostic". Measured against
the actual composited light background, all twelve failed WCAG AA — 1.17:1 to 2.16:1, nine of
them below 2:1, i.e. subject names were effectively invisible in light mode. The light
override shades measure 5.47:1 to 7.97:1.

To bind a subject to its accent, spread `subjectVars(colorIdx)` and reference the generic
vars:

```jsx
<div style={{ ...subjectVars(subject.colorIdx), color: 'var(--subj-text)' }}>
```

**This is the extension point for theme authors.** A theme that needs its own subject
palette redefines the tokens under its own selector — and because custom themes inject
arbitrary `--*` tokens, custom themes can now restyle subject colours too, which was
impossible while the palette lived in JS.

### Type scale and shared classes

`src/index.css` defines the theme-independent type scale on `:root`:

```
--cad-fs-micro  10px      --cad-track-wide  0.15em
--cad-fs-xs     11px      --cad-track-mid   0.10em
--cad-fs-sm     12px
--cad-fs-md     14px
--cad-fs-lg     20px
--cad-fs-xl     32px
--cad-fs-hero   48px
```

`:root[data-density="compact"]` overrides the first four with tighter values for anyone who
wants the app's original density.

Alongside them is a small vocabulary of shared classes — **use these instead of inline style
objects in new UI**:

| Class | Use |
|---|---|
| `.cad-label` | Uppercase mono micro-label (mono, `--cad-fs-xs`, wide tracking, `--cad-text-lo`) |
| `.cad-value` | Mono readout value (`--cad-fs-sm`, `--cad-text-hi`) |
| `.cad-input` | Full-width mono text input, with a `:focus` accent border |
| `.cad-chip` | Segmented-control chip; `.cad-chip[data-active]` is the selected state, and hover is gated behind `(hover: hover) and (pointer: fine)` |
| `.sr-only` | Screen-reader-only text, for glyphs that carry real meaning |

Also global: `.btn-mech` (press feedback), `.blink`, the `anim-*` animation utilities (all
disabled under `prefers-reduced-motion: reduce`), and a `:focus-visible` outline for every
focusable element.

---

## Views & Workflows

The right-hand panel has four tabs (`PANEL_TABS` in `constants.js`), mirrored by the desktop
tab strip and `MobileTabBar`. On narrow viewports the roster becomes a fifth tab.

### Roster

Subjects belong to a semester: name, auto-generated code, credits, colour index, and grade
point. `SubjectRoster` renders semester GPA and cumulative CGPA through `GpaBadge`
(credit-weighted; ungraded subjects are ignored). **Deleting a subject cascades to every
timetable entry referencing it.**

### Timetable

`TimetableGrid` maps a 7-day week against a time axis.

- **EDIT MODE** — clicking an empty slot opens `TimetableModal` to create a repeating weekly
  class block; clicking a block edits it. The modal validates the time range and rejects
  overlaps with existing entries.
- **VIEW MODE** — clicking a block opens `ClassInstanceModal` for that specific date: mark
  attendance, write a note, or record a substitution. Notes and substitutions are stored in
  the attendance map alongside the status, under the suffixed keys described above.

### Exams

`ExamsView` lists the active semester's exams split into UPCOMING and COMPLETED with a live
countdown per exam; `ExamModal` handles add/edit/delete in edit mode.

Exams are not just a list — their dates form the `examDates` set that the attendance engine
consumes. **An exam date suspends regular attendance counting for that whole day**, on the
assumption that classes do not meet. `DayDetailModal` offers COUNT DAY AS PRESENT to opt a
specific exam day back in, which sets `examCountAsPresent` and credits that weekday's
scheduled slots.

### Calendar

Monthly grid with per-day class chips. Clicking a day opens `DayDetailModal`: quick-mark all
classes present or absent, toggle a manual holiday, open a specific class instance, or opt an
exam day into counting.

### Attendance

Per-subject percentages against the 75 % threshold, with the safe margin ("how many more can
I miss") and the recovery path ("how many in a row to get back"). `SubjectAttendanceModal`
shows a subject's individual records.

### Classified Operations (easter egg)

Two triggers, both in `App.jsx`: the Konami code
(`↑ ↑ ↓ ↓ ← → ← → B A`, ignored while typing in a field) and — on touch devices — **five
quick taps on the CADENCE logo** within 1.5 s. Either opens `ClassifiedPanel`, which purges
every room/location field from every timetable entry and exam across all semesters behind a
two-step confirm.

---

## PWA & Offline

`public/manifest.webmanifest` declares the installable app (standalone display, SVG icon,
`#0a0a0a` theme colour). `main.jsx` registers `public/sw.js` **in production builds only** —
dev serves un-hashed modules that must not be cached.

The service worker keeps one cache (`cadence-v1`) and deletes every other cache on activate:

- `/assets/*` (content-hashed by Vite) — cache-first, populated on first fetch
- navigations — network-first, falling back to the cached `index.html`
- everything else, including all cross-origin requests (Supabase, Google Fonts, analytics) —
  untouched

Because fonts are loaded cross-origin, typography is not currently offline-capable.

---

## Security

- **CSP** — `index.html` ships a `Content-Security-Policy` meta tag: `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, with explicit allowances for the Vercel analytics
  script, Google Fonts, and Supabase over HTTPS/WSS. `script-src` still needs
  `'unsafe-inline'` for the pre-paint theme script. Note that `connect-src` also carries
  `ws:` and `http:` for the dev server — those are development escape hatches and should not
  be relied on in production.
- **Custom theme sanitisation** — see the theming section; user-supplied CSS is filtered
  before injection.
- **RLS** — the only barrier between the public anon key and user rows; see the sync section.

---

## Environment Variables

Cloud sync is optional. To enable it, create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these the app runs entirely on `localStorage`. The Supabase client is imported lazily
(`supabaseClient.js`), so it stays out of the initial bundle.

---

## Testing

| Command | Suite |
|---|---|
| `npm test` | Vitest — pure data layer (`src/**/*.test.js`, node environment) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end |

The Vitest suite targets the logic that is hardest to verify by eye and has no DOM
dependency — `attendanceMath.test.js` (exam-day credit, explicit-mark precedence,
substitutions, holidays, history, orphan pruning), `calendar.test.js` (weekday resolution,
date round-trips, `getDayMeta`), and `utils.test.js` (GPA/CGPA, subject codes, time and date
helpers). Config lives in the `test` block of `vite.config.js`; the environment is `node`,
and only `src/**/*.test.js` is collected.

Playwright config (`playwright.config.js`) starts a Vite dev server on `127.0.0.1:5199` and
runs Chromium against it, retaining traces on failure. Two specs:

- `e2e/smoke.spec.js` — boot and panel switching, keyboard-accessible calendar days,
  attendance quick-mark persistence, theme cycling, modal focus trap and restore, the auth
  form, both classified-ops triggers, and the mobile tab bar.
- `e2e/sync.spec.js` — the merge contract with a stubbed Supabase: local-newer, server-newer,
  missing server row, retry after reconnect, pull/push serialization, per-key merge, and a
  freshly migrated row.

`npm run lint` runs Oxlint.

---

## Deployment & Build

1. `npm run build` compiles to `dist/`.
2. Serve `dist/` from any static host (Vercel, Netlify, GitHub Pages, …).
3. `npm run preview` serves the production build locally — the only way to exercise the
   service worker, since it is not registered in dev.

If cloud sync is in use, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's
environment, and make sure the `key_updated_at` migration and the RLS policy have been
applied to the Supabase project.
