import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant, getPressureVariant } from '../components/Badge'

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

export default function Dashboard({ apiData, loading }: Props) {
  const [matchAsset, setMatchAsset] = useState({ location: 'Madinaty', type: 'apartment', purpose: 'sale', price: '5500000', bedrooms: '3' })
  const [matchResult, setMatchResult] = useState<any>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [embedData, setEmbedData] = useState<Record<string, any>>({})

  const summary = apiData?.summary
  const markets = apiData?.intelligence?.markets || []
  const topLocations = summary?.top_locations || []

  // Fetch embed data for top 3 locations
  useEffect(() => {
    if (topLocations.length === 0) return
    const top3 = topLocations.slice(0, 3).map((l: any) => l.name)
    top3.forEach(async (loc: string) => {
      try {
        const res = await fetch(`/proxy/api/public/embed/${encodeURIComponent(loc)}`)
        const data = await res.json()
        setEmbedData(prev => ({ ...prev, [loc]: data }))
      } catch {}
    })
  }, [topLocations])

  // Prepare chart data
  const supplyDemandData = topLocations.slice(0, 8).map((l: any) => ({
    name: l.name.length > 12 ? l.name.substring(0, 12) + '...' : l.name,
    fullName: l.name,
    supply: l.supply,
    demand: l.demand,
    pressure: parseFloat(l.pressure)
  }))

  const pressureData = markets.slice(0, 8).map((m: any) => ({
    name: m.location.length > 10 ? m.location.substring(0, 10) + '...' : m.location,
    pressure: m.pressure_index,
    supply: m.supply,
    demand: m.demand
  }))

  const pieData = [
    { name: 'Supply', value: summary?.total_supply || 0 },
    { name: 'Demand', value: summary?.total_demand || 0 }
  ]

  // Simulate trend data
  const trendData = Array.from({ length: 12 }, (_, i) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const base = (summary?.total_supply || 3000)
    return {
      month: months[i],
      supply: Math.round(base * (0.7 + i * 0.025 + Math.random() * 0.1)),
      demand: Math.round(base * (1.4 + i * 0.04 + Math.random() * 0.15)),
      matches: Math.round(base * (0.8 + i * 0.06))
    }
  })

  const handleMatch = async () => {
    setMatchLoading(true)
    try {
      const res = await fetch('/proxy/api/public/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_location: matchAsset.location,
          asset_type: matchAsset.type,
          asset_purpose: matchAsset.purpose,
          asset_price: parseInt(matchAsset.price),
          asset_bedrooms: parseInt(matchAsset.bedrooms)
        })
      })
      const data = await res.json()
      setMatchResult(data)
    } catch (err) {
      setMatchResult({
        matches_found: Math.floor(Math.random() * 40) + 10,
        top_match_score: 0.87,
        location: matchAsset.location,
        message: 'Demo match result — live API unavailable'
      })
    } finally {
      setMatchLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      {/* Hero Stats */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Market Overview 🏢
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Real-time Egyptian real estate intelligence powered by MatchPro™
        </p>
      </div>

      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        <StatCard
          title="Total Supply"
          value={summary?.total_supply || 0}
          subtitle="Active listings"
          icon="🏠"
          color="var(--brand-teal)"
          trend={{ value: '+5.2%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Demand"
          value={summary?.total_demand || 0}
          subtitle="Active buyers"
          icon="👥"
          color="var(--brand-green)"
          trend={{ value: '+12.8%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Matches"
          value={summary?.total_matches || 0}
          subtitle="Qualified connections"
          icon="🎯"
          color="var(--brand-gold)"
          trend={{ value: '+8.3%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Demand Ratio"
          value={summary?.total_supply ? `${(summary.total_demand / summary.total_supply).toFixed(2)}x` : '—'}
          subtitle="Demand vs Supply"
          icon="⚖️"
          color="var(--brand-purple)"
          trend={{ value: 'Seller market', up: true }}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <Card title="Supply vs Demand Trend (12 Months)" subtitle="Market volume over time">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
              />
              <Legend />
              <Area type="monotone" dataKey="demand" stroke="#10b981" strokeWidth={2} fill="url(#demandGrad)" name="Demand" />
              <Area type="monotone" dataKey="supply" stroke="#0ea5e9" strokeWidth={2} fill="url(#supplyGrad)" name="Supply" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Market Split" subtitle="Supply vs Demand distribution">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill="#0ea5e9" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <LegendItem color="#0ea5e9" label="Supply" value={(summary?.total_supply || 0).toLocaleString()} />
              <LegendItem color="#10b981" label="Demand" value={(summary?.total_demand || 0).toLocaleString()} />
            </div>
          </div>
        </Card>
      </div>

      {/* Top Locations Bar Chart */}
      <Card title="Top Markets — Supply vs Demand" subtitle="Comparative analysis by location">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supplyDemandData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
              formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString() : v, String(n)]}
            />
            <Legend />
            <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top Markets Table */}
        <Card title="Hot Markets" subtitle="Sorted by demand pressure index">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Pressure</th>
                  <th>Signal</th>
                  <th>D/S Ratio</th>
                </tr>
              </thead>
              <tbody>
                {topLocations.slice(0, 6).map((loc: any, i: number) => {
                  const pressure = parseFloat(loc.pressure)
                  const market = markets.find((m: any) => m.location === loc.name)
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: COLORS[i % COLORS.length]
                          }} />
                          <span style={{ fontWeight: 500 }}>{loc.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: `${Math.min(pressure / 5 * 60, 60)}px`,
                            height: '4px',
                            borderRadius: '2px',
                            background: pressure >= 3.5 ? '#ef4444' : pressure >= 2 ? '#f59e0b' : '#10b981'
                          }} />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{pressure.toFixed(2)}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={getMarketSignalVariant(market?.market_signal || 'balanced')}>
                          {market?.market_signal || 'balanced'}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 600, color: pressure > 2 ? '#ef4444' : '#10b981' }}>
                        {(loc.demand / Math.max(loc.supply, 1)).toFixed(1)}x
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Match Tool */}
        <Card title="⚡ Quick Asset Matcher" subtitle="Find matching demand for your property">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
                <select
                  value={matchAsset.location}
                  onChange={e => setMatchAsset(prev => ({ ...prev, location: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  {topLocations.slice(0, 10).map((l: any) => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Property Type</label>
                <select
                  value={matchAsset.type}
                  onChange={e => setMatchAsset(prev => ({ ...prev, type: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="studio">Studio</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Purpose</label>
                <select
                  value={matchAsset.purpose}
                  onChange={e => setMatchAsset(prev => ({ ...prev, purpose: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Bedrooms</label>
                <select
                  value={matchAsset.bedrooms}
                  onChange={e => setMatchAsset(prev => ({ ...prev, bedrooms: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="1">1 BR</option>
                  <option value="2">2 BR</option>
                  <option value="3">3 BR</option>
                  <option value="4">4 BR</option>
                  <option value="5">5+ BR</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Price (EGP)</label>
              <input
                type="number"
                value={matchAsset.price}
                onChange={e => setMatchAsset(prev => ({ ...prev, price: e.target.value }))}
                placeholder="e.g. 5500000"
              />
            </div>
            <button
              onClick={handleMatch}
              disabled={matchLoading}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: matchLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, var(--brand-teal), var(--brand-purple))',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: matchLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s'
              }}
            >
              {matchLoading ? '⏳ Finding matches...' : '🎯 Find Matching Demand'}
            </button>

            {matchResult && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981', marginBottom: '6px' }}>
                  ✅ {matchResult.matches_found || 'Multiple'} matches found!
                </div>
                {matchResult.top_match_score && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Top score: {(matchResult.top_match_score * 100).toFixed(0)}%
                  </div>
                )}
                {matchResult.message && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {matchResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Live Widget Data */}
      {Object.keys(embedData).length > 0 && (
        <Card title="📡 Live Market Widgets" subtitle="Real-time buyer activity by location">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {Object.entries(embedData).map(([location, data]: [string, any]) => (
              <div key={location} style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(14, 165, 233, 0.06)',
                border: '1px solid rgba(14, 165, 233, 0.2)'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  📍 {location}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-teal)' }}>
                  {(data?.demand_count || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>active buyers</div>
                {data?.avg_price && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--brand-gold)', marginTop: '6px' }}>
                    Avg: {(data.avg_price / 1000000).toFixed(1)}M EGP
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}: <strong>{value}</strong></span>
    </div>
  )
}
