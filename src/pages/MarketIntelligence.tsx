<<<<<<< HEAD
/**
 * Market Intelligence — Full lkdsbjzk.gensparkclaw.com reference implementation
 * All panels: pressure index, temperature heatmap, location cards with deep data,
 * scatter plot (supply vs demand bubble), investment scoring, market signals
 */
import { useState, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant } from '../components/Badge'
=======
import { useState } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, BarChart, Bar,
} from 'recharts'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant, getTemperatureLabel } from '../components/Badge'
>>>>>>> origin/main
import StatCard from '../components/StatCard'

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

<<<<<<< HEAD
const TEMP_COLORS: Record<string, string> = {
  hot:  '#ef4444',
  warm: '#f59e0b',
  cool: '#0ea5e9',
  cold: '#6366f1',
}
const TEMP_BG: Record<string, string> = {
  hot:  'rgba(239,68,68,0.1)',
  warm: 'rgba(245,158,11,0.1)',
  cool: 'rgba(14,165,233,0.1)',
  cold: 'rgba(99,102,241,0.1)',
}
const TEMP_BORDER: Record<string, string> = {
  hot:  'rgba(239,68,68,0.3)',
  warm: 'rgba(245,158,11,0.3)',
  cool: 'rgba(14,165,233,0.3)',
  cold: 'rgba(99,102,241,0.3)',
}
const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']

function tempLabel(temp: string) {
  if (temp === 'hot')  return '🔥 Hot'
  if (temp === 'warm') return '🌡️ Warm'
  if (temp === 'cool') return '❄️ Cool'
  return '🧊 Cold'
}

=======
const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']

>>>>>>> origin/main
export default function MarketIntelligence({ apiData, loading }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [locationData, setLocationData]     = useState<any>(null)
  const [locationLoading, setLocationLoading] = useState(false)
<<<<<<< HEAD
  const [searchQuery, setSearchQuery]       = useState('')
  const [sortBy, setSortBy]                 = useState<'pressure'|'demand'|'supply'|'price'|'score'>('pressure')
  const [filterTemp, setFilterTemp]         = useState<string>('all')
  const [activeTab, setActiveTab]           = useState<'overview'|'detail'|'compare'>('overview')

  const markets      = apiData?.intelligence?.markets || []
  const topLocations = apiData?.summary?.top_locations || []
  const summary      = apiData?.summary

  const filteredMarkets = [...markets]
    .filter((m: any) => {
      const q = searchQuery.toLowerCase()
      const matchQ = !q || m.location?.toLowerCase().includes(q)
      const matchT = filterTemp === 'all' || m.temperature === filterTemp
      return matchQ && matchT
    })
=======
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy]           = useState<'pressure' | 'demand' | 'supply' | 'price'>('pressure')

  const markets      = apiData?.intelligence?.markets || []
  const topLocations = apiData?.summary?.top_locations || []

  const filteredMarkets = [...markets]
    .filter((m: any) => m.location?.toLowerCase().includes(searchQuery.toLowerCase()))
>>>>>>> origin/main
    .sort((a: any, b: any) => {
      if (sortBy === 'pressure') return (b.pressure_index || 0) - (a.pressure_index || 0)
      if (sortBy === 'demand')   return (b.demand  || 0) - (a.demand  || 0)
      if (sortBy === 'supply')   return (b.supply  || 0) - (a.supply  || 0)
      if (sortBy === 'price')    return (b.avg_price || 0) - (a.avg_price || 0)
<<<<<<< HEAD
      if (sortBy === 'score')    return (b.investment_score || 0) - (a.investment_score || 0)
      return 0
    })

  const fetchLocationData = useCallback(async (location: string) => {
    setLocationLoading(true)
    try {
      const [supplyRes, demandRes, embedRes] = await Promise.all([
        fetch(`/proxy/api/public/supply?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/proxy/api/public/demand?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/proxy/api/public/embed/${encodeURIComponent(location)}`),
=======
      return 0
    })

  const fetchLocationData = async (location: string) => {
    setLocationLoading(true)
    try {
      const [supplyRes, demandRes, embedRes] = await Promise.all([
        fetch(`/api/public/supply?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/api/public/demand?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/api/public/embed/${encodeURIComponent(location)}`),
>>>>>>> origin/main
      ])
      const [supply, demand, embed] = await Promise.all([supplyRes.json(), demandRes.json(), embedRes.json()])
      setLocationData({ supply, demand, embed })
    } catch {
<<<<<<< HEAD
      const market = markets.find((m: any) => m.location === location)
      setLocationData({
        supply: { data: market?.recent_supply || [] },
        demand: { data: market?.recent_demand || [] },
        embed:  {
          demand_count: market?.demand || 120,
          avg_price:    market?.avg_price || 5000000,
          location,
        },
=======
      setLocationData({
        supply: { data: Array.from({ length: 4 }, (_, i) => ({ id: i + 1, location, price: 3000000 + i * 600000, bedrooms: 2 + i % 3, type: ['apartment','villa','studio','duplex'][i % 4], purpose: 'sale' })) },
        demand: { data: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, location, budget_max: 4500000 + i * 350000, bedrooms: 2 + i % 3, type: 'apartment' })) },
        embed:  { demand_count: 120 + Math.floor(Math.random() * 250), avg_price: 4000000 + Math.random() * 2000000, location },
>>>>>>> origin/main
      })
    } finally {
      setLocationLoading(false)
    }
<<<<<<< HEAD
  }, [markets])
=======
  }
>>>>>>> origin/main

  const handleSelectMarket = (market: any) => {
    setSelectedMarket(market)
    fetchLocationData(market.location)
<<<<<<< HEAD
    setActiveTab('detail')
  }

  // Bubble chart data
  const scatterData = markets.map((m: any) => ({
    x:    m.supply || 0,
    y:    m.demand || 0,
    z:    Math.max(50, (m.pressure_index || 1) * 60),
    name: m.location,
    temp: m.temperature || 'cool',
  }))

  const hotMarkets      = markets.filter((m: any) => (m.pressure_index || 0) >= 3.5)
  const warmMarkets     = markets.filter((m: any) => (m.pressure_index || 0) >= 2 && (m.pressure_index || 0) < 3.5)
  const coolMarkets     = markets.filter((m: any) => (m.pressure_index || 0) >= 1.2 && (m.pressure_index || 0) < 2)
  const coldMarkets     = markets.filter((m: any) => (m.pressure_index || 0) < 1.2)

  const topPressure = [...markets]
    .sort((a: any, b: any) => (b.pressure_index || 0) - (a.pressure_index || 0))
    .slice(0, 6)

  const topPressureChartData = topPressure.map((m: any) => ({
    name:     m.location.length > 14 ? m.location.slice(0, 13) + '…' : m.location,
    fullName: m.location,
    pressure: parseFloat((m.pressure_index || 0).toFixed(2)),
    temp:     m.temperature || 'cool',
  }))

  const fmt = (n: number) => {
    if (!n) return '—'
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000)    return `${(n / 1000).toFixed(0)}K`
    return String(n)
  }

  const radarData = selectedMarket ? [
    { metric: 'Demand',    value: Math.min(100, Math.round((selectedMarket.demand || 0) / 20)) },
    { metric: 'Supply',    value: Math.min(100, Math.round((selectedMarket.supply || 0) / 6))  },
    { metric: 'Pressure',  value: Math.min(100, Math.round((selectedMarket.pressure_index || 0) * 20)) },
    { metric: 'Price',     value: Math.min(100, Math.round((selectedMarket.avg_price || 0) / 150000)) },
    { metric: 'Score',     value: selectedMarket.investment_score || 60 },
  ] : []
=======
  }

  const scatterData = markets.map((m: any) => ({
    x:      m.supply  || 0,
    y:      m.demand  || 0,
    z:      m.pressure_index || 1,
    name:   m.location,
    signal: m.market_signal,
  }))

  const hotMarkets      = markets.filter((m: any) => (m.pressure_index || 0) >= 3)
  const balancedMarkets = markets.filter((m: any) => (m.pressure_index || 0) >= 1.5 && (m.pressure_index || 0) < 3)
  const buyerMarkets    = markets.filter((m: any) => (m.pressure_index || 0) < 1.5)

  // Top 5 chart data
  const topChartData = [...markets]
    .sort((a: any, b: any) => (b.pressure_index || 0) - (a.pressure_index || 0))
    .slice(0, 6)
    .map((m: any) => ({
      name:     m.location.length > 10 ? m.location.substring(0, 10) + '…' : m.location,
      supply:   m.supply  || 0,
      demand:   m.demand  || 0,
      pressure: m.pressure_index || 0,
    }))
>>>>>>> origin/main

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

<<<<<<< HEAD
      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            🧠 Market Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {markets.length} active markets · AI-powered location analysis · MatchPro™ v10
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {apiData?.source === 'mock' && (
            <span style={{ padding: '4px 12px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-gold)' }}>
              📊 DEMO DATA
            </span>
          )}
          {apiData?.source === 'live' && (
            <span style={{ padding: '4px 12px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-green)' }}>
              🔴 LIVE DATA
            </span>
          )}
        </div>
      </div>

      {/* ── Market Temperature Summary ────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        {[
          { label: 'Hot Markets',  markets: hotMarkets,   temp: 'hot',  icon: '🔥', subtitle: 'Pressure > 3.5x' },
          { label: 'Warm Markets', markets: warmMarkets,  temp: 'warm', icon: '🌡️', subtitle: 'Pressure 2-3.5x' },
          { label: 'Cool Markets', markets: coolMarkets,  temp: 'cool', icon: '❄️', subtitle: 'Pressure 1.2-2x'  },
          { label: 'Cold Markets', markets: coldMarkets,  temp: 'cold', icon: '🧊', subtitle: 'Pressure < 1.2x'  },
        ].map(({ label, markets: mList, temp, icon, subtitle }) => (
          <div
            key={temp}
            onClick={() => setFilterTemp(filterTemp === temp ? 'all' : temp)}
            style={{
              padding: '16px',
              borderRadius: '10px',
              background:   filterTemp === temp ? TEMP_BG[temp] : 'rgba(0,0,0,0.15)',
              border:       `1px solid ${filterTemp === temp ? TEMP_BORDER[temp] : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: TEMP_COLORS[temp], lineHeight: 1 }}>
              {mList.length}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '3px' }}>{label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', width: 'fit-content' }}>
        {(['overview','detail','compare'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '7px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background:  activeTab === t ? 'rgba(14,165,233,0.2)' : 'transparent',
              color:       activeTab === t ? 'var(--brand-teal)' : 'var(--text-muted)',
              fontWeight:  activeTab === t ? 700 : 400,
              fontSize: '0.82rem',
              transition: 'all 0.15s',
            }}
          >
            {t === 'overview' ? '📊 Overview' : t === 'detail' ? '📍 Location Detail' : '⚡ Compare'}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* Pressure Bar Chart */}
          <Card title="🔥 Top Market Pressure Index" subtitle="Demand ÷ Supply ratio by location">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topPressureChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
                <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                  formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) + 'x' : v, 'Pressure']}
                  labelFormatter={(l: any) => topPressureChartData.find((d: any) => d.name === l)?.fullName || l}
                />
                <Bar dataKey="pressure" radius={[4, 4, 0, 0]} maxBarSize={52}>
                  {topPressureChartData.map((d: any, i: number) => (
                    <Cell key={i} fill={TEMP_COLORS[d.temp] || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Bubble chart */}
          <Card title="🫧 Supply vs Demand Bubble Map" subtitle="Bubble size = pressure intensity">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 4, right: 20, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
                <XAxis dataKey="x" name="Supply" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Supply', position: 'insideBottom', offset: -4, fill: '#4e6280', fontSize: 11 }} />
                <YAxis dataKey="y" name="Demand" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: '#4e6280', fontSize: 11 }} />
                <ZAxis dataKey="z" range={[30, 500]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    if (!d) return null
                    return (
                      <div style={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>{d.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Supply: {d.x?.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Demand: {d.y?.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: TEMP_COLORS[d.temp] || '#0ea5e9', fontWeight: 600 }}>
                          {tempLabel(d.temp)}
                        </div>
                      </div>
                    )
                  }}
                />
                {['hot','warm','cool','cold'].map(temp => (
                  <Scatter
                    key={temp}
                    name={temp}
                    data={scatterData.filter((d: any) => d.temp === temp)}
                    fill={TEMP_COLORS[temp]}
                    opacity={0.75}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
              {Object.entries(TEMP_COLORS).map(([t, c]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c as string }} />
                  {tempLabel(t)}
                </div>
              ))}
            </div>
          </Card>

          {/* Market Cards Grid */}
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search location…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '200px', padding: '7px 12px', fontSize: '0.82rem' }}
              />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ width: '150px', padding: '7px 12px', fontSize: '0.82rem' }}>
                <option value="pressure">Sort: Pressure</option>
                <option value="demand">Sort: Demand</option>
                <option value="supply">Sort: Supply</option>
                <option value="price">Sort: Avg Price</option>
                <option value="score">Sort: Inv. Score</option>
              </select>
              {filterTemp !== 'all' && (
                <button onClick={() => setFilterTemp('all')} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--brand-red)' }}>
                  ✕ Clear filter
                </button>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {filteredMarkets.length} of {markets.length} markets
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {filteredMarkets.map((market: any, i: number) => {
                const temp     = market.temperature || 'cool'
                const pressure = market.pressure_index || 0
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectMarket(market)}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: TEMP_BG[temp] || 'rgba(14,165,233,0.04)',
                      border:     `1px solid ${TEMP_BORDER[temp] || 'rgba(14,165,233,0.18)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                          {market.location}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: TEMP_COLORS[temp], fontWeight: 600 }}>
                          {tempLabel(temp)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: TEMP_COLORS[temp] }}>
                          {pressure.toFixed(2)}x
                        </div>
                        <Badge variant={getMarketSignalVariant(market.market_signal)}>
                          {market.market_signal || 'balanced'}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ padding: '8px', borderRadius: '7px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Supply</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-teal)' }}>{(market.supply || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ padding: '8px', borderRadius: '7px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Demand</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-green)' }}>{(market.demand || 0).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Pressure bar */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pressure Index</span>
                        <span style={{ fontSize: '0.65rem', color: TEMP_COLORS[temp], fontWeight: 700 }}>{pressure.toFixed(2)}x</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(pressure / 5 * 100, 100)}%`, background: TEMP_COLORS[temp] }} />
                      </div>
                    </div>

                    {/* Price + Investment score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      {market.avg_price && (
                        <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>
                          💰 {fmt(market.avg_price)} EGP
                        </span>
                      )}
                      {market.investment_score != null && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px',
                          background: market.investment_score >= 70 ? 'rgba(16,185,129,0.15)' : market.investment_score >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: market.investment_score >= 70 ? 'var(--brand-green)' : market.investment_score >= 50 ? 'var(--brand-gold)' : 'var(--brand-red)',
                          fontWeight: 700,
                        }}>
                          ⭐ {market.investment_score}/100
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      👆 Click for details
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Detail Tab ───────────────────────────────────── */}
      {activeTab === 'detail' && (
        <div>
          {!selectedMarket ? (
            <Card title="Select a Market" subtitle="Click any market card in the Overview tab to see full details">
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                👆 Go to Overview tab → click a location card
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Market Header */}
              <div style={{
                padding: '20px 24px',
                borderRadius: '12px',
                background: TEMP_BG[selectedMarket.temperature || 'cool'],
                border: `1px solid ${TEMP_BORDER[selectedMarket.temperature || 'cool']}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      📍 {selectedMarket.location}
                    </h2>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <Badge variant={getMarketSignalVariant(selectedMarket.market_signal)}>{selectedMarket.market_signal}</Badge>
                      <span style={{ fontSize: '0.78rem', color: TEMP_COLORS[selectedMarket.temperature || 'cool'], fontWeight: 600 }}>
                        {tempLabel(selectedMarket.temperature || 'cool')}
                      </span>
                      {selectedMarket.price_trend && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: selectedMarket.price_trend.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)' }}>
                          📈 {selectedMarket.price_trend} YoY
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    {[
                      { label: 'Pressure', value: selectedMarket.pressure_index?.toFixed(2) + 'x', color: TEMP_COLORS[selectedMarket.temperature || 'cool'] },
                      { label: 'Supply',   value: (selectedMarket.supply  || 0).toLocaleString(), color: 'var(--brand-teal)'  },
                      { label: 'Demand',   value: (selectedMarket.demand  || 0).toLocaleString(), color: 'var(--brand-green)' },
                      { label: 'Avg Price',value: fmt(selectedMarket.avg_price || 0) + ' EGP',    color: 'var(--brand-gold)'  },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Radar + Supply/Demand */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <Card title="📡 Market Profile" subtitle="Multi-dimensional scoring">
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(30,48,80,0.8)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#4e6280', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#4e6280', fontSize: 9 }} />
                      <Radar dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="🏢 Recent Listings" subtitle={`Live supply & demand for ${selectedMarket.location}`}>
                  {locationLoading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading…</div>
                  ) : locationData ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-teal)', marginBottom: '8px' }}>
                          🏠 Supply ({locationData.supply?.data?.length || 0})
                        </div>
                        {(locationData.supply?.data || []).slice(0, 5).map((item: any, i: number) => (
                          <div key={i} style={{ padding: '8px 10px', borderRadius: '7px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)', marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {item.type || 'Property'} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--brand-gold)', fontWeight: 600 }}>
                              {item.price ? fmt(item.price) + ' EGP' : '—'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {item.purpose === 'rent' ? '🔑 Rent' : '🏷️ Sale'}
                              {item.area_sqm ? ` · ${item.area_sqm}m²` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-green)', marginBottom: '8px' }}>
                          👥 Demand ({locationData.demand?.data?.length || 0})
                        </div>
                        {(locationData.demand?.data || []).slice(0, 5).map((item: any, i: number) => (
                          <div key={i} style={{ padding: '8px 10px', borderRadius: '7px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Buyer {i + 1} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--brand-green)', fontWeight: 600 }}>
                              {item.budget_max ? 'Max ' + fmt(item.budget_max) : '—'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {item.purpose === 'rent' ? '🔑 Rent' : '🏷️ Buy'}
                              {item.contact && <span style={{ marginLeft: '6px', color: 'var(--brand-teal)' }}>{item.contact}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No data available</div>
                  )}
                </Card>
              </div>

              {/* Investment score */}
              {selectedMarket.investment_score != null && (
                <Card title="⭐ Investment Score" subtitle="AI-computed 0-100 attractiveness index">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: 90, height: 90, borderRadius: '50%',
                      background: `conic-gradient(${selectedMarket.investment_score >= 70 ? '#10b981' : selectedMarket.investment_score >= 50 ? '#f59e0b' : '#ef4444'} ${selectedMarket.investment_score * 3.6}deg, rgba(0,0,0,0.3) 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{selectedMarket.investment_score}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {selectedMarket.investment_score >= 75 ? '🔥 Excellent investment opportunity' :
                         selectedMarket.investment_score >= 55 ? '✅ Good market conditions' :
                         selectedMarket.investment_score >= 35 ? '⚠️ Moderate opportunity' : '📉 Challenging market'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Demand/Supply ratio: <strong style={{ color: 'var(--brand-teal)' }}>{selectedMarket.pressure_index?.toFixed(2)}x</strong>
                        {' · '} Market signal: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedMarket.market_signal}</strong>
                        {selectedMarket.price_trend && <span> · YoY Price: <strong style={{ color: selectedMarket.price_trend.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)' }}>{selectedMarket.price_trend}</strong></span>}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Compare Tab ──────────────────────────────────── */}
      {activeTab === 'compare' && (
        <Card title="⚡ Market Comparison" subtitle="Top 10 markets side by side">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Location</th>
                  <th>Temp</th>
                  <th>Signal</th>
                  <th>Pressure</th>
                  <th>Supply</th>
                  <th>Demand</th>
                  <th>Avg Price</th>
                  <th>Trend</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {[...markets]
                  .sort((a: any, b: any) => (b.pressure_index || 0) - (a.pressure_index || 0))
                  .slice(0, 15)
                  .map((m: any, i: number) => {
                    const pressure = m.pressure_index || 0
                    const temp     = m.temperature || 'cool'
                    return (
                      <tr
                        key={i}
                        onClick={() => handleSelectMarket(m)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td><strong style={{ fontSize: '0.85rem' }}>{m.location}</strong></td>
                        <td><span style={{ color: TEMP_COLORS[temp], fontWeight: 600 }}>{tempLabel(temp)}</span></td>
                        <td><Badge variant={getMarketSignalVariant(m.market_signal)}>{m.market_signal || '—'}</Badge></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: `${Math.min(pressure / 5 * 60, 60)}px`, height: 5, borderRadius: 3, background: TEMP_COLORS[temp] }} />
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: TEMP_COLORS[temp] }}>{pressure.toFixed(2)}x</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>{(m.supply || 0).toLocaleString()}</td>
                        <td style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{(m.demand || 0).toLocaleString()}</td>
                        <td style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>{fmt(m.avg_price || 0)}</td>
                        <td style={{
                          fontWeight: 700, fontSize: '0.82rem',
                          color: (m.price_trend || '').startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)',
                        }}>{m.price_trend || '—'}</td>
                        <td>
                          {m.investment_score != null && (
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px',
                              background: m.investment_score >= 70 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: m.investment_score >= 70 ? 'var(--brand-green)' : 'var(--brand-gold)',
                              fontWeight: 700, fontSize: '0.78rem',
                            }}>{m.investment_score}/100</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
=======
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          Market Intelligence
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Deep analysis of Egyptian real estate markets with AI-powered pressure indexing
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 stagger" style={{ gap: '16px' }}>
        <StatCard title="Hot Markets"      value={hotMarkets.length}      subtitle="Pressure ≥ 3×"      icon="🔥" color="var(--brand-red)"    loading={loading} />
        <StatCard title="Balanced Markets" value={balancedMarkets.length} subtitle="1.5× – 3× pressure" icon="⚖️" color="var(--brand-gold)"   loading={loading} />
        <StatCard title="Buyer Markets"    value={buyerMarkets.length}    subtitle="Pressure < 1.5×"    icon="🎁" color="var(--brand-green)"  loading={loading} />
      </div>

      {/* Top Markets mini bar chart */}
      <Card title="Pressure Leaders" subtitle="Top 6 markets by demand/supply pressure index">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
            <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
              formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString() : v, String(n)]}
              cursor={{ fill: 'rgba(14,165,233,0.06)' }}
            />
            <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Main: Table + Detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>

        {/* Markets Table */}
        <Card
          title="All Markets"
          subtitle={`${filteredMarkets.length} locations tracked`}
          actions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                placeholder="Search…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 130, padding: '6px 10px', fontSize: '0.78rem' }}
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ padding: '6px 10px', fontSize: '0.78rem', width: 'auto' }}
              >
                <option value="pressure">Pressure</option>
                <option value="demand">Demand</option>
                <option value="supply">Supply</option>
                <option value="price">Avg Price</option>
              </select>
            </div>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Demand</th>
                  <th>Supply</th>
                  <th>Pressure</th>
                  <th>Signal</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map((market: any, i: number) => {
                  const isSelected = selectedMarket?.location === market.location
                  return (
                    <tr
                      key={i}
                      className={isSelected ? 'table-row-active' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectMarket(market)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{market.location}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-green)' }}>
                        {(market.demand || 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--brand-teal)' }}>
                        {(market.supply || 0).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: `${Math.min((market.pressure_index || 0) / 5 * 52, 52)}px`,
                            height: 5,
                            borderRadius: 3,
                            background: (market.pressure_index || 0) >= 3.5
                              ? 'var(--brand-red)'
                              : (market.pressure_index || 0) >= 2
                              ? 'var(--brand-gold)'
                              : 'var(--brand-green)',
                            transition: 'width 0.4s',
                          }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                            {(market.pressure_index || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={getMarketSignalVariant(market.market_signal)}>
                          {market.market_signal || 'N/A'}
                        </Badge>
                      </td>
                      <td style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: market.price_trend?.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)',
                      }}>
                        {market.price_trend || '—'}
                      </td>
                    </tr>
                  )
                })}
>>>>>>> origin/main
              </tbody>
            </table>
          </div>
        </Card>
<<<<<<< HEAD
      )}
=======

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedMarket ? (
            <>
              {/* Detail card */}
              <Card title={`📍 ${selectedMarket.location}`} subtitle="Market breakdown">
                {locationLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                    <span style={{ animation: 'spin 0.8s linear infinite', fontSize: '1.2rem' }}>⟳</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Grid of mini metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <MiniMetric label="Demand"   value={(selectedMarket.demand  || 0).toLocaleString()} color="var(--brand-green)" />
                      <MiniMetric label="Supply"   value={(selectedMarket.supply  || 0).toLocaleString()} color="var(--brand-teal)" />
                      <MiniMetric label="Pressure" value={`${(selectedMarket.pressure_index || 0).toFixed(2)}x`} color="var(--brand-gold)" />
                      <MiniMetric label="Avg Price" value={selectedMarket.avg_price ? `${(selectedMarket.avg_price / 1000000).toFixed(1)}M EGP` : '—'} color="var(--brand-purple)" />
                    </div>

                    {/* Demand vs Supply visual */}
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Demand vs Supply
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--brand-green)' }}>Demand</span>
                          <span style={{ color: 'var(--brand-green)', fontWeight: 700 }}>{(selectedMarket.demand || 0).toLocaleString()}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '100%', background: 'var(--brand-green)' }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--brand-teal)' }}>Supply</span>
                          <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>{(selectedMarket.supply || 0).toLocaleString()}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{
                            width: `${Math.min((selectedMarket.supply || 0) / Math.max(selectedMarket.demand || 1, 1) * 100, 100)}%`,
                            background: 'var(--brand-teal)',
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* Temperature */}
                    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Market Temperature</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                        {getTemperatureLabel(selectedMarket.pressure_index || 0)}
                      </span>
                    </div>

                    {/* Hot property types */}
                    {selectedMarket.hot_types?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Hot Property Types
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {selectedMarket.hot_types.map((t: string) => (
                            <span key={t} style={{
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: 'rgba(14,165,233,0.12)',
                              border: '1px solid rgba(14,165,233,0.3)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--brand-teal)',
                              textTransform: 'capitalize',
                            }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Investment verdict */}
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: selectedMarket.pressure_index >= 3 ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                      border: `1px solid ${selectedMarket.pressure_index >= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: selectedMarket.pressure_index >= 3 ? 'var(--brand-red)' : 'var(--brand-green)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Investment Insight
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {selectedMarket.pressure_index >= 3
                          ? `🔥 Strong seller market. ${(selectedMarket.demand || 0).toLocaleString()} active buyers vs only ${(selectedMarket.supply || 0).toLocaleString()} listings. Excellent entry point.`
                          : selectedMarket.pressure_index >= 1.5
                          ? `⚖️ Balanced market. Moderate activity — ideal for long-term investment and steady returns.`
                          : `🎁 Buyer-favored market. Negotiate aggressively — supply exceeds demand.`
                        }
                      </div>
                    </div>

                    {/* Live widget data */}
                    {locationData?.embed && (
                      <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Live Active Buyers</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-teal)', lineHeight: 1 }}>
                              {(locationData.embed.demand_count || 0).toLocaleString()}
                            </div>
                          </div>
                          {locationData.embed.avg_price && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Avg Price</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-gold)' }}>
                                {(locationData.embed.avg_price / 1000000).toFixed(1)}M EGP
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '50px 20px',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              textAlign: 'center',
              minHeight: 200,
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗺️</div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Select a Market</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Click any row in the table to see detailed analysis
              </div>
            </div>
          )}

          {/* Scatter chart */}
          <Card title="Supply vs Demand Scatter" subtitle="All markets — size = pressure">
            <ResponsiveContainer width="100%" height={210}>
              <ScatterChart margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
                <XAxis dataKey="x" name="Supply" tick={{ fill: '#4e6280', fontSize: 10 }} label={{ value: 'Supply', position: 'insideBottom', fill: '#4e6280', fontSize: 10, dy: 6 }} />
                <YAxis dataKey="y" name="Demand" tick={{ fill: '#4e6280', fontSize: 10 }} label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: '#4e6280', fontSize: 10 }} />
                <ZAxis dataKey="z" range={[40, 220]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                  formatter={(v: any, _n: any, p: any) => [typeof v === 'number' ? v.toLocaleString() : v, p?.payload?.name || String(_n)]}
                />
                <Scatter data={scatterData} fill="#0ea5e9" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</div>
>>>>>>> origin/main
    </div>
  )
}
