# Cadence Planner — Handoff

**Written:** 2026-08-13. Last updated after the sync-stamp and quick-mark fixes
in §6c.
**Repo:** `C:\Users\Chef\Documents\Errnolink\cadence-planner` · `github.com/Errnolink/cadence-planner`

Read this, then `IMPROVEMENT_PLAN.md` for the full audit and the backlog. This
file covers what changed, what is in flight, and what will bite you.

---

## 1. Where things stand

| Branch | State | Pushed |
|---|---|---|
| `main` | `429d642` — gradebook merged in, plus the awarded-grade and roster work | **yes**, `origin/main` matches |
| `exams-gradebook` | fully contained in `main`; keep or delete, it carries nothing unique | yes |

The gradebook is **on `main`** — §4 describes shipped code, not a side branch.
Five older branches (`perf-upgrade`, `improvement-v2`, `fix/review-issues`,
`mobile-ui-optimisation`, `feature/timetable-fixes-and-substitutes`) predate it
and are stale.

```bash
npm run dev        # vite, :5173
npm test           # vitest — 203 unit tests, all green
npm run test:e2e   # playwright — 17 tests, all green
npm run lint       # oxlint — 3 pre-existing warnings, no errors
npm run build      # vite build
node scripts/check-contrast.mjs   # WCAG gate, 192 pairs, exits 1 on failure
```

**Nothing runs these automatically.** A broken unit test and a broken
interaction both reached `main` described in their own commit messages as
green — see §6c. CI (`IMPROVEMENT_PLAN.md` §X3) is now the highest-value item
in §5 for that reason.

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

### Semester dates are real now

`startDate` / `endDate` bound the term. `isInTerm` (`calendar.js`) is the single
rule, used by both `getDayMeta` and `attendanceMath`'s `traverse` so the two
cannot disagree about a boundary day. Both bounds are inclusive; the comparison
is a plain string compare, which is why dates are stored as `YYYY-MM-DD`.

**A semester with no dates set is unbounded and counts everything** — that is
how every semester behaved before, so no existing record moved. `getDayMeta`
had computed `inTerm` and had tests for it since the audit, but not one of its
three call sites passed `semester`: the helper was wired up and dead.

Out of term, the calendar dims the cell and draws no class chips, the timetable
badges the week `OFF-TERM`, and the day modal says marks there are not counted.
Marking is still allowed — the dates are the user's to get wrong, and silently
discarding a mark is worse than one that admits it does not count.

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

- **rounding** — `'none'` (default) or `'half-up'`. Some universities record
  each component as a whole number, so internals averaging 19.5 of 25 go down
  as 20 and that half mark can cross a grade band. Applied per component in
  `computeSubjectGrade`, *not* to the final total — a college that rounds does
  so before adding the components up.

**The split, the rule and the rounding are independent knobs.** Two colleges
share a split while differing on the rule. Do not re-couple them.

`roundMarks` deliberately runs its input through `toFixed(6)` first. Marks come
from `score / max * weight`, and two mids totalling 29 of 50 weighted to 25 is
exactly 14.5 but arrives as `14.499999999999998` — a plain `Math.round` returns
14 and quietly costs the student the mark. There are 21 such triples across the
realistic range; there is a test naming that one.

Two derived numbers had to learn about rounding, both in the safe direction:

- `targetForGrade` claims the free half mark ("59.5 is recorded as 60") **only**
  when a single component is outstanding, where the gain is exactly 0.5. With
  two left the gain is 0 to 1.0 depending on where each lands, and assuming any
  of it would tell someone they need less than they do.
- `impliedComponentMarks` shifts its window down by the same half, because the
  band bounds the mark the university *recorded*, not the paper that was sat.

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

1. **CI** (§X3) — nothing runs automatically, and §6c is what that costs. Gate
   unit + e2e + the contrast script *and* a mobile-width check; the header
   regression in §9 would have been caught by one assertion.
2. **Attendance context** (`IMPROVEMENT_PLAN.md` §M2). `attendanceHook` is
   prop-drilled through eight components as an opaque bag. This also unblocks #3.
3. **Orphan pruning on delete** — deleting a subject or slot leaves its
   attendance rows until the next boot sweep. Needs #2.
4. **`DOCUMENTATION.md` predates the gradebook *and* the settings page.** Its data model still shows
   `Exam` and a hand-typed `subject.gradePoint` as the grade source; `grading.js`
   (659 lines), assessments, sittings, schemes, bands and `SchemeModal` are
   absent. The largest feature in the app is undocumented.
5. **CSP** (§X4) — `index.html` `connect-src` still ships `ws: http:`, a dev
   escape hatch that permits plaintext HTTP to any host in production.
6. **`API.set` has no quota handling** — a `QuotaExceededError` is caught and
   logged, so the user's edit silently fails to persist. `IMPROVEMENT_PLAN.md` §C4.

---

## 6. Known issues

- **Deleting a subject/slot orphans attendance rows** until the next boot sweep.
- **Restoring a backup reloads the page.** Works, but heavy-handed.
- **The header runs out of room at 320px.** Measured: at 320 CSS px `EDIT` sits
  at x=356 while the document only scrolls to 337, so it is genuinely
  unreachable — the §9 failure mode again, one breakpoint further down. Fine at
  360, 375, 390 and 412. Affects iPhone SE (1st gen) and Android handsets at the
  largest display-size setting. The header's floor is ~368px: `px-3` 24 + five
  `gap-2` 40 + `SemDropdown` `minWidth:110` + three 40px `HudButton`s, and every
  child is `shrink-0`. Dropping the CADENCE logo below `sm` buys ~74px. Not done
  — it changes the header's identity, so it wants a decision, not a patch.
- **Tap targets under 44×44.** Partly addressed — see `.tap-44` in `index.css`.
  A `min-height:44px` on `.btn-mech` is the obvious fix and the wrong one: the
  control bar's fixed floor is already ~368px against 375, so widening its three
  40px buttons would push EDIT back off-screen, and three 44px quick-mark
  toggles would stand taller than the class block they live in. `.tap-44` grows
  the hit region with a centred transparent pseudo-element under
  `@media (pointer: coarse)` — no layout change, desktop untouched.

  **It only suits ISOLATED controls.** The overlay paints above later siblings,
  so two within 44px of each other fight and the loser stops responding. Applied
  and measured: modal close ✕ 10×18 → **39×35** (the panel's `overflow-hidden`
  clips the last few px), calendar month arrows 30×30 → **41×44**, attendance
  filter chips → **44×44**. Tried and **reverted** on the roster remove ✕: its
  overlay reached the subject-name input's own centre column and stole taps from
  it. The dense roster row needs taller rows, not a bigger hit box.

  Still under 44, all in places where growth is constrained by the header floor:
  `SubjectRow.jsx` colour swatch 12×12 and remove ✕ 16×14 · `SemDropdown.jsx`
  delete ~10×13 · `Modal.jsx` close ✕ ~12×15 (`.cad-x` sets no padding at all) ·
  `AttendanceToggle.jsx` `size="sm"` 64×19, three of them 2px apart, which is the
  main phone path for marking attendance · `ColorPicker.jsx` 28×28 ·
  `CalendarView.jsx` month arrows ~30×26 · `.cad-chip` 19px tall. One rule on
  `.btn-mech`/`.cad-x` (`min-height:44px`, visual box kept small with transparent
  padding) would cover most of them.
- **`SubjectRoster.jsx:81-87` — the CR / GP column headers sit ~188px right of
  the values they label on a phone**, because `SubjectRow` is one row at `sm`+
  and two rows below it. Hide the header row below `sm`.
- **`SemDropdown.jsx` advertises `aria-haspopup="menu"`** but the popup has no
  `role="menu"`, focus never enters it, and Escape does not close it. Its delete
  button's armed state changes the visible text to SURE?/REALLY? while the
  `aria-label` stays "Delete <sem>", so the confirm step is silent to a reader.
- **`api.js` swallows `QuotaExceededError`** — the edit is lost with no signal
  and `lastSaved*Ref` has already advanced. `IMPROVEMENT_PLAN.md` §C4.
- **`supabase/migrations/` has no RLS policy.** If it was applied by hand in the
  dashboard it is not in version control, and RLS is the only thing protecting
  user rows from the public anon key.

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

## 6c. Fixed the session after — the "all green" ones

Three things were shipped as passing. They were not. Every command in §1 was run
and read, which is the only reason these surfaced.

**1. Boot was stamped as an edit, and it clobbered the cloud.** Each of the four
providers guarded its persistence effect with an `isFirstRender` ref. StrictMode
mounts twice, so by the second mount the ref was already `false` and the write
happened anyway — stamped with `Date.now()`. Result: opening the app wrote
`semesters`, `active_sem_id`, `attendance` and `settings` into
`cadence_key_stamps` as if the user had just edited all four.

Two consequences, both silent:

- **A fresh device beat the server.** Sign in on a new phone: local stamps say
  "now", the server says "whenever you last edited", so `localWon` fired and the
  **demo seed data was pushed over real cloud data**.
- **Per-key merging never worked.** Whichever device booted last won every key —
  exactly the clobbering the merge exists to prevent.

The fix: a boot write is still performed (storage stays populated, so the first
push after sign-up is unchanged) but goes in **unstamped**, via a new
`skipTimestamp` argument threaded through `API.saveSemesters` and friends into
the `skipTimestampUpdate` parameter `API.set` already had. Mounting is not an
edit. Verified: after boot `cadence_key_stamps` is absent; after marking one
class it holds `attendance` and nothing else.

`e2e/sync.spec.js › fresh device — full pull, never clobbers server` asserts
exactly this and had been failing since it was written. It was recorded here as
"pre-existing, not a regression" — true, and beside the point. **A red test that
asserts real behaviour is a bug report, not a known issue.**

**2. Marking attendance from the timetable silently did nothing.** `.tt-block`
applies `transform: translateY(-1px)` on hover. A transform creates a stacking
context, so the block gained one on hover and lost it on leave, relayering the
quick-mark toggle **mid-gesture**: `mousedown` and `mouseup` resolved to
different elements, the browser dispatched `click` on their common ancestor, and
the toggle's handler never ran. No error, no console output, and the block's
aria-label still read "not marked" afterwards.

Fixed with `isolation: isolate` on `.tt-block` — the stacking context now exists
in both states, so hover changes paint and never layer structure. Bisected by
A/B-ing the CSS in a live browser; the transition, the smooth auto-scroll and
the z-index were each ruled out by measurement first.

**3. `gpa.test.js` asserted a stale shape.** `gradeCoverage` gained an `awarded`
count; the assertion was never updated. The commit that added it says
"203 tests" — that is the total, not the pass count.

The lesson is the same shape as §6b: **a number that looks reasonable is the
hardest kind of bug**, and here the reassuring number was the test count in a
commit message. Read the summary line, not the total.

## 6d. The sweep after that

**The attendance percentage rounded a shortfall up across its own threshold.**
`finalize` did `Math.round`, and `statusTier` was then handed that rounded
figure — so 56 of 75 (74.667%) printed as **75%** and tiered **WATCH**, telling
a student they were at the line while they were below it. `recoveryPath`
disagreed with the tier in the same object. Also true of 149/200, 38/51, 71/95.
Now floors: a displayed percentage can only ever understate. 5 tests, including
an exhaustive sweep over every present/total up to 60.

**`bootPrune`'s module-level memo ignored its own argument after the first
call.** Remounting the hook — which `ErrorBoundary`'s ATTEMPT RECOVERY does —
re-seeded state from the page-load snapshot and then persisted it over
everything marked since, and the debounced push sent the emptied map to the
cloud. The memo existed to make StrictMode's double-invoked initialiser
idempotent, which the `cadence_pruned_at` stamp already does. Deleted.

**`_retryTimer` was cleared but never nulled**, so `scheduleRetry`'s
`if (_retryTimer) return` guard disabled the bounded retry for the rest of the
session after the first successful push.

**"CAN MISS Infinity MORE"** — the overall margin strip was hardcoded green and
hardcoded "SAFE MARGIN", so on a fresh install it printed `Infinity` and to
anyone below the threshold it announced safety. It branches like the per-subject
line now.

**Subject cards in the attendance list were `div onClick`** — the whole tab was
keyboard-inaccessible. Real buttons with composed labels.

**Text that was cut off with nothing to show for it.** Measured at 375px:
- The roster subject name was an `<input>` even in view mode, and an input can
  neither wrap nor ellipsise — the box is 320px and "CONSTITUTION OF INDIA AND
  PROFESSIONAL ETHICS" needs 351px, so four characters vanished silently. View
  mode is wrapping text now; only edit mode keeps the input.
- `SubjectGradeCard`'s title ellipsised away up to 89px of a 297px name. Wraps.
- The calendar chip led with the *time*, so truncation ate the subject code —
  the only identifying part. The time is desktop-only now (screen readers still
  get it). And the chip's `text-overflow: ellipsis` was inert because the chip
  is `display: flex`, so "MATH101" was cut mid-glyph to "MATH10" with no
  ellipsis at all; the code has its own truncating box now.

---

## 7. Do not touch

Carried forward and still valid:

- **The persistence write guards** in the four providers. Cheapen them, never
  remove — they prevent pull-write-back loops and `sync.spec.js` depends on the
  behaviour. Two rules now, both load-bearing: the `lastSaved*Ref` comparison
  (seeded from storage, so an unchanged boot writes nothing) and the
  `isBootWrite` flag (so the one write a mount *does* make carries no
  timestamp). Do not collapse them back into an `isFirstRender` skip — that is
  the shape StrictMode defeated in §6c.
- **`isolation: isolate` on `.tt-block`.** Reads like a cosmetic line and is not;
  removing it makes attendance marking fail silently. §6c.
- **`Modal`'s three variants.** `center`, `sheet` and `page` all share one focus
  trap, focus restore and scroll lock. `SettingsPage` is a `variant="page"` for
  exactly that reason — the last component that hand-rolled full-screen chrome
  (`DayDetailModal`) silently lost all three. Add a variant, never a new shell.
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
