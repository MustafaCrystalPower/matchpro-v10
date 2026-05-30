<<<<<<< HEAD
/**
 * Dashboard — matches lkdsbjzk.gensparkclaw.com/market-intelligence exactly
 * Stats bar · Supply/Demand Balance · Purpose Breakdown · Property Types ·
 * Price Distribution · Location Cards · Instant Match Engine
 */
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
=======
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
>>>>>>> origin/main
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
<<<<<<< HEAD
import Badge, { getMarketSignalVariant } from '../components/Badge'
=======
import Badge, { getMarketSignalVariant, getPressureVariant } from '../components/Badge'
>>>>>>> origin/main

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']
<<<<<<< HEAD
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
=======

export default function Dashboard({ apiData, loading }: Props) {
  const [matchAsset, setMatchAsset] = useState({
>>>>>>> origin/main
    location: 'Madinaty', type: 'apartment', purpose: 'sale', price: '5500000', bedrooms: '3',
  })
  const [matchResult, setMatchResult]   = useState<any>(null)
  const [matchLoading, setMatchLoading] = useState(false)
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
      })
    } finally {
      setMatchLoading(false)
    }
  }

<<<<<<< HEAD
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

=======
>>>>>>> origin/main
  const ratio = summary?.total_supply
    ? (summary.total_demand / summary.total_supply).toFixed(2)
    : '—'

<<<<<<< HEAD
  const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000)    return `${(n / 1000).toFixed(0)}K`
    return String(n)
  }

  const selectedMarket = selectedCard ? markets.find((m: any) => m.location === selectedCard) : null

=======
>>>>>>> origin/main
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

      {/* ── Page Header ──────────────────────────────────── */}
<<<<<<< HEAD
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Market Intelligence
=======
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
            Market Overview
>>>>>>> origin/main
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Egyptian real estate intelligence — powered by MatchPro™ v10
          </p>
        </div>
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
          subtitle="Active listings"
          icon="🏠"
          color="var(--brand-teal)"
          trend={{ value: '+5.2%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Demand"
<<<<<<< HEAD
          value={(summary?.total_demand || 7626).toLocaleString()}
=======
          value={summary?.total_demand || 0}
>>>>>>> origin/main
          subtitle="Qualified buyers"
          icon="👥"
          color="var(--brand-green)"
          trend={{ value: '+12.8%', up: true }}
          loading={loading}
        />
        <StatCard
          title="Total Matches"
<<<<<<< HEAD
          value={(summary?.total_matches || 57105).toLocaleString()}
          subtitle="AI-powered connections"
=======
          value={summary?.total_matches || 0}
          subtitle="Connections made"
>>>>>>> origin/main
          icon="🎯"
          color="var(--brand-gold)"
          trend={{ value: '+8.3%', up: true }}
          loading={loading}
        />
        <StatCard
<<<<<<< HEAD
          title="Locations"
          value={String(topLocations.length || 967)}
          subtitle="Active markets"
          icon="📍"
=======
          title="Demand Ratio"
          value={`${ratio}x`}
          subtitle={parseFloat(ratio) >= 2 ? '🔥 Seller market' : parseFloat(ratio) >= 1.2 ? '⚖️ Balanced' : '📉 Buyer market'}
          icon="⚖️"
>>>>>>> origin/main
          color="var(--brand-purple)"
          loading={loading}
        />
      </div>

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
            </div>
          </div>
        </Card>
      </div>

<<<<<<< HEAD
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
=======
      {/* ── Top Markets Bar Chart ─────────────────────────── */}
      <Card title="Top Markets — Supply vs Demand" subtitle="Comparative analysis by location">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supplyDemandData} barGap={4} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
>>>>>>> origin/main
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
            <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }}
<<<<<<< HEAD
              formatter={(v: any, n: any) => [Number(v).toLocaleString(), String(n)]}
              labelFormatter={(l: any) => supplyDemandBar.find((d: any) => d.name === l)?.fullName || l}
=======
              formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString() : v, String(n)]}
              cursor={{ fill: 'rgba(14,165,233,0.06)' }}
>>>>>>> origin/main
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
    </div>
  )
}

<<<<<<< HEAD
function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
=======
function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
>>>>>>> origin/main
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {label}: <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
      </span>
    </div>
  )
}
<<<<<<< HEAD

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
=======
>>>>>>> origin/main
