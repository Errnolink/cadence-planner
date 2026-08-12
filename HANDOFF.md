# Cadence Planner — Handoff

**Written:** 2026-08-13, end of session.
**Repo:** `C:\Users\Chef\Documents\Errnolink\cadence-planner` · `github.com/Errnolink/cadence-planner`

Read this, then `IMPROVEMENT_PLAN.md` for the full audit and the backlog. This
file covers what changed, what is in flight, and what will bite you.

---

## 1. Where things stand

| Branch | State | Pushed |
|---|---|---|
| `main` | `14aae8e` — audit, correctness fixes, docs | **yes**, `origin/main` matches |
| `exams-gradebook` | 4 commits + uncommitted UI work | **no** |

`main` is green and deployed-ready. `exams-gradebook` branches off it and is
mid-feature — see §4.

```bash
npm run dev        # vite, :5173
npm test           # vitest — 154 unit tests, all green
npm run test:e2e   # playwright — 16 pass, 1 known pre-existing failure (§6)
npm run lint       # oxlint — 3 pre-existing warnings, no errors
npm run build      # vite build
node scripts/check-contrast.mjs   # WCAG gate, 192 pairs, exits 1 on failure
```

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

Vitest added. **154 unit tests** where there were zero. Playwright grew two
selector fixes for the new ARIA roles.

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

## 4. In flight — `exams-gradebook`

Turning the Exams tab from a schedule into a gradebook. Four commits landed,
UI uncommitted.

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

### UI status at handoff

`SubjectGradeCard.jsx`, `SittingRow.jsx`, `SchemeModal.jsx` written;
`ExamsView.jsx` being wired. **Verify before trusting**: `npm run build` and
`npm test` (154), then open the Exams tab. Enter `8/7/4` and `6/9/5` for one
subject — internals should read **19.5 / 25**. Switch the scheme to BEST — it
should become **20 / 25** with Mid 1 flagged `DROPPED`.

If it is broken, the four committed gradebook commits are safe and `main` is
untouched. `git checkout -- src/components/exams/` reverts just the UI.

---

## 5. Next up, in priority order

1. **Finish/verify the gradebook UI** (§4), then feed derived `gradePoint` into
   the GPA badges — they are hand-typed today, and auto-deriving them is the
   actual payoff of this feature. The badge also hardcodes `/ 10.0`; use
   `scaleOf(bands)`, since a 4.0-scale user exists.
2. **Attendance context** (`IMPROVEMENT_PLAN.md` §M2). `attendanceHook` is
   prop-drilled through eight components as an opaque bag. This also unblocks
   the known gap below.
3. **Orphan pruning on delete** — deleting a subject or slot leaves its
   attendance rows until the next boot sweep. Needs #2.
4. **CI** (§X3) — nothing runs automatically. Include the contrast script.
5. **CSP** (§X4) — `index.html` `connect-src` still ships `ws: http:`, a dev
   escape hatch that permits plaintext HTTP to any host in production.
6. **Semester dates are decorative** (§D1) — `startDate`/`endDate` bound nothing.
   Needs a product decision: make them real, or remove them.

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
