# Cadence Planner

A local-first academic schedule and attendance manager, built for students who want to track semesters, class rosters, weekly timetables, exams, and daily attendance in one place. Responsive, installable, and usable with no account at all.

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Client-3ECF8E?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Semester and subject roster** — isolated academic terms holding subjects with auto-generated codes, credit hours, grade points, and per-subject colour accents. Live GPA and cumulative CGPA.
- **Weekly timetable grid** — interactive 7-day schedule with edit/view modes, clash detection, optional room tags, and exam blocks that replace the class list on exam days.
- **Attendance tracking** — mark Present / Absent / Cancelled per class instance, add per-date notes, and record substitutions when a slot is taught as another subject. Percentages are measured against a 75% threshold, with "how many more can I miss" and "how many in a row to recover".
- **Exam schedule** — upcoming and completed exams with live countdowns. Exam dates automatically suspend attendance counting for the day, with an opt-in to count that day as present.
- **Theming** — two built-in themes (`nerv`, `minimal`) plus dark/light mode, driven entirely by CSS custom properties. Import your own themes as JSON; they are sanitised before injection.
- **Local-first with optional cloud sync** — fully usable offline on `localStorage`. Sign in and edits sync to Supabase on a 2-second debounce, with per-key merging so a phone and a laptop editing different things don't clobber each other.
- **Installable PWA** — web app manifest plus a service worker that caches the app shell for offline launch.
- **Backup and restore** — export the entire state to a validated JSON file and restore it at any time.
- **Classified operations** — hidden panel for bulk-purging room locations, opened by the Konami code (`↑ ↑ ↓ ↓ ← → ← → B A`) on desktop or five quick taps on the CADENCE logo on mobile.

## Tech stack

| Area | Choice |
| --- | --- |
| Frontend | React 19, Vite |
| Styling | Tailwind CSS + CSS custom properties (theme engine) |
| Database / sync | `@supabase/supabase-js` (lazy-loaded) |
| Analytics | `@vercel/analytics`, `@vercel/speed-insights` |
| Testing | Vitest (unit), Playwright (e2e) |
| Linter | Oxlint |

## Getting started

Requires Node.js `^20.19.0 || >=22.12.0` — Vite 8 refuses to run on older versions.

```bash
git clone https://github.com/Errnolink/cadence-planner.git
cd cadence-planner
npm install
npm run dev
```

Cloud sync is optional. To enable it, create a `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Without these, the app runs entirely offline on `localStorage`.

### Enabling cloud sync

Cloud sync needs a `public.user_data` table in your Supabase project, and two things applied to it:

1. **Row-level security.** The anon key is public by design, so RLS is the only thing protecting user rows. Run [`supabase/migrations/20260801_enable_rls.sql`](supabase/migrations/20260801_enable_rls.sql) — it enables RLS and creates this policy:

   ```sql
   alter table public.user_data enable row level security;
   create policy "own row" on public.user_data
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

2. **The per-key merge column.** Run [`supabase/migrations/20260806_add_key_updated_at.sql`](supabase/migrations/20260806_add_key_updated_at.sql) once from the Supabase SQL Editor. Until you do, the client detects the missing column and falls back to whole-row last-write-wins; nothing breaks, but concurrent edits from two devices will overwrite one another.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Launch the Vite development server |
| `npm run build` | Compile the production bundle |
| `npm run preview` | Preview the production build (the only way to exercise the service worker) |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the Vitest unit suite (pure data layer) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Run the Playwright end-to-end suite |

## Project structure

```text
src/
├── components/      # React UI components
│   ├── attendance/  # Attendance view & subject history
│   ├── calendar/    # Monthly calendar & day detail
│   ├── exams/       # Exam schedule & editor
│   ├── layout/      # Control bar, tab bar, settings, classified panel
│   ├── roster/      # Subject listing, GPA badge
│   ├── timetable/   # Weekly grid & class modals
│   └── ui/          # Reusable micro-components (Modal, Chip, Dot, SyncChip…)
├── data/            # Pure logic: storage/sync API, attendance math, calendar helpers
├── hooks/           # Domain hooks (useSemesters, useAttendance, useSettings, useAuth, useNow)
├── themes/          # Theme context, built-in theme tokens, subject colour tokens
├── App.jsx          # Main application container
├── index.css        # Global CSS, type scale, shared classes, Tailwind directives
└── main.jsx         # Entry point & provider tree

e2e/                 # Playwright specs
public/              # Manifest, service worker, favicon
scripts/             # Dev utilities (theme contrast checker)
docs/history/        # Notes on past work
supabase/migrations/ # SQL to apply to your Supabase project
```

For the data model, the attendance storage shape, the sync contract, and how to write a theme, see [DOCUMENTATION.md](DOCUMENTATION.md).

## License

MIT — see [LICENSE](LICENSE).
