import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import { ToastContainer, NotificationBell, NotificationPanel, PWAInstallBanner, startMatchWatcher } from './components/NotificationSystem'
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
import BrokerAnalytics from './pages/BrokerAnalytics'
import CRMPipeline from './pages/CRMPipeline'
import MarketMap from './pages/MarketMap'
import LiveScraper from './pages/LiveScraper'
import NLPEngine from './pages/NLPEngine'
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
  | 'broker-analytics'
  | 'crm-pipeline'
  | 'market-map'
  | 'live-scraper'
  | 'nlp-engine'

const PAGE_META: Record<Page, { title: string; icon: string; desc: string }> = {
  'dashboard':           { title: 'Market Overview',          icon: '⊞',  desc: 'Real-time market snapshot' },
  'market-intelligence': { title: 'Market Intelligence',      icon: '🧠', desc: 'AI-powered location insights' },
  'supply-demand':       { title: 'Supply & Demand',          icon: '⚖️', desc: 'Browse listings & requests' },
  'matches':             { title: 'Property Matches',         icon: '🎯', desc: 'Find qualified buyers instantly' },
  'asset-matcher':       { title: 'Asset Matcher',            icon: '🏆', desc: 'Match your asset across all platforms' },
  'analytics':           { title: 'Analytics & Reports',      icon: '📊', desc: 'Trends, funnels & performance' },
  'heatmap':             { title: 'Market Heat Map',          icon: '🗺️', desc: 'Geographic demand distribution' },
  'whatsapp':            { title: 'WhatsApp Intelligence',    icon: '💬', desc: 'Live WhatsApp message feed' },
  'api-explorer':        { title: 'API Explorer',             icon: '🔌', desc: 'Interactive endpoint tester' },
  'settings':            { title: 'Settings',                 icon: '⚙️', desc: 'Configure preferences & alerts' },
  'broker-analytics':    { title: 'Broker Analytics',         icon: '👔', desc: 'Broker leaderboard & performance' },
  'crm-pipeline':        { title: 'CRM Pipeline',             icon: '📋', desc: 'Match status workflow & deals' },
  'market-map':          { title: 'Market Intelligence Map',  icon: '🗺️', desc: 'Mapbox heatmap · demand density' },
  'live-scraper':        { title: 'Live Market Scraper',      icon: '🔍', desc: 'Search all Egyptian RE platforms' },
  'nlp-engine':          { title: 'NLP Classification Engine',icon: '🧠', desc: 'Classify & extract RE messages' },
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
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const socketRef      = useRef<any>(null)

  useEffect(() => {
    fetchMarketData()
    startRefreshCycle()
    // Connect Socket.IO for real-time match notifications
    import('socket.io-client').then(({ io }) => {
      const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })
      socketRef.current = socket
      startMatchWatcher(socket)
    }).catch(() => {})
    // Listen for custom navigation events (from map "View Matches" button)
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.page) setCurrentPage(detail.page as Page)
    }
    window.addEventListener('matchpro:navigate', onNav)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      socketRef.current?.disconnect()
      window.removeEventListener('matchpro:navigate', onNav)
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

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page)
    setShowNotifPanel(false)
  }

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000) // 2s — fail fast if market API offline
      const [summaryRes, intelligenceRes] = await Promise.all([
        fetch('/proxy/api/public/market-summary',    { signal: controller.signal }),
        fetch('/proxy/api/public/market-intelligence', { signal: controller.signal }),
      ])
      clearTimeout(timeout)
      if (!summaryRes.ok || !intelligenceRes.ok) throw new Error('API error')
      const summary     = await summaryRes.json()
      const intelligence = await intelligenceRes.json()
      setApiData({ summary, intelligence, source: 'live' })
      setLastUpdated(new Date())
      pushNotification('Live data refreshed successfully', 'success')
    } catch {
      setApiData({ ...getMockData(), source: 'mock' })  // market API offline — rich demo data shown
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
      case 'broker-analytics':    return <BrokerAnalytics     {...props} />
      case 'crm-pipeline':        return <CRMPipeline         {...props} />
      case 'market-map':          return <MarketMap />
      case 'live-scraper':        return <LiveScraper />
      case 'nlp-engine':          return <NLPEngine />
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
          onNotifBellClick={() => setShowNotifPanel(v => !v)}
        />

        <div style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
          {renderPage()}
        </div>
      </main>

      {/* Rich match toast + coin rain */}
      <ToastContainer onNavigate={handleNavigate} />

      {/* Notification history panel */}
      {showNotifPanel && (
        <NotificationPanel
          onClose={() => setShowNotifPanel(false)}
          onNavigate={handleNavigate}
        />
      )}

      {/* PWA install banner */}
      <PWAInstallBanner />

      {/* Legacy system toasts */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 9990, pointerEvents: 'none',
      }}>
        {notifications.map(n => (
          <div key={n.id} className="fade-in" style={{
            padding: '10px 16px', borderRadius: '10px',
            background: n.type === 'success' ? 'rgba(16,185,129,0.15)' : n.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)',
            border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.4)' : n.type === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(14,165,233,0.4)'}`,
            color: n.type === 'success' ? 'var(--brand-green)' : n.type === 'warning' ? 'var(--brand-gold)' : 'var(--brand-teal)',
            fontSize: '0.8rem', fontWeight: 500, backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-md)', maxWidth: 300, pointerEvents: 'auto',
          }}>
            {n.type === 'success' ? '✓' : n.type === 'warning' ? '⚠' : 'ℹ'} {n.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── TopBar ──────────────────────────────────────────────── */
function TopBar({ currentPage, loading, onRefresh, lastUpdated, onMenuToggle, apiData, nextRefreshIn, onNotifBellClick }: any) {
  const meta = PAGE_META[currentPage as Page]
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
          {isLive ? 'LIVE DATA' : 'OFFLINE — Demo Data'}
        </div>

        {/* Notifications bell — powered by NotificationSystem */}
        <NotificationBell onClick={onNotifBellClick} />

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
  const mkMarket = (location: string, supply: number, demand: number, avgPrice: number, priceTrend: string) => {
    const pi   = parseFloat((demand / supply).toFixed(2))
    const temp = pi >= 3.5 ? 'hot' : pi >= 2 ? 'warm' : pi >= 1.2 ? 'cool' : 'cold'
    const sig  = pi >= 2 ? 'seller' : pi < 1.2 ? 'buyer' : 'balanced'
    return {
      location, supply, demand, avg_price: avgPrice, price_trend: priceTrend,
      pressure_index: pi, market_signal: sig, temperature: temp,
      investment_score: Math.min(100, Math.round(pi * 18 + 30)),
      recent_supply: Array.from({ length: 3 }, (_, i) => ({
        id: `S${i+1}`, type: ['apartment','villa','studio'][i % 3],
        bedrooms: 2 + i, price: avgPrice + (i - 1) * 500000,
        purpose: i % 3 === 0 ? 'rent' : 'sale', area_sqm: 120 + i * 30,
      })),
      recent_demand: Array.from({ length: 3 }, (_, i) => ({
        id: `D${i+1}`, bedrooms: 2 + i % 3,
        budget_max: avgPrice * (0.8 + i * 0.1),
        purpose: i % 2 === 0 ? 'sale' : 'rent',
        contact: `+2010${Math.floor(10000000 + Math.random() * 89999999)}`,
      })),
    }
  }
  const markets = [
    mkMarket('Madinaty',         478, 1931, 4800000, '+12%'),
    mkMarket('New Capital',      210,  890, 3200000, '+18%'),
    mkMarket('Fifth Settlement', 380, 1245, 5500000, '+8%'),
    mkMarket('Rehab City',       298,  780, 3800000, '+7%'),
    mkMarket('Sheikh Zayed',     320,  650, 6200000, '+4%'),
    mkMarket('North Coast',      333,  560, 7500000, '+9%'),
    mkMarket('Tagamoa',          280,  590, 6800000, '+6%'),
    mkMarket('Nasr City',        410,  520, 2800000, '+2%'),
    mkMarket('Zamalek',          180,  280, 8500000, '+5%'),
    mkMarket('Maadi',            225,  340, 4200000, '+3%'),
    mkMarket('Heliopolis',       390,  430, 3500000, '+1%'),
    mkMarket('Dokki',            165,  310, 5100000, '+2%'),
  ]
  return {
    summary: {
      total_supply:  4508,
      total_demand:  7640,
      total_matches: 57105,
      top_locations: markets.map(m => ({
        name: m.location, supply: m.supply, demand: m.demand,
        pressure: m.pressure_index.toFixed(2),
      })).sort((a, b) => parseFloat(b.pressure) - parseFloat(a.pressure)),
      purpose_breakdown: {
        sale: { count: Math.round(4508 * 0.779), percent: 77.9 },
        rent: { count: Math.round(4508 * 0.221), percent: 22.1 },
      },
      property_types: [
        { type: 'Apartment', count: 2800, percent: 62.1 },
        { type: 'Villa',     count: 680,  percent: 15.1 },
        { type: 'Townhouse', count: 450,  percent: 9.99 },
        { type: 'Studio',    count: 320,  percent: 7.1  },
        { type: 'Penthouse', count: 160,  percent: 3.6  },
        { type: 'Duplex',    count: 98,   percent: 2.2  },
      ],
      price_distribution: [
        { range: '< 2M',  count: 420  },
        { range: '2-4M',  count: 980  },
        { range: '4-6M',  count: 1240 },
        { range: '6-8M',  count: 860  },
        { range: '8-10M', count: 540  },
        { range: '> 10M', count: 264  },
      ],
    },
    intelligence: {
      version: '10.0.0',
      summary: { total_supply: 4508, total_demand: 7640 },
      markets,
    },
  }
}
