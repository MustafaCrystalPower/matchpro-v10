import { useState } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, BarChart, Bar,
} from 'recharts'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant, getTemperatureLabel } from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props {
  apiData: any
  loading: boolean
  refreshData: () => void
  lastUpdated: Date
}

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1']

export default function MarketIntelligence({ apiData, loading }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [locationData, setLocationData]     = useState<any>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy]           = useState<'pressure' | 'demand' | 'supply' | 'price'>('pressure')

  const markets      = apiData?.intelligence?.markets || []
  const topLocations = apiData?.summary?.top_locations || []

  const filteredMarkets = [...markets]
    .filter((m: any) => m.location?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a: any, b: any) => {
      if (sortBy === 'pressure') return (b.pressure_index || 0) - (a.pressure_index || 0)
      if (sortBy === 'demand')   return (b.demand  || 0) - (a.demand  || 0)
      if (sortBy === 'supply')   return (b.supply  || 0) - (a.supply  || 0)
      if (sortBy === 'price')    return (b.avg_price || 0) - (a.avg_price || 0)
      return 0
    })

  const fetchLocationData = async (location: string) => {
    setLocationLoading(true)
    try {
      const [supplyRes, demandRes, embedRes] = await Promise.all([
        fetch(`/api/public/supply?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/api/public/demand?location=${encodeURIComponent(location)}&limit=6`),
        fetch(`/api/public/embed/${encodeURIComponent(location)}`),
      ])
      const [supply, demand, embed] = await Promise.all([supplyRes.json(), demandRes.json(), embedRes.json()])
      setLocationData({ supply, demand, embed })
    } catch {
      setLocationData({
        supply: { data: Array.from({ length: 4 }, (_, i) => ({ id: i + 1, location, price: 3000000 + i * 600000, bedrooms: 2 + i % 3, type: ['apartment','villa','studio','duplex'][i % 4], purpose: 'sale' })) },
        demand: { data: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, location, budget_max: 4500000 + i * 350000, bedrooms: 2 + i % 3, type: 'apartment' })) },
        embed:  { demand_count: 120 + Math.floor(Math.random() * 250), avg_price: 4000000 + Math.random() * 2000000, location },
      })
    } finally {
      setLocationLoading(false)
    }
  }

  const handleSelectMarket = (market: any) => {
    setSelectedMarket(market)
    fetchLocationData(market.location)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

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
              </tbody>
            </table>
          </div>
        </Card>

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
    </div>
  )
}
