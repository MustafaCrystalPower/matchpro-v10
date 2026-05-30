/**
 * Broker Analytics — Leaderboard, supply/demand per broker, activity tracking
 */
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import Card from '../components/Card'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface Broker {
  phone: string
  name: string
  supply: number
  demand: number
  match: number
  inquiry: number
  other: number
  total: number
  lastSeen: string | null
}

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316']
const MOCK_BROKERS: Broker[] = [
  { phone: '+201066505665', name: 'Crystal Power Main', supply: 45, demand: 78, match: 12, inquiry: 8, other: 5, total: 148, lastSeen: new Date(Date.now() - 300000).toISOString() },
  { phone: '+201012345678', name: 'Ahmed Hassan', supply: 32, demand: 41, match: 8,  inquiry: 5, other: 3, total: 89,  lastSeen: new Date(Date.now() - 1800000).toISOString() },
  { phone: '+201198765432', name: 'Sara Mohamed', supply: 28, demand: 55, match: 6,  inquiry: 4, other: 2, total: 95,  lastSeen: new Date(Date.now() - 7200000).toISOString() },
  { phone: '+201087654321', name: 'Khaled Ali',   supply: 19, demand: 34, match: 5,  inquiry: 7, other: 1, total: 66,  lastSeen: new Date(Date.now() - 3600000).toISOString() },
  { phone: '+201156789012', name: 'Fatima Ibrahim',supply: 22, demand: 29, match: 4, inquiry: 3, other: 2, total: 60,  lastSeen: new Date(Date.now() - 14400000).toISOString() },
  { phone: '+201234567890', name: 'Omar Sayed',   supply: 15, demand: 22, match: 3,  inquiry: 6, other: 4, total: 50,  lastSeen: new Date(Date.now() - 86400000).toISOString() },
]

export default function BrokerAnalytics({ }: Props) {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loadingB, setLoadingB] = useState(true)
  const [sortBy, setSortBy]     = useState<'total'|'supply'|'demand'|'match'>('total')
  const [selected, setSelected] = useState<Broker | null>(null)

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        const res  = await fetch('/api/brokers')
        const data = await res.json()
        if (data.brokers?.length > 0) {
          setBrokers(data.brokers)
        } else {
          setBrokers(MOCK_BROKERS)
        }
      } catch {
        setBrokers(MOCK_BROKERS)
      } finally {
        setLoadingB(false)
      }
    }
    fetchBrokers()
    const t = setInterval(fetchBrokers, 30_000)
    return () => clearInterval(t)
  }, [])

  const sorted = [...brokers].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  const totalMsgs   = brokers.reduce((s, b) => s + b.total, 0)
  const totalSupply = brokers.reduce((s, b) => s + b.supply, 0)
  const totalDemand = brokers.reduce((s, b) => s + b.demand, 0)
  const totalMatch  = brokers.reduce((s, b) => s + b.match, 0)

  const activityData = sorted.slice(0, 6).map((b, i) => ({
    name:    b.name.split(' ')[0],
    supply:  b.supply,
    demand:  b.demand,
    match:   b.match,
  }))

  const pieData = [
    { name: 'Supply',  value: totalSupply },
    { name: 'Demand',  value: totalDemand },
    { name: 'Match',   value: totalMatch  },
    { name: 'Inquiry', value: brokers.reduce((s, b) => s + b.inquiry, 0) },
  ]

  const fmt = (d: string | null) => {
    if (!d) return 'Never'
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 60000)    return 'Just now'
    if (diff < 3600000)  return `${Math.round(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
    return `${Math.round(diff / 86400000)}d ago`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>👔 Broker Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Performance leaderboard · Supply/demand ratio · Activity tracking</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        <StatCard title="Active Brokers"   value={String(brokers.length)}        subtitle="Contributing agents"  icon="👔" color="var(--brand-teal)"   loading={loadingB} />
        <StatCard title="Total Messages"   value={totalMsgs.toLocaleString()}    subtitle="From all brokers"     icon="💬" color="var(--brand-green)"  loading={loadingB} />
        <StatCard title="Supply Messages"  value={totalSupply.toLocaleString()}  subtitle="Property listings"    icon="🏠" color="var(--brand-gold)"   loading={loadingB} />
        <StatCard title="Match Created"    value={totalMatch.toLocaleString()}   subtitle="Confirmed matches"    icon="🎯" color="var(--brand-purple)"  loading={loadingB} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <Card title="📊 Broker Activity Comparison" subtitle="Supply / Demand / Match per broker">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.8)" />
              <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4e6280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3,3,0,0]} maxBarSize={22} />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3,3,0,0]} maxBarSize={22} />
              <Bar dataKey="match"  name="Match"  fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="🥧 Message Distribution" subtitle="By classification type">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.9} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', color: '#f1f5f9', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card
        title="🏆 Broker Leaderboard"
        subtitle={`Sorted by ${sortBy} — click a row for details`}
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {(['total','supply','demand','match'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              padding: '5px 14px', borderRadius: '16px', fontSize: '0.75rem', cursor: 'pointer',
              border: `1px solid ${sortBy === s ? 'var(--brand-teal)' : 'var(--border)'}`,
              background: sortBy === s ? 'rgba(14,165,233,0.12)' : 'rgba(0,0,0,0.15)',
              color: sortBy === s ? 'var(--brand-teal)' : 'var(--text-muted)',
              fontWeight: sortBy === s ? 700 : 400,
            }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Broker</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Supply</th>
                <th>Demand</th>
                <th>Match</th>
                <th>D/S Ratio</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b, i) => {
                const ratio = b.supply > 0 ? (b.demand / b.supply).toFixed(1) : '—'
                const isHot = b.total >= 50
                return (
                  <tr key={b.phone} onClick={() => setSelected(selected?.phone === b.phone ? null : b)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                  >
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{b.name}</div>
                          {isHot && <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>🔥 Top Performer</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.phone}</td>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{b.total}</td>
                    <td style={{ color: 'var(--brand-teal)',   fontWeight: 600 }}>{b.supply}</td>
                    <td style={{ color: 'var(--brand-green)',  fontWeight: 600 }}>{b.demand}</td>
                    <td style={{ color: 'var(--brand-gold)',   fontWeight: 600 }}>{b.match}</td>
                    <td style={{ fontWeight: 700, color: parseFloat(ratio) > 2 ? 'var(--brand-red)' : 'var(--brand-green)' }}>{ratio}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(b.lastSeen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail panel */}
      {selected && (
        <Card title={`👤 ${selected.name} — Full Profile`} subtitle={selected.phone}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {[
              ['Total',   String(selected.total),   'var(--brand-teal)'],
              ['Supply',  String(selected.supply),  'var(--brand-teal)'],
              ['Demand',  String(selected.demand),  'var(--brand-green)'],
              ['Match',   String(selected.match),   'var(--brand-gold)'],
              ['Inquiry', String(selected.inquiry), 'var(--brand-purple)'],
              ['Other',   String(selected.other),   'var(--text-muted)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '3px' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Last seen: <strong style={{ color: 'var(--text-primary)' }}>{fmt(selected.lastSeen)}</strong>
            {' · '} D/S Ratio: <strong style={{ color: selected.supply > 0 && selected.demand / selected.supply > 2 ? 'var(--brand-red)' : 'var(--brand-green)' }}>
              {selected.supply > 0 ? (selected.demand / selected.supply).toFixed(1) + 'x' : '—'}
            </strong>
          </div>
        </Card>
      )}
    </div>
  )
}
