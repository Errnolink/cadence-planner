# Cadence Planner — Improvement Plan v2

Audit date: **2026-08-12**. Branch at audit: `perf-upgrade` @ `070382f`, working tree clean.
Scope: correctness, data model, modularity, performance, UI/UX, accessibility.

This is the successor to `OPTIMISATION_PLAN.md` (complete — Phases 0–6 + follow-up
batch all shipped). **Nothing in that document is repeated here.** Every finding below
was verified against source at the cited `file:line`; measurements and contrast ratios
were computed, not estimated.

**Baseline (measured `npm run build`, 2026-08-12):**

| Artifact | Raw | Gzip |
|---|---|---|
| `index-*.js` (app + react-dom) | 321.41 kB | 91.42 kB |
| `dist-*.js` (supabase, lazy) | 201.27 kB | 51.47 kB |
| `index-*.css` | 20.04 kB | 5.51 kB |

`npm run lint` → 3 warnings, all `react/only-export-components` on
context files (`useAuth.jsx:57`, `useSettings.jsx:57`, `ThemeContext.jsx:197`).
Source: 5,950 lines across 46 files. e2e: 22 Playwright tests, 0 unit tests.

---

## Executive summary

The app is in good shape structurally — the sync layer in particular is careful,
well-commented work. The problems cluster in four places:

1. **The attendance engine silently produces wrong numbers.** `getSubjectStats`
   credits classes that were never scheduled and overwrites explicit user marks.
   This is the app's core value proposition and it is measurably incorrect.
2. **The subject palette is unusable in the `minimal` light theme.** All 12 colours
   fail WCAG AA — most below 2:1. Subject names are effectively invisible.
3. **There is no shared style vocabulary.** 283 inline `style={{}}` objects and 174
   repetitions of `var(--cad-font-mono)` mean every visual change is a 40-file sweep.
   This is the root cause of most UX debt, not a separate problem from it.
4. **The timetable is keyboard-inaccessible.** Class blocks are `div`s with `onClick`.

Severity legend: **S1** silent data corruption · **S2** user-visible defect ·
**S3** maintainability / perf · **S4** polish.

| Phase | Theme | Items | Est. |
|---|---|---|---|
| 0 | Test harness (do first) | 3 | 0.5 d |
| 1 | Correctness | 10 | 1.5 d |
| 2 | Data model & lifecycle | 5 | 1 d |
| 3 | Modularity foundation | 8 | 2 d |
| 4 | Performance | 6 | 0.5 d |
| 5 | UI/UX | 12 | 1.5 d |
| 6 | Accessibility | 6 | 1 d |
| 7 | Docs, types, CI | 5 | 0.5 d |

Phases 1–2 are independent of 3–7 and can ship alone. **Phase 3 must precede 5**,
or the UX fixes get written into the same 283 inline style objects they should be
deleting.

---

# Phase 0 — Test harness (do this first)

There are 22 e2e tests and **zero unit tests**. The three hardest-to-eyeball parts of
the app — attendance math, GPA math, sync merge — have no unit coverage at all. Phase 1
changes attendance math; without tests, you are changing numbers you cannot verify.

### 0.1 Add Vitest

```bash
npm i -D vitest @vitest/coverage-v8
```

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',           // pure-logic tests; no DOM needed yet
    include: ['src/**/*.test.js'],
  },
})
```

```json
// package.json scripts
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] Install + wire config
- [ ] `npm test` runs green with zero tests

### 0.2 Extract attendance math into a pure module

`useAttendance.js:113-195` mixes React state with five pure functions. Pull the pure
half out so it is testable without a renderer. This is also prerequisite work for §3.2.

Create `src/data/attendanceMath.js`:

```js
import { ATTENDANCE_THRESHOLD } from './constants.js'

/** @typedef {'PRESENT'|'ABSENT'|'CANCELLED'} Status */

export function computeSubjectStats(attendance, subjectId, timetable, examDates) { /* … */ }
export function computeOverallStats(attendance, subjects, timetable, examDates) { /* … */ }
export function marginToThreshold(present, total, threshold = ATTENDANCE_THRESHOLD) { /* … */ }
export function recoveryPath(present, total, threshold = ATTENDANCE_THRESHOLD) { /* … */ }
export function statusTier(percentage, threshold = ATTENDANCE_THRESHOLD) { /* … */ }
```

`useAttendance.js` then becomes state + `useCallback` wrappers over these.

- [ ] Move the five functions verbatim (no behaviour change yet)
- [ ] `useAttendance` imports and wraps them
- [ ] App still behaves identically

### 0.3 Characterisation tests — lock in current behaviour, then fix

Write tests that assert what the code does **today**, including the bugs, then flip each
assertion as you fix it in Phase 1. This makes every Phase-1 change provably intentional.

`src/data/attendanceMath.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeSubjectStats, marginToThreshold, recoveryPath } from './attendanceMath.js'

const TT = [
  { id: 'e-mon', subjectId: 'math', day: 'MON', startTime: '09:00', endTime: '10:00' },
  { id: 'e-wed', subjectId: 'math', day: 'WED', startTime: '09:00', endTime: '10:00' },
  { id: 'e-fri', subjectId: 'math', day: 'FRI', startTime: '09:00', endTime: '10:00' },
]

describe('exam day marked "count as present"', () => {
  // 2026-08-11 is a TUESDAY — math has no class that day
  const examDates = new Set(['2026-08-11'])

  it('credits only classes actually scheduled that weekday', () => {
    const att = { '2026-08-11': { examCountAsPresent: true } }
    const s = computeSubjectStats(att, 'math', TT, examDates)
    expect(s.total).toBe(0)      // C1 — currently 3
    expect(s.present).toBe(0)    // C1 — currently 3
  })

  it('does not override an explicit ABSENT mark', () => {
    const att = { '2026-08-11': { examCountAsPresent: true, 'e-mon': 'ABSENT' } }
    const s = computeSubjectStats(att, 'math', TT, examDates)
    expect(s.absent).toBe(1)     // C2 — currently 0
  })
})

describe('margin / recovery', () => {
  it('margin: 30/40 at 75% can miss 0 more', () => expect(marginToThreshold(30, 40)).toBe(0))
  it('margin: 31/40 can miss 1 more',        () => expect(marginToThreshold(31, 40)).toBe(1))
  it('recovery: 30/40 already at threshold', () => expect(recoveryPath(30, 40)).toBe(0))
  it('recovery: 25/40 needs 20 straight',    () => expect(recoveryPath(25, 40)).toBe(20))
})
```

Also cover `calcGPA` / `calcCGPA` / `generateSubjectCode` / `isSecondOrFourthSaturday` /
`daysUntil` in `src/data/utils.test.js` — all pure, all currently untested.

- [ ] `attendanceMath.test.js` — ≥12 cases incl. substitutes, holidays, cancelled
- [ ] `utils.test.js` — ≥10 cases
- [ ] Both red on the known bugs, green on everything else

---

# Phase 1 — Correctness

## C1 · S1 — Exam-day credit counts every weekly slot, not the day's slots

`src/hooks/useAttendance.js:119,130-136`

```js
const subjectEntryIds = timetable.filter(t => t.subjectId === subjectId).map(t => t.id)
//                      ^ no weekday filter
…
subjectEntryIds.forEach(id => {
  …
  if (examAsPresent) { present++; total++; return }   // credits ALL slots
```

`subjectEntryIds` is every weekly slot for the subject, across all seven weekdays. When
a user taps **COUNT DAY AS PRESENT** on an exam day (`DayDetailModal.jsx:122-134`), the
loop credits *all* of them — including slots on other weekdays that could not possibly
have met that date.

**Verified:** MATH scheduled MON/WED/FRI, exam on Tuesday 2026-08-11, user taps
"count as present" → `present 3 / total 3`. Correct answer is `0 / 0`.

Every exam day the user opts into inflates attendance by (number of weekly slots − slots
actually on that weekday). Over a term with a dozen exam days this is a multi-percent
error in the number the whole app exists to display.

**Fix** — resolve the date's weekday and filter:

```js
// src/data/attendanceMath.js
import { DAYS } from './constants.js'

/** 'YYYY-MM-DD' → 'MON'|'TUE'|… (local time, matches the rest of the app) */
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay()     // 0 = Sun
  return DAYS[js === 0 ? 6 : js - 1]
}

export function computeSubjectStats(attendance, subjectId, timetable, examDates = EMPTY) {
  let present = 0, absent = 0, cancelled = 0, total = 0

  const subjectEntries = timetable.filter(t => t.subjectId === subjectId)
  const entryById      = new Map(timetable.map(t => [t.id, t]))

  for (const [dateStr, dayData] of Object.entries(attendance)) {
    if (dayData.isHoliday) continue

    const isExamDay = examDates.has(dateStr)
    if (isExamDay && dayData.examCountAsPresent !== true) continue
    const examAsPresent = isExamDay
    const wd = examAsPresent ? weekdayOf(dateStr) : null

    for (const entry of subjectEntries) {
      if (dayData[`${entry.id}_sub`]) continue           // substituted away
      const status = dayData[entry.id]
      // C2: an explicit mark always wins over the exam-day blanket credit
      if (examAsPresent && !status) {
        if (entry.day === wd) { present++; total++ }     // C1: only this weekday
        continue
      }
      if (status === 'PRESENT')        { present++; total++ }
      else if (status === 'ABSENT')    { absent++;  total++ }
      else if (status === 'CANCELLED') { cancelled++ }
    }

    // entries substituted INTO this subject
    for (const [key, val] of Object.entries(dayData)) {
      if (!key.endsWith('_sub') || val !== subjectId) continue
      const id = key.slice(0, -4)
      const entry = entryById.get(id)
      if (!entry) continue                                // orphan — see C4
      const status = dayData[id]
      if (examAsPresent && !status) {
        if (entry.day === wd) { present++; total++ }
        continue
      }
      if (status === 'PRESENT')        { present++; total++ }
      else if (status === 'ABSENT')    { absent++;  total++ }
      else if (status === 'CANCELLED') { cancelled++ }
    }
  }

  return { present, absent, cancelled, total,
           percentage: total === 0 ? 100 : Math.round((present / total) * 100) }
}
```

Note the substitute loop also changed from `allEntryIds.forEach` (O(all entries) per
date) to a scan of the day's own keys (O(marks on that date)) — see P2.

- [ ] Rewrite `computeSubjectStats` as above
- [ ] Flip the C1 assertions in `attendanceMath.test.js` to green
- [ ] Manually: create a Tue exam, tap COUNT AS PRESENT, confirm subject % unchanged

## C2 · S1 — Exam-day credit silently overwrites an explicit ABSENT

Same block, `useAttendance.js:132`. `if (examAsPresent) { present++; total++; return }`
runs *before* the status checks, so a class the user deliberately marked ABSENT on an
exam day is recorded as PRESENT.

**Verified:** `{ examCountAsPresent: true, 'e-mon': 'ABSENT' }` → `present 3, absent 0`.

The user's explicit input is the highest-authority signal in the app and it is being
discarded. Fixed by the `&& !status` guard in the C1 rewrite.

- [ ] Covered by the C1 rewrite
- [ ] Flip the C2 assertion to green

## C3 · S2 — Clearing a mark writes `null` instead of deleting the key

`src/hooks/useAttendance.js:35-46`, driven by `AttendanceToggle.jsx:31`
(`onMark(dateStr, entryId, isActive ? null : type)`).

```js
markAttendance: (dateStr, entryId, status) => {
  …[entryId]: status     // status === null → key persists with a null value
}
```

Stats tolerate it, but every cleared mark is a permanent row in `localStorage` *and* in
every Supabase sync payload, forever. A user who toggles marks while deciding leaves a
trail of `"e-abc": null` entries.

```js
const markAttendance = useCallback((dateStr, entryId, status) => {
  setAttendance(prev => {
    const day = { ...(prev[dateStr] || {}) }
    if (status == null) delete day[entryId]
    else day[entryId] = status
    // drop the date entirely if nothing is left on it
    if (Object.keys(day).length === 0) {
      const { [dateStr]: _drop, ...rest } = prev
      return rest
    }
    return { ...prev, [dateStr]: day }
  })
}, [])
```

Apply the same "delete, don't null" + "drop empty day" pattern to `toggleHoliday`
(`:61-72` — should delete `isHoliday` when toggled off, not store `false`) and
`setNote` (`:74-85` — an emptied note should remove the `_note` key).
`setSubstitute` (`:87-98`) and `setExamDayPresent` (`:100-107`) already do this.

- [ ] `markAttendance`, `toggleHoliday`, `setNote` delete rather than null/false
- [ ] Empty day objects are removed
- [ ] Test: mark → clear → `attendance` deep-equals `{}`

## C4 · S2 — Attendance records are never garbage-collected

Deleting a timetable entry (`useSemesters.js:143-148`) or a subject
(`:122-128`, which cascades to entries) removes the schedule but leaves every
`attendance[date][entryId]`, `_note`, and `_sub` key behind. Nothing ever prunes them.
They are invisible in the UI, count against the 5 MB `localStorage` quota, and are
uploaded on every sync for the life of the account.

`API.set` has no quota handling either — `api.js:296-315` catches and `console.error`s
a `QuotaExceededError`, so the user's edit silently fails to persist.

**Fix** — a pure pruner in the data layer, called from the delete paths:

```js
// src/data/attendanceMath.js
/** Drop attendance keys whose entry no longer exists. Returns the same object if clean. */
export function pruneOrphans(attendance, allEntryIds) {
  const live = allEntryIds instanceof Set ? allEntryIds : new Set(allEntryIds)
  let changed = false
  const next = {}
  for (const [dateStr, day] of Object.entries(attendance)) {
    const kept = {}
    for (const [k, v] of Object.entries(day)) {
      if (k === 'isHoliday' || k === 'examCountAsPresent') { kept[k] = v; continue }
      const id = k.endsWith('_note') ? k.slice(0, -5)
               : k.endsWith('_sub')  ? k.slice(0, -4)
               : k
      if (live.has(id)) kept[k] = v
      else changed = true
    }
    if (Object.keys(kept).length) next[dateStr] = kept
    else changed = true
  }
  return changed ? next : attendance
}
```

Wire it in two places:

1. **On delete** — `removeSubject` / `deleteTimetableEntry` must reach attendance state.
   Cleanest once attendance is a context (§3.2): dispatch a `cadence-entries-removed`
   event, or lift both into one `useAcademicData` hook. Interim: pass a
   `pruneAttendance` callback from `App.jsx` into `useSemesters`.
2. **On boot, once** — a one-shot sweep in `useAttendance`'s initialiser covers records
   orphaned by every delete that already happened. Guard it behind a
   `cadence_pruned_at` stamp so it runs once per schema version, not every load.

Also add quota handling to `API.set`:

```js
catch (e) {
  if (e?.name === 'QuotaExceededError') {
    window.dispatchEvent(new CustomEvent('cadence-storage-full'))
  }
  console.error(`Failed to save ${key}`, e)
}
```
…and surface it in `SyncChip` as a red `STORAGE FULL` state.

- [ ] `pruneOrphans` + tests (orphan entry, orphan note, orphan sub, empty-day removal)
- [ ] Called on subject/entry delete
- [ ] One-shot boot sweep behind `cadence_pruned_at`
- [ ] Quota error surfaced, not swallowed

## C5 · S2 — Subject history contradicts the percentage in its own title bar

`src/components/attendance/SubjectAttendanceModal.jsx:9-30`

```js
const stats = getSubjectStats(subject.id, timetable, examDates)   // substitute + exam aware
…
Object.entries(attendance).forEach(([dateStr, dayData]) => {
  subjectEntryIds.forEach(id => { if (dayData[id]) records.push(…) })  // neither
})
```

The header shows `stats.percentage` from the substitute- and exam-aware engine; the list
below is a naive scan. So the modal shows classes that were substituted *away* (not
counted in the %), omits classes substituted *into* this subject (counted in the %), and
lists exam-day rows that the % skips. The two halves of one modal disagree.

**Fix** — have the engine emit the records it counted, and render those:

```js
// src/data/attendanceMath.js — same traversal, now also returns rows
export function computeSubjectStats(attendance, subjectId, timetable, examDates, { withHistory = false } = {}) {
  const history = withHistory ? [] : null
  …
  // at each counted entry:
  history?.push({ date: dateStr, entryId: entry.id, entry, status, substituted: isSub, examCredited })
  …
  return { present, absent, cancelled, total, percentage, history }
}
```

Then `SubjectAttendanceModal` renders `stats.history` (sorted descending) and can badge
`⇄ SUB` / `✎ EXAM` rows, which the current list cannot express at all.

- [ ] `withHistory` option on `computeSubjectStats`
- [ ] Modal consumes `stats.history`; local `useMemo` deleted
- [ ] Substituted and exam-credited rows visually distinguished
- [ ] Test: substituted-away row absent, substituted-into row present

## C6 · S2 — Day modal behaves differently depending on where you opened it

`src/components/timetable/TimetableGrid.jsx:230-237`

```js
setActiveDayDetail({
  date: { year: …, month: …, day: … },   // no isHoliday / isManualHoliday
  weekday: day,                          // set even when the day IS a holiday
})
```

versus `CalendarView.jsx:49-55`, which passes both flags and nulls `weekday` on holidays.

`DayDetailModal` reads `date.isHoliday` at `:85`, `:198`, `:202`, `:258`. Opened from the
grid those are `undefined`, so on a 2nd/4th-Saturday holiday the grid route shows the
full class list with live attendance toggles, while the calendar route shows
`// HOLIDAY (2ND/4TH SAT)`. Same date, same data, two different screens — and the grid
route lets you record attendance for a day the stats engine will discard.

**Fix** — stop passing holiday state as three loose props. Give the modal a date string
and let it derive everything (this also kills the §3.4 duplication):

```js
// src/data/calendar.js  (new)
export function getDayMeta(dateStr, { settings, attendance, examDates }) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const isManualHoliday = attendance?.[dateStr]?.isHoliday === true
  const isAutoHoliday   = settings.holidays2nd4thSat && isSecondOrFourthSaturday(y, m - 1, d)
  return {
    dateStr, weekday: weekdayOf(dateStr),
    isManualHoliday, isAutoHoliday,
    isHoliday: isManualHoliday || isAutoHoliday,
    isExamDay: examDates.has(dateStr),
  }
}
```

`<DayDetailModal dateStr="2026-08-12" />` — one prop. Both call sites collapse to that,
and the four duplicated `isHoliday` expressions
(`TimetableGrid.jsx:225,317`, `CalendarView.jsx:53,169`) become one function.

- [ ] `src/data/calendar.js` with `getDayMeta` + `weekdayOf` + tests
- [ ] `DayDetailModal` takes `dateStr`, derives the rest
- [ ] Both call sites simplified; four duplicated expressions deleted
- [ ] Manually: open a 2nd/4th Saturday from grid **and** calendar → identical

## C7 · S2 — Restoring a backup never reaches the cloud

`SettingsModal.jsx:93-108` → `API.importAllData` → `window.location.reload()`.

`importAllData` (`api.js:380-385`) calls `saveSemesters`/`saveAttendance`/… Each arms the
**2-second** debounced push (`api.js:308-311`). `reload()` fires immediately after, so
the timer is destroyed before it ever runs. The restored data lives only on this device
until some unrelated future edit happens to push it — and if another device syncs first,
the *stale* server row wins the merge and the restore is undone.

```js
// api.js
importAllData: async (data) => {
  …validation unchanged…
  …writes unchanged…
  if (API.userId) await API.syncToServer()   // flush before the caller reloads
}
```

```js
// SettingsModal.jsx
reader.onload = async (ev) => {
  try {
    setDataSyncMsg('RESTORING…')
    await API.importAllData(JSON.parse(ev.target.result))
    window.location.reload()
  } catch (err) {
    setDataSyncMsg(err?.message?.toUpperCase() || 'INVALID BACKUP FILE.')
    msgTimer.current = setTimeout(() => setDataSyncMsg(''), 4000)
  } finally {
    e.target.value = ''            // U10: allow re-selecting the same file
  }
}
```

Note the `catch` currently discards `err.message`, so a backup rejected by validation
(`'Unsupported backup version'`, `'Semesters must be an array'`) reports the useless
`INVALID BACKUP FILE.` — surface the real reason.

- [ ] `importAllData` is async and flushes
- [ ] Restore awaits the flush before reload
- [ ] Validation messages surfaced
- [ ] File input reset (U10)

## C8 · S2 — `addSemester` produces `NaN` ids on imported data

`useSemesters.js:66`

```js
const newId = (prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0) + 1
```

Subjects and timetable entries use `crypto.randomUUID()`; semesters use max-plus-one.
Any non-numeric `id` in the list — from a hand-edited backup, a future schema, or a
restore from another build — makes `Math.max` return `NaN`, so the new semester gets
`id: NaN`. Every `String(s.id) === String(activeSemId)` comparison then matches
`"NaN" === "NaN"` for *all* such semesters. `importAllData` does not validate
`sem.id` (`api.js:353-357`), so nothing stops it.

```js
const newId = crypto.randomUUID()
const numeric = prev.map(p => Number(p.id)).filter(Number.isFinite)
const label = `SEM ${String((numeric.length ? Math.max(...numeric) : prev.length) + 1).padStart(2, '0')}`
```

Ids become opaque (as they already are for subjects/entries); the label keeps the
human-friendly counter. Add `if (sem.id === undefined) throw` to `importAllData`'s
per-semester validation.

- [ ] UUID ids for new semesters
- [ ] Label counter derived separately
- [ ] `importAllData` validates `sem.id` presence and uniqueness

## C9 · S3 — Side effect inside a `setState` updater

`useSemesters.js:80-95` — `removeSemester` calls `queueMicrotask(() => setActiveSemId(…))`
*inside* the `setSemesters` updater. React may invoke updaters more than once (StrictMode
double-invokes them in development by design), so the microtask can be scheduled twice.
It is idempotent today, which is why it has not broken — but it is a trap for the next edit.

```js
const removeSemester = useCallback((id) => {
  setSemesters(prev => {
    if (prev.length <= 1) return prev
    return prev.filter(s => String(s.id) !== String(id))
  })
  setActiveSemId(prevId =>
    String(prevId) === String(id) ? (semestersRef.current.find(s => String(s.id) !== String(id))?.id ?? prevId)
                                  : prevId)
}, [])
```

Keep a `semestersRef` updated in an effect, or compute both from one `useReducer` — the
latter is cleaner and is the §3.2 direction anyway.

- [ ] Updater is pure
- [ ] Deleting the active semester still switches to a surviving one
- [ ] Deleting a non-active semester leaves the selection alone

## C10 · S2 — `ABORT` in the class-instance modal only aborts the note

`ClassInstanceModal.jsx:18-25, 140-152`

Attendance (`handleStatusChange` → `markAttendance`) and substitute (`onChange` →
`setSubstitute`) commit **immediately**. Only the note is buffered in local state. So
`ABORT` discards the note and keeps everything else, while Escape and backdrop-click
route through `Modal`'s `onClose` — which is `handleModalClose` — and **save** the note.

Three exits, three different outcomes, one of them mislabelled.

Pick one model. Recommended — commit everything immediately (matches the rest of the app,
where roster edits and quick-marks are instant) and make the note autosave on blur:

```js
<textarea
  value={currentNote}
  onChange={e => setCurrentNote(e.target.value)}
  onBlur={e => attendanceHook.setNote(dateStr, entry.id, e.target.value)}
/>
```

Then both buttons become one `CLOSE`, and Escape / backdrop / button all agree.
(The alternative — buffer everything and make ABORT truly abort — is more code and
breaks the instant-feedback feel of the toggles.)

- [ ] Note autosaves on blur
- [ ] Single `CLOSE` action; `ABORT` removed
- [ ] Escape, backdrop, and button produce identical state

## C11 · S3 — Type drift and hand-rolled time parsing in `ExamModal`

`ExamModal.jsx:53` — `onChange={e => upd('subjectId', e.target.value)}` stores the raw
string. `TimetableModal.jsx:78-81` deliberately maps back to the original id type. Object
key coercion hides it today (`subjectMap["1"]` finds `m[1]`), but a `Map`, a `Set`, or a
`===` comparison anywhere downstream breaks on it. Normalise like the timetable modal.

`ExamModal.jsx:31-33` — `parseInt(form.startTime.replace(':',''), 10)` compares `0930`
vs `1100` as integers. Monotonic for `HH:MM`, so it works, but `parseTimeToMins` already
exists and is imported one line away in sibling files. There is also **no upper bound
check** (`GRID_END_HOUR`) and **no clash detection** against other exams or classes,
both of which `TimetableModal.validate` does (`:36-56`).

```js
import { parseTimeToMins, GRID_END_HOUR, pad2 } from '../../data/index.js'

const validate = () => {
  if (!form.subjectId) return 'SELECT A SUBJECT'
  if (!form.date)      return 'SELECT A DATE'
  const s = parseTimeToMins(form.startTime), e = parseTimeToMins(form.endTime)
  if (e <= s) return 'END TIME MUST BE AFTER START'
  if (e > GRID_END_HOUR * 60) return `END EXCEEDS ${pad2(GRID_END_HOUR)}:00`
  const clash = exams.find(x => x.id !== initial?.id && x.date === form.date &&
                                !(e <= parseTimeToMins(x.startTime) || s >= parseTimeToMins(x.endTime)))
  if (clash) return `CLASH WITH EXAM @ ${clash.startTime}–${clash.endTime}`
  return null
}
```

Requires passing `exams` into `ExamModal` from `ExamsView` (it already holds the list).
Longer term, `validate` in both modals is the same interval-overlap check — extract
`findOverlap(intervals, candidate)` to `src/data/schedule.js`.

- [ ] `subjectId` normalised to the source type
- [ ] `parseTimeToMins` + upper bound
- [ ] Exam-vs-exam clash detection
- [ ] Shared `findOverlap` used by both modals

## C12 · S4 — "Today" is frozen at mount

`TimetableGrid.jsx:24` `const todayIdx = getTodayDayIdx()` and the now-line at `:350-365`
both read the clock once per render, and nothing re-renders on a timer. Leave the tab open
past midnight and the highlighted column, the `▸NOW` badge, and the red line are all a
day stale. `ExamsView.jsx:20` (`todayStr`) has the same issue for its UPCOMING/COMPLETED
split and its countdowns.

Add one shared ticker and consume it in both:

```js
// src/hooks/useNow.js
import { useState, useEffect } from 'react'

/** Re-renders on an interval. Default 60 s — enough for a now-line, cheap enough to ignore. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    const onVis = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [intervalMs])
  return now
}
```

The `visibilitychange` listener matters more than the interval: phones suspend timers, so
returning to a backgrounded PWA is the common case for a stale view.
`ControlBar.jsx:6-27`'s `Clock` can keep its own 1 s interval (it is deliberately isolated
so ticks do not re-render the bar) or switch to `useNow(1000)`.

- [ ] `useNow` added
- [ ] `TimetableGrid` and `ExamsView` consume it
- [ ] Backgrounding the tab and returning refreshes the now-line

---

# Phase 2 — Data model & lifecycle

## D1 · S2 — Semester dates are decorative

`grep` confirms `startDate` / `endDate` are read in exactly one place —
`SubjectRoster.jsx:48-55`, the "DAYS ELAPSED" readout. They bound nothing:

- Attendance is counted across **all** dates in the map, regardless of term.
- The calendar renders classes on every matching weekday, forever, including years
  before the semester started.
- The timetable grid renders the weekly pattern for any week you navigate to.

A user who sets SEM 03 to Jan–May 2026 still sees SEM 03 classes on the calendar in
December 2025. Two honest options:

**(a) Make them real** (recommended). Add to `getDayMeta`:
`inTerm: !sem.startDate || !sem.endDate || (dateStr >= sem.startDate && dateStr <= sem.endDate)`.
Grey out-of-term calendar cells, skip out-of-term dates in `computeSubjectStats`, and
badge out-of-term weeks in the grid. This makes per-semester attendance scoping fall out
for free, which also defuses any future entry-id collision.

**(b) Remove them** and drop the DAYS ELAPSED strip.

Do not leave them as-is: the fields imply a constraint the app does not enforce, and users
will assume attendance is term-scoped when it is not.

- [ ] Decide (a) or (b) — record the decision here
- [ ] If (a): `inTerm` in `getDayMeta`, honoured by stats + calendar + grid
- [ ] If (a): tests for a date before `startDate` and after `endDate`

## D2 · S3 — Attendance has no schema version

`api.js:335-345` stamps `version: 1` on exports, but the live `localStorage` shape is
unversioned. Phase 1 changes the shape (C3 deletes nulls, C4 prunes orphans) and D1 may
add term scoping. Without a version marker, migrations cannot be applied idempotently and
you cannot tell a pre-fix payload from a post-fix one.

Add `cadence_schema_version` alongside the other `KEYS` and a small migration runner
invoked once in `main.jsx` before render:

```js
// src/data/migrations.js
const MIGRATIONS = [
  { to: 2, name: 'prune-null-marks-and-orphans', run: (s) => { /* … */ } },
]
export function runMigrations() { /* read version, apply in order, write version */ }
```

Bump `exportAllData().version` to match, and have `importAllData` migrate old exports
forward instead of rejecting them (`api.js:349` currently throws on anything ≠ 1 — a
version-2 backup restored into a version-1 build gives an unhelpful hard error, and a
version-1 backup will be rejected by a future build unless you handle it now).

- [ ] `cadence_schema_version` key + runner
- [ ] C3/C4 cleanups expressed as migration 2
- [ ] `importAllData` migrates forward rather than throwing
- [ ] Tests: v1 payload → v2 shape

## D3 · S3 — Push sends whole-row `updated_at` from the client clock

`api.js:249` — `updated_at: API.get(KEYS.UPDATED_AT, null) || new Date().toISOString()`.

Every device stamps rows with its own clock. Two devices whose clocks differ by minutes
will resolve the per-key merge (`api.js:135-164`) in favour of the *fast* clock, not the
recent edit. On a school laptop with a drifting clock this loses real edits.

The per-key map has the same exposure. Mitigation without a server function: have the
server stamp authoritatively.

```sql
alter table public.user_data
  alter column updated_at set default now();

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

create trigger user_data_touch before insert or update on public.user_data
  for each row execute function public.touch_updated_at();
```

…then stop sending `updated_at` in the payload and adopt the value the upsert returns
(`.upsert(payload).select().single()`). Per-key stamps stay client-side, but anchoring
them to a server-returned base bounds the drift.

Lower-effort interim: on each pull, compute `skew = Date.parse(serverUpdatedAt) - Date.now()`
and, if `|skew| > 5 min`, show a warning in `SyncChip`. Diagnosing this from a user report
is otherwise near-impossible.

- [ ] Decide server-trigger vs skew warning
- [ ] Migration file if going the trigger route
- [ ] e2e: skewed-clock scenario in `sync.spec.js`

## D4 · S2 — Sign-out can destroy unsynced work

`Auth.jsx:69-74`. `OPTIMISATION_PLAN.md` added a two-step confirm, which was the right
first move, but the underlying risk is untouched: `API.clearLocalData()` wipes every key
including `cadence_user_id` and the stamp map. If the last push failed — `_syncFailed`
is `true`, the user is offline, the tab has been open all day on hotel wifi — that work
is gone and there is no warning.

```js
const handleLogout = async () => {
  if (API.hasUnsyncedChanges()) {                     // expose _syncFailed
    const ok = await confirmModal({
      title: 'UNSYNCED CHANGES',
      body: 'Local edits have not reached the cloud. Signing out erases them.',
      actions: ['DOWNLOAD BACKUP FIRST', 'SIGN OUT ANYWAY', 'CANCEL'],
    })
    if (ok === 'CANCEL') return
    if (ok === 'DOWNLOAD BACKUP FIRST') { downloadBackup(); return }
  }
  …
}
```

Also relabel. `DISCONNECT (SIGN OUT)` → `CONFIRM WIPE?` reads like a bug: the user asked
to sign out, not to wipe. Either say `SIGN OUT + ERASE LOCAL DATA` up front, or offer
sign-out that *keeps* local data (the app is local-first — signing out of sync does not
obviously imply destroying the planner).

- [ ] `API.hasUnsyncedChanges()` exposed
- [ ] Unsynced-changes guard with a backup escape hatch
- [ ] Labels describe the actual consequence
- [ ] Consider "sign out but keep local data" as the default

## D5 · S4 — Seed data ships to every new user

`initialData.js` gives a first-run user three fabricated semesters, fifteen subjects with
invented grade points, forty timetable entries, and two exams dated August 2026. The first
experience of an attendance tracker is deleting somebody else's coursework — and the fake
GPA (8.44 CGPA) renders in the badge as if it were theirs.

Keep the fixture for tests and demos; do not boot into it.

```js
// src/data/initialData.js
export const EMPTY_SEMESTER = () => ({
  id: crypto.randomUUID(), label: 'SEM 01',
  startDate: '', endDate: '', subjects: [], timetable: [], exams: [],
})
export const DEMO_SEMESTERS = [ /* today's INITIAL_SEMESTERS, used by tests + LOAD DEMO */ ]
```

`useSemesters` boots to `[EMPTY_SEMESTER()]`. Add a first-run empty state offering
**ADD YOUR FIRST SUBJECT** / **LOAD DEMO DATA** / **RESTORE A BACKUP**. `e2e/smoke.spec.js`
seeds `DEMO_SEMESTERS` into `localStorage` in a `beforeEach` instead of relying on the
boot default.

- [ ] `EMPTY_SEMESTER` / `DEMO_SEMESTERS` split
- [ ] Boot is empty; first-run panel added
- [ ] e2e seeds explicitly
- [ ] Empty states in roster, timetable, calendar, attendance, exams

---

# Phase 3 — Modularity foundation

> Do this before Phase 5. Every UX fix below either edits inline styles or adds more.

## M1 · S3 — 283 inline style objects, no shared vocabulary

**Measured:** 283 `style={{` occurrences; `var(--cad-font-mono)` written out 174 times;
`letterSpacing: '0.15em'` and `textTransform: 'uppercase'` appear with it almost every
time. `labelStyle` / `sectionStyle` / `inputStyle` are redeclared as locals in five
modals (`TimetableModal:67-68`, `ClassInstanceModal:29-30`, `ExamModal:6-12`,
`SettingsModal:110-111`, `AttendanceView:19-20`) with slightly different values each time.

Consequences, in order of cost:
- A type-scale change (Phase 5, U3) means editing ~174 sites by hand.
- Every render allocates hundreds of fresh objects, defeating `React.memo` on any child
  that receives one (P6).
- Hover states are implemented as ~15 pairs of `onMouseEnter`/`onMouseLeave` handlers
  that mutate `e.currentTarget.style` — behaviour CSS does natively, that breaks on
  touch, and that fights React's ownership of the DOM.

**Fix — three layers, in order:**

**(a) Type + spacing tokens.** The theme system already owns colour; extend it to size.
Add to `index.css` under a theme-independent `:root`:

```css
:root {
  --cad-fs-micro: 10px;   /* today 6-8px  */
  --cad-fs-xs:    11px;   /* today 9px    */
  --cad-fs-sm:    12px;
  --cad-fs-md:    14px;
  --cad-fs-lg:    20px;
  --cad-fs-xl:    32px;
  --cad-fs-hero:  48px;
  --cad-track-wide: 0.15em;
  --cad-track-mid:  0.10em;
}
```

Now U3 (illegible 6–9 px type) is a **seven-line change**, and a future "compact mode"
setting is a class toggle.

**(b) Semantic classes for the repeated combinations.** In `index.css`:

```css
.cad-label {                       /* the ~40 uppercase micro-labels */
  font-family: var(--cad-font-mono);
  font-size: var(--cad-fs-xs);
  letter-spacing: var(--cad-track-wide);
  text-transform: uppercase;
  color: var(--cad-text-lo);
}
.cad-value  { font-family: var(--cad-font-mono); font-size: var(--cad-fs-sm); color: var(--cad-text-hi); }
.cad-input  { width: 100%; font-family: var(--cad-font-mono); font-size: var(--cad-fs-sm);
              color: var(--cad-text-hi); background: var(--cad-bg-input);
              border: 1px solid var(--cad-border); padding: 6px 8px; border-radius: var(--cad-radius); }
.cad-input:focus { border-color: var(--cad-accent); }        /* replaces onFocus/onBlur handlers */

.cad-chip   { font-family: var(--cad-font-mono); font-size: var(--cad-fs-micro);
              letter-spacing: var(--cad-track-mid); padding: 2px 6px;
              border-radius: var(--cad-radius); border: 1px solid var(--cad-border); }
.cad-chip[data-active] { border-color: var(--cad-accent); color: var(--cad-accent-text);
                         background: var(--cad-accent-dim); }
.cad-chip:hover:not([data-active]) { border-color: var(--cad-border); color: var(--cad-text-hi); }
```

`.cad-chip[data-active]` alone replaces the identical
`border/color/background` ternary triple in `App.jsx:182-185`,
`TimetableGrid.jsx:199-202`, `TimetableModal.jsx:113-116`,
`AttendanceView.jsx:79-82`, and `SettingsModal.jsx:125-127` — five copies of one idea.

**(c) Three primitive components** in `src/components/ui/`:

```jsx
export const Label = ({ children, ...p }) => <div className="cad-label" {...p}>{children}</div>
export const Chip  = ({ active, ...p })   => <button className="cad-chip btn-mech" data-active={active || undefined} {...p} />
export const Field = ({ label, children }) => <div className="cad-field"><Label>{label}</Label>{children}</div>
```

Do not build a component library. These three plus the classes cover the great majority
of the 283 sites. **Migrate opportunistically** — whenever you touch a file for another
item in this plan, convert that file. A big-bang rewrite risks visual regressions with no
test coverage to catch them.

- [ ] Type/spacing tokens in `index.css`
- [ ] `.cad-label` / `.cad-value` / `.cad-input` / `.cad-chip` classes
- [ ] `Label` / `Chip` / `Field` primitives
- [ ] All five modal `labelStyle`/`sectionStyle` locals deleted
- [ ] All `onMouseEnter`/`onMouseLeave` style mutations → CSS `:hover`
- [ ] Target: `grep -o 'style={{' src | wc -l` under 100

## M2 · S3 — `attendanceHook` is prop-drilled as an opaque bag

`App.jsx:32` creates it and passes the whole object to `CalendarView`,
`AttendanceView`, `TimetableGrid`, `ClassInstanceModal`, which forward it to
`DayDetailModal`, `SubjectAttendanceModal`, `AttendanceToggle`. Eight components accept a
prop with no documented shape; several guard it with `attendanceHook?.` because they
cannot tell whether it is optional.

Settings and Theme are already contexts. Attendance should be too.

```jsx
// src/hooks/useAttendance.jsx
const AttendanceContext = createContext(null)
export function AttendanceProvider({ children }) { /* today's useAttendance body */ }
export function useAttendance() {
  const ctx = useContext(AttendanceContext)
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider')
  return ctx
}
```

Mount it in `main.jsx` beside the others. Every `attendanceHook` prop and every `?.` guard
disappears; the `useMemo` at `useAttendance.js:197-201` that exists purely to stabilise the
prop identity can go too.

**Split the context in two** while you are there — the state and the actions have very
different change rates:

```jsx
<AttendanceActionsContext.Provider value={actions}>   {/* stable forever */}
  <AttendanceStateContext.Provider value={attendance}> {/* changes on every mark */}
```

`AttendanceToggle` only needs actions, so it stops re-rendering when unrelated marks
change (see P6).

- [ ] `AttendanceProvider` mounted in `main.jsx`
- [ ] State/actions split into two contexts
- [ ] All `attendanceHook` props removed (grep → 0)
- [ ] All `attendanceHook?.` guards removed

## M3 · S3 — `subjectMap` rebuilt identically in four components

`TimetableGrid.jsx:57-61`, `CalendarView.jsx:39-43`, `DayDetailModal.jsx:27-31`,
`ExamsView.jsx:13-17` — byte-identical:

```js
const subjectMap = useMemo(() => { const m = {}; subjects.forEach(s => { m[s.id] = s }); return m }, [subjects])
```

```js
// src/hooks/useSubjectMap.js
export function useSubjectMap(subjects) {
  return useMemo(() => new Map(subjects.map(s => [String(s.id), s])), [subjects])
}
```

Use a `Map` keyed on `String(id)`: the current plain object silently relies on JS key
coercion to paper over the C11 string/number drift. A `Map` makes the normalisation
explicit and survives a UUID migration.

- [ ] `useSubjectMap` + four call sites converted
- [ ] Lookups use `String(id)`

## M4 · S3 — Date and holiday logic re-derived inline everywhere

Three inline `YYYY-MM-DD` template literals (`CalendarView.jsx:51,167`,
`DayDetailModal.jsx:13`) plus two in `TimetableGrid.jsx:223,314` — while `toDateStr`
already exists in `utils.js:53` and is imported only by the two exam files.
`isSecondOrFourthSaturday` is combined with `settings.holidays2nd4thSat` and
`attendance[dateStr].isHoliday` in four places (`TimetableGrid.jsx:225,317`,
`CalendarView.jsx:53,169`) with identical expressions.

Covered by `getDayMeta` in C6. Additionally:

- Delete every inline date template; use `toDateStr` / `toDateStrParts`.
- `CalendarView.jsx:9-13` has a local `dayLabel`, `TimetableGrid` derives weekday by
  index arithmetic, `utils.js:14` has `getTodayDayIdx` — three ways to answer "what day is
  this". Consolidate on `weekdayOf(dateStr)` in `src/data/calendar.js`.

- [ ] Zero inline date templates (`grep "padStart(2, '0')}-\${"` → 0)
- [ ] One weekday function
- [ ] `getDayMeta` is the only holiday determination

## M5 · S3 — Adding a tab requires edits in three files

`constants.js:28-33` (`PANEL_TABS`), `App.jsx:193-218` (nested ternary),
`MobileTabBar.jsx:3` (`TAB_ICONS`). Three places, no compiler to catch a miss.

```js
// src/views/registry.js
import { lazy } from 'react'
export const VIEWS = [
  { id: 'timetable',  label: 'TIMETABLE',  icon: '⊞', Component: lazy(() => import('./TimetableView.jsx')) },
  { id: 'exams',      label: 'EXAMS',      icon: '✎', Component: lazy(() => import('./ExamsView.jsx')) },
  { id: 'calendar',   label: 'CALENDAR',   icon: '◫', Component: lazy(() => import('./CalendarView.jsx')) },
  { id: 'attendance', label: 'ATTENDANCE', icon: '✓', Component: lazy(() => import('./AttendanceView.jsx')) },
]
```

`App.jsx` becomes a lookup and a `<Suspense>`; `MobileTabBar` and the desktop tab strip
both map the same array. `lazy` also gets each view out of the initial chunk (P7).

- [ ] `src/views/registry.js`
- [ ] `App.jsx` ternary chain → registry lookup + `Suspense`
- [ ] `TAB_ICONS` deleted
- [ ] Adding a tab touches exactly one file

## M6 · S3 — No URL state

Active tab, semester, calendar month, and week offset are all component state. Refresh
always lands on TIMETABLE / current week. There is no back-button, no deep link, no way to
bookmark a semester or share a week — and no way for a Playwright test to navigate
directly to a view instead of clicking through.

No router needed for four views:

```js
// src/hooks/useHashState.js — reads/writes location.hash as a param bag
// #/attendance?sem=<id>&week=2   →  { view: 'attendance', sem: '<id>', week: 2 }
```

`popstate` drives state; navigation calls `history.pushState`. ~40 lines, no dependency.
Adopt `react-router` only if nested routes ever appear.

- [ ] `useHashState`
- [ ] View + semester + week/month in the hash
- [ ] Back button navigates between views
- [ ] e2e navigates by URL rather than by click

## M7 · S3 — No unit tests, no types, no contracts

Phase 0 gets unit tests started. Beyond that, every component's contract is implicit — the
`attendanceHook` bag being the worst offender, `date` in `DayDetailModal` (which is
sometimes `{year,month,day}` and sometimes carries `isHoliday`/`isManualHoliday`) a close
second. That shape inconsistency **is** bug C6.

You do not need to convert to TypeScript. Add JSDoc typedefs in `src/data/types.js` and
`// @ts-check` at the top of the data layer; VS Code will then check the pure modules with
no build change:

```js
/**
 * @typedef {Object} TimetableEntry
 * @property {string} id
 * @property {string} subjectId
 * @property {'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'} day
 * @property {string} startTime  HH:MM
 * @property {string} endTime    HH:MM
 * @property {string} room
 */
```

Start with `Semester`, `Subject`, `TimetableEntry`, `Exam`, `AttendanceMap`, `DayData`.

- [ ] `src/data/types.js` with the six core typedefs
- [ ] `// @ts-check` on `attendanceMath.js`, `calendar.js`, `utils.js`, `api.js`
- [ ] Zero editor type errors in those files

## M8 · S4 — Two theme mechanisms

Built-in themes are CSS files (`themes/*/tokens.css`) picked up by `@import`. Custom themes
are objects sanitised and serialised into a `<style>` tag at
`ThemeContext.jsx:145-166`. Same concept, two code paths, two failure modes — a built-in
theme cannot be exported as a custom theme, and the sanitiser only guards one of them.

Not urgent. When it next needs work, generate the built-in `<style>` blocks from the same
`meta.js` token objects that custom themes use, and keep the CSS files only for
effect-specific rules (`styles.css`) that tokens cannot express.

- [ ] (Deferred) Single token→CSS path for built-in and custom themes

---

# Phase 4 — Performance

## P1 · S3 — Attendance stats recomputed twice per subject, unmemoized

`AttendanceView.jsx:17` — `const overallStats = getOverallStats(subjects, timetable, examDates)`
runs in the render body with no `useMemo`. `getOverallStats`
(`useAttendance.js:158-173`) itself calls `getSubjectStats` once per subject, and
`sortedSubjects` (`:23-32`) calls it **again** for each. So every render is
`2 × subjects × dates × entries`.

At 6 subjects, 180 recorded days, 25 timetable entries that is ~54,000 iterations per
render — and `AttendanceView` re-renders on every keystroke elsewhere in the app because
`attendanceHook`'s identity changes.

Two fixes, both cheap:

```js
// one pass over every subject instead of 2N passes
const { overall, perSubject } = useMemo(
  () => computeAllStats(attendance, subjects, timetable, examDates),
  [attendance, subjects, timetable, examDates])
```

`computeAllStats` traverses `attendance` **once**, accumulating into a `Map` keyed by
subject — O(dates × marks) total rather than O(subjects × dates × entries).

- [ ] `computeAllStats` single-pass
- [ ] `AttendanceView` memoizes on the four inputs
- [ ] Test: `computeAllStats` totals equal the sum of per-subject `computeSubjectStats`

## P2 · S3 — Substitute lookup is O(all entries) per date

`useAttendance.js:139-145` iterates `allEntryIds` for every date, only to check
`dayData[`${id}_sub`] !== subjectId`. Most dates have no substitutes at all. The C1
rewrite already replaces this with a scan of the day's own keys.

- [ ] Covered by C1

## P3 · S4 — `matchMedia` called on every mouse event

`TimetableGrid.jsx:417,423` — `window.matchMedia('(hover: hover) and (pointer: fine)').matches`
inside both `onMouseEnter` and `onMouseLeave` for every class block. A fresh
`MediaQueryList` per event, per block.

The whole handler pair exists to apply a hover lift. Delete both and write CSS:

```css
@media (hover: hover) and (pointer: fine) {
  .tt-block:not([data-holiday]):hover {
    transform: translateY(-1px);
    box-shadow: inset 0 0 0 1px var(--tt-border-a22), 0 4px 12px var(--tt-border-a40);
  }
}
```

Set `--tt-border-a22` / `--tt-border-a40` as inline custom properties on the block (the
one part that genuinely varies per subject). Same for the ~13 other
`onMouseEnter/onMouseLeave` style mutations across the codebase (M1c).

- [ ] Block hover in CSS
- [ ] `matchMedia` out of event handlers
- [ ] Remaining hover handlers converted

## P4 · S4 — 24-hour grid renders 168+ absolutely-positioned lines

`constants.js:2-3` — `GRID_START_HOUR = 0`, `GRID_END_HOUR = 24`.
`TimetableGrid.jsx:335-347` renders 25 hour lines per column × 7 columns = 175 divs, plus
25 tick labels, inside a `minHeight: 1440px` scroller — for classes that in practice occupy
08:00–18:00. The UX half of this is U2; the render half is these DOM nodes.

Derive the window from the data:

```js
const [gridStart, gridEnd] = useMemo(() => {
  const times = timetable.flatMap(t => [parseTimeToMins(t.startTime), parseTimeToMins(t.endTime)])
             .concat(exams.flatMap(e => [parseTimeToMins(e.startTime), parseTimeToMins(e.endTime)]))
  if (!times.length) return [8, 18]
  return [Math.max(0, Math.floor(Math.min(...times) / 60) - 1),
          Math.min(24, Math.ceil(Math.max(...times) / 60) + 1)]
}, [timetable, exams])
```

Typically 10–12 hours: ~half the DOM, and no dead scroll space. Keep a "FULL DAY" toggle
next to ALL WEEK / SINGLE DAY for anyone with an 06:00 lab.

- [ ] Grid bounds derived from entries + exams
- [ ] FULL DAY toggle
- [ ] `GRID_START_HOUR`/`GRID_END_HOUR` remain the hard clamp for validation only

## P5 · S4 — Four providers `JSON.stringify` their whole state on every change

`useSemesters.js:49`, `useAttendance.js:29`, `useSettings.jsx:36`,
`ThemeContext.jsx:92`. The guard is correct and load-bearing — `OPTIMISATION_PLAN.md`
flags it as do-not-remove because it prevents pull-write-back loops — but it stringifies
the *entire* semester tree and attendance map on every state change, including every
committed keystroke in the roster.

Replace the string compare with a write-origin flag, which is what the guard actually
means:

```js
const originRef = useRef('local')   // 'local' | 'sync'

// in the sync listener
originRef.current = 'sync'; setSemesters(fresh)

// in the persist effect
useEffect(() => {
  if (originRef.current === 'sync') { originRef.current = 'local'; return }
  API.saveSemesters(semesters)
}, [semesters])
```

Same semantics, O(1) instead of O(state). Keep the stringify in a dev-only assertion for a
release or two if you want belt and braces.

- [ ] Origin flag in all four providers
- [ ] Existing `sync.spec.js` tests still pass (they cover exactly this loop)

## P6 · S4 — No memoization boundaries

`SubjectRow`, `AttendanceToggle`, and the timetable block are re-created on every parent
render. With M1 (stable classes instead of fresh style objects) and M2 (split contexts)
in place, `React.memo` finally becomes effective on them — before those, it is a no-op
because every prop is a new object.

Order matters: **M1 and M2 first**, then add `memo`, then measure with the React Profiler.
Do not add `memo` speculatively.

- [ ] After M1+M2: `memo` on `SubjectRow`, `AttendanceToggle`, `TimetableBlock`
- [ ] Profiler: marking attendance re-renders < 10 components (currently the whole tree)

## P7 · S4 — Everything is in one chunk; fonts block first paint

`index.css:10` — a Google Fonts `@import` as the **first statement** of the stylesheet.
CSS `@import` is render-blocking and serialises: the browser must fetch `index.css`,
parse line 10, *then* start the font request. The `<link rel="preconnect">` tags in
`index.html:7-8` are doing nothing useful because no request is issued until the CSS
parses. Four families are requested (`Share Tech Mono`, `Inter` 4 weights, `IBM Plex Mono`
3 weights, `Bebas Neue`); only `IBM Plex Mono` + `Bebas Neue` (nerv) and
`Inter` + `IBM Plex Mono` (minimal) are ever used — `Share Tech Mono` appears only in
fallback stacks and the `ErrorBoundary`.

```html
<!-- index.html — parallel with the HTML, not after the CSS -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Inter:wght@400;600&family=Bebas+Neue&display=swap" />
```

Also: the fonts are external, so the PWA is not actually offline-capable for typography —
`sw.js` deliberately skips cross-origin requests. Self-hosting the three families as
`woff2` in `public/fonts/` removes the third-party dependency, the render-blocking
round-trip, and the CSP `font-src` exception in one move.

Then split the views (M5's `lazy`) and set explicit chunks:

```js
build: { rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'] } } } }
```

- [ ] Font `@import` → `<link>` in `index.html`
- [ ] Unused families dropped
- [ ] Self-host fonts (removes `fonts.googleapis.com` from CSP)
- [ ] Views lazy-loaded via M5
- [ ] Record new bundle sizes here

---

# Phase 5 — UI/UX

## U1 · S1 — Subject colours are unusable in the `minimal` light theme

`src/data/colors.js`. The header comment claims the palette is "theme-agnostic … so the
timetable blocks stay vibrant regardless of the active UI theme". Measured against the
actual composited backgrounds, that is false for every colour in light mode:

| | on NERV dark (`bg` over `#050505`) | on minimal light (`bg` over `#f8fafc`) |
|---|---|---|
| ORANGE `#fb923c` | 6.79:1 ✅ | **1.73:1 ❌** |
| RED `#f87171` | 5.97:1 ✅ | **1.99:1 ❌** |
| GREEN `#4ade80` | 8.40:1 ✅ | **1.39:1 ❌** |
| BLUE `#60a5fa` | 6.34:1 ✅ | **1.90:1 ❌** |
| AMBER `#fcd34d` | 9.89:1 ✅ | **1.17:1 ❌** |
| TEAL `#2dd4bf` | 8.05:1 ✅ | **1.46:1 ❌** |
| PINK `#f472b6` | 6.12:1 ✅ | **1.94:1 ❌** |
| PURPLE `#c084fc` | 6.22:1 ✅ | **1.93:1 ❌** |
| INDIGO `#818cf8` | 5.63:1 ✅ | **2.16:1 ❌** |
| CYAN `#22d3ee` | 8.21:1 ✅ | **1.42:1 ❌** |
| LIME `#a3e635` | 9.24:1 ✅ | **1.51:1 ❌** |
| ROSE `#fb7185` | 6.09:1 ✅ | **1.93:1 ❌** |

**12 of 12 fail AA. Nine are below 2:1** — that is pale-on-pale, not "low contrast".
This affects subject names on timetable blocks (`TimetableGrid.jsx:439,442`), calendar
chips (`CalendarView.jsx:252`), day-detail rows (`DayDetailModal.jsx:241`), roster rows
(`SubjectRow.jsx:64`), attendance cards (`AttendanceView.jsx:110`), and exam cards
(`ExamsView.jsx:54`) — i.e. the subject name is illegible everywhere in the light theme.

**Fix** — move the palette into the theme layer so each theme picks its own text shade:

```css
/* src/themes/_subjects.css — imported once */
:root {                                          /* dark default */
  --subj-0-bg: rgba(249,115,22,.22); --subj-0-border: #f97316; --subj-0-text: #fb923c;
  /* … 1-11 … */
}
:root[data-theme="minimal"]:not([data-mode="dark"]) {
  --subj-0-bg: rgba(249,115,22,.14); --subj-0-text: #9a3412;   /* orange-800  6.07:1 */
  --subj-1-text: #991b1b;  /* red-800     6.66:1 */
  --subj-2-text: #166534;  /* green-800   6.09:1 */
  --subj-3-text: #1d4ed8;  /* blue-700    5.47:1 */
  --subj-4-text: #92400e;  /* amber-800   6.12:1 */
  --subj-5-text: #115e59;  /* teal-800    6.41:1 */
  --subj-6-text: #9d174d;  /* pink-800    6.35:1 */
  --subj-7-text: #6b21a8;  /* purple-800  7.05:1 */
  --subj-8-text: #3730a3;  /* indigo-800  7.97:1 */
  --subj-9-text: #155e75;  /* cyan-800    6.11:1 */
  --subj-10-text:#3f6212;  /* lime-800    6.20:1 */
  --subj-11-text:#9f1239;  /* rose-800    6.40:1 */
  /* all --subj-N-bg drop to .14 alpha */
}
```

**Validated:** every proposed light value clears AA against its own composited tint —
worst case 5.47:1 (blue), best 7.97:1 (indigo).

Components then read `var(--subj-${idx}-text)` instead of importing the JS palette.
`colors.js` keeps the `name` list for the `ColorPicker` label. Bonus: custom themes gain
the ability to restyle subject colours, which they cannot do today.

- [ ] `_subjects.css` with dark + light-override blocks
- [ ] All six render sites use the CSS vars
- [ ] Re-run the contrast script → 0 failures in both themes
- [ ] Visually check the minimal light theme across all five views

## U2 · S2 — The timetable opens on a mostly-empty 24-hour canvas

Covered structurally by P4. The UX half: `TimetableGrid.jsx:95-104` auto-scrolls to "now"
on mount, but with `GRID_START_HOUR = 0` the user still lands mid-scroll in a 1440 px
canvas where 08:00 is 33 % down. Navigate to another week and the scroll position persists
from wherever you left it. On mobile, most of the visible area is empty grid.

- [ ] Bounds from data (P4)
- [ ] Re-run the auto-scroll on week change, not only on mount
- [ ] Empty state when the semester has no entries at all

## U3 · S2 — Type as small as 6 px

`TimetableGrid.jsx:260-261` sets `fontSize: '6px'` for the "● VIEW" affordance. 7 px
appears in the status badge (`:459`), note marker (`:471`), NOW badge (`:253`),
SUB badge (`DayDetailModal.jsx:245`), and the threshold marker
(`AttendanceView.jsx:132`). 8 px and 9 px are the default across essentially every label
in the app — `grep -c "fontSize: '9px'"` alone is in the dozens.

At 6–8 px, monospace glyphs are 3–4 device pixels tall on a standard display. This is
below the point where the aesthetic is worth the cost, and it is the most common
complaint any reviewer will have.

Once M1a lands this is a token edit, which is the whole reason M1 comes first:

```css
--cad-fs-micro: 10px;   /* was 6-8 */
--cad-fs-xs:    11px;   /* was 9   */
```

Keep the mono/uppercase/tracking aesthetic — it survives a 2–3 px bump intact. Consider a
`compactUI` setting for anyone who genuinely wants the current density.

- [ ] No `fontSize` below `--cad-fs-micro` (10 px) anywhere
- [ ] Screenshot diff of all five views before/after
- [ ] Optional `compactUI` setting

## U4 · S3 — `--cad-text-xlo` fails AA where it carries real content

Measured:

| Pair | Ratio | Verdict |
|---|---|---|
| `text-xlo #6b5f4b` on `bg-elevated #1a1612` (nerv) | **2.88:1** | ❌ FAIL |
| `text-xlo #6b5f4b` on `bg-primary #050505` (nerv) | 3.26:1 | large-text only |
| `text-lo #8a7a5c` on `bg-elevated #1a1612` (nerv) | 4.30:1 | just under AA |
| `text-xlo #94a3b8` on `bg-primary #f8fafc` (minimal light) | **2.45:1** | ❌ FAIL |

`text-xlo` is not decorative: `ExamsView.jsx:85` uses it for the section count
(`UPCOMING (3)`) and `CalendarView.jsx:145` for weekday headers.

Validated replacements: nerv `--cad-text-xlo: #a08e6d` → 5.64:1 on elevated;
minimal light `--cad-text-xlo: #64748b` → 4.55:1. Nudge `--cad-text-lo` up slightly too
so it clears AA on `bg-elevated`, not just on `bg-primary`.

- [ ] Token values updated in both themes
- [ ] Contrast script → all text tokens ≥ 4.5:1 on every surface they appear on
- [ ] Add the contrast script to the repo as `scripts/check-contrast.mjs` and run it in CI

## U5 · S3 — Attendance toggles only appear in SINGLE DAY mode

`TimetableGrid.jsx:451` — `!editMode && attendanceHook && showTodayOnly && !isHoliday`.
In ALL WEEK mode (the default) you must open a modal per class. The hint at `:125` does
say "CLICK BLOCK TO MARK ATTENDANCE", so it is discoverable — but marking a week's worth
of classes is 20+ modal round-trips.

Show the toggle on hover in ALL WEEK mode for blocks tall enough to hold it (> 45 min,
the existing `isShort` threshold), and add a "MARK THIS WEEK" bulk action mirroring
`DayDetailModal`'s QUICK MARK toolbar.

- [ ] Hover toggles in ALL WEEK for non-short blocks
- [ ] Week-level bulk mark
- [ ] Verify no regression in `smoke.spec.js`'s quick-mark test

## U6 · S3 — No undo, anywhere

`removeSubject` (`useSemesters.js:122-128`) deletes the subject **and cascades to every
timetable entry referencing it** — behind a single `✕` with no confirm at all
(`SubjectRow.jsx:146-155`). Deleting a subject with 4 weekly slots and a term of attendance
history is one misclick, and C4's pruner will (correctly) then GC the attendance too.

Minimum: route it through `ConfirmDeleteButton` like every other destructive action, and
say what will be lost — `DELETE MATHEMATICS III + 4 CLASSES?`.

Better: a 6-second undo toast holding the removed slice.

```js
// src/hooks/useUndo.js — one slot, timeout-based, no history stack
const { pushUndo } = useUndo()
removeSubject(id)
pushUndo({ label: `Removed ${subject.name}`, restore: () => setSemesters(snapshot) })
```

- [ ] Subject delete confirms and states the blast radius
- [ ] `useUndo` + toast for subject / entry / exam / semester deletion
- [ ] Undo restores timetable entries and attendance together

## U7 · S4 — Three different destructive-action patterns

- `ConfirmDeleteButton` — 2-step, 2.5 s auto-disarm (timetable entry, exam, logout, purge)
- `SemDropdown.jsx:84-101` — bespoke 3-stage `×` → `SURE?` → `REALLY?`, **no** auto-disarm
- `SubjectRow.jsx:146` — bare `✕`, no confirm at all (U6)

Three severities of consequence, three unrelated interaction models, and the *least*
guarded (bare `✕`) sits on the *most* destructive action (cascading subject delete).

Standardise on `ConfirmDeleteButton` everywhere; give it a `severity` prop where
`'high'` requires typing the label (semester deletion) rather than inventing a third stage.

- [ ] `SemDropdown` uses `ConfirmDeleteButton`
- [ ] `SubjectRow` uses `ConfirmDeleteButton`
- [ ] `severity` prop; bespoke `deleteStage` state deleted

## U8 · S4 — Edit mode is invisible on mobile

The `MODE :: EDIT` strip and its blinking `■` are inside a `hidden sm:flex` container
(`App.jsx:116-124`). Below the `sm` breakpoint the only signal is the EDIT/LOCK button in
the control bar, which is easy to miss and easy to leave on. Meanwhile edit mode changes
what tapping a class block does — edit the entry vs mark attendance — so an unnoticed
mode is a wrong action.

Give `MobileTabBar` a persistent edit indicator, or tint the control bar border with
`--cad-danger` while `editMode` is on (the desktop strip already uses danger for the
blinker — reuse the signal).

- [ ] Edit mode visible at every breakpoint
- [ ] Verify in `smoke.spec.js`'s mobile viewport test

## U9 · S4 — Quick-mark works on future dates

`DayDetailModal.jsx:148-186` — ALL PRESENT / ALL ABSENT on any date, including next
month's. Nothing stops recording attendance for classes that have not happened, which then
counts toward the percentage and the safe-margin advice.

Disable the toolbar for `dateStr > today`, or show `▸ FUTURE DATE` and require a
confirmation. Same guard on `AttendanceToggle` in the calendar and grid.

- [ ] Future dates blocked or confirmed
- [ ] Today itself is still markable

## U10 · S4 — The same backup file cannot be restored twice

`SettingsModal.jsx:308` — `<input type="file">` is never reset, so re-selecting the same
file fires no `change` event and the button appears dead. Fixed in C7's `finally` block.

- [ ] Covered by C7

## U11 · S4 — Wheel hijacking on the calendar

`CalendarView.jsx:57-68` intercepts `onWheel` on the container and pages the month when
`|deltaY| > 20`. A trackpad user scrolling the page — or a mouse user overshooting — jumps
months unexpectedly, and there is no visual hint the gesture exists. The
`e.target.closest('.calendar-scroll')` escape hatch only helps once the grid itself is
scrollable.

Remove it, or gate it behind a modifier (`e.shiftKey`) and document it in the legend
strip, which already has room (`:281-286`).

- [ ] Wheel paging removed or modifier-gated
- [ ] Legend documents any surviving gesture

## U12 · S4 — Sync status is invisible unless you are looking at it

`SyncChip` (`SyncChip.jsx:9-24`) shows `SYNCING` / `SYNCED` / `SYNC FAILED` for 2.5 s then
reverts to `CLOUD SYNC`. A failed sync therefore leaves **no persistent trace** — the user
sees red for 2.5 seconds and then a neutral chip, while `_syncFailed` stays `true`
internally and the retry (`api.js:25-31`) fires silently 10 s later.

Make the failure state sticky until the next success, and expose "last synced" on hover.
This is also where C4's `STORAGE FULL` and D4's unsynced-changes state belong. Given the
app's data lives in `localStorage`, a persistent honest sync indicator is the difference
between "I lost a term of attendance" and "I noticed and exported a backup".

- [ ] Error state persists until the next success
- [ ] `title` shows last-successful-sync time
- [ ] Storage-full and unsynced-changes states surface here

---

# Phase 6 — Accessibility

## A1 · S2 — The timetable is completely keyboard-inaccessible

`TimetableGrid.jsx:394-397` — class blocks are `<div onClick>`. No `role`, no `tabIndex`,
no key handler. Same for the day headers (`:228-237`), the day columns'
click-to-add-entry (`:332`), and the exam blocks (`:486-488`).

`CalendarView.jsx:174-180` does this correctly — `role="button"`, `tabIndex={0}`,
`onKeyDown` for Enter/Space. The pattern exists in the codebase; the timetable just never
adopted it.

Net effect: a keyboard-only user can reach the calendar and mark attendance there, but
**cannot mark attendance, add a class, or edit an entry from the timetable at all** — the
app's primary view.

Use real `<button>`s. They are already `position: absolute` boxes, so the layout cost is
`background: none; border: 0; padding: 0; text-align: left` plus keeping the existing
inline positioning:

```jsx
<button
  type="button"
  onClick={handleBlockAction}
  aria-label={`${displaySubj.name}, ${entry.startTime} to ${entry.endTime}${
    entry.room ? `, room ${entry.room}` : ''}${status ? `, marked ${status}` : ', not marked'}`}
  className="tt-block"
  style={{ position: 'absolute', … }}
>
```

Free wins: Enter/Space, the global `:focus-visible` ring (`index.css:91`), and correct
semantics for screen readers. The day column's click-to-add needs different treatment —
it is a click-position-to-time affordance, so add an explicit `+ ADD` button in the column
header for edit mode rather than trying to make an area click keyboard-operable.

- [ ] Class blocks → `<button>` with descriptive `aria-label`
- [ ] Exam blocks → `<button>`
- [ ] Day headers → `<button>`
- [ ] Keyboard-only path exists for add-entry in edit mode
- [ ] e2e: tab to a block, press Enter, modal opens

## A2 · S3 — `DayDetailModal` re-implements `Modal` and loses its a11y

`DayDetailModal.jsx:41-70` builds its own backdrop and panel. It has `role="dialog"`,
`aria-modal`, `aria-label`, and `useModalDismiss` — but **not** the focus trap
(`Modal.jsx:25-33`), **not** the initial focus move (`:18`), **not** focus restoration
(`:21`), and **not** the body scroll lock (`:19`). So the app's most-used modal is its
least accessible one, and Tab escapes to the page behind it.

It diverges because it slides up from the bottom on mobile and `Modal` is always centred.
Add a `variant="sheet"` to `Modal` and delete the duplicate:

```jsx
export function Modal({ title, hex, onClose, variant = 'center', children }) {
  const wrap = variant === 'sheet'
    ? 'fixed z-50 left-0 right-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4'
```

Four modals then inherit every future a11y fix instead of three.

- [ ] `variant="sheet"` on `Modal`
- [ ] `DayDetailModal` uses `Modal`; ~30 lines of duplicate chrome deleted
- [ ] Focus trap + scroll lock verified in the day modal
- [ ] `smoke.spec.js` focus-restore test extended to cover it

## A3 · S3 — No landmarks, no headings

The entire app is `div`s. There is no `<h1>`, no `<main>`, no `<nav>`, no `<aside>`. A
screen-reader user has no way to jump between the roster and the panel; the document
outline is empty.

- `ControlBar` → `<header>`
- Roster column (`App.jsx:130`) → `<aside aria-label="Subject roster">`
- Panel column (`:159`) → `<main>`
- Tab strips (`:172`, `MobileTabBar`) → `<nav role="tablist">` with
  `role="tab"` / `aria-selected` / `aria-controls`
- Panel headings (`ROSTER`, `PANEL-B`) → `<h2>` styled to look identical

`MobileTabBar.jsx:19` already sets `aria-current="page"`, which is the wrong role for a
tab set — `aria-selected` on `role="tab"` is correct.

- [ ] Landmarks added
- [ ] Real heading hierarchy (visually unchanged)
- [ ] Tab strips use the ARIA tabs pattern
- [ ] Axe DevTools: zero critical issues

## A4 · S4 — Decorative glyphs are announced

`◈`, `⊞`, `◫`, `✎`, `⊠`, `▸`, `∥`, `∷`, `⇄` are used throughout as icons.
`MobileTabBar.jsx:26` renders the icon and the label as siblings, so a screen reader
reads "black square with left half black, TIMETABLE". Mark decorative glyphs
`aria-hidden="true"` — they carry no information a sighted user gets that the adjacent
label does not.

Conversely, `⇄` in `TimetableGrid.jsx:439` and the `📝` note marker at `:473` are the
**only** indication of substitution and notes on a block; those need real text
alternatives, not hiding.

- [ ] Decorative glyphs `aria-hidden`
- [ ] Meaning-bearing glyphs get `<span className="sr-only">` text
- [ ] `.sr-only` utility added to `index.css`

## A5 · S4 — Colour-only status in a few places

`SubjectRow.jsx:135-139` colours the grade point green/orange/red with no other signal.
`ExamsView.jsx:65` colours the countdown chip by proximity. `Dot` (`Dot.jsx`) is
colour-only by design.

Grid attendance badges already pair colour with `P`/`A`/`C` (`TimetableGrid.jsx:465`) —
good. Apply the same principle: pair colour with a glyph or a word wherever it encodes
state.

- [ ] Grade tier gets a non-colour signal
- [ ] Countdown chip states proximity in text (already does — verify)

## A6 · S4 — Focus trap does not skip disabled controls

`Modal.jsx:27` selects `button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`
without filtering `:disabled` or hidden elements. In `SettingsModal` the IMPORT THEME
button is disabled when the input is empty (`:239`), so Shift+Tab from the first element
can land focus on an unfocusable node and the trap stalls.

```js
const nodes = [...panelRef.current.querySelectorAll(SELECTOR)]
  .filter(n => !n.disabled && n.offsetParent !== null)
```

- [ ] Filter disabled/hidden from the trap
- [ ] e2e: tab-cycle `SettingsModal` with the import button disabled

---

# Phase 7 — Docs, types, CI

## X1 — `DOCUMENTATION.md` is stale

Verified inaccuracies:
- `:22-23` cites `useSettings.js` / `useTheme.js`; the files are `useSettings.jsx` and
  `themes/ThemeContext.jsx`.
- `:31` documents `src/assets/`; deleted in `OPTIMISATION_PLAN.md` §1.2.
- `:56` says theme switching maps hex codes onto `:root` — true only for *custom* themes;
  built-ins are static CSS files.
- No mention of exams (a whole tab), the per-key sync merge, `key_updated_at`, the PWA
  service worker, or the migration in `supabase/migrations/`.
- `:15` says the sync debounce triggers `syncToServer()` — accurate, but the whole
  serialize/retry/reconnect layer added in the follow-up batch is undocumented.

- [ ] Rewrite against current source
- [ ] Document the attendance data shape (`{date: {entryId, entryId_note, entryId_sub, isHoliday, examCountAsPresent}}`) — nothing currently explains it and it is the least obvious part of the app
- [ ] Document the sync merge contract and the required SQL migration
- [ ] `README.md:86` project structure — add `exams/`, `views/`

## X2 — Retire `OPTIMISATION_PLAN.md`

24 KB of completed plan in the repo root. Move to `docs/history/2026-08-optimisation.md`
or delete — its useful content is the "Do NOT touch" list, which should graduate into
`CLAUDE.md` or a short `docs/INVARIANTS.md` so it is actually read before someone
"cleans up" the stringify guard.

- [ ] Archive or delete
- [ ] "Do NOT touch" invariants extracted somewhere durable

## X3 — CI

No workflow file exists. Everything (lint, build, 22 e2e tests) is manual.

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test                      # Phase 0
      - run: node scripts/check-contrast.mjs   # U1/U4 regression guard
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

The contrast script is worth keeping permanently — U1 happened because nothing checked,
and it will happen again the next time a theme is added.

- [ ] CI workflow
- [ ] `scripts/check-contrast.mjs` committed
- [ ] Branch protection on the default branch

## X4 — Tighten the production CSP

`index.html:20` — `connect-src` ends with `ws: http:`. Those are dev-server escape
hatches shipped to production, and `http:` permits a plaintext connection to **any**
host, which defeats most of the point of the policy.

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com;
```

Vite can inject the dev-only additions via `transformIndexHtml` so the two environments
differ deliberately rather than by leftover.

`script-src 'unsafe-inline'` is required by the FOUC script at `:11-19`. Replace it with
`'sha256-…'` of that exact script — it never changes at runtime, so the hash is stable.

Self-hosting fonts (P7) additionally removes `https://fonts.googleapis.com` and
`https://fonts.gstatic.com` from the policy.

- [ ] `ws:` / `http:` removed from production
- [ ] Dev additions injected by Vite
- [ ] Inline script hashed
- [ ] Verify Supabase auth + analytics still work

## X5 — `.env.local` is present in the working tree

Gitignored (`.gitignore:20-26`) and not tracked — verified via `git status`. No action
needed, but confirm the anon key it holds has RLS enforced on `user_data`:

```sql
alter table public.user_data enable row level security;
create policy "own row" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The anon key is public by design in a client app; RLS is the only thing standing between
it and every user's data. There is no policy in `supabase/migrations/` — if it was
applied by hand in the dashboard, capture it as a migration so it is reproducible.

- [ ] Confirm RLS is enabled on `user_data`
- [ ] Capture the policy as a migration file

---

# Suggested order

Ship in small, verifiable commits. Suggested sequencing:

1. **Phase 0** — 0.5 d. Nothing else is provable without it.
2. **C1 + C2** — the numbers are wrong today; this is the highest-value change in the plan.
3. **U1** — one CSS file, fixes the most visible defect, zero risk to logic.
4. **C3 · C4 · C7 · C8** — data integrity round.
5. **M1 (a and b)** — tokens and classes; unblocks Phase 5.
6. **A1 + A2** — accessibility round; keyboard access to the primary view.
7. **M2 · M3 · M4 · M5** — structural cleanup, now that tests exist.
8. **Phase 4** — measure before and after; skip anything the profiler does not confirm.
9. **Remaining Phase 5 + 6**, then **Phase 7**.

`D1` (semester dates) is the one item needing a product decision before it can be
scheduled — resolve it early since C1's term-scoping interacts with it.

# Do NOT touch

Carried forward from `OPTIMISATION_PLAN.md`, still valid:

- The persistence-effect write guards. **Cheapen** them (P5), never remove — they prevent
  pull-write-back loops and `sync.spec.js` depends on the behaviour.
- `ThemeContext`'s CSS-injection sanitisation (`:20-64`) and `data-theme-switching`
  transition suppression. Both deliberate, both correct.
- The sync serialization queue (`api.js:17-22`) and the `_serverHasKeyStamps` feature
  detection. Subtle, hard-won, and covered by eight e2e tests.
- `ControlBar`'s isolated `Clock` interval — a good pattern, not an oversight.
