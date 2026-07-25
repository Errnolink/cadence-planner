# Cadence Planner ⚡

> A modern, responsive, local-first academic schedule & attendance manager featuring a cyberpunk "mech-inspired" UI.

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Client-3ECF8E?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Cadence Planner** is built for students, academics, and power users who want an intuitive yet high-tech interface for tracking semesters, class rosters, weekly timetables, and daily attendance records.

---

## 🌟 Key Features

- **🏛️ Semester & Subject Roster**: Manage isolated academic terms with subject codes, credit hours, instructors, and custom color accents.
- **📅 Weekly Timetable Grid**: Interactive schedule grid supporting time slots, class block creation, edit/view modes, and location tags.
- **✅ Attendance Tracking & Notes**: Track attendance status (Present, Absent, Cancelled) and record class notes per session.
- **🎨 Mech / Cyberpunk Aesthetic**: High-contrast, dynamic CSS-variable theme engine with instant theme switching.
- **💾 Local-First & Cloud Sync**: Operates offline with `localStorage` persistence and automatic debounced background sync to Supabase when authenticated.
- **📤 Backup & Restore**: Export complete timetable data to JSON and restore at any time.
- **🎮 Classified Operations**: Hidden Konami Code listener (`↑ ↑ ↓ ↓ ← → ← → B A`) for administrative tools.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: Tailwind CSS + CSS Custom Properties (Theme Engine)
- **Database / Sync**: `@supabase/supabase-js`
- **Analytics**: `@vercel/analytics`, `@vercel/speed-insights`
- **Linter**: Oxlint

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- `npm` or `yarn`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Errnolink/cadence-planner.git
   cd cadence-planner
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables (Optional for Cloud Sync)**:
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

---

## 📜 Available Scripts

- `npm run dev` – Launch Vite development server
- `npm run build` – Compile production bundle
- `npm run preview` – Preview production build locally
- `npm run lint` – Run Oxlint code analysis

---

## 📂 Project Structure

```text
src/
├── components/      # React UI components (Attendance, Calendar, Timetable, Roster, Layout)
├── data/            # Local Storage API wrapper, Supabase client, default state
├── hooks/           # Domain hooks (useSemesters, useAttendance, useSettings, useTheme)
├── themes/          # Theme context & color mappings
├── App.jsx          # Main application container
└── index.css        # Global CSS & Tailwind directives
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

