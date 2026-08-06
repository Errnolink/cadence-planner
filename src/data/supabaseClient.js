/**
 * Lazily-created Supabase client.
 *
 * `@supabase/supabase-js` (~160 kB) is split into its own chunk via dynamic
 * import, so it never blocks first paint. The client is created once on first
 * use and cached.
 */
let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
    );
  }
  return clientPromise;
}
