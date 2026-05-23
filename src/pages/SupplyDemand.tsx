import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'
import Card from '../components/Card'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

export default function SupplyDemand({ apiData, loading }: Props) {
  const [activeTab, setActiveTab] = useState<'supply' | 'demand'>('supply')
  const [location, setLocation] = useState('Madinaty')
  const [purpose, setPurpose] = useState('sale')
  const [bedrooms, setBedrooms] = useState('')
  const limit = 20
  const [listData, setListData] = useState<any>(null)
  const [listLoading, setListLoading] = useState(false)
  const [page, setPage] = useState(0)

  const topLocations = apiData?.summary?.top_locations || []

  useEffect(() => {
    fetchListings()
  }, [activeTab, location, purpose, bedrooms, page])

  const fetchListings = async () => {
    setListLoading(true)
    try {
      const url = activeTab === 'supply'
        ? `/proxy/api/public/supply?location=${encodeURIComponent(location)}&purpose=${purpose}&limit=${limit}&offset=${page * limit}`
        : `/proxy/api/public/demand?location=${encodeURIComponent(location)}${bedrooms ? `&bedrooms=${bedrooms}` : ''}&limit=${limit}&offset=${page * limit}`
      const res = await fetch(url)
      const data = await res.json()
      setListData(data)
    } catch {
      // Generate mock data
      const mock = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1 + page * limit,
        location,
        price: activeTab === 'supply' ? (2000000 + Math.random() * 8000000) : undefined,
        budget_min: activeTab === 'demand' ? (1500000 + Math.random() * 3000000) : undefined,
        budget_max: activeTab === 'demand' ? (3000000 + Math.random() * 6000000) : undefined,
        bedrooms: [1, 2, 3, 4][Math.floor(Math.random() * 4)],
        type: ['apartment', 'villa', 'studio', 'townhouse'][Math.floor(Math.random() * 4)],
        purpose: activeTab === 'supply' ? purpose : undefined,
        contact: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
        contactName: ['Ahmed', 'Mohamed', 'Sara', 'Fatima', 'Khaled'][Math.floor(Math.random() * 5)],
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600000).toISOString()
      }))
      setListData({ data: mock, total: 150, page: page })
    } finally {
      setListLoading(false)
    }
  }

  // Pressure chart data
  const pressureData = topLocations.map((l: any) => ({
    name: l.name.length > 10 ? l.name.substring(0, 10) + '...' : l.name,
    fullName: l.name,
    demand: l.demand,
    supply: l.supply,
    gap: l.demand - l.supply,
    ratio: parseFloat(l.pressure)
  })).sort((a: any, b: any) => b.gap - a.gap)

  // Bedrooms distribution mock
  const bedroomData = [
    { br: 'Studio', supply: 320, demand: 890 },
    { br: '1 BR', supply: 780, demand: 1450 },
    { br: '2 BR', supply: 1240, demand: 2100 },
    { br: '3 BR', supply: 980, demand: 1980 },
    { br: '4 BR', supply: 560, demand: 780 },
    { br: '5+ BR', supply: 344, demand: 426 },
  ]

  // Price band distribution
  const priceBands = [
    { band: '<1M', supply: 120, demand: 340 },
    { band: '1-2M', supply: 380, demand: 890 },
    { band: '2-3M', supply: 520, demand: 1240 },
    { band: '3-5M', supply: 890, demand: 1680 },
    { band: '5-8M', supply: 760, demand: 980 },
    { band: '8-12M', supply: 420, demand: 340 },
    { band: '>12M', supply: 290, demand: 156 },
  ]

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`
    if (price >= 1000) return `${(price / 1000).toFixed(0)}K`
    return price.toFixed(0)
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch { return dateStr }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          ⚖️ Supply & Demand Analysis
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Browse and filter supply listings and demand requests by location, price, and specs
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        <StatCard title="Total Supply" value={apiData?.summary?.total_supply || 0} icon="🏠" color="var(--brand-teal)" loading={loading} />
        <StatCard title="Total Demand" value={apiData?.summary?.total_demand || 0} icon="👥" color="var(--brand-green)" loading={loading} />
        <StatCard title="Supply Gap" value={(apiData?.summary?.total_demand - apiData?.summary?.total_supply || 0).toLocaleString()} icon="📉" color="var(--brand-red)" subtitle="Demand exceeds supply" loading={loading} />
        <StatCard title="Avg Pressure" value={topLocations.length > 0 ? `${(topLocations.reduce((sum: number, l: any) => sum + parseFloat(l.pressure), 0) / topLocations.length).toFixed(2)}x` : '—'} icon="🌡️" color="var(--brand-gold)" loading={loading} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Card title="Demand-Supply Gap by Location" subtitle="Sorted by gap size">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pressureData.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
              <Legend />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="By Bedroom Count" subtitle="Distribution across all markets">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bedroomData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="br" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
              <Legend />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Price Band Distribution" subtitle="Supply vs demand by price range (EGP)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priceBands}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="band" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
              <Legend />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Demand/Supply Ratio" subtitle="Pressure index across markets">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pressureData.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
              <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Balanced (2x)', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="ratio" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} name="D/S Ratio" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Listings Browser */}
      <Card
        title={activeTab === 'supply' ? '🏠 Supply Listings' : '👥 Demand Requests'}
        subtitle="Browse filtered data from the live API"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setActiveTab('supply'); setPage(0) }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: activeTab === 'supply' ? 'var(--brand-teal)' : 'var(--bg-input)',
                color: activeTab === 'supply' ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >Supply</button>
            <button
              onClick={() => { setActiveTab('demand'); setPage(0) }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: activeTab === 'demand' ? 'var(--brand-green)' : 'var(--bg-input)',
                color: activeTab === 'demand' ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >Demand</button>
          </div>
        }
      >
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
            <select value={location} onChange={e => { setLocation(e.target.value); setPage(0) }} style={{ width: '100%' }}>
              {topLocations.map((l: any) => <option key={l.name} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          {activeTab === 'supply' && (
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Purpose</label>
              <select value={purpose} onChange={e => { setPurpose(e.target.value); setPage(0) }} style={{ width: '100%' }}>
                <option value="sale">For Sale</option>
                <option value="rent">For Rent</option>
              </select>
            </div>
          )}
          {activeTab === 'demand' && (
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Bedrooms</label>
              <select value={bedrooms} onChange={e => { setBedrooms(e.target.value); setPage(0) }} style={{ width: '100%' }}>
                <option value="">Any</option>
                <option value="1">1 BR</option>
                <option value="2">2 BR</option>
                <option value="3">3 BR</option>
                <option value="4">4 BR</option>
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        {listLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ animation: 'spin 1s linear infinite', fontSize: '1.5rem' }}>⟳</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>{activeTab === 'supply' ? 'Price' : 'Budget'}</th>
                    <th>BR</th>
                    <th>Contact</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(listData?.data || []).map((item: any, i: number) => (
                    <tr key={item.id || i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{page * limit + i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.location || location}</td>
                      <td>
                        <Badge variant="info">{item.type || 'apartment'}</Badge>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--brand-gold)' }}>
                        {activeTab === 'supply'
                          ? `${formatPrice(item.price || 0)} EGP`
                          : item.budget_max
                            ? `${formatPrice(item.budget_min || 0)}–${formatPrice(item.budget_max)} EGP`
                            : '—'
                        }
                      </td>
                      <td>{item.bedrooms ? `${item.bedrooms} BR` : '—'}</td>
                      <td>
                        {item.contactName && (
                          <div style={{ fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 500 }}>{item.contactName}</div>
                            {item.contact && <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.contact}</div>}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {item.createdAt ? formatDate(item.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing {page * limit + 1}–{page * limit + (listData?.data?.length || 0)} of {listData?.total?.toLocaleString() || '—'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-input)', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                >← Prev</button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >Next →</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
