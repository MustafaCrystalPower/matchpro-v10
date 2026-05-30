/**
 * MatchPro™ Service Worker — Push Notifications + Background Sync + Offline Cache
 * Crystal Power Investments | Cairo, Egypt
 */

const SW_VERSION = 'matchpro-v10.1'
const CACHE_NAME = `matchpro-cache-${SW_VERSION}`
const API_CACHE  = `matchpro-api-${SW_VERSION}`

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch Strategy: Network-first for API, Cache-first for static ───────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API: network first, cache 5 min fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then(c => c.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Static: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
        }
        return response
      }).catch(() => caches.match('/index.html'))
    })
  )
})

// ─── Push Notification Handler ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'MatchPro™', body: event.data ? event.data.text() : 'New match found!' }
  }

  const {
    title       = 'MatchPro™ — New Match 🎯',
    body        = 'A new property match was found for you',
    icon        = '/icons/icon-192x192.png',
    badge       = '/icons/icon-96x96.png',
    tag         = 'matchpro-match',
    data: pData = {},
    type        = 'match',
    match_score = null,
    location    = null,
    vibrate     = [200, 100, 200],
  } = data

  const notifTitle = match_score
    ? `🪙 ${match_score}% Match Found!`
    : title

  const notifBody = location
    ? `📍 ${location} — ${body}`
    : body

  const options = {
    body:    notifBody,
    icon:    icon,
    badge:   badge,
    tag:     tag,
    vibrate: vibrate,
    sound:   '/sounds/coin.mp3',
    renotify: true,
    requireInteraction: type === 'urgent',
    data: {
      url:    pData.url || '/?page=matches',
      type:   type,
      ...pData,
    },
    actions: [
      { action: 'view',    title: '👁 View Match' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(notifTitle, options)
  )
})

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: targetUrl })
          return client.focus()
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// ─── Background Sync — Poll for new matches every 5 min ──────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'matchpro-check-matches') {
    event.waitUntil(checkForNewMatches())
  }
})

async function checkForNewMatches() {
  try {
    const resp = await fetch('/api/public/market-summary')
    if (!resp.ok) return
    const data = await resp.json()

    // Check if there are new matches since last check
    const cache = await caches.open(API_CACHE)
    const lastResp = await cache.match('/api/public/market-summary')
    let lastData = null
    if (lastResp) {
      try { lastData = await lastResp.json() } catch {}
    }

    const newMatches = data.total_matches - (lastData?.total_matches || 0)

    if (newMatches > 0) {
      await self.registration.showNotification('MatchPro™ — New Matches! 🎯', {
        body: `${newMatches} new match${newMatches > 1 ? 'es' : ''} found in the market`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: 'matchpro-background-sync',
        data: { url: '/?page=matches' },
        vibrate: [300, 100, 300, 100, 300],
      })
    }

    // Update cache
    await cache.put('/api/public/market-summary', new Response(JSON.stringify(data)))
  } catch { /* silent — offline ok */ }
}

// ─── Message from main thread ─────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}

  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (type === 'SHOW_MATCH_NOTIFICATION') {
    const { match_score, location, property_type, budget } = payload || {}
    self.registration.showNotification('🪙 New Match Found!', {
      body: `${match_score}% match — ${property_type || 'Property'} in ${location}${budget ? ` · ${(budget/1e6).toFixed(1)}M EGP` : ''}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: `match-${Date.now()}`,
      vibrate: [200, 50, 200],
      data: { url: '/?page=matches' },
      actions: [
        { action: 'view',    title: '👁 View' },
        { action: 'dismiss', title: '✕ Skip' },
      ],
    })
  }
})
