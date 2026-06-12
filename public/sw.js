/**
 * sw.js – Beach and Food Service Worker
 *
 * Strategie:
 *   - Shell (HTML, CSS, JS, Fonts) → Cache-first mit Netzwerk-Update im Hintergrund
 *   - Bilder (product-images, gallery-images) → Cache-first (lang stabil)
 *   - API / Sanity → Network-first, kein Caching (dynamische Daten)
 *   - Alles andere → Network-first mit Cache-Fallback
 *
 * Cache-Versionen:
 *   Beim Deploy CACHE_VERSION erhöhen → alter Cache wird automatisch geleert.
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE   = `bf-shell-${CACHE_VERSION}`
const IMAGE_CACHE   = `bf-images-${CACHE_VERSION}`

// Dateien, die beim Install sofort gecacht werden (App Shell)
const SHELL_URLS = [
  '/',
  '/favicon.svg',
  '/logo/logo.jpeg',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS)
    ).then(() => self.skipWaiting())
  )
})

// ── Activate: alten Cache löschen ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Nur GET-Requests behandeln
  if (request.method !== 'GET') return

  // Sanity API & externe Dienste → immer Netzwerk, kein Cache
  if (
    url.hostname.includes('sanity.io') ||
    url.hostname.includes('cdn.sanity.io') ||
    url.hostname.includes('spotify.com') ||
    url.hostname.includes('youtube') ||
    url.hostname.includes('openstreetmap')
  ) {
    return // Browser übernimmt
  }

  // Produktbilder & Galerie → Cache-first (Bilder ändern sich selten)
  if (
    url.pathname.startsWith('/product-images/') ||
    url.pathname.startsWith('/gallery-images/')
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // App Shell (HTML, CSS, JS, Fonts, Icons) → Stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    (
      url.pathname === '/' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/logo/') ||
      url.pathname === '/favicon.svg'
    )
  ) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
    return
  }

  // Alles andere → Network-first mit Cache-Fallback
  event.respondWith(networkFirst(request, SHELL_CACHE))
})

// ── Strategien ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName)
  const cached   = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName)
  const cached   = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)
  return cached || fetchPromise
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || new Response('Offline – bitte prüfe deine Internetverbindung.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}