/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim }   from 'workbox-core'
import { registerRoute }  from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// ── Core workbox setup ────────────────────────────────────────────────────────
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Cache strategies ──────────────────────────────────────────────────────────
// App shell: stale-while-revalidate for JS/CSS/HTML
registerRoute(
  ({ request }) => ['document', 'script', 'style'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'app-shell', plugins: [new ExpirationPlugin({ maxEntries: 60 })] })
)

// Images: cache first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'images', plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 })] })
)

// API: network first with 5s timeout
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 5, plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })] })
)

// Mapbox tiles: cache first, long TTL
registerRoute(
  ({ url }) => url.hostname.includes('api.mapbox.com') || url.hostname.includes('arcgisonline.com'),
  new CacheFirst({ cacheName: 'map-tiles', plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })] })
)

// ── Push Notification Handler ─────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let data: any = {}
  try { data = event.data.json() } catch { data = { title: 'MatchPro Alert', body: event.data.text() } }

  const { type = 'info', title = 'MatchPro™', body = '', location = '', price = '', score, url = '/' } = data

  // Build notification options
  const icon  = '/icons/icon-192x192.png'
  const badge = '/icons/icon-96x96.png'

  const options: NotificationOptions = {
    body: [body, location ? `📍 ${location}` : '', price ? `💰 ${price}` : ''].filter(Boolean).join('\n'),
    icon,
    badge,
    tag:  `matchpro-${type}`,   // Replace old notifications of same type
    renotify: type === 'match',  // Vibrate even if replacing
    silent: false,
    vibrate: type === 'match' ? [200, 100, 200, 100, 400] : [100, 50, 100],
    data: { url, type, score, location, price },
    actions: type === 'match'
      ? [
          { action: 'view',    title: '🎯 View Match',   icon: '/icons/icon-72x72.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [
          { action: 'view',    title: '📊 Open App', icon: '/icons/icon-72x72.png' },
        ],
  }

  // Choose title emoji based on type and score
  let notifTitle = title
  if (type === 'match') {
    if (score && score >= 80) notifTitle = `🔥 ${title}`
    else if (score && score >= 60) notifTitle = `⚡ ${title}`
    else notifTitle = `🎯 ${title}`
  } else if (type === 'demand') {
    notifTitle = `🏠 ${title}`
  } else if (type === 'supply') {
    notifTitle = `🏗️ ${title}`
  }

  event.waitUntil(
    self.registration.showNotification(notifTitle, options)
  )
})

// ── Notification Click Handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationClickEvent) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl = data.url || '/'

  if (event.action === 'dismiss') return

  event.waitUntil(
    (self.clients as any).matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: WindowClient[]) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.postMessage({ type: 'navigate', url: targetUrl, notifType: data.type })
            return
          }
        }
        // Open new window
        if ((self.clients as any).openWindow) {
          return (self.clients as any).openWindow(targetUrl)
        }
      })
  )
})

// ── Background Sync (offline form submissions) ────────────────────────────────
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-pipeline') {
    event.waitUntil(syncPendingData())
  }
})

async function syncPendingData() {
  // Stub — could sync pending pipeline entries saved in IndexedDB while offline
  console.log('[SW] Background sync triggered')
}
