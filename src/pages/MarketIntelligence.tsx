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
import StatCard from '../components/StatCard'

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

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

export default function MarketIntelligence({ apiData, loading }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [locationData, setLocationData]     = useState<any>(null)
  const [locationLoading, setLocationLoading] = useState(false)
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
    .sort((a: any, b: any) => {
      if (sortBy === 'pressure') return (b.pressure_index || 0) - (a.pressure_index || 0)
      if (sortBy === 'demand')   return (b.demand  || 0) - (a.demand  || 0)
      if (sortBy === 'supply')   return (b.supply  || 0) - (a.supply  || 0)
      if (sortBy === 'price')    return (b.avg_price || 0) - (a.avg_price || 0)
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
      ])
      const [supply, demand, embed] = await Promise.all([supplyRes.json(), demandRes.json(), embedRes.json()])
      setLocationData({ supply, demand, embed })
    } catch {
      const market = markets.find((m: any) => m.location === location)
      setLocationData({
        supply: { data: market?.recent_supply || [] },
        demand: { data: market?.recent_demand || [] },
        embed:  {
          demand_count: market?.demand || 120,
          avg_price:    market?.avg_price || 5000000,
          location,
        },
      })
    } finally {
      setLocationLoading(false)
    }
  }, [markets])

  const handleSelectMarket = (market: any) => {
    setSelectedMarket(market)
    fetchLocationData(market.location)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

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
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
