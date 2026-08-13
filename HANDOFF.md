# Cadence Planner — Handoff

**Written:** 2026-08-13. Last updated after the gradebook UI, mobile fix and GPA
derivation landed.
**Repo:** `C:\Users\Chef\Documents\Errnolink\cadence-planner` · `github.com/Errnolink/cadence-planner`

Read this, then `IMPROVEMENT_PLAN.md` for the full audit and the backlog. This
file covers what changed, what is in flight, and what will bite you.

---

## 1. Where things stand

| Branch | State | Pushed |
|---|---|---|
| `main` | `14aae8e` — audit, correctness fixes, docs | **yes**, `origin/main` matches |
| `exams-gradebook` | 11 commits — gradebook, mobile fix, derived GPA, scheme editor | **no** |

`main` is green and deployed-ready. `exams-gradebook` branches off it and is
feature-complete — see §4.

```bash
npm run dev        # vite, :5173
npm test           # vitest — 175 unit tests, all green
npm run test:e2e   # playwright — 16 pass, 1 known pre-existing failure (§6)
npm run lint       # oxlint — 3 pre-existing warnings, no errors
npm run build      # vite build
node scripts/check-contrast.mjs   # WCAG gate, 192 pairs, exits 1 on failure
```

### Commits on `exams-gradebook`, oldest first

| Commit | What |
|---|---|
| `cd5aada` | grading math — weighted marks, targets |
| `ccce69b` | sittings and per-part splits |
| `0c60136` | editable grade bands |
| `bc4bb6e` | migrate exams → assessments in state |
| `85ff7f2` | this handoff, archive old plan, drop dead files |
| `c21d8e5` | marks entry UI |
| `3c23708` | mobile header fix |
| `991481f` | GPA derived from marks, scale-aware badges |
| `a1c83b7` `b2ea6d6` | this handoff, updated |
| `a30808b` | scheme editor — free-form components and bands |

**House rule:** commits carry **no** `Co-Authored-By` trailer and PR bodies carry
no "Generated with" footer. The user asked for this explicitly.

---

## 2. What shipped to `main`

Three commits. The audit that drove them is `IMPROVEMENT_PLAN.md`; completed
prior work is archived at `docs/history/2026-08-optimisation.md`.

### Correctness — the attendance engine was producing wrong numbers

All three were silent. None threw, none logged, all changed the percentage the
whole app exists to display.

1. **Exam-day credit ignored the weekday.** `getSubjectStats` credited *every*
   weekly slot of a subject when a day was marked "count as present". A Tuesday
   exam with a subject scheduled MON/WED/FRI scored `present 3 / total 3`;
   correct is `0 / 0`.
2. **The blanket credit ran before the status checks**, so a class explicitly
   marked ABSENT on an exam day was recorded PRESENT.
3. **Substitutes were never counted at all.** `dayData[id+'_sub'] !== subjectId`
   compared a string from a `<select>` against a numeric subject id with `===`.
   Found while fixing the other two. Normalised now — which means percentages
   go *up* for anyone who used substitutes. That is the correct direction.

Also: cleared marks wrote `null` instead of deleting the key (dead rows in
storage and in every sync payload); restoring a backup armed the 2s debounced
push then reloaded, killing the timer, so restores never reached the cloud;
`addSemester` produced `NaN` ids for non-numeric input; exam validation had no
upper bound and no clash detection.

### Accessibility

Timetable class/exam/day-header blocks were `div`s with `onClick` — the primary
view was entirely keyboard-inaccessible. They are real `<button>`s with composed
aria-labels now. `DayDetailModal` hand-rolled its own chrome and so lacked the
focus trap, focus restore and scroll lock that `Modal` provides; `Modal` gained a
`variant="sheet"` and the duplicate is gone. Landmarks, heading hierarchy and a
real ARIA tablist added.

### Contrast

The subject palette lived in `colors.js` as hard-coded hex tuned for the dark
theme. On the `minimal` light theme **all 12 colours failed WCAG AA, nine below
2:1** — subject names were effectively invisible. Colours moved into
`src/themes/_subjects.css` as `--subj-N-{bg,border,text}` with a light override.

`scripts/check-contrast.mjs` flattens all three theme cascades and composites
translucent tints over the surfaces components actually render on. It found
**24 failures across 192 pairs**; all fixed, gate now exits 0. **Run it in CI** —
this class of bug is invisible in review.

### Type scale

Inline font sizes down to 6px replaced with `--cad-fs-*` tokens (floor 10px),
plus `.cad-label` / `.cad-value` / `.cad-input` / `.cad-chip` / `.sr-only` in
`index.css`. There is an opt-in `:root[data-density="compact"]`.

### Testing

Vitest added — **154 unit tests on `main`** where there were zero, now 175 on
`exams-gradebook`. Playwright grew two selector fixes for the new ARIA roles.

---

## 3. Architecture you need to know

### Data layer (`src/data/`) — pure, tested, no React

| Module | Owns |
|---|---|
| `attendanceMath.js` | attendance stats, margins, recovery, orphan pruning |
| `grading.js` | marks → components → weighted total → grade → grade point |
| `calendar.js` | `getDayMeta` — the only place that answers "is this a holiday / exam day / in term" |
| `colors.js` | subject **names** only; `subjectVars(idx)` binds to theme tokens |
| `utils.js` | GPA, time parsing, date helpers |

Keep logic here, not in components. Everything in these files is unit-tested and
that is why the bugs above were provable rather than arguable.

### The attendance map — least obvious structure in the app

```js
attendance = {
  "YYYY-MM-DD": {
    "<entryId>":        "PRESENT" | "ABSENT" | "CANCELLED",
    "<entryId>_note":   string,
    "<entryId>_sub":    "<subjectId>",   // slot substituted to another subject
    "isHoliday":         true,
    "examCountAsPresent": true,
  }
}
```

Keyed by **timetable entry id**, global across semesters, and `_note`/`_sub`
share the namespace by suffix convention. Writers must **delete** keys rather
than write `null`/`false`/`''`, and drop the date object when it empties.

### Sync (`src/data/api.js`)

Local-first. Writes hit `localStorage` immediately, then a 2s debounced push.
Pulls and pushes are serialised through a promise queue, with a bounded 10s
retry and an `online`-event resync. Merging is **per key** against a
`cadence_key_stamps` map — that needs
`supabase/migrations/20260806_add_key_updated_at.sql` run once; the client
detects the column's absence and falls back to whole-row last-write-wins.

`user_data` needs RLS enabled. There is no policy in the migrations folder — if
it was applied by hand in the dashboard, capture it as a migration.

### Theming

Built-in themes are static CSS (`src/themes/<id>/tokens.css`) selected by a
`data-theme` attribute. **Custom** themes are sanitised token objects injected
into a `<style>` block by `ThemeContext.jsx`. Two mechanisms; see
`IMPROVEMENT_PLAN.md` §M8.

Subject colours are theme tokens now, so a custom theme can restyle them.

---

## 4. The gradebook — `exams-gradebook`

Turns the Exams tab from a schedule into a gradebook. Built and committed;
only the scheme editor is outstanding.

### The user's real grading scheme (JNTU)

```
SUBJECT — 100
├── THEORY (external)                                    75
└── INTERNALS                                            25
    ├── Mid 1 ── objective 10 + subjective 10 + assignment 5  = /25 ┐
    └── Mid 2 ── objective 10 + subjective 10 + assignment 5  = /25 ┴─ averaged
```

The assignment sits **inside** each mid, not beside them. His college averages
the two sittings; his friend's takes the **best** one. That switch is the whole
reason the feature exists.

### Model

- **component** — `THEORY` / `INTERNALS`. `weight` is literally its marks out of
  100, so "25 + 75" is expressed directly. Has a `rule` and `parts`.
- **part** — the split inside one sitting, each with its own `max`.
- **sitting** (`attempt`) — Mid 1, Mid 2. The unit the rule compares.
- **assessment** — one mark: `{id, subjectId, componentId, partId, attempt,
  score, maxScore, date, blocksClasses, …}`. `score: null` = ungraded.

**The split and the rule are independent knobs.** Two colleges share a split
while differing on the rule. Do not re-couple them.

**Sittings are summed before the rule compares them.** Ranking loose entries
would let "best of mids" pick the best objective from Mid 1 and the best
subjective from Mid 2 and report a total no real sitting ever scored. There is a
test on exactly that.

### ⚠ The trap — read before touching anything here

`examDates` drives attendance: an exam day removes that day's classes and skips
them in stats. It is now derived from `classBlockingDates(assessments)`, which
reads the `blocksClasses` flag — **not** from every dated assessment.

If you ever widen that back to "any assessment with a date", every assignment
deadline will silently cancel a day of teaching and move the attendance
percentage. Thirteen tests in `migration.test.js` guard this. Do not weaken them.

### Migration

`normalizeSemester` runs on **both** read paths (initial load and cloud pull) and
is idempotent. The legacy `exams` array is deliberately **kept** — nothing reads
it, but a downgrade still shows the exam schedule instead of an empty tab. Drop
it in a later schema version.

### State API (`useSemesters`)

`addSitting(component, subjectId, attempt, shared?)` · `updateAssessment` ·
`setAssessmentScore(id, score)` (`''` clears) · `removeAssessment` ·
`removeSitting` · `setGradingScheme` · `setSubjectScheme(id, scheme|null)`.

### UI status

Built and **verified in a real browser at 390×844**:

```
inputs after 2 sittings: 6
AVERAGE  ->  internals 19.5 / 25   dropped rows: 0
BEST     ->  internals 20 / 25     dropped rows: 2
```

Matches the unit tests. `SubjectGradeCard` collapses per subject and expands to
per-component sittings; `SittingRow` gives each part its own numeric input,
commits on blur and Enter, rejects out-of-range rather than clamping, and dims
a sitting the rule discarded with a `DROPPED` chip and the reason.

`SchemeModal` is complete: preset pickers, free-form component editing
(name, weight, rule, parts, with a live sitting total) and a band table over
floor/label/gp plus scale. `Modal` gained `size="lg"`.

Two behaviours there are deliberate and easy to "fix" wrongly:
- **Cross-field validation does not fight the cursor.** A weight total of 105
  passes through while typing; save just stays blocked and names the real
  number. Enforcing per-field would make the editor unusable.
- **Changing a scheme cannot silently orphan marks.** Removing a component or
  part with graded entries names them with counts and makes save two-step.
  Nothing is deleted. Component ids derive from the label once at creation and
  are not editable, so a rename can never orphan anything.

### GPA is now derived from marks

`subject.gradePoint` was hand-typed and fed the GPA/CGPA badges directly — the
student did the arithmetic. `subjectGradePoint(subject, assessments, scheme)`
now prefers a derived grade and falls back to the typed one.

- The typed value is **never overwritten**. Clearing marks reverts to it.
- Partway through a term it grades the **projection**, not banked marks. Only
  internals in means 19.5 of 100 banked — grading that reports an F for someone
  heading for an A. Once every component is in, the real total is used.
- `computeSemesterGPA` / `computeCGPA` weight by credits, honour per-subject
  scheme overrides, and skip ungraded subjects rather than scoring them zero.
- The badge takes its scale from the band set instead of hardcoding `/ 10.0`,
  and its colour/rank thresholds are proportional — they were absolute (`>= 8`,
  `>= 6`), so a 4.0-scale student needed 8 out of 4 for FIRST CLASS.
- Roster rows mark a computed grade with a dot, in the tooltip and for screen
  readers, so a typed grade is never mistaken for a derived one.

---

## 5. Next up, in priority order

1. **Push `exams-gradebook`.** Eleven commits sit unpushed; `main` has none of
   the gradebook. Decide whether it merges or stays a branch.
2. **Attendance context** (`IMPROVEMENT_PLAN.md` §M2). `attendanceHook` is
   prop-drilled through eight components as an opaque bag. This also unblocks #4.
3. **Orphan pruning on delete** — deleting a subject or slot leaves its
   attendance rows until the next boot sweep. Needs #2.
4. **CI** (§X3) — nothing runs automatically. Include the contrast script *and*
   a mobile-width check; the header regression in §9 would have been caught by
   one assertion.
5. **CSP** (§X4) — `index.html` `connect-src` still ships `ws: http:`, a dev
   escape hatch that permits plaintext HTTP to any host in production.
6. **Semester dates are decorative** (§D1) — `startDate`/`endDate` bound nothing.
   Needs a product decision: make them real, or remove them.
7. **`API.set` has no quota handling** — a `QuotaExceededError` is caught and
   logged, so the user's edit silently fails to persist. `IMPROVEMENT_PLAN.md` §C4.

---

## 6. Known issues

- **`e2e/sync.spec.js › fresh device — full pull` fails.** Pre-existing —
  verified by stashing all work and running it on `070382f`, where it fails
  identically. Not a regression. Asserts real merge behaviour, so worth a look.
- **Deleting a subject/slot orphans attendance rows** until the next boot sweep.
- **Restoring a backup reloads the page.** Works, but heavy-handed.
- **kanso** (separate repo, `Documents/Errnolink/kanso`) has **zero commits and
  no remote** — the whole project exists only on disk. Not this repo's problem
  but the highest-risk thing in the workspace.

---

## 6b. Fixed this session — and why each hid

Recorded because the *shape* of these repeats. None threw, none logged, and
none would show up in review; they were found by measuring rather than reading.

| Fix | Why it was invisible |
|---|---|
| Exam-day credit ignored the weekday | Produced a plausible number. `present 3 / total 3` looks like data, not a bug. |
| Exam-day credit overrode explicit ABSENT | Only fires on a day the user opted into, so it never appears in casual use. |
| Substitutes never counted | `===` between a `<select>` string and a numeric id. The UI still drew the `⇄` badge, so it *looked* wired. |
| 12/12 subject colours failed AA in light theme | The theme was rarely opened, and contrast is not something eyes measure. |
| kanso-style gate blind spot | Our own gate would have missed it too until it flattened all three cascades and composited tints over real surfaces. |
| EDIT off-screen on every phone | Inside a clipping container, so no scrollbar and no overflow warning. The app was read-only on mobile with no sign of it. |
| `nextBandTarget` threw on a band set | Only on a code path the UI had not reached yet. An agent hit it and worked around it locally. |
| GPA badges hardcoded `/ 10.0` | Correct for the only scale anyone had tested. |
| Rank thresholds absolute, not proportional | Same — `>= 8` is right on a 10-point scale and nonsense on a 4.0 one. |
| `+ ADD SITTING` unaddressable by voice | Accessible name read fine to a *reader*; only fails for voice control. |

Two general lessons worth keeping:

- **Test against the surfaces things actually render on**, not the most
  favourable one. That single change took our contrast audit from "0 failures"
  to 24 real ones, and the same blind spot exists in kanso's gate.
- **A number that looks reasonable is the hardest kind of bug.** Every
  attendance fix above was found by writing a test that asserted a specific
  expected value, not by reading the code.

---

## 7. Do not touch

Carried forward and still valid:

- **The persistence write guards** in the four providers. Cheapen them, never
  remove — they prevent pull-write-back loops and `sync.spec.js` depends on the
  behaviour.
- **`ThemeContext`'s CSS-injection sanitiser** and the `data-theme-switching`
  transition suppression. Both deliberate and correct.
- **The sync serialisation queue** (`api.js`) and `_serverHasKeyStamps` feature
  detection. Subtle, hard-won, eight e2e tests.
- **`ControlBar`'s isolated `Clock` interval** — a good pattern, not an oversight.
- **`blocksClasses`** and the `classBlockingDates` derivation. See §4.
- **`GRID_START_HOUR` / `GRID_END_HOUR`** stay as the validation clamp; the
  grid's visible window is derived locally in `TimetableGrid`.

---

## 8. Conventions

- Logic in `src/data/`, pure and unit-tested. Components render.
- No inline `style={{fontSize}}` — use `--cad-fs-*`. Nothing below
  `--cad-fs-micro` (10px).
- Subject colours only via `subjectVars(colorIdx)`. `SUBJECT_COLORS` has no
  `.bg`/`.text`/`.border` any more.
- Hover states in CSS, not `onMouseEnter` style mutation.
- Real `<button>`/`<input>` elements with accessible names. No `div onClick`.
- New colours must pass `scripts/check-contrast.mjs` in **all three** cascades
  (nerv, minimal-light, minimal-dark).

---

## 9. Mobile

This app is used on a phone. Until `3c23708` the control bar needed **518px**
and got 375–412, with `EDIT` at x=450 inside a container that *clips* rather
than scrolls — so edit mode, and with it every add and delete in the app, was
unreachable on mobile with no visible symptom.

**Check any header or toolbar change at 375, 390 and 412 before shipping.** A
horizontal-overflow check is not enough on its own: the clipping ancestor means
`document.scrollWidth === clientWidth` while content sits outside the viewport.
Measure each child's `getBoundingClientRect().right` against the viewport width.

Current state at 375px: header measures 375/375 with EDIT at 363. Clock is
desktop-only, SETTINGS and EDIT are icon-only below `sm` with `sr-only` text,
`HudButton` carries a 40px minimum tap target, and the tab bar drops its wide
tracking so `ATTENDANCE` fits its ~78px cell.

Still outstanding: roughly **180 interactive targets measure under 44×44**
across the app — mostly 12×12 colour swatches in the roster and 23×23 week-nav
arrows in the timetable. Not addressed; the header was the blocking one.
