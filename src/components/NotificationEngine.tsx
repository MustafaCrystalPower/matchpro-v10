/**
 * MatchPro™ Notification Engine
 * - PWA Install Banner (Add to Home Screen)
 * - Push Notification subscription
 * - Coin-drop match alert animation
 * - In-app notification bell + tray
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────────── */
export interface MatchAlert {
  id: string
  match_score: number
  location: string
  property_type: string
  budget?: number
  bedrooms?: number
  source: string
  timestamp: Date
  read: boolean
}

interface NotificationEngineProps {
  apiData?: any
  onNavigate?: (page: string) => void
}

/* ─── Coin Drop Animation Component ──────────────────────────────────────────── */
function CoinDrop({ score, onDone }: { score: number; onDone: () => void }) {
  const color = score >= 90 ? '#f59e0b' : score >= 75 ? '#22c55e' : '#0ea5e9'
  const glow  = score >= 90 ? '#f59e0b' : score >= 75 ? '#22c55e' : '#0ea5e9'

  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 99998,
      overflow: 'hidden',
    }}>
      {/* Multiple coin particles */}
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-60px',
            left: `${10 + i * 13}%`,
            animation: `coinFall 2.4s ease-in ${i * 0.12}s forwards`,
            fontSize: score >= 90 ? '2.2rem' : '1.8rem',
          }}
        >
          🪙
        </div>
      ))}

      {/* Central score badge */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'scorePop 2.6s ease forwards',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow}33 0%, transparent 70%)`,
          border: `3px solid ${color}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 40px ${glow}66, 0 0 80px ${glow}33`,
          margin: '0 auto',
        }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color, lineHeight: 1 }}>
            {score}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: 600 }}>
            MATCH
          </div>
        </div>
        <div style={{
          marginTop: 12,
          fontSize: '1rem',
          fontWeight: 700,
          color: 'white',
          textShadow: `0 0 20px ${glow}`,
        }}>
          New Match Found! 🎯
        </div>
      </div>

      <style>{`
        @keyframes coinFall {
          0%   { top: -60px; opacity: 1; transform: rotate(0deg) scale(1); }
          60%  { opacity: 1; transform: rotate(360deg) scale(1.1); }
          80%  { transform: rotate(540deg) scale(0.9); }
          100% { top: 110vh; opacity: 0; transform: rotate(720deg) scale(0.5); }
        }
        @keyframes scorePop {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
          15%  { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
          25%  { transform: translate(-50%,-50%) scale(0.95); }
          35%  { transform: translate(-50%,-50%) scale(1.05); }
          45%  { transform: translate(-50%,-50%) scale(1); }
          75%  { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(0.8); }
        }
      `}</style>
    </div>
  )
}

/* ─── PWA Install Banner ──────────────────────────────────────────────────────── */
function InstallBanner({ onDismiss }: { onDismiss: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (localStorage.getItem('pwa-install-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setVisible(true), 2000)
    }

    window.addEventListener('beforeinstallprompt', handler as any)
    window.addEventListener('appinstalled', () => setInstalled(true))

    // Show manually after 5s if no prompt (iOS)
    const iosTimer = setTimeout(() => {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isInStandalone = window.matchMedia('(display-mode: standalone)').matches
      if (isIOS && !isInStandalone && !localStorage.getItem('pwa-install-dismissed')) {
        setVisible(true)
      }
    }, 5000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as any)
      clearTimeout(iosTimer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setInstalling(false)
    setDeferredPrompt(null)
    dismiss()
  }

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem('pwa-install-dismissed', '1')
    onDismiss()
  }

  if (!visible || installed) return null
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="fade-in" style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(420px, calc(100vw - 32px))',
      background: 'rgba(8,15,30,0.97)',
      border: '1px solid rgba(14,165,233,0.4)',
      borderRadius: 16,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      zIndex: 99999,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(14,165,233,0.15)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* App Icon */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.6rem',
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(14,165,233,0.4)',
        fontWeight: 800,
        color: 'white',
        letterSpacing: '-0.05em',
      }}>M</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>
          Install MatchPro™
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(248,250,252,0.6)', lineHeight: 1.4 }}>
          {isIOS
            ? 'Tap Share → "Add to Home Screen" for instant access + match alerts'
            : 'Add to home screen for instant match notifications 🪙'}
        </div>
        {isIOS && (
          <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📤</span> Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              padding: '8px 14px',
              background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: installing ? 'not-allowed' : 'pointer',
              opacity: installing ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {installing ? '⏳' : '⬇ Install'}
          </button>
        )}
        <button
          onClick={dismiss}
          style={{
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >Not now</button>
      </div>
    </div>
  )
}

/* ─── Notification Bell ───────────────────────────────────────────────────────── */
export function NotificationBell({
  alerts,
  onClear,
  onNavigate,
}: {
  alerts: MatchAlert[]
  onClear: (id: string) => void
  onNavigate?: (page: string) => void
}) {
  const [open, setOpen] = useState(false)
  const unread = alerts.filter(a => !a.read).length
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function scoreColor(s: number) {
    if (s >= 90) return '#f59e0b'
    if (s >= 75) return '#22c55e'
    if (s >= 60) return '#0ea5e9'
    return '#6b7280'
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Match Alerts"
        style={{
          width: 36, height: 36,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: unread > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${unread > 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
          color: unread > 0 ? '#f59e0b' : 'var(--text-secondary)',
          fontSize: '1.1rem', cursor: 'pointer', position: 'relative',
          transition: 'all 0.15s',
        }}
      >
        🪙
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            width: unread > 9 ? 16 : 12,
            height: 12,
            borderRadius: 6,
            background: '#ef4444',
            border: '1.5px solid var(--bg-secondary)',
            fontSize: '0.55rem',
            fontWeight: 800,
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute',
          top: 44, right: 0,
          width: 320,
          maxHeight: 420,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              🪙 Match Alerts
              {unread > 0 && (
                <span style={{ padding: '1px 6px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 4, fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800 }}>
                  {unread} NEW
                </span>
              )}
            </span>
            {alerts.length > 0 && (
              <button
                onClick={() => alerts.forEach(a => onClear(a.id))}
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear all
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>🪙</div>
                No match alerts yet — run a search to start
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => { onNavigate?.('matches'); setOpen(false) }}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    background: alert.read ? 'transparent' : 'rgba(245,158,11,0.04)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = alert.read ? 'transparent' : 'rgba(245,158,11,0.04)'}
                >
                  {/* Score ring */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: `conic-gradient(${scoreColor(alert.match_score)} ${alert.match_score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 8px ${scoreColor(alert.match_score)}44`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.62rem', fontWeight: 800, color: scoreColor(alert.match_score),
                    }}>
                      {alert.match_score}%
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {alert.property_type.charAt(0).toUpperCase() + alert.property_type.slice(1)} in {alert.location}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {alert.bedrooms ? `${alert.bedrooms}BR · ` : ''}
                      {alert.budget ? `${(alert.budget / 1e6).toFixed(1)}M EGP · ` : ''}
                      {alert.source}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {timeSince(alert.timestamp)}
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); onClear(alert.id) }}
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0 }}
                  >×</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main NotificationEngine Hook + Component ───────────────────────────────── */
export function useNotificationEngine() {
  const [alerts, setAlerts] = useState<MatchAlert[]>([])
  const [coinDrop, setCoinDrop] = useState<{ active: boolean; score: number }>({ active: false, score: 0 })
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMatchCountRef = useRef<number>(0)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
    // Listen for SW messages (navigate from push click)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage)
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      }
    }
  }, [])

  const handleSWMessage = (event: MessageEvent) => {
    if (event.data?.type === 'NAVIGATE') {
      window.location.hash = event.data.url || ''
    }
  }

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  const triggerCoinDrop = useCallback((score: number) => {
    setCoinDrop({ active: true, score })
  }, [])

  const addAlert = useCallback((alert: Omit<MatchAlert, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: MatchAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      read: false,
    }
    setAlerts(prev => [newAlert, ...prev].slice(0, 50))

    // Trigger coin drop for high-score matches
    if (alert.match_score >= 75) {
      triggerCoinDrop(alert.match_score)
    }

    // In-browser notification
    if (permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'SHOW_MATCH_NOTIFICATION',
          payload: alert,
        })
      })
    }
  }, [permission, triggerCoinDrop])

  const clearAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }, [])

  // Poll for new matches every 30s
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch('/api/public/market-summary')
        if (!resp.ok) return
        const data = await resp.json()
        const current = data.total_matches || 0
        const prev = lastMatchCountRef.current

        if (prev > 0 && current > prev) {
          const diff = current - prev
          // Simulate a new match alert from market data
          const topLoc = data.top_locations?.[0]
          addAlert({
            match_score: Math.floor(75 + Math.random() * 20),
            location: topLoc?.name || 'Cairo',
            property_type: 'apartment',
            budget: topLoc ? topLoc.demand * 2000 : 3500000,
            bedrooms: Math.floor(2 + Math.random() * 2),
            source: 'MatchPro DB',
          })
        }
        lastMatchCountRef.current = current
      } catch { /* silent */ }
    }, 30_000)
  }, [addAlert])

  useEffect(() => {
    startPolling()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [startPolling])

  return {
    alerts,
    coinDrop,
    permission,
    requestPermission,
    addAlert,
    clearAlert,
    markAllRead,
    setCoinDropDone: () => setCoinDrop({ active: false, score: 0 }),
    triggerCoinDrop,
  }
}

/* ─── Main Export: NotificationEngine renders overlays + banner ──────────────── */
export default function NotificationEngine({ onNavigate }: NotificationEngineProps) {
  const engine = useNotificationEngine()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  return (
    <>
      {/* Coin Drop Overlay */}
      {engine.coinDrop.active && (
        <CoinDrop
          score={engine.coinDrop.score}
          onDone={engine.setCoinDropDone}
        />
      )}

      {/* PWA Install Banner */}
      {!bannerDismissed && (
        <InstallBanner onDismiss={() => setBannerDismissed(true)} />
      )}
    </>
  )
}

/* ─── Utility ─────────────────────────────────────────────────────────────────── */
function timeSince(date: Date): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
