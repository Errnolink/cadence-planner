-- Cadence Planner — per-key sync merge (client-side)
-- ==================================================
-- Adds the per-key timestamp map that lets the app merge concurrent edits
-- from multiple devices (e.g. attendance marked on your phone + timetable
-- edited on your laptop) instead of last-write-wins clobbering one side.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste → Run.
--   One statement, idempotent (safe to re-run).
--
-- WITHOUT RUNNING IT
--   The app keeps working exactly as before (whole-row last-write-wins).
--   The client detects the column's absence on the next pull and stays in
--   legacy mode until you run this. Nothing breaks either way.
--
-- AFTER RUNNING IT
--   The next sync from any updated client upgrades its row automatically:
--   per-key timestamps are populated from the whole-row timestamp, and
--   per-key merging takes over from the following pull.

alter table public.user_data
  add column if not exists key_updated_at jsonb;
