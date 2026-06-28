# Cadence Planner

Cadence Planner is a modern, responsive web application designed for students and academics to efficiently track semesters, subjects, timetables, and attendance. It features a unique, technical "mech-inspired" user interface.

## Features

- **Semester & Subject Management**: Organize your academic life by semesters and track the subjects, credits, and details for each term.
- **Roster & Timetable Grid**: Build out your weekly schedule with an intuitive timetable view.
- **Calendar & Attendance Tracking**: Keep tabs on your attendance and view your schedule in a calendar format.
- **Data Persistence**: Uses a custom backend/storage (Supabase integration is set up in dependencies) to keep your schedule safe.
- **Mech Aesthetic**: A highly stylized, terminal-like UI with a cyberpunk feel.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS + Vanilla CSS variables
- **Backend/DB**: Supabase (Client)

## Getting Started

### Prerequisites
Make sure you have Node.js installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Errnolink/cadence-planner.git
   cd cadence-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173/` (or the port specified by Vite).

## Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the app for production.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Lints the codebase using Oxlint.

## License

MIT
