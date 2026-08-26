-- Cadence Planner — row-level security on user_data
-- ==================================================
-- The anon key is public by design in a client app, so RLS is the only
-- thing protecting user rows. This policy was applied by hand in the
-- Supabase dashboard when the project was set up (it is documented in
-- README §Cloud sync); this file captures it so a fresh project is not one
-- forgotten step away from a public table.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste → Run.
--   Idempotent (safe to re-run): drops and recreates the policy.
--
-- WITHOUT RUNNING IT
--   With RLS disabled, anyone holding the anon key can read and write every
--   row in user_data.

alter table public.user_data enable row level security;

drop policy if exists "own row" on public.user_data;
create policy "own row" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
