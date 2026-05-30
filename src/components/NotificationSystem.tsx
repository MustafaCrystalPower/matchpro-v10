/**
 * MatchPro™ Notification System
 * ================================
 * • In-app toast notifications with coin/money animation for matches
 * • Web Push subscription management (VAPID)
 * • PWA install prompt with persistence
 * • iOS / Android install banners
 * • Notification bell with badge count in header
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
export type NotifType = 'match' | 'demand' | 'supply' | 'info' | 'warning' | 'error'

export interface AppNotification {
  id:        string
  type:      NotifType
  title:     string
  body:      string
  score?:    number      // match score 0-100
  location?: string
  price?:    string
  timestamp: number
  read:      boolean
  coinAnim?: boolean     // trigger coin rain animation
}

// ── Coin Rain Animation ───────────────────────────────────────────────────────
function CoinParticle({ x, delay, size }: { x: number; delay: number; size: number }) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${x}%`,
    top: -60,
    width:  size,
    height: size,
    fontSize: size,
    lineHeight: 1,
    zIndex: 100000,
    pointerEvents: 'none',
    animation: `coinFall ${1.8 + Math.random() * 1.2}s ${delay}s ease-in forwards`,
    filter: 'drop-shadow(0 2px 4px rgba(251,191,36,0.6))',
  }
  const coins = ['🪙', '💰', '💵', '🤑', '💎', '🪙', '💰', '🪙']
  const coin  = coins[Math.floor(Math.random() * coins.length)]
  return <span style={style}>{coin}</span>
}

function CoinRain({ active, onDone }: { active: boolean; onDone: () => void }) {
  const [particles, setParticles] = useState<{ id: number; x: number; delay: number; size: number }[]>([])

  useEffect(() => {
    if (!active) return
    const pts = Array.from({ length: 28 }, (_, i) => ({
      id:    i,
      x:     5 + Math.random() * 90,
      delay: Math.random() * 0.9,
      size:  20 + Math.floor(Math.random() * 20),
    }))
    setParticles(pts)
    const t = setTimeout(() => { setParticles([]); onDone() }, 3500)
    return () => clearTimeout(t)
  }, [active, onDone])

  if (!particles.length) return null

  return (
    <>
      <style>{`
        @keyframes coinFall {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.6); opacity: 0; }
        }
        @keyframes coinPulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.3); }
        }
      `}</style>
      {particles.map(p => (
        <CoinParticle key={p.id} x={p.x} delay={p.delay} size={p.size} />
      ))}
    </>
  )
}

// ── Match Toast Notification ──────────────────────────────────────────────────
function MatchToast({ notif, onClose, onView }: {
  notif: AppNotification; onClose: () => void; onView: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => close(), 8000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(onClose, 350)
  }, [onClose])

  const isMatch = notif.type === 'match'
  const score   = notif.score || 0
  const color   = isMatch
    ? score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#0ea5e9'
    : notif.type === 'demand' ? '#ef4444'
    : notif.type === 'supply' ? '#0ea5e9'
    : '#64748b'

  const icon = isMatch
    ? score >= 80 ? '🔥' : score >= 60 ? '⚡' : '🎯'
    : notif.type === 'demand' ? '🏠' : notif.type === 'supply' ? '🏗️' : 'ℹ️'

  return (
    <>
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateX(100%) scale(0.9); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(0) scale(1); } to { opacity:0; transform:translateX(100%) scale(0.9); } }
        @keyframes scorePulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
      `}</style>
      <div
        onClick={onView}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: 'linear-gradient(135deg, rgba(8,15,30,0.98), rgba(15,23,42,0.98))',
          border: `1px solid ${color}55`,
          borderLeft: `4px solid ${color}`,
          borderRadius: 14, padding: '14px 16px',
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${color}22`,
          cursor: 'pointer', maxWidth: 380, width: '100%',
          backdropFilter: 'blur(20px)',
          animation: leaving
            ? 'toastOut 0.35s ease forwards'
            : visible ? 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          transition: 'box-shadow 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.7), 0 0 32px ${color}44`)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${color}22`)}
      >
        {/* Icon / Score */}
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: `${color}22`, border: `1px solid ${color}44`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: isMatch ? 'scorePulse 2s ease infinite' : 'none',
        }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          {isMatch && (
            <span style={{ fontSize: 10, fontWeight: 800, color, lineHeight: 1 }}>{score}%</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>
            {notif.title}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4, marginBottom: 6 }}>
            {notif.body}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {notif.location && (
              <span style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                📍 {notif.location}
              </span>
            )}
            {notif.price && (
              <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                💰 {notif.price}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
              {new Date(notif.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={e => { e.stopPropagation(); close() }}
          style={{
            background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, padding: 2, borderRadius: 4, flexShrink: 0,
          }}
        >×</button>
      </div>
    </>
  )
}

// ── Toast Stack Manager ───────────────────────────────────────────────────────
interface ToastItem { notif: AppNotification; coinActive: boolean }

let _globalToastPush: ((n: AppNotification) => void) | null = null

export function pushNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
  const full: AppNotification = {
    ...notif,
    id:        `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read:      false,
  }
  _globalToastPush?.(full)
  // Also store in local storage notification history
  try {
    const history: AppNotification[] = JSON.parse(localStorage.getItem('mp_notifs') || '[]')
    history.unshift(full)
    localStorage.setItem('mp_notifs', JSON.stringify(history.slice(0, 100)))
  } catch {}
  return full
}

export function ToastContainer({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [coinActive, setCoinActive] = useState(false)

  const push = useCallback((notif: AppNotification) => {
    setToasts(prev => [{ notif, coinActive: notif.coinAnim || notif.type === 'match' }, ...prev].slice(0, 5))
    if (notif.type === 'match' || notif.coinAnim) {
      setCoinActive(true)
    }
    // Vibrate on mobile if available
    if ('vibrate' in navigator) {
      navigator.vibrate(notif.type === 'match' ? [100, 50, 100, 50, 200] : [100])
    }
  }, [])

  useEffect(() => { _globalToastPush = push; return () => { _globalToastPush = null } }, [push])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.notif.id !== id))
  }, [])

  return (
    <>
      <CoinRain active={coinActive} onDone={() => setCoinActive(false)} />
      <div style={{
        position: 'fixed', top: 80, right: 20, zIndex: 99998,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(({ notif }) => (
          <div key={notif.id} style={{ pointerEvents: 'auto' }}>
            <MatchToast
              notif={notif}
              onClose={() => removeToast(notif.id)}
              onView={() => {
                removeToast(notif.id)
                if (onNavigate && notif.type === 'match') onNavigate('matches')
                else if (onNavigate) onNavigate('dashboard')
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}

// ── Notification Bell / Header Icon ──────────────────────────────────────────
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const [unread, setUnread] = useState(0)
  const [pulse, setPulse]   = useState(false)

  const refresh = useCallback(() => {
    try {
      const h: AppNotification[] = JSON.parse(localStorage.getItem('mp_notifs') || '[]')
      const cnt = h.filter(n => !n.read).length
      setUnread(cnt)
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [refresh])

  // Pulse when new arrives
  const prevUnread = useRef(0)
  useEffect(() => {
    if (unread > prevUnread.current) {
      setPulse(true)
      setTimeout(() => setPulse(false), 1500)
    }
    prevUnread.current = unread
  }, [unread])

  return (
    <>
      <style>{`
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes badgePop {
          0% { transform: scale(0); }
          70% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
      <button
        onClick={onClick}
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
          width: 38, height: 38, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 18,
          transition: 'background 0.2s, transform 0.1s',
          animation: pulse ? 'bellRing 0.8s ease' : 'none',
        }}
        title={`${unread} unread notifications`}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'linear-gradient(135deg,#ef4444,#f97316)',
            color: '#fff', borderRadius: 10, minWidth: 18, height: 18,
            fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 4px',
            boxShadow: '0 2px 8px rgba(239,68,68,0.6)',
            animation: 'badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  )
}

// ── Notification History Panel ────────────────────────────────────────────────
export function NotificationPanel({ onClose, onNavigate }: {
  onClose: () => void; onNavigate?: (page: string) => void
}) {
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    try {
      const h: AppNotification[] = JSON.parse(localStorage.getItem('mp_notifs') || '[]')
      // Mark all as read
      const marked = h.map(n => ({ ...n, read: true }))
      setNotifs(marked)
      localStorage.setItem('mp_notifs', JSON.stringify(marked))
    } catch {}
    // Check push permission
    setPushEnabled(Notification.permission === 'granted')
  }, [])

  const enablePush = async () => {
    setPushLoading(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushLoading(false); return }
      // Get VAPID public key
      const res = await fetch('/api/push/vapid-public-key')
      const { publicKey } = await res.json()
      const swReg = await navigator.serviceWorker.ready
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      // Save subscription on server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      setPushEnabled(true)
      // Show confirmation notification
      pushNotification({
        type: 'info',
        title: '🔔 Push Notifications Enabled!',
        body: "You'll receive real-time match alerts even when the app is closed.",
        coinAnim: false,
      })
    } catch (e) {
      console.error('Push subscription failed:', e)
    } finally {
      setPushLoading(false)
    }
  }

  const disablePush = async () => {
    try {
      const swReg = await navigator.serviceWorker.ready
      const sub = await swReg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushEnabled(false)
    } catch {}
  }

  const clearAll = () => {
    localStorage.removeItem('mp_notifs')
    setNotifs([])
  }

  const typeColor = (t: NotifType) => ({
    match:   '#22c55e', demand: '#ef4444', supply: '#0ea5e9',
    info:    '#0ea5e9', warning: '#f59e0b', error: '#ef4444',
  }[t] || '#64748b')

  const typeIcon = (t: NotifType) => ({
    match: '🎯', demand: '🏠', supply: '🏗️',
    info: 'ℹ️', warning: '⚠️', error: '❌',
  }[t] || '📩')

  return (
    <>
      <style>{`
        @keyframes panelIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(0,0,0,0.3)' }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 70, right: 16, width: 380, maxHeight: 'calc(100vh - 90px)',
        zIndex: 99991, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg,rgba(8,12,24,0.99),rgba(10,18,36,0.99))',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        backdropFilter: 'blur(24px)',
        animation: 'panelIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>🔔 Notifications</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{notifs.length} total · all marked read</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {notifs.length > 0 && (
                <button onClick={clearAll} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>Clear all</button>
              )}
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#94a3b8', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          </div>

          {/* Push toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: pushEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${pushEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10, padding: '10px 14px',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: pushEnabled ? '#22c55e' : '#f1f5f9' }}>
                {pushEnabled ? '✅ Push Notifications Active' : '🔕 Push Notifications Off'}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                {pushEnabled ? 'Receive alerts even when app is closed' : 'Enable to get match alerts on your device'}
              </div>
            </div>
            <button
              onClick={pushEnabled ? disablePush : enablePush}
              disabled={pushLoading}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: pushLoading ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: 11, transition: 'all 0.2s',
                background: pushEnabled
                  ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
                color: pushEnabled ? '#ef4444' : '#fff',
                opacity: pushLoading ? 0.6 : 1,
              }}
            >
              {pushLoading ? '…' : pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 13 }}>No notifications yet</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Match alerts will appear here</div>
            </div>
          ) : (
            notifs.map(n => (
              <div
                key={n.id}
                onClick={() => { if (onNavigate && n.type === 'match') { onNavigate('matches'); onClose() } }}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '12px 18px', cursor: n.type === 'match' ? 'pointer' : 'default',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, fontSize: 18,
                  background: `${typeColor(n.type)}22`, border: `1px solid ${typeColor(n.type)}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {typeIcon(n.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    {n.location && (
                      <span style={{ fontSize: 10, color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', borderRadius: 4, padding: '1px 6px' }}>📍 {n.location}</span>
                    )}
                    {n.score && (
                      <span style={{ fontSize: 10, color: typeColor(n.type), background: `${typeColor(n.type)}15`, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{n.score}% match</span>
                    )}
                    <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
                      {new Date(n.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ── PWA Install Banner ────────────────────────────────────────────────────────
export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed / dismissed recently
    const dis = localStorage.getItem('mp_pwa_dismissed')
    if (dis && Date.now() - parseInt(dis) < 7 * 24 * 60 * 60 * 1000) return

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // iOS detection
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !('MSStream' in window)
    setIsIOS(ios)

    if (ios) {
      // iOS: show manual install instructions
      setTimeout(() => setShowBanner(true), 3000)
    } else {
      // Android / Chrome: listen for beforeinstallprompt
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setTimeout(() => setShowBanner(true), 2000)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const installApp = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowBanner(false)
      pushNotification({
        type: 'info', title: '📱 MatchPro Installed!',
        body: 'App added to your home screen. Open it anytime for instant match alerts.',
        coinAnim: true,
      })
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    setShowBanner(false)
    localStorage.setItem('mp_pwa_dismissed', Date.now().toString())
  }

  if (!showBanner || dismissed) return null

  return (
    <>
      <style>{`
        @keyframes bannerUp { from { opacity:0; transform:translateX(-50%) translateY(30px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 99995, width: 'min(380px, calc(100vw - 32px))',
        background: 'linear-gradient(135deg,rgba(8,12,24,0.98),rgba(14,165,233,0.15))',
        border: '1px solid rgba(14,165,233,0.45)', borderRadius: 16,
        padding: 16, display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(14,165,233,0.2)',
        backdropFilter: 'blur(24px)',
        animation: 'bannerUp 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <img src="/icons/icon-96x96.png" alt="MatchPro" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>
            📲 Add MatchPro to Home Screen
          </div>
          {isIOS ? (
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
              Tap <strong style={{ color: '#0ea5e9' }}>Share</strong> then <strong style={{ color: '#0ea5e9' }}>Add to Home Screen</strong> to install
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Install for push notifications &amp; offline access
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {!isIOS && (
            <button onClick={installApp} style={{
              background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
            }}>Install App</button>
          )}
          <button onClick={dismiss} style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 11,
          }}>Maybe later</button>
        </div>
      </div>
    </>
  )
}

// ── Utility ───────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// ── Socket.IO match watcher — auto-fire notifications ─────────────────────────
let _matchWatcherStarted = false

export function startMatchWatcher(socket: any) {
  if (_matchWatcherStarted || !socket) return
  _matchWatcherStarted = true

  socket.on('new_messages', ({ messages }: { messages: any[] }) => {
    for (const msg of messages || []) {
      const label = msg.classification?.label?.toLowerCase()
      const ext   = msg.classification?.extracted || {}

      if (label === 'demand') {
        pushNotification({
          type: 'demand',
          title: '🏠 New Buyer Demand Detected',
          body:  msg.body?.slice(0, 120) || 'New demand signal from WhatsApp',
          location: ext.location || undefined,
          price: ext.budget_max ? `EGP ${(ext.budget_max/1e6).toFixed(1)}M budget` : undefined,
          coinAnim: false,
        })
      } else if (label === 'supply') {
        pushNotification({
          type: 'supply',
          title: '🏗️ New Property Listed',
          body:  msg.body?.slice(0, 120) || 'New supply listed on WhatsApp',
          location: ext.location || undefined,
          price: ext.price ? `EGP ${ext.price}` : undefined,
          coinAnim: false,
        })
      }
    }
  })
}

export function fireMatchNotification(score: number, location: string, price?: string) {
  pushNotification({
    type:     'match',
    title:    score >= 80 ? '🔥 Hot Match Found!' : score >= 60 ? '⚡ Strong Match!' : '🎯 Match Found',
    body:     `${score >= 80 ? 'Excellent' : score >= 60 ? 'Great' : 'Good'} match at ${score}% compatibility${location ? ` in ${location}` : ''}`,
    score,
    location,
    price,
    coinAnim: score >= 60,
  })
}
