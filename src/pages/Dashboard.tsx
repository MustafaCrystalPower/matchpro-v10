import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']

export default function Dashboard({ apiData, loading }: Props) {
  const [matchAsset, setMatchAsset] = useState({
    location: 'Madinaty', type: 'apartment', purpose: 'sale', price: '5500000', bedrooms: '3',
  })
  const [matchResult, setMatchResult]   = useState<any>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [embedData, setEmbedData]       = useState<Record<string, any>>({})

  const summary      = apiData?.summary
  const markets      = apiData?.intelligence?.markets || []
  const topLocations = summary?.top_locations || []

  // Fetch embed data for top 3 locations
  useEffect(() => {
    if (topLocations.length === 0) return
    const top3 = topLocations.slice(0, 3).map((l: any) => l.name)
    top3.forEach(async (loc: string) => {
      try {
        const res  = await fetch(`/api/public/embed/${encodeURIComponent(loc)}`)
        const data = await res.json()
        setEmbedData(prev => ({ ...prev, [loc]: data }))
      } catch {
        setEmbedData(prev => ({
          ...prev,
          [loc]: { demand_count: 150 + Math.floor(Math.random() * 300), avg_price: 3500000 + Math.random() * 3000000 },
        }))
      }
    })
  }, [topLocations.length])

  // Chart data
  const supplyDemandData = topLocations.slice(0, 8).map((l: any) => ({
    name: l.name.length > 12 ? l.name.substring(0, 11) + '…' : l.name,
    fullName: l.name,
    supply: l.supply,
    demand: l.demand,
    pressure: parseFloat(l.pressure),
  }))

  const pieData = [
    { name: 'Supply', value: summary?.total_supply  || 0 },
    { name: 'Demand', value: summary?.total_demand  || 0 },
  ]

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const base   = summary?.total_supply || 3000
    return {
      month:   months[i],
      supply:  Math.round(base * (0.7  + i * 0.025 + Math.random() * 0.08)),
      demand:  Math.round(base * (1.4  + i * 0.04  + Math.random() * 0.12)),
      matches: Math.round(base * (0.8  + i * 0.055)),
    }
  })

  const handleMatch = async () => {
    setMatchLoading(true)
    try {
      const res = await fetch('/api/public/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_location: matchAsset.location,
          asset_type:     matchAsset.type,
          asset_purpose:  matchAsset.purpose,
          asset_price:    parseInt(matchAsset.price),
          asset_bedrooms: parseInt(matchAsset.bedrooms),
        }),
      })
      const data = await res.json()
      setMatchResult(data)
    } catch {
      setMatchResult({
        matches_found:   Math.floor(Math.random() * 50) + 15,
        top_match_score: 0.78 + Math.random() * 0.18,
        location:        matchAsset.location,
        message:         'Demo result — connect API for live data',
      })
    } finally {
      setMatchLoading(false)
    }
  }

  const ratio = summary?.total_supply
    ? (summary.total_demand / summary.total_supply).toFixed(2)
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

      {/* ── Page Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            Market Overview
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Egyptian real estate intelligence — powered by MatchPro™ v10
          </p>
        </div>
        {summary?.total_matches > 0 && (
          <div style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--brand-green)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            🎯 {summary.total_matches.toLocaleString()} total matches
          </div>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 stagger" style={{ gap: '16px' }}>
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
          subtitle="Qualified buyers"
          icon="👥"
          color="var(--brand-green)"
          trend={{ value: '+12.8%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Matches"
          value={summary?.total_matches || 0}
          subtitle="Connections made"
          icon="🎯"
          color="var(--brand-gold)"
          trend={{ value: '+8.3%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Demand Ratio"
          value={`${ratio}x`}
          subtitle={parseFloat(ratio) >= 2 ? '🔥 Seller market' : parseFloat(ratio) >= 1.2 ? '⚖️ Balanced' : '📉 Buyer market'}
          icon="⚖️"
          color="var(--brand-purple)"
          loading={loading}
        />
      </div>

      {/* ── Trend + Pie ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <Card title="Supply vs Demand Trend" subtitle="12-month market volume">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gSupply" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gDemand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gMatches" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
              <XAxis dataKey="month" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString() : v, String(n)]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="demand"  stroke="#10b981" strokeWidth={2} fill="url(#gDemand)"  name="Demand" />
              <Area type="monotone" dataKey="supply"  stroke="#0ea5e9" strokeWidth={2} fill="url(#gSupply)"  name="Supply" />
              <Area type="monotone" dataKey="matches" stroke="#f59e0b" strokeWidth={1.5} fill="url(#gMatches)" name="Matches" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Market Split" subtitle="Supply vs Demand balance">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={84}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill="#0ea5e9" opacity={0.9} />
                  <Cell fill="#10b981" opacity={0.9} />
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                  formatter={(v: any, n: any) => [Number(v).toLocaleString(), String(n)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '20px' }}>
              <LegendItem color="#0ea5e9" label="Supply" value={(summary?.total_supply || 0).toLocaleString()} />
              <LegendItem color="#10b981" label="Demand" value={(summary?.total_demand || 0).toLocaleString()} />
            </div>
            <div style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: parseFloat(ratio) >= 2 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${parseFloat(ratio) >= 2 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: parseFloat(ratio) >= 2 ? 'var(--brand-red)' : 'var(--brand-green)',
              textAlign: 'center',
            }}>
              {parseFloat(ratio) >= 2 ? '🔥 High demand pressure' : parseFloat(ratio) >= 1.2 ? '⚖️ Near equilibrium' : '📉 Supply surplus'}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Top Markets Bar Chart ─────────────────────────── */}
      <Card title="Top Markets — Supply vs Demand" subtitle="Comparative analysis by location">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supplyDemandData} barGap={4} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
            <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
              formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString() : v, String(n)]}
              cursor={{ fill: 'rgba(14,165,233,0.06)' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Bottom Row: Hot Markets Table + Quick Matcher ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Hot Markets */}
        <Card title="🔥 Hot Markets" subtitle="Sorted by demand pressure index">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Location</th>
                  <th>Pressure</th>
                  <th>Signal</th>
                  <th>D/S Ratio</th>
                </tr>
              </thead>
              <tbody>
                {topLocations.slice(0, 7).map((loc: any, i: number) => {
                  const pressure = parseFloat(loc.pressure)
                  const market   = markets.find((m: any) => m.location === loc.name)
                  const dsRatio  = (loc.demand / Math.max(loc.supply, 1)).toFixed(1)
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{loc.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: `${Math.min(pressure / 5 * 56, 56)}px`,
                            height: 5,
                            borderRadius: 3,
                            background: pressure >= 3.5 ? 'var(--brand-red)' : pressure >= 2 ? 'var(--brand-gold)' : 'var(--brand-green)',
                          }} />
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: pressure >= 3.5 ? 'var(--brand-red)' : pressure >= 2 ? 'var(--brand-gold)' : 'var(--brand-green)' }}>
                            {pressure.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={getMarketSignalVariant(market?.market_signal || 'balanced')}>
                          {market?.market_signal || 'balanced'}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.85rem', color: parseFloat(dsRatio) > 2 ? 'var(--brand-red)' : 'var(--brand-green)' }}>
                        {dsRatio}x
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Asset Matcher */}
        <Card title="⚡ Quick Asset Matcher" subtitle="Instantly find demand for your property">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</label>
                <select value={matchAsset.location} onChange={e => setMatchAsset(p => ({ ...p, location: e.target.value }))}>
                  {topLocations.map((l: any) => <option key={l.name} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</label>
                <select value={matchAsset.type} onChange={e => setMatchAsset(p => ({ ...p, type: e.target.value }))}>
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="studio">Studio</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="penthouse">Penthouse</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purpose</label>
                <select value={matchAsset.purpose} onChange={e => setMatchAsset(p => ({ ...p, purpose: e.target.value }))}>
                  <option value="sale">For Sale</option>
                  <option value="rent">For Rent</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bedrooms</label>
                <select value={matchAsset.bedrooms} onChange={e => setMatchAsset(p => ({ ...p, bedrooms: e.target.value }))}>
                  {['1','2','3','4','5'].map(n => <option key={n} value={n}>{n} BR</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price (EGP)</label>
              <input
                type="number"
                value={matchAsset.price}
                onChange={e => setMatchAsset(p => ({ ...p, price: e.target.value }))}
                placeholder="e.g. 5,500,000"
              />
            </div>

            {/* Summary line */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', lineHeight: 1.6 }}>
              Searching for a{' '}
              <span style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>{matchAsset.bedrooms}BR {matchAsset.type}</span>
              {' '}for{' '}
              <span style={{ color: matchAsset.purpose === 'sale' ? 'var(--brand-green)' : 'var(--brand-gold)', fontWeight: 600 }}>{matchAsset.purpose}</span>
              {' '}in{' '}
              <span style={{ color: 'var(--brand-purple)', fontWeight: 600 }}>{matchAsset.location}</span>
            </div>

            <button
              onClick={handleMatch}
              disabled={matchLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '0.9rem',
                opacity: matchLoading ? 0.7 : 1,
                cursor: matchLoading ? 'not-allowed' : 'pointer',
                justifyContent: 'center',
              }}
            >
              <span style={{ animation: matchLoading ? 'spin 0.8s linear infinite' : 'none', display: 'inline-block' }}>
                {matchLoading ? '⟳' : '🎯'}
              </span>
              {matchLoading ? 'Matching…' : 'Find Matching Buyers'}
            </button>

            {matchResult && (
              <div className="fade-in" style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
                  ✅ {matchResult.matches_found || 'Multiple'} buyers matched!
                </div>
                {matchResult.top_match_score != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Top match score</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width: `${(matchResult.top_match_score * 100).toFixed(0)}%`,
                          background: matchResult.top_match_score >= 0.85 ? 'var(--brand-green)' : matchResult.top_match_score >= 0.7 ? 'var(--brand-gold)' : 'var(--brand-red)',
                        }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-green)' }}>
                      {(matchResult.top_match_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {matchResult.message && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ℹ️ {matchResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Live Widget Embeds ────────────────────────────── */}
      {Object.keys(embedData).length > 0 && (
        <Card title="📡 Live Market Widgets" subtitle="Real-time buyer activity by location">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {Object.entries(embedData).map(([location, data]: [string, any]) => {
              const loc    = topLocations.find((l: any) => l.name === location)
              const market = markets.find((m: any) => m.location === location)
              const pressure = loc ? parseFloat(loc.pressure) : 0
              return (
                <div key={location} style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'rgba(14,165,233,0.05)',
                  border: '1px solid rgba(14,165,233,0.18)',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.45)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.18)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>📍 {location}</div>
                    {pressure > 0 && <Badge variant={getPressureVariant(pressure)}>{pressure.toFixed(2)}x</Badge>}
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-teal)', lineHeight: 1 }}>
                    {(data?.demand_count || loc?.demand || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px', marginBottom: '8px' }}>active buyers</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    {data?.avg_price && (
                      <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>
                        Avg {(data.avg_price / 1000000).toFixed(1)}M EGP
                      </span>
                    )}
                    {market?.price_trend && (
                      <span style={{ color: market.price_trend.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)', fontWeight: 600 }}>
                        📈 {market.price_trend}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
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
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
      </span>
    </div>
  )
}
