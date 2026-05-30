/**
 * Dashboard — matches lkdsbjzk.gensparkclaw.com/market-intelligence exactly
 * Stats bar · Supply/Demand Balance · Purpose Breakdown · Property Types ·
 * Price Distribution · Location Cards · Instant Match Engine
 */
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant } from '../components/Badge'

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']
const CPI_ASSETS = [
  { label: 'Madinaty 3BR Sale',    location: 'Madinaty',     type: 'apartment', purpose: 'sale', price: 5500000, bedrooms: 3 },
  { label: 'New Cairo Villa',      location: 'New Cairo',    type: 'villa',     purpose: 'sale', price: 12000000,bedrooms: 4 },
  { label: 'Sheikh Zayed Studio',  location: 'Sheikh Zayed', type: 'studio',    purpose: 'rent', price: 18000,   bedrooms: 1 },
  { label: 'Tagamoa Apartment',    location: 'Tagamoa',      type: 'apartment', purpose: 'sale', price: 7200000, bedrooms: 3 },
  { label: 'Zamalek Penthouse',    location: 'Zamalek',      type: 'penthouse', purpose: 'rent', price: 65000,   bedrooms: 3 },
  { label: 'New Capital Office',   location: 'New Capital',  type: 'office',    purpose: 'sale', price: 4200000, bedrooms: 0 },
]

export default function Dashboard({ apiData, loading }: Props) {
  const [matchForm, setMatchForm] = useState({
    location: 'Madinaty', type: 'apartment', purpose: 'sale', price: '5500000', bedrooms: '3',
  })
  const [matchResult, setMatchResult]   = useState<any>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [cardData, setCardData]         = useState<Record<string, any>>({})
  const [cardLoading, setCardLoading]   = useState(false)

  const summary      = apiData?.summary
  const markets      = apiData?.intelligence?.markets || []
  const topLocations = (summary?.top_locations || []).slice(0, 10)

  // ── Chart data ──────────────────────────────────────────────────────
  const supplyDemandBar = topLocations.slice(0, 8).map((l: any) => ({
    name:     l.name.length > 12 ? l.name.slice(0, 11) + '…' : l.name,
    fullName: l.name,
    supply:   l.supply,
    demand:   l.demand,
  }))

  const purposePie = summary?.purpose_breakdown
    ? [
        { name: 'Sale', value: summary.purpose_breakdown.sale?.count  || summary.total_supply * 0.78 },
        { name: 'Rent', value: summary.purpose_breakdown.rent?.count  || summary.total_supply * 0.22 },
      ]
    : [
        { name: 'Sale', value: Math.round((summary?.total_supply || 4224) * 0.779) },
        { name: 'Rent', value: Math.round((summary?.total_supply || 4224) * 0.221) },
      ]

  const propertyTypeData = summary?.property_types || [
    { type: 'Apartment', count: 2800 },
    { type: 'Villa',     count: 680  },
    { type: 'Townhouse', count: 450  },
    { type: 'Studio',    count: 320  },
    { type: 'Penthouse', count: 160  },
    { type: 'Duplex',    count: 98   },
  ]

  const priceDistData = summary?.price_distribution || [
    { range: '< 2M',  count: 420  },
    { range: '2-4M',  count: 980  },
    { range: '4-6M',  count: 1240 },
    { range: '6-8M',  count: 860  },
    { range: '8-10M', count: 540  },
    { range: '> 10M', count: 264  },
  ]

  const pressureData = topLocations.slice(0, 8).map((l: any) => ({
    name:     l.name.length > 14 ? l.name.slice(0, 13) + '…' : l.name,
    fullName: l.name,
    pressure: parseFloat(l.pressure),
  })).sort((a: any, b: any) => b.pressure - a.pressure)

  // ── Location card fetch ─────────────────────────────────────────────
  const fetchCardData = async (locationName: string) => {
    if (cardData[locationName]) { setSelectedCard(locationName); return }
    setCardLoading(true)
    setSelectedCard(locationName)
    try {
      const [supplyRes, demandRes, embedRes] = await Promise.all([
        fetch(`/proxy/api/public/supply?location=${encodeURIComponent(locationName)}&limit=4`),
        fetch(`/proxy/api/public/demand?location=${encodeURIComponent(locationName)}&limit=4`),
        fetch(`/proxy/api/public/embed/${encodeURIComponent(locationName)}`),
      ])
      const [supply, demand, embed] = await Promise.all([
        supplyRes.json(), demandRes.json(), embedRes.json()
      ])
      setCardData(prev => ({ ...prev, [locationName]: { supply, demand, embed } }))
    } catch {
      const loc = topLocations.find((l: any) => l.name === locationName)
      const market = markets.find((m: any) => m.location === locationName)
      setCardData(prev => ({
        ...prev,
        [locationName]: {
          supply: { data: market?.recent_supply || [] },
          demand: { data: market?.recent_demand || [] },
          embed:  {
            demand_count: loc?.demand || 120,
            avg_price:    market?.avg_price || 5000000,
            location:     locationName,
          },
        },
      }))
    } finally {
      setCardLoading(false)
    }
  }

  // ── Instant match engine ────────────────────────────────────────────
  const handleMatch = async () => {
    setMatchLoading(true)
    setMatchResult(null)
    try {
      // Try market API first
      const res = await fetch('/proxy/api/public/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_location: matchForm.location,
          asset_type:     matchForm.type,
          asset_purpose:  matchForm.purpose,
          asset_price:    parseInt(matchForm.price),
          asset_bedrooms: parseInt(matchForm.bedrooms),
        }),
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json()
      setMatchResult({ ...data, source: 'live' })
    } catch {
      // Fallback: compute locally from market pressure
      const loc    = topLocations.find((l: any) => l.name === matchForm.location)
      const market = markets.find((m: any) => m.location === matchForm.location)
      const base   = loc?.demand || 80
      const score  = market ? Math.min(98, Math.round(market.pressure_index * 18 + 30)) : 72
      setMatchResult({
        matches_found:   Math.round(base * 0.18),
        top_match_score: score / 100,
        location:        matchForm.location,
        market_signal:   market?.market_signal || 'balanced',
        pressure_index:  market?.pressure_index || 1.5,
        source:          'mock',
        message:         'Estimated from market pressure — live API offline',
      })
    } finally {
      setMatchLoading(false)
    }
  }

  const applyPreset = (preset: typeof CPI_ASSETS[0]) => {
    setMatchForm({
      location: preset.location,
      type:     preset.type,
      purpose:  preset.purpose,
      price:    String(preset.price),
      bedrooms: String(preset.bedrooms),
    })
    setMatchResult(null)
  }

  const ratio = summary?.total_supply
    ? (summary.total_demand / summary.total_supply).toFixed(2)
    : '—'

  const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000)    return `${(n / 1000).toFixed(0)}K`
    return String(n)
  }

  const selectedMarket = selectedCard ? markets.find((m: any) => m.location === selectedCard) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

      {/* ── Page Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Market Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Egyptian real estate intelligence — powered by MatchPro™ v10
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {apiData?.source === 'mock' && (
            <span style={{
              padding: '4px 12px', borderRadius: '12px',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
              fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-gold)',
            }}>📊 DEMO DATA</span>
          )}
          {apiData?.source === 'live' && (
            <span style={{
              padding: '4px 12px', borderRadius: '12px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-green)',
            }}>🔴 LIVE DATA</span>
          )}
        </div>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 stagger" style={{ gap: '16px' }}>
        <StatCard
          title="Total Supply"
          value={(summary?.total_supply || 4224).toLocaleString()}
          subtitle="Active listings"
          icon="🏠"
          color="var(--brand-teal)"
          trend={{ value: '+5.2%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Demand"
          value={(summary?.total_demand || 7626).toLocaleString()}
          subtitle="Qualified buyers"
          icon="👥"
          color="var(--brand-green)"
          trend={{ value: '+12.8%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Matches"
          value={(summary?.total_matches || 57105).toLocaleString()}
          subtitle="AI-powered connections"
          icon="🎯"
          color="var(--brand-gold)"
          trend={{ value: '+8.3%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Locations"
          value={String(topLocations.length || 967)}
          subtitle="Active markets"
          icon="📍"
          color="var(--brand-purple)"
          loading={loading}
        />
      </div>

      {/* ── Row 1: Pressure Bar + Supply/Demand Balance ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>

        <Card title="📊 Market Pressure by Location" subtitle="Demand ÷ Supply ratio — higher = more competitive">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pressureData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
              <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) + 'x' : v, 'Pressure']}
                labelFormatter={(l: any) => pressureData.find((d: any) => d.name === l)?.fullName || l}
              />
              <Bar dataKey="pressure" name="Pressure Index" radius={[4, 4, 0, 0]} maxBarSize={42}>
                {pressureData.map((_: any, i: number) => (
                  <Cell
                    key={i}
                    fill={pressureData[i]?.pressure >= 3.5 ? '#ef4444' : pressureData[i]?.pressure >= 2 ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
            {[['#ef4444','Seller (>3.5x)'], ['#f59e0b','Balanced (2-3.5x)'], ['#10b981','Buyer (<2x)']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c as string }} />
                {l}
              </div>
            ))}
          </div>
        </Card>

        <Card title="⚖️ Supply/Demand Balance" subtitle="Overall market split">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Supply', value: summary?.total_supply || 4224 },
                    { name: 'Demand', value: summary?.total_demand || 7626 },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={62} outerRadius={88}
                  paddingAngle={4} dataKey="value" strokeWidth={0}
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
            <div style={{ display: 'flex', gap: '24px' }}>
              <LegendDot color="#0ea5e9" label="Supply" value={(summary?.total_supply || 4224).toLocaleString()} />
              <LegendDot color="#10b981" label="Demand" value={(summary?.total_demand || 7626).toLocaleString()} />
            </div>
            <div style={{
              padding: '8px 20px', borderRadius: '8px',
              background: parseFloat(ratio) >= 2 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${parseFloat(ratio) >= 2 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              fontSize: '0.78rem', fontWeight: 700,
              color: parseFloat(ratio) >= 2 ? 'var(--brand-red)' : 'var(--brand-green)',
              textAlign: 'center',
            }}>
              {parseFloat(ratio) >= 2 ? '🔥 High Demand Pressure' : parseFloat(ratio) >= 1.2 ? '⚖️ Near Equilibrium' : '📉 Supply Surplus'}
              <div style={{ fontWeight: 400, fontSize: '0.7rem', marginTop: '2px', color: 'var(--text-muted)' }}>
                D/S Ratio: {ratio}x
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Purpose Breakdown + Property Types + Price Dist ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.3fr', gap: '20px' }}>

        <Card title="🏷️ Purpose Breakdown" subtitle="Sale vs Rent distribution">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={purposePie}
                  cx="50%" cy="50%"
                  outerRadius={78} paddingAngle={3}
                  dataKey="value" strokeWidth={0}
                >
                  <Cell fill="#0ea5e9" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
                  formatter={(v: any, n: any) => [Number(v).toLocaleString(), String(n)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '20px' }}>
              <LegendDot color="#0ea5e9" label="Sale" value={`${Math.round(purposePie[0].value / (purposePie[0].value + purposePie[1].value) * 100)}%`} />
              <LegendDot color="#f59e0b" label="Rent" value={`${Math.round(purposePie[1].value / (purposePie[0].value + purposePie[1].value) * 100)}%`} />
            </div>
          </div>
        </Card>

        <Card title="🏗️ Top Property Types" subtitle="Supply by property category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={propertyTypeData.slice(0, 6).map((p: any) => ({ name: p.type, count: p.count }))}
              layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {propertyTypeData.slice(0, 6).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="💰 Price Distribution (EGP)" subtitle="Supply by price range">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priceDistData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
              <XAxis dataKey="range" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
              />
              <Bar dataKey="count" name="Listings" radius={[4, 4, 0, 0]} maxBarSize={38}>
                {priceDistData.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Row 3: Supply vs Demand grouped bar ───────────── */}
      <Card title="📈 Supply vs Demand by Location" subtitle="Comparative analysis — top 8 markets">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supplyDemandBar} barGap={4} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
            <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
              formatter={(v: any, n: any) => [Number(v).toLocaleString(), String(n)]}
              labelFormatter={(l: any) => supplyDemandBar.find((d: any) => d.name === l)?.fullName || l}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Row 4: Location Cards ──────────────────────────── */}
      <div>
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>📍 Location Intelligence Cards</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Click any location to see recent supply & demand listings
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {topLocations.map((loc: any, i: number) => {
            const market   = markets.find((m: any) => m.location === loc.name)
            const pressure = parseFloat(loc.pressure)
            const isHot    = pressure >= 3.5
            const isWarm   = pressure >= 2 && pressure < 3.5
            const isSelected = selectedCard === loc.name
            return (
              <div
                key={i}
                onClick={() => fetchCardData(loc.name)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background:   isSelected ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.04)',
                  border:       `1px solid ${isSelected ? 'rgba(14,165,233,0.5)' : isHot ? 'rgba(239,68,68,0.25)' : isWarm ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.15)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.4)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = isHot ? 'rgba(239,68,68,0.25)' : isWarm ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.15)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : '📍'} {loc.name}
                  </div>
                  <Badge variant={isHot ? 'hot' : isWarm ? 'warm' : 'cool'}>
                    {pressure.toFixed(2)}x
                  </Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                  <Chip label="Supply" value={loc.supply.toLocaleString()} color="var(--brand-teal)" />
                  <Chip label="Demand" value={loc.demand.toLocaleString()} color="var(--brand-green)" />
                </div>
                {market?.avg_price && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Avg <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>
                      {fmt(market.avg_price)} EGP
                    </span>
                    {market.price_trend && (
                      <span style={{
                        marginLeft: '6px', fontWeight: 600,
                        color: market.price_trend.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)',
                      }}>
                        {market.price_trend}
                      </span>
                    )}
                  </div>
                )}
                {market?.market_signal && (
                  <div style={{ marginTop: '6px' }}>
                    <Badge variant={getMarketSignalVariant(market.market_signal)}>
                      {market.market_signal}
                    </Badge>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Location Detail Panel ──────────────────────────── */}
      {selectedCard && (
        <Card
          title={`📍 ${selectedCard} — Recent Listings`}
          subtitle={selectedMarket ? `Pressure: ${selectedMarket.pressure_index}x · Signal: ${selectedMarket.market_signal}` : ''}
        >
          {cardLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : cardData[selectedCard] ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Recent Supply */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-teal)', marginBottom: '10px' }}>
                  🏠 Recent Supply ({cardData[selectedCard]?.supply?.data?.length || 0})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(cardData[selectedCard]?.supply?.data || []).slice(0, 4).map((item: any, i: number) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: '8px',
                      background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {item.type || 'Property'} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-gold)' }}>
                          {item.price ? fmt(item.price) + ' EGP' : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {item.purpose === 'rent' ? '🔑 For Rent' : '🏷️ For Sale'}
                        {item.area_sqm ? ` · ${item.area_sqm}m²` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Demand */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-green)', marginBottom: '10px' }}>
                  👥 Recent Demand ({cardData[selectedCard]?.demand?.data?.length || 0})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(cardData[selectedCard]?.demand?.data || []).slice(0, 4).map((item: any, i: number) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: '8px',
                      background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Buyer {i + 1} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-green)' }}>
                          {item.budget_max ? 'Up to ' + fmt(item.budget_max) : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {item.purpose === 'rent' ? '🔑 Seeking Rental' : '🏷️ Seeking to Buy'}
                        {item.contact && <span style={{ marginLeft: '8px', color: 'var(--brand-teal)' }}>{item.contact}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* ── Instant Match Engine ───────────────────────────── */}
      <Card title="⚡ Instant Match Engine" subtitle="Crystal Power Investment — Quick asset matching">
        {/* CPI Asset Quick-Select */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            CPI Quick-Select Assets
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {CPI_ASSETS.map((asset, i) => (
              <button
                key={i}
                onClick={() => applyPreset(asset)}
                className="btn"
                style={{
                  padding: '6px 14px', fontSize: '0.75rem',
                  background: matchForm.location === asset.location && matchForm.type === asset.type
                    ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.06)',
                  border: '1px solid rgba(14,165,233,0.25)',
                  borderRadius: '20px', cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {asset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Location</label>
            <select value={matchForm.location} onChange={e => setMatchForm(p => ({ ...p, location: e.target.value }))}>
              {topLocations.map((l: any) => <option key={l.name} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Type</label>
            <select value={matchForm.type} onChange={e => setMatchForm(p => ({ ...p, type: e.target.value }))}>
              {['apartment','villa','studio','townhouse','duplex','penthouse','office'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Purpose</label>
            <select value={matchForm.purpose} onChange={e => setMatchForm(p => ({ ...p, purpose: e.target.value }))}>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Bedrooms</label>
            <select value={matchForm.bedrooms} onChange={e => setMatchForm(p => ({ ...p, bedrooms: e.target.value }))}>
              {['1','2','3','4','5','6'].map(n => <option key={n} value={n}>{n} BR</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Price (EGP)</label>
            <input
              type="number"
              value={matchForm.price}
              onChange={e => setMatchForm(p => ({ ...p, price: e.target.value }))}
              placeholder="e.g. 5,500,000"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleMatch}
            disabled={matchLoading}
            className="btn btn-primary"
            style={{ padding: '11px 28px', fontSize: '0.9rem', opacity: matchLoading ? 0.7 : 1 }}
          >
            <span style={{ animation: matchLoading ? 'spin 0.8s linear infinite' : 'none', display: 'inline-block' }}>
              {matchLoading ? '⟳' : '🎯'}
            </span>
            {matchLoading ? ' Matching…' : ' Find Matching Buyers'}
          </button>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Searching: <strong style={{ color: 'var(--brand-teal)' }}>{matchForm.bedrooms}BR {matchForm.type}</strong> for{' '}
            <strong style={{ color: matchForm.purpose === 'sale' ? 'var(--brand-green)' : 'var(--brand-gold)' }}>{matchForm.purpose}</strong> in{' '}
            <strong style={{ color: 'var(--brand-purple)' }}>{matchForm.location}</strong>
          </div>
        </div>

        {matchResult && (
          <div className="fade-in" style={{
            marginTop: '14px', padding: '16px', borderRadius: '10px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
          }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '10px' }}>
              ✅ {matchResult.matches_found || 'Multiple'} buyers matched in {matchResult.location || matchForm.location}!
            </div>
            {matchResult.top_match_score != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Top Match Score</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${(matchResult.top_match_score * 100).toFixed(0)}%`,
                      background: matchResult.top_match_score >= 0.85 ? 'var(--brand-green)' : matchResult.top_match_score >= 0.65 ? 'var(--brand-gold)' : 'var(--brand-red)',
                    }} />
                  </div>
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-green)' }}>
                  {(matchResult.top_match_score * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {matchResult.pressure_index && (
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>📊 Pressure: <strong style={{ color: 'var(--brand-gold)' }}>{matchResult.pressure_index}x</strong></span>
                <span>📡 Signal: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{matchResult.market_signal}</strong></span>
                {matchResult.source === 'mock' && (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ℹ️ {matchResult.message}</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
      </span>
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '4px 8px', borderRadius: '6px',
      background: 'rgba(0,0,0,0.2)',
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
