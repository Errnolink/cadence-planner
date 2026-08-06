/**
 * Cadence service worker — offline app shell, no build tooling.
 *
 * Strategy:
 *  - /assets/* (content-hashed by Vite): cache-first, populate on first use.
 *  - navigations: network-first, falling back to the cached index.html.
 *  - everything else: untouched (Supabase, fonts, analytics).
 */
const CACHE = 'cadence-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return

  const url = new URL(request.url)

  // Hashed assets are immutable — serve from cache, fill on first fetch
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
        )
      )
    )
    return
  }

  // App shell — always try network first for fresh index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
  }
})
