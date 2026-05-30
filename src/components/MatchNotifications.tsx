/**
 * MatchPro™ MatchNotifications — Complete Notification System
 * Exports: default (MatchNotifications), NotificationBell, useNotifications
 *
 * Features:
 * - 🪙 Coin-drop animation on new match (≥75% score)
 * - 📲 PWA install banner (Android Chrome + iOS Safari)
 * - 🔔 Push notification enable/disable
 * - 🎯 In-app alert tray with match cards
 * - 🔄 Background polling for new matches
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Alert Interface ────────────────────────────────────────────────────────── */
export interface MatchAlertPayload {
  type?: 'match' | 'whatsapp' | 'scraper' | 'system'
  title: string
  body: string
  score?: number
  location?: string
  price?: number
  url?: string
}

export interface StoredAlert extends MatchAlertPayload {
  id: string
  timestamp: Date
  read: boolean
}

/* ─── useNotifications Hook ──────────────────────────────────────────────────── */
export function useNotifications() {
  const [alerts, setAlerts] = useState<StoredAlert[]>([])
  const [pushEnabled, setPushEnabled] = useState(false)
  const [coinDrop, setCoinDrop] = useState<{ active: boolean; score: number; location?: string }>({ active: false, score: 0 })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef(0)

  // Request push permission + subscribe SW
  const enablePush = useCallback(async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setPushEnabled(true)
      localStorage.setItem('matchpro_push', '1')
      // Register periodic sync if available
      if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
        try {
          const reg = await navigator.serviceWorker.ready
          await (reg as any).periodicSync.register('matchpro-check-matches', { minInterval: 5 * 60 * 1000 })
        } catch { /* not supported */ }
      }
    }
  }, [])

  const disablePush = useCallback(() => {
    setPushEnabled(false)
    localStorage.removeItem('matchpro_push')
  }, [])

  // Add alert + trigger coin drop
  const pushAlert = useCallback((payload: MatchAlertPayload) => {
    const alert: StoredAlert = {
      ...payload,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date(),
      read: false,
    }
    setAlerts(prev => [alert, ...prev].slice(0, 50))

    // Coin drop for match alerts with score
    const score = payload.score || 0
    if (score >= 75 || payload.type === 'match') {
      setCoinDrop({ active: true, score: score || 85, location: payload.location })
    }

    // SW push notification
    if (pushEnabled && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'SHOW_MATCH_NOTIFICATION',
          payload: {
            match_score: score,
            location: payload.location || 'Cairo',
            property_type: 'Property',
            budget: payload.price,
          },
        })
      })
    }
  }, [pushEnabled])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  // Init: restore push preference
  useEffect(() => {
    if (localStorage.getItem('matchpro_push') && Notification.permission === 'granted') {
      setPushEnabled(true)
    }
    // Listen for SW navigate messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'NEW_MATCH') {
          pushAlert({
            type: 'match',
            title: `🪙 ${e.data.score}% Match Found!`,
            body: e.data.body || 'New property match available',
            score: e.data.score,
            location: e.data.location,
          })
        }
      })
    }
  }, [pushAlert])

  // Poll every 45s for new matches
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      if (!pushEnabled) return
      try {
        const res = await fetch('/api/public/market-summary')
        if (!res.ok) return
        const data = await res.json()
        const count = data.total_matches || 0
        const prev = lastCountRef.current
        if (prev > 0 && count > prev) {
          const diff = count - prev
          const topLoc = data.top_locations?.[0]?.name || 'Cairo'
          pushAlert({
            type: 'match',
            title: `🎯 ${diff} New Match${diff > 1 ? 'es' : ''} Found!`,
            body: `New buyer-seller matches in ${topLoc}`,
            score: Math.floor(78 + Math.random() * 18),
            location: topLoc,
            url: '/?page=matches',
          })
        }
        lastCountRef.current = count
      } catch { /* offline OK */ }
    }, 45_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pushEnabled, pushAlert])

  return {
    alerts,
    pushEnabled,
    enablePush,
    disablePush,
    pushAlert,
    dismissAlert,
    coinDrop,
    setCoinDropDone: () => setCoinDrop({ active: false, score: 0 }),
  }
}

/* ─── Coin Drop Animation ────────────────────────────────────────────────────── */
function CoinDropOverlay({ score, location, onDone }: { score: number; location?: string; onDone: () => void }) {
  const gold   = score >= 90
  const color  = gold ? '#f59e0b' : score >= 75 ? '#22c55e' : '#0ea5e9'
  const shadow = gold ? '#f59e0b88' : score >= 75 ? '#22c55e88' : '#0ea5e988'
  const coin   = gold ? '🪙' : '🎯'

  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      zIndex: 99999, overflow: 'hidden',
    }}>
      {/* Falling coins */}
      {[...Array(8)].map((_, i) => (
        <span key={i} style={{
          position: 'absolute',
          top: '-60px',
          left: `${8 + i * 11}%`,
          fontSize: gold ? '2rem' : '1.6rem',
          animation: `mpCoinFall 2.3s ease-in ${i * 0.1}s forwards`,
          display: 'inline-block',
          userSelect: 'none',
        }}>{coin}</span>
      ))}

      {/* Score badge */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        animation: 'mpScorePop 2.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        textAlign: 'center',
      }}>
        <div style={{
          width: 130, height: 130, borderRadius: '50%',
          border: `3px solid ${color}`,
          background: `radial-gradient(circle, ${color}22 0%, ${color}08 50%, transparent 70%)`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
          boxShadow: `0 0 40px ${shadow}, 0 0 80px ${color}33, inset 0 0 40px ${color}11`,
        }}>
          <div style={{ fontSize: '2.4rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
            {score}%
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Match
          </div>
        </div>
        <div style={{
          marginTop: 14, fontSize: '1.1rem', fontWeight: 800,
          color: '#f8fafc',
          textShadow: `0 0 24px ${color}, 0 2px 8px rgba(0,0,0,0.8)`,
        }}>
          🎯 New Match Found!
          {location && (
            <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              📍 {location}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mpCoinFall {
          0%   { top:-60px; opacity:1; transform:rotate(0deg) scale(1); }
          55%  { opacity:1; }
          80%  { opacity:0.6; transform:rotate(540deg) scale(0.85); }
          100% { top:110vh; opacity:0; transform:rotate(760deg) scale(0.4); }
        }
        @keyframes mpScorePop {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.2) rotate(-15deg); }
          18%  { opacity:1; transform:translate(-50%,-50%) scale(1.18) rotate(2deg); }
          28%  { transform:translate(-50%,-50%) scale(0.94) rotate(-1deg); }
          38%  { transform:translate(-50%,-50%) scale(1.04) rotate(0deg); }
          50%  { transform:translate(-50%,-50%) scale(1); opacity:1; }
          78%  { opacity:1; transform:translate(-50%,-50%) scale(1); }
          100% { opacity:0; transform:translate(-50%,-50%) scale(0.85); }
        }
      `}</style>
    </div>
  )
}

/* ─── PWA Install Banner ────────────────────────────────────────────────────── */
function PWAInstallBanner({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void
  onDismiss: () => void
}) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  if (isStandalone) return null

  return (
    <div className="fade-in" style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(400px, calc(100vw - 24px))',
      background: 'linear-gradient(135deg, rgba(8,15,30,0.98) 0%, rgba(13,23,48,0.98) 100%)',
      border: '1px solid rgba(14,165,233,0.45)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 99998,
      boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(14,165,233,0.12)',
      backdropFilter: 'blur(24px)',
    }}>
      {/* Icon */}
      <div style={{
        width: 50, height: 50, borderRadius: 13, flexShrink: 0,
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.5rem', fontWeight: 900, color: 'white',
        boxShadow: '0 4px 16px rgba(14,165,233,0.5)',
        letterSpacing: '-0.05em',
      }}>M</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', marginBottom: 3 }}>
          Install MatchPro™
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(248,250,252,0.55)', lineHeight: 1.45 }}>
          {isIOS
            ? <>Tap <strong style={{ color: '#0ea5e9' }}>Share</strong> → <strong style={{ color: '#0ea5e9' }}>Add to Home Screen</strong> for live 🪙 match alerts</>
            : 'Add to home screen — get 🪙 coin alerts for every new match'
          }
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
        {!isIOS && (
          <button
            onClick={onInstall}
            style={{
              padding: '7px 12px',
              background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
              border: 'none', borderRadius: 8,
              color: 'white', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px rgba(14,165,233,0.35)',
            }}
          >⬇ Install</button>
        )}
        <button
          onClick={onDismiss}
          style={{
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7, color: 'rgba(255,255,255,0.45)',
            fontSize: '0.72rem', cursor: 'pointer',
          }}
        >Later</button>
      </div>
    </div>
  )
}

/* ─── NotificationBell (TopBar) ─────────────────────────────────────────────── */
export function NotificationBell({
  count,
  pushEnabled,
  onClick,
}: {
  count: number
  pushEnabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={pushEnabled ? `${count} match alerts` : 'Enable match notifications'}
      style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: count > 0 ? 'rgba(245,158,11,0.14)' : pushEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${count > 0 ? 'rgba(245,158,11,0.45)' : pushEnabled ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        color: count > 0 ? '#f59e0b' : pushEnabled ? '#10b981' : 'var(--text-secondary)',
        fontSize: '1.05rem', cursor: 'pointer',
        position: 'relative', transition: 'all 0.15s',
      }}
    >
      🪙
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 3, right: 3,
          minWidth: 14, height: 14, borderRadius: 7,
          background: '#ef4444',
          border: '1.5px solid var(--bg-secondary)',
          fontSize: '0.55rem', fontWeight: 800, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 2px', lineHeight: 1,
        }}>
          {count > 9 ? '9+' : count}
        </div>
      )}
      {!pushEnabled && (
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 8, height: 8, borderRadius: '50%',
          background: '#6b7280',
          border: '1.5px solid var(--bg-secondary)',
        }} />
      )}
    </button>
  )
}

/* ─── Main MatchNotifications Component ─────────────────────────────────────── */
interface MatchNotificationsProps {
  alerts: StoredAlert[]
  pushEnabled: boolean
  enablePush: () => void
  disablePush: () => void
  dismissAlert: (id: string) => void
  onNavigate: (page: string) => void
  showInstallBanner: boolean
  onInstall: () => void
  onDismissInstall: () => void
}

export default function MatchNotifications({
  alerts,
  pushEnabled,
  enablePush,
  disablePush,
  dismissAlert,
  onNavigate,
  showInstallBanner,
  onInstall,
  onDismissInstall,
}: MatchNotificationsProps) {
  // Access coinDrop from the same hook context — but since App.tsx manages state,
  // we track the latest alert for coin drops locally
  const [coinActive, setCoinActive] = useState(false)
  const [coinScore, setCoinScore] = useState(0)
  const [coinLocation, setCoinLocation] = useState<string | undefined>()
  const prevAlertCount = useRef(0)

  // Trigger coin drop when new match alerts arrive
  useEffect(() => {
    const current = alerts.length
    if (current > prevAlertCount.current) {
      const latest = alerts[0]
      if (latest && (latest.score || 0) >= 75 && latest.type === 'match') {
        setCoinScore(latest.score || 85)
        setCoinLocation(latest.location)
        setCoinActive(true)
      }
    }
    prevAlertCount.current = current
  }, [alerts])

  return (
    <>
      {/* Coin Drop Overlay */}
      {coinActive && (
        <CoinDropOverlay
          score={coinScore}
          location={coinLocation}
          onDone={() => setCoinActive(false)}
        />
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <PWAInstallBanner
          onInstall={onInstall}
          onDismiss={onDismissInstall}
        />
      )}
    </>
  )
}
