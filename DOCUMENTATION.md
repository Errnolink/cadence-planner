# Cadence Planner: Technical Documentation

## Overview
Cadence Planner is a modern, client-side heavy React application (using Vite) designed for academic planning. It provides students and academics with an intuitive, "mech-aesthetic" interface to manage semesters, class rosters, weekly timetables, and daily attendance. 

The architecture is primarily built around React functional components and custom hooks, with state heavily persisted to `localStorage` (via a centralized API wrapper) to ensure high performance and offline capability. It also supports background syncing to a Supabase backend when an active session is present.

---

## Architecture & Data Flow

### 1. Data Persistence Layer (`src/data/api.js`)
Instead of scattering `localStorage` calls throughout the app, all data access goes through a central `API` object. This ensures schema consistency and allows for debounced cloud-syncing.
- **Local First**: Data is read instantly from `localStorage`.
- **Cloud Sync**: When a user modifies data (using `API.set`), the update is saved locally and a debounced timer (2000ms) triggers `API.syncToServer()`.
- **Import/Export**: The app supports downloading the entire JSON state as a backup and restoring it natively.

### 2. State Management (Custom Hooks)
The application avoids heavy state-management libraries (like Redux or Zustand) in favor of domain-specific custom hooks:
- **`useSemesters.js`**: Manages the core data structure (Semesters -> Subjects -> Timetable entries).
- **`useAttendance.js`**: Manages attendance records, mapped by date and subject.
- **`useSettings.js`**: Controls global preferences (e.g., showing locations, alternating Saturday holidays).
- **`useTheme.js`**: Manages the dynamic CSS variable injection for the "mech" aesthetic.

---

## Directory Structure

```text
src/
├── assets/          # Static assets (images, fonts, etc.)
├── components/      # React UI Components
│   ├── attendance/  # Attendance tracking views
│   ├── calendar/    # Monthly/Weekly calendar views
│   ├── layout/      # Core layout wrappers (ControlBar, Modals, TabBar)
│   ├── roster/      # Subject listing and management
│   ├── timetable/   # Grid layout for the weekly schedule
│   └── ui/          # Reusable micro-components (Buttons, Dots, Icons)
├── data/            # API wrapper, default constants, Supabase client
├── hooks/           # Core state and logic hooks
├── themes/          # Theme definitions and CSS variable mappings
├── App.jsx          # Main application container and routing logic
├── index.css        # Global CSS and Tailwind directives
└── main.jsx         # React DOM entry point
```

---

## UI & Styling System ("Mech Aesthetic")

Cadence Planner uses a highly stylized, terminal/mech-inspired UI. 
- **Tailwind CSS** is used for layout, spacing, and structural utility classes.
- **Vanilla CSS Variables** (`var(--cad-bg-primary)`, `var(--cad-accent)`, etc.) are used for colors, borders, and typography.

### Theme Switching (`src/themes/ThemeContext.jsx`)
Themes are simply JSON objects containing color hex codes. When a theme is selected (via `ThemeContext.jsx`), the app maps these hex codes to standard CSS variables and injects them onto the `document.documentElement` (`:root`). This allows instantaneous, app-wide theme switching without re-rendering components.

---

## Key Features & Workflows

### 1. Semester & Roster Management
Users create Semesters, which act as isolated data containers. Inside a semester, users add "Subjects" (with properties like Name, Code, Credits, Color). These subjects populate dropdowns in the Timetable view.

### 2. Timetable Grid
The `TimetableGrid` component maps out a 7-day week against time blocks. Clicking empty slots opens a modal (`TimetableModal.jsx`) to create a new class block. 

### 3. Classified Operations (Easter Egg)
The app includes a secret Konami Code listener inside `App.jsx` (`ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft, ArrowRight, b, a`). When triggered, it opens a "Classified Operations" panel that allows users to purge all room locations across all semesters at once.

---

## Deployment & Build
Built on Vite, the deployment process is standard for modern static React apps:
1. `npm run build` compiles the application into the `dist/` directory.
2. The output can be hosted on any static hosting provider (Vercel, Netlify, GitHub Pages, etc.).
