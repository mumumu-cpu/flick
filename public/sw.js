// App-shell cache: the page opens from cache instantly (offline too), then refreshes in the background.
const CACHE = 'flick-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    // Stale-while-revalidate for the shell.
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const cached = await c.match('/')
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) c.put('/', res.clone())
            return res
          })
          .catch(() => cached)
        return cached || fresh
      }),
    )
    return
  }

  // Hashed assets never change: cache-first.
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req)
      if (cached) return cached
      const res = await fetch(req)
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon'))) c.put(req, res.clone())
      return res
    }),
  )
})
