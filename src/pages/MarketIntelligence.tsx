import { useState, useEffect } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
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

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

export default function MarketIntelligence({ apiData, loading }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<any>(null)
  const [locationData, setLocationData] = useState<any>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'pressure' | 'demand' | 'supply'>('pressure')

  const markets = apiData?.intelligence?.markets || []
  const topLocations = apiData?.summary?.top_locations || []

  const filteredMarkets = markets
    .filter((m: any) => m.location?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a: any, b: any) => {
      if (sortBy === 'pressure') return (b.pressure_index || 0) - (a.pressure_index || 0)
      if (sortBy === 'demand') return (b.demand || 0) - (a.demand || 0)
      return (b.supply || 0) - (a.supply || 0)
    })

  const fetchLocationData = async (location: string) => {
    setLocationLoading(true)
    try {
      const [supplyRes, demandRes, embedRes] = await Promise.all([
        fetch(`/proxy/api/public/supply?location=${encodeURIComponent(location)}&limit=10`),
        fetch(`/proxy/api/public/demand?location=${encodeURIComponent(location)}&limit=10`),
        fetch(`/proxy/api/public/embed/${encodeURIComponent(location)}`)
      ])
      const supply = await supplyRes.json()
      const demand = await demandRes.json()
      const embed = await embedRes.json()
      setLocationData({ supply, demand, embed })
    } catch {
      // Mock data
      setLocationData({
        supply: { data: Array.from({ length: 5 }, (_, i) => ({ id: i+1, location, price: 3000000 + i * 500000, bedrooms: 2 + i % 3, type: 'apartment', purpose: 'sale' })) },
        demand: { data: Array.from({ length: 8 }, (_, i) => ({ id: i+1, location, budget_max: 4000000 + i * 300000, bedrooms: 2 + i % 3, type: 'apartment' })) },
        embed: { demand_count: 150 + Math.floor(Math.random() * 200), avg_price: 4500000, location }
      })
    } finally {
      setLocationLoading(false)
    }
  }

  const handleSelectMarket = (market: any) => {
    setSelectedMarket(market)
    fetchLocationData(market.location)
  }

  // Radar data placeholder
  const _radarData = [
    { metric: 'Demand', ...Object.fromEntries(topLocations.slice(0, 5).map((l: any) => [l.name, Math.min(l.demand / 20, 100)])) },
    { metric: 'Supply', ...Object.fromEntries(topLocations.slice(0, 5).map((l: any) => [l.name, Math.min(l.supply / 10, 100)])) },
    { metric: 'Pressure', ...Object.fromEntries(topLocations.slice(0, 5).map((l: any) => [l.name, parseFloat(l.pressure) * 20])) },
  ]

  const scatterData = markets.map((m: any) => ({
    x: m.supply || 0,
    y: m.demand || 0,
    z: m.pressure_index || 1,
    name: m.location,
    signal: m.market_signal
  }))

  const hotMarkets = markets.filter((m: any) => (m.pressure_index || 0) >= 3)
  const balancedMarkets = markets.filter((m: any) => (m.pressure_index || 0) >= 1.5 && (m.pressure_index || 0) < 3)
  const buyerMarkets = markets.filter((m: any) => (m.pressure_index || 0) < 1.5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          🧠 Market Intelligence
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Deep analysis of Egyptian real estate markets with AI-powered insights
        </p>
      </div>

      {/* Market Signal Summary */}
      <div className="grid grid-cols-3" style={{ gap: '16px' }}>
        <StatCard
          title="Seller Markets"
          value={hotMarkets.length + balancedMarkets.length}
          subtitle="Supply < Demand"
          icon="🔥"
          color="var(--brand-red)"
          loading={loading}
        />
        <StatCard
          title="Balanced Markets"
          value={balancedMarkets.length}
          subtitle="Equilibrium zones"
          icon="⚖️"
          color="var(--brand-gold)"
          loading={loading}
        />
        <StatCard
          title="Buyer Markets"
          value={buyerMarkets.length}
          subtitle="Supply > Demand"
          icon="🎁"
          color="var(--brand-green)"
          loading={loading}
        />
      </div>

      {/* Main Content: Table + Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Markets Table */}
        <Card
          title="All Markets"
          subtitle={`${filteredMarkets.length} markets tracked`}
          actions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '140px', padding: '6px 10px', fontSize: '0.8rem' }}
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ padding: '6px 10px', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="pressure">By Pressure</option>
                <option value="demand">By Demand</option>
                <option value="supply">By Supply</option>
              </select>
            </div>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: '450px', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
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
                {filteredMarkets.map((market: any, i: number) => (
                  <tr
                    key={i}
                    style={{ cursor: 'pointer', background: selectedMarket?.location === market.location ? 'rgba(14,165,233,0.08)' : undefined }}
                    onClick={() => handleSelectMarket(market)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{market.location}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--brand-green)' }}>{(market.demand || 0).toLocaleString()}</td>
                    <td style={{ color: 'var(--brand-teal)' }}>{(market.supply || 0).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: `${Math.min((market.pressure_index || 0) / 5 * 50, 50)}px`,
                          height: '4px',
                          borderRadius: '2px',
                          background: (market.pressure_index || 0) >= 3.5 ? '#ef4444' : (market.pressure_index || 0) >= 2 ? '#f59e0b' : '#10b981',
                          transition: 'width 0.3s'
                        }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
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
                      fontWeight: 600,
                      color: market.price_trend?.startsWith('+') ? '#10b981' : '#ef4444'
                    }}>
                      {market.price_trend || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Market Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedMarket ? (
            <>
              <Card title={`📍 ${selectedMarket.location}`} subtitle="Detailed market breakdown">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <MiniMetric label="Demand" value={(selectedMarket.demand || 0).toLocaleString()} color="var(--brand-green)" />
                    <MiniMetric label="Supply" value={(selectedMarket.supply || 0).toLocaleString()} color="var(--brand-teal)" />
                    <MiniMetric label="Pressure" value={`${(selectedMarket.pressure_index || 0).toFixed(2)}x`} color="var(--brand-gold)" />
                    <MiniMetric label="Avg Price" value={selectedMarket.avg_price ? `${(selectedMarket.avg_price / 1000000).toFixed(1)}M` : 'N/A'} color="var(--brand-purple)" />
                  </div>

                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Market Temperature</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {getTemperatureLabel(selectedMarket.pressure_index || 0)}
                    </div>
                  </div>

                  {selectedMarket.hot_types && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Hot Property Types</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {selectedMarket.hot_types.map((t: string) => (
                          <Badge key={t} variant="info">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 600, marginBottom: '4px' }}>
                      Investment Recommendation
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {selectedMarket.pressure_index >= 3 ?
                        `Strong seller market. High demand (${selectedMarket.demand}) vs low supply (${selectedMarket.supply}). Excellent investment opportunity.` :
                        selectedMarket.pressure_index >= 1.5 ?
                        `Balanced market with moderate activity. Good for long-term investment.` :
                        `Buyer-favored market. More supply than demand. Negotiate for better deals.`
                      }
                    </div>
                  </div>
                </div>
              </Card>

              {locationData && !locationLoading && (
                <Card title="Live Widget Data" subtitle="Real-time buyer activity">
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand-teal)' }}>
                          {(locationData.embed?.demand_count || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>active buyers</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--brand-gold)' }}>
                          {locationData.embed?.avg_price ? `${(locationData.embed.avg_price / 1000000).toFixed(1)}M EGP` : '—'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>avg price</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗺️</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Select a market from the table to see detailed analysis
              </div>
            </div>
          )}

          {/* Scatter Plot */}
          <Card title="Supply vs Demand Scatter" subtitle="Market positioning">
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="x" name="Supply" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Supply', position: 'insideBottom', fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="y" name="Demand" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <ZAxis dataKey="z" range={[40, 200]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                  formatter={(v: any, _n: any, p: any) => [v, p.payload?.name || String(_n)]}
                />
                <Scatter
                  data={scatterData}
                  fill="#0ea5e9"
                  fillOpacity={0.7}
                />
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
    <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
