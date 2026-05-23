import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import MarketIntelligence from './pages/MarketIntelligence'
import SupplyDemand from './pages/SupplyDemand'
import Matches from './pages/Matches'
import Analytics from './pages/Analytics'
import HeatMap from './pages/HeatMap'
import APIExplorer from './pages/APIExplorer'
import Settings from './pages/Settings'
import './App.css'

export type Page = 'dashboard' | 'market-intelligence' | 'supply-demand' | 'matches' | 'analytics' | 'heatmap' | 'api-explorer' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [apiData, setApiData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    fetchMarketData()
    const interval = setInterval(fetchMarketData, 60000) // Refresh every 60s
    return () => clearInterval(interval)
  }, [])

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      // Use Vite proxy to bypass CORS (proxied through /proxy/api)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)

      const [summaryRes, intelligenceRes] = await Promise.all([
        fetch('/proxy/api/public/market-summary', { signal: controller.signal }),
        fetch('/proxy/api/public/market-intelligence', { signal: controller.signal })
      ])
      clearTimeout(timeout)

      if (!summaryRes.ok || !intelligenceRes.ok) throw new Error('API error')

      const summary = await summaryRes.json()
      const intelligence = await intelligenceRes.json()
      setApiData({ summary, intelligence, source: 'live' })
      setLastUpdated(new Date())
    } catch (err) {
      // Fallback to rich demo data
      setApiData({ ...getMockData(), source: 'demo' })
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  const renderPage = () => {
    const props = { apiData, loading, refreshData: fetchMarketData, lastUpdated }
    switch (currentPage) {
      case 'dashboard': return <Dashboard {...props} />
      case 'market-intelligence': return <MarketIntelligence {...props} />
      case 'supply-demand': return <SupplyDemand {...props} />
      case 'matches': return <Matches {...props} />
      case 'analytics': return <Analytics {...props} />
      case 'heatmap': return <HeatMap {...props} />
      case 'api-explorer': return <APIExplorer {...props} />
      case 'settings': return <Settings {...props} />
      default: return <Dashboard {...props} />
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        apiData={apiData}
      />
      <main style={{
        flex: 1,
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '64px',
        transition: 'margin-left 0.3s ease',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TopBar
          currentPage={currentPage}
          loading={loading}
          onRefresh={fetchMarketData}
          lastUpdated={lastUpdated}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          apiData={apiData}
        />
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

function TopBar({ currentPage, loading, onRefresh, lastUpdated, onMenuToggle, apiData }: any) {
  const titles: Record<string, string> = {
    'dashboard': 'Overview Dashboard',
    'market-intelligence': 'Market Intelligence',
    'supply-demand': 'Supply & Demand Analysis',
    'matches': 'Property Matches',
    'analytics': 'Analytics & Reports',
    'heatmap': 'Market Heat Map',
    'api-explorer': 'API Explorer',
    'settings': 'Settings'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMenuToggle}
          style={{ color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }}
        >
          ☰
        </button>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {titles[currentPage]}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LiveIndicator />
        <div style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '0.7rem',
          fontWeight: 600,
          background: apiData?.source === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: apiData?.source === 'live' ? 'var(--brand-green)' : 'var(--brand-gold)',
          border: `1px solid ${apiData?.source === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
        }}>
          {apiData?.source === 'live' ? '🟢 LIVE DATA' : '📊 DEMO DATA'}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: loading ? 'var(--bg-input)' : 'var(--brand-teal)',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {loading ? '⟳ Refreshing...' : '↻ Refresh'}
        </button>
      </div>
    </div>
  )
}

function LiveIndicator() {
  const [pulse, setPulse] = useState(true)
  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 1500)
    return () => clearInterval(interval)
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: '#10b981',
        opacity: pulse ? 1 : 0.4,
        transition: 'opacity 0.5s',
        boxShadow: pulse ? '0 0 6px #10b981' : 'none'
      }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LIVE</span>
    </div>
  )
}

export function getMockData() {
  return {
    summary: {
      total_supply: 4224,
      total_demand: 7626,
      total_matches: 56566,
      top_locations: [
        { name: "Madinaty", demand: 1931, supply: 478, pressure: "4.04" },
        { name: "Fifth Settlement", demand: 1245, supply: 380, pressure: "3.28" },
        { name: "New Capital", demand: 890, supply: 210, pressure: "4.24" },
        { name: "Sheikh Zayed", demand: 650, supply: 320, pressure: "2.03" },
        { name: "Rehab City", demand: 780, supply: 298, pressure: "2.62" },
        { name: "Nasr City", demand: 520, supply: 410, pressure: "1.27" },
        { name: "Heliopolis", demand: 430, supply: 390, pressure: "1.10" },
        { name: "Zamalek", demand: 280, supply: 180, pressure: "1.56" },
        { name: "Maadi", demand: 340, supply: 225, pressure: "1.51" },
        { name: "North Coast", demand: 560, supply: 333, pressure: "1.68" }
      ]
    },
    intelligence: {
      version: "10.0.0",
      summary: { total_supply: 4224, total_demand: 7626 },
      markets: [
        { location: "Madinaty", pressure_index: 4.04, market_signal: "seller", demand: 1931, supply: 478, avg_price: 4800000, price_trend: "+12%", hot_types: ["apartment", "villa"] },
        { location: "Fifth Settlement", pressure_index: 3.28, market_signal: "seller", demand: 1245, supply: 380, avg_price: 5500000, price_trend: "+8%", hot_types: ["villa", "townhouse"] },
        { location: "New Capital", pressure_index: 4.24, market_signal: "seller", demand: 890, supply: 210, avg_price: 3200000, price_trend: "+18%", hot_types: ["apartment", "studio"] },
        { location: "Sheikh Zayed", pressure_index: 2.03, market_signal: "balanced", demand: 650, supply: 320, avg_price: 6200000, price_trend: "+4%", hot_types: ["villa", "apartment"] },
        { location: "Rehab City", pressure_index: 2.62, market_signal: "seller", demand: 780, supply: 298, avg_price: 3800000, price_trend: "+7%", hot_types: ["apartment", "duplex"] },
        { location: "Nasr City", pressure_index: 1.27, market_signal: "buyer", demand: 520, supply: 410, avg_price: 2800000, price_trend: "+2%", hot_types: ["apartment", "studio"] },
        { location: "Heliopolis", pressure_index: 1.10, market_signal: "buyer", demand: 430, supply: 390, avg_price: 3500000, price_trend: "+1%", hot_types: ["apartment", "duplex"] },
        { location: "Zamalek", pressure_index: 1.56, market_signal: "balanced", demand: 280, supply: 180, avg_price: 8500000, price_trend: "+5%", hot_types: ["apartment", "penthouse"] },
        { location: "Maadi", pressure_index: 1.51, market_signal: "balanced", demand: 340, supply: 225, avg_price: 4200000, price_trend: "+3%", hot_types: ["villa", "apartment"] },
        { location: "North Coast", pressure_index: 1.68, market_signal: "balanced", demand: 560, supply: 333, avg_price: 7500000, price_trend: "+9%", hot_types: ["chalet", "villa"] }
      ]
    }
  }
}
