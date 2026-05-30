import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import MatchNotifications, { NotificationBell, useNotifications } from './components/MatchNotifications'
import Dashboard from './pages/Dashboard'
import MarketIntelligence from './pages/MarketIntelligence'
import SupplyDemand from './pages/SupplyDemand'
import Matches from './pages/Matches'
import AssetMatcher from './pages/AssetMatcher'
import Analytics from './pages/Analytics'
import HeatMap from './pages/HeatMap'
import APIExplorer from './pages/APIExplorer'
import Settings from './pages/Settings'
import WhatsApp from './pages/WhatsApp'
import MySearch from './pages/MySearch'
import VersionManager from './pages/VersionManager'
import MarketMap from './pages/MarketMap'
import NLPClassifier from './pages/NLPClassifier'
import LiveSearch from './pages/LiveSearch'
import './App.css'

export type Page =
  | 'dashboard'
  | 'market-intelligence'
  | 'supply-demand'
  | 'matches'
  | 'asset-matcher'
  | 'analytics'
  | 'heatmap'
  | 'whatsapp'
  | 'api-explorer'
  | 'settings'
  | 'my-search'
  | 'version-manager'
  | 'market-map'
  | 'nlp-classifier'
  | 'live-search'

const PAGE_META: Record<Page, { title: string; icon: string; desc: string }> = {
  'dashboard':           { title: 'Overview Dashboard',       icon: '⊞', desc: 'Real-time market snapshot' },
  'market-intelligence': { title: 'Market Intelligence',      icon: '🧠', desc: 'AI-powered location insights' },
  'supply-demand':       { title: 'Supply & Demand',          icon: '⚖️', desc: 'Browse listings & requests' },
  'matches':             { title: 'Property Matches',         icon: '🎯', desc: 'Find qualified buyers instantly' },
  'asset-matcher':       { title: 'Asset Matcher',             icon: '🏆', desc: 'Match your asset across all platforms' },
  'analytics':           { title: 'Analytics & Reports',      icon: '📊', desc: 'Trends, funnels & performance' },
  'heatmap':             { title: 'Market Heat Map',          icon: '🗺️', desc: 'Geographic demand distribution' },
  'whatsapp':            { title: 'WhatsApp Intelligence',    icon: '💬', desc: 'Live WhatsApp message feed' },
  'api-explorer':        { title: 'API Explorer',             icon: '🔌', desc: 'Interactive endpoint tester' },
  'settings':            { title: 'Settings',                 icon: '⚙️', desc: 'Configure preferences & alerts' },
  'my-search':           { title: 'My Search',                icon: '🔍', desc: 'Search all supply in the system' },
  'version-manager':     { title: 'Version Manager',          icon: '🔒', desc: 'Manage feature unlock tiers v1–v10' },
  'market-map':          { title: 'Market Intelligence Map',   icon: '🗺️', desc: 'Live Mapbox demand heatmap — Cairo' },
  'nlp-classifier':      { title: 'NLP Classifier',           icon: '🧬', desc: 'Arabic/English message classification engine' },
  'live-search':         { title: 'Live Scraper',              icon: '🔭', desc: 'Real-time multi-platform property search' },
}

const REFRESH_INTERVAL_MS = 60_000

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [apiData, setApiData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000)
  const [notifications, setNotifications] = useState<Array<{ id: number; msg: string; type: 'info' | 'success' | 'warning' }>>([])  
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const prevMatchCount = useRef<number>(0)
  const { alerts, pushEnabled, enablePush, disablePush, pushAlert, dismissAlert } = useNotifications()

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchMarketData()
    startRefreshCycle()

    // PWA install prompt capture
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true) }
    window.addEventListener('beforeinstallprompt', handler as any)

    // iOS: show banner if not standalone and not dismissed recently
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('matchpro_install_dismissed')
    if (isIOS && !isStandalone && !dismissed) {
      setTimeout(() => setShowInstallBanner(true), 3000)
    }

    // Listen for SW messages (navigate events from notification clicks)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'NAVIGATE') {
          const url = new URL(e.data.url, window.location.origin)
          const page = url.searchParams.get('page') as Page
          if (page) setCurrentPage(page)
        }
      })
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      window.removeEventListener('beforeinstallprompt', handler as any)
    }
  }, [])

  const startRefreshCycle = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    setNextRefreshIn(REFRESH_INTERVAL_MS / 1000)
    refreshTimerRef.current = setInterval(() => {
      fetchMarketData()
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000)
    }, REFRESH_INTERVAL_MS)

    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev > 1 ? prev - 1 : REFRESH_INTERVAL_MS / 1000))
    }, 1000)
  }

  const pushNotification = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Date.now()
    setNotifications(prev => [{ id, msg, type }, ...prev.slice(0, 4)])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const [summaryRes, intelligenceRes] = await Promise.all([
        fetch('/api/public/market-summary',    { signal: controller.signal }),
        fetch('/api/public/market-intelligence', { signal: controller.signal }),
      ])
      clearTimeout(timeout)
      if (!summaryRes.ok || !intelligenceRes.ok) throw new Error('API error')
      const summary     = await summaryRes.json()
      const intelligence = await intelligenceRes.json()
      setApiData({ summary, intelligence, source: 'live' })
      setLastUpdated(new Date())
      pushNotification('Live data refreshed successfully', 'success')
      // Check for new matches and fire coin notification
      const newMatchCount = summary?.total_matches || 0
      if (prevMatchCount.current > 0 && newMatchCount > prevMatchCount.current) {
        const diff = newMatchCount - prevMatchCount.current
        pushAlert({
          type: 'match',
          title: `🎯 ${diff} New Match${diff > 1 ? 'es' : ''} Found!`,
          body: `${diff} new buyer-seller match${diff > 1 ? 'es' : ''} available in your market`,
          score: 87,
          location: summary?.top_locations?.[0]?.name || 'Cairo',
          price: undefined,
          url: '/?page=matches',
        })
      }
      prevMatchCount.current = newMatchCount
    } catch {
      setApiData({ ...getMockData(), source: 'demo' })
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchMarketData()
    startRefreshCycle()
  }

  const renderPage = () => {
    const props = { apiData, loading, refreshData: handleRefresh, lastUpdated }
    switch (currentPage) {
      case 'dashboard':           return <Dashboard           {...props} />
      case 'market-intelligence': return <MarketIntelligence  {...props} />
      case 'supply-demand':       return <SupplyDemand        {...props} />
      case 'matches':             return <Matches             {...props} />
      case 'asset-matcher':        return <AssetMatcher        {...props} />
      case 'analytics':           return <Analytics           {...props} />
      case 'heatmap':             return <HeatMap             {...props} />
      case 'whatsapp':            return <WhatsApp            {...props} />
      case 'api-explorer':        return <APIExplorer         {...props} />
      case 'settings':            return <Settings            {...props} />
      case 'my-search':           return <MySearch            {...props} />
      case 'version-manager':     return <VersionManager      {...props} />
      case 'market-map':          return <MarketMap           {...props} />
      case 'nlp-classifier':      return <NLPClassifier       {...props} />
      case 'live-search':         return <LiveSearch          {...props} />
      default:                    return <Dashboard           {...props} />
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => { setCurrentPage(page) }}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        apiData={apiData}
      />

      <main style={{
        flex: 1,
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '64px',
        transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <TopBar
          currentPage={currentPage}
          loading={loading}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          apiData={apiData}
          nextRefreshIn={nextRefreshIn}
          notifications={notifications}
          onDismissNotification={(id: number) => setNotifications(prev => prev.filter(n => n.id !== id))}
          pushEnabled={pushEnabled}
          onTogglePush={pushEnabled ? disablePush : enablePush}
          alertCount={alerts.length}
        />

        <div style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
          {renderPage()}
        </div>
      </main>

      {/* Toast notifications */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {notifications.map(n => (
          <div key={n.id} className="fade-in" style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: n.type === 'success' ? 'rgba(16,185,129,0.15)' : n.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)',
            border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.4)' : n.type === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(14,165,233,0.4)'}`,
            color: n.type === 'success' ? 'var(--brand-green)' : n.type === 'warning' ? 'var(--brand-gold)' : 'var(--brand-teal)',
            fontSize: '0.8rem',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-md)',
            maxWidth: 300,
            pointerEvents: 'auto',
          }}>
            {n.type === 'success' ? '✓' : n.type === 'warning' ? '⚠' : 'ℹ'} {n.msg}
          </div>
        ))}
      </div>

      {/* MatchPro Notification Engine — coin drops + PWA install + push alerts */}
      <MatchNotifications
        alerts={alerts}
        pushEnabled={pushEnabled}
        enablePush={enablePush}
        disablePush={disablePush}
        dismissAlert={dismissAlert}
        onNavigate={(page) => setCurrentPage(page as Page)}
        showInstallBanner={showInstallBanner}
        onInstall={async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt()
            const choice = await deferredPrompt.userChoice
            if (choice.outcome === 'accepted') {
              pushAlert({ type: 'match', title: '✅ MatchPro Installed!', body: 'App added to home screen. Coin notifications enabled 🪙' })
            }
          }
          setShowInstallBanner(false)
          setDeferredPrompt(null)
        }}
        onDismissInstall={() => {
          setShowInstallBanner(false)
          localStorage.setItem('matchpro_install_dismissed', Date.now().toString())
        }}
      />
    </div>
  )
}

/* ─── TopBar ──────────────────────────────────────────────── */
function TopBar({ currentPage, loading, onRefresh, lastUpdated, onMenuToggle, apiData, nextRefreshIn, notifications, onDismissNotification, pushEnabled, onTogglePush, alertCount }: any) {
  const meta = PAGE_META[currentPage as Page]
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const isLive = apiData?.source === 'live'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 'var(--topbar-height)',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backdropFilter: 'blur(12px)',
      flexShrink: 0,
    }}>
      {/* Left: Menu toggle + page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <button
          onClick={onMenuToggle}
          style={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)'; (e.currentTarget as HTMLElement).style.color = 'var(--brand-teal)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
        >☰</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{ fontSize: '1.25rem' }}>{meta?.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {meta?.title}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span style={{ color: 'var(--border-light)' }}>·</span>
              <span>↻ {nextRefreshIn}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Live/Demo badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '20px',
          fontSize: '0.7rem',
          fontWeight: 700,
          background: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: isLive ? 'var(--brand-green)' : 'var(--brand-gold)',
          border: `1px solid ${isLive ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
          letterSpacing: '0.04em',
        }}>
          <LiveDot active={!loading} color={isLive ? '#10b981' : '#f59e0b'} />
          {isLive ? 'LIVE DATA' : 'DEMO DATA'}
        </div>

        {/* Push Notification Bell */}
        <NotificationBell
          count={alertCount || 0}
          pushEnabled={!!pushEnabled}
          onClick={() => {
            if (!pushEnabled) onTogglePush()
            else setShowNotifPanel(!showNotifPanel)
          }}
        />

        {/* Activity Log */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: notifications.length > 0 ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${notifications.length > 0 ? 'rgba(14,165,233,0.3)' : 'var(--border)'}`,
              color: notifications.length > 0 ? 'var(--brand-teal)' : 'var(--text-secondary)',
              fontSize: '1rem',
              position: 'relative',
              transition: 'all 0.15s',
            }}
          >
            🔔
            {notifications.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 4, right: 4,
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--brand-red)',
                border: '1.5px solid var(--bg-secondary)',
              }} />
            )}
          </button>

          {showNotifPanel && (
            <div className="fade-in" style={{
              position: 'absolute',
              top: '44px',
              right: 0,
              width: 300,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 200,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Recent Activity
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No notifications
                </div>
              ) : (
                notifications.map((n: { id: number; msg: string; type: string }) => (
                  <div key={n.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(30,48,80,0.5)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <span>{n.type === 'success' ? '✓ ' : 'ℹ '}{n.msg}</span>
                    <button onClick={() => onDismissNotification(n.id)} style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 4px' }}>×</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn btn-primary"
          style={{
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '8px 16px',
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

function LiveDot({ active, color }: { active: boolean; color: string }) {
  const [pulse, setPulse] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1400)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      width: 7, height: 7, borderRadius: '50%',
      background: active ? color : 'var(--text-muted)',
      opacity: active && pulse ? 1 : 0.5,
      transition: 'opacity 0.6s',
      boxShadow: active && pulse ? `0 0 6px ${color}` : 'none',
      flexShrink: 0,
    }} />
  )
}

/* ─── Mock data ──────────────────────────────────────────── */
export function getMockData() {
  return {
    summary: {
      total_supply:  4224,
      total_demand:  7626,
      total_matches: 56566,
      top_locations: [
        { name: 'Madinaty',          demand: 1931, supply:  478, pressure: '4.04' },
        { name: 'Fifth Settlement',  demand: 1245, supply:  380, pressure: '3.28' },
        { name: 'New Capital',       demand:  890, supply:  210, pressure: '4.24' },
        { name: 'Sheikh Zayed',      demand:  650, supply:  320, pressure: '2.03' },
        { name: 'Rehab City',        demand:  780, supply:  298, pressure: '2.62' },
        { name: 'Nasr City',         demand:  520, supply:  410, pressure: '1.27' },
        { name: 'Heliopolis',        demand:  430, supply:  390, pressure: '1.10' },
        { name: 'Zamalek',           demand:  280, supply:  180, pressure: '1.56' },
        { name: 'Maadi',             demand:  340, supply:  225, pressure: '1.51' },
        { name: 'North Coast',       demand:  560, supply:  333, pressure: '1.68' },
      ],
    },
    intelligence: {
      version: '10.0.0',
      summary: { total_supply: 4224, total_demand: 7626 },
      markets: [
        { location: 'Madinaty',         pressure_index: 4.04, market_signal: 'seller',   demand: 1931, supply:  478, avg_price: 4800000, price_trend: '+12%', hot_types: ['apartment','villa'] },
        { location: 'Fifth Settlement', pressure_index: 3.28, market_signal: 'seller',   demand: 1245, supply:  380, avg_price: 5500000, price_trend: '+8%',  hot_types: ['villa','townhouse'] },
        { location: 'New Capital',      pressure_index: 4.24, market_signal: 'seller',   demand:  890, supply:  210, avg_price: 3200000, price_trend: '+18%', hot_types: ['apartment','studio'] },
        { location: 'Sheikh Zayed',     pressure_index: 2.03, market_signal: 'balanced', demand:  650, supply:  320, avg_price: 6200000, price_trend: '+4%',  hot_types: ['villa','apartment'] },
        { location: 'Rehab City',       pressure_index: 2.62, market_signal: 'seller',   demand:  780, supply:  298, avg_price: 3800000, price_trend: '+7%',  hot_types: ['apartment','duplex'] },
        { location: 'Nasr City',        pressure_index: 1.27, market_signal: 'buyer',    demand:  520, supply:  410, avg_price: 2800000, price_trend: '+2%',  hot_types: ['apartment','studio'] },
        { location: 'Heliopolis',       pressure_index: 1.10, market_signal: 'buyer',    demand:  430, supply:  390, avg_price: 3500000, price_trend: '+1%',  hot_types: ['apartment','duplex'] },
        { location: 'Zamalek',          pressure_index: 1.56, market_signal: 'balanced', demand:  280, supply:  180, avg_price: 8500000, price_trend: '+5%',  hot_types: ['apartment','penthouse'] },
        { location: 'Maadi',            pressure_index: 1.51, market_signal: 'balanced', demand:  340, supply:  225, avg_price: 4200000, price_trend: '+3%',  hot_types: ['villa','apartment'] },
        { location: 'North Coast',      pressure_index: 1.68, market_signal: 'balanced', demand:  560, supply:  333, avg_price: 7500000, price_trend: '+9%',  hot_types: ['chalet','villa'] },
      ],
    },
  }
}
