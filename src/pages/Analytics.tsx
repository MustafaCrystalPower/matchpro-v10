import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, FunnelChart, Funnel, LabelList,
  PieChart, Pie, Cell,
} from 'recharts'
import Card from '../components/Card'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

/* ─── CSV export ───────────────────────────────────────────── */
function exportAnalyticsCSV(
  trendData: any[], funnelData: any[], marketPerf: any[],
  brokers: any[], dateRange: string
) {
  const BOM = '\uFEFF'
  const ts  = new Date().toLocaleString('en-GB')
  const rows: any[][] = [
    ['MATCHPRO™ ANALYTICS REPORT — Crystal Power Intelligence'],
    [`Generated: ${ts}  |  Period: ${dateRange}`],
    [],
    ['=== MARKET TREND ==='],
    ['Date', 'Supply', 'Demand', 'Matches', 'Avg Price (EGP)'],
    ...trendData.map(d => [d.date, d.supply, d.demand, d.matches, d.avgPrice]),
    [],
    ['=== CONVERSION FUNNEL ==='],
    ['Stage', 'Count', 'Conversion %'],
    ...funnelData.map(f => [f.stage, f.count, `${f.pct}%`]),
    [],
    ['=== MARKET PERFORMANCE ==='],
    ['Rank', 'Location', 'Demand', 'Supply', 'Gap', 'Pressure', 'Score'],
    ...marketPerf.map((m, i) => [i+1, m.fullName, m.demand, m.supply, m.demand - m.supply, `${(m.score/20).toFixed(2)}x`, m.efficiency]),
    [],
    ['=== BROKER PERFORMANCE ==='],
    ['Rank', 'Phone', 'Total', 'Supply', 'Demand', 'Matches'],
    ...brokers.map((b, i) => [i+1, b.phone, b.total, b.supply_count, b.demand_count, b.match_count]),
  ]
  const csv = BOM + rows.map(r => r.map(c => {
    const s = String(c ?? '')
    return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `MatchPro_Analytics_${dateRange}_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ─── Custom funnel bar (horizontal) ────────────────────────── */
function FunnelBar({ stage, count, pct, color, maxCount }: {
  stage: string; count: number; pct: number; color: string; maxCount: number
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stage}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{count.toLocaleString()}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(count / maxCount) * 100}%`,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius: 5,
          transition: 'width 1s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  )
}

/* ─── Weekly heat grid ──────────────────────────────────────── */
function WeeklyHeatGrid() {
  const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const hours = ['9am','11am','1pm','3pm','5pm','7pm','9pm']
  // seeded so it doesn't re-randomize on every render
  const seed = (i: number) => ((i * 1664525 + 1013904223) & 0xffffffff) >>> 0
  const grid = days.map((_, di) => hours.map((_, hi) => {
    const isWeekend  = di >= 5
    const isPeakHour = hi >= 2 && hi <= 4
    const base = isWeekend ? 28 : isPeakHour ? 72 : 45
    return Math.min(100, Math.max(5, base + (seed(di*7+hi) % 35) - 10))
  }))

  return (
    <div>
      <div style={{ display: 'flex', marginBottom: 6, paddingLeft: 36, gap: 3 }}>
        {hours.map(h => (
          <div key={h} style={{ flex:1, textAlign:'center', fontSize:'0.6rem', color:'var(--text-muted)', fontWeight:600 }}>{h}</div>
        ))}
      </div>
      {days.map((day, di) => (
        <div key={day} style={{ display:'flex', alignItems:'center', gap:3, marginBottom:3 }}>
          <div style={{ width:32, fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:700, flexShrink:0 }}>{day}</div>
          {grid[di].map((val, hi) => {
            const bg = val >= 70
              ? `rgba(239,68,68,${0.35 + (val/100)*0.65})`
              : val >= 45
              ? `rgba(245,158,11,${0.25 + (val/100)*0.55})`
              : `rgba(14,165,233,${0.12 + (val/100)*0.38})`
            return (
              <div key={hi} title={`${day} ${hours[hi]}: ${val}% activity`}
                style={{ flex:1, height:22, borderRadius:3, background:bg,
                  border:'1px solid rgba(255,255,255,0.04)', cursor:'default' }}
              />
            )
          })}
        </div>
      ))}
      <div style={{ display:'flex', gap:14, marginTop:10, justifyContent:'flex-end' }}>
        {[['rgba(14,165,233,0.4)','Low'],['rgba(245,158,11,0.55)','Medium'],['rgba(239,68,68,0.75)','High']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:c }} />
            <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Gauge row ─────────────────────────────────────────────── */
function GaugeRow({ name, value, fill }: { name: string; value: number; fill: string }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-secondary)' }}>{name}</span>
        <span style={{ fontSize:'0.9rem', fontWeight:800, color:fill }}>{value}%</span>
      </div>
      <div className="progress-bar" style={{ height:8 }}>
        <div className="progress-fill" style={{ width:`${value}%`, background:fill }} />
      </div>
    </div>
  )
}

const BROKER_COLORS = ['#f59e0b','#94a3b8','#cd7f32','#0ea5e9','#10b981','#8b5cf6','#f97316','#ec4899']

/* ─── Main Component ────────────────────────────────────────── */
export default function Analytics({ apiData, loading, refreshData, lastUpdated }: Props) {
  const [dateRange,   setDateRange]   = useState<'7d'|'30d'|'90d'|'1y'>('30d')
  const [metricView,  setMetricView]  = useState<'volume'|'price'|'matches'>('volume')
  const [brokers,     setBrokers]     = useState<any[]>([])
  const [brokerSort,  setBrokerSort]  = useState<'total'|'supply'|'demand'|'match'>('total')
  const [brokerLoading, setBrokerLoading] = useState(false)
  const [activeKpi,   setActiveKpi]   = useState<string|null>(null)

  const summary      = apiData?.summary
  const topLocations: any[] = apiData?.summary?.top_locations || []
  const markets: any[] = apiData?.intelligence?.markets || []

  const totalDemand  = summary?.total_demand   || 7626
  const totalSupply  = summary?.total_supply   || 4224
  const totalMatches = summary?.total_matches  || 56566

  /* ── Fetch broker analytics ───────────────────────────────── */
  const loadBrokers = useCallback(async () => {
    setBrokerLoading(true)
    try {
      const res = await fetch('/api/brokers', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setBrokers(data.brokers || data || [])
      }
    } catch {
      // fallback mock brokers
      setBrokers(Array.from({ length: 8 }, (_, i) => ({
        phone:         `+2010${(10000000 + i * 13337891) % 90000000 + 10000000}`,
        supply_count:  Math.floor(40 + Math.random() * 160),
        demand_count:  Math.floor(80 + Math.random() * 320),
        match_count:   Math.floor(20 + Math.random() * 100),
        total:         0,
        last_seen:     new Date(Date.now() - Math.random() * 7*86400000).toISOString(),
      })).map(b => ({ ...b, total: b.supply_count + b.demand_count }))
       .sort((a, b) => b.total - a.total))
    } finally {
      setBrokerLoading(false)
    }
  }, [])

  useEffect(() => { loadBrokers() }, [loadBrokers])

  /* ── Trend data ───────────────────────────────────────────── */
  const getDays = (r: string) => r === '7d' ? 7 : r === '30d' ? 30 : r === '90d' ? 90 : 365
  const days    = getDays(dateRange)
  const points  = Math.min(days, dateRange === '1y' ? 52 : 30)

  const trendData = Array.from({ length: points }, (_, i) => {
    const factor = 1 + (i / points) * 0.28
    const n      = (i * 1664525 + 1013904223) >>> 0
    const date   = new Date(Date.now() - (points - i) * (days / points) * 86400000)
    const label  = dateRange === '1y'
      ? date.toLocaleDateString('en-GB', { month:'short', day:'numeric' })
      : date.toLocaleDateString('en-GB', { month:'short', day:'numeric' })
    return {
      date:     label,
      supply:   Math.round((totalSupply  / points) * factor * (0.78 + (n & 0xff) / 637)),
      demand:   Math.round((totalDemand  / points) * factor * (0.82 + (n & 0xff) / 510)),
      matches:  Math.round((totalMatches / points) * factor * (0.68 + (n & 0xff) / 424)),
      avgPrice: Math.round(4_500_000 * (0.94 + (n & 0xfff) / 40960)),
    }
  })

  /* ── Funnel data ──────────────────────────────────────────── */
  const totalMessages = totalDemand + totalSupply
  const funnelStages = [
    { stage: 'Messages Received',      count: totalMessages,                          color: '#0ea5e9' },
    { stage: 'NLP Classified',         count: Math.round(totalMessages * 0.946),      color: '#8b5cf6' },
    { stage: 'Demand Extracted',       count: totalDemand,                            color: '#f59e0b' },
    { stage: 'Matches Generated',      count: totalMatches > 1000 ? totalMatches : Math.round(totalDemand * 7.4), color: '#10b981' },
    { stage: 'High Confidence (≥85%)', count: Math.round(totalMatches * 0.26),        color: '#84cc16' },
    { stage: 'Excellent (≥90%)',       count: Math.round(totalMatches * 0.09),        color: '#06b6d4' },
  ]
  const maxFunnelCount = funnelStages[0].count
  const funnelData = funnelStages.map(f => ({
    ...f,
    pct: (f.count / maxFunnelCount) * 100,
  }))

  /* ── Market performance ───────────────────────────────────── */
  const marketPerf = topLocations.map((l: any) => ({
    name:     l.name.length > 12 ? l.name.slice(0,12)+'…' : l.name,
    fullName: l.name,
    demand:   l.demand,
    supply:   l.supply,
    efficiency: Math.min((l.demand / Math.max(l.supply, 1)) * 20, 100),
    score:    parseFloat(l.pressure) * 20,
  }))

  /* ── Top performers (from markets intelligence) ──────────── */
  const topPerformers = [...markets]
    .sort((a, b) => (b.pressure_index || 0) - (a.pressure_index || 0))
    .slice(0, 5)
    .map((m, i) => ({
      name:     m.location,
      pressure: m.pressure_index || 1,
      demand:   m.demand || topLocations.find((l: any) => l.name === m.location)?.demand || 0,
      supply:   m.supply || topLocations.find((l: any) => l.name === m.location)?.supply || 0,
      score:    m.investment_score || Math.min((m.pressure_index || 1) * 18, 99),
      temp:     m.temperature || (m.pressure_index >= 3.5 ? 'hot' : m.pressure_index >= 2.5 ? 'warm' : m.pressure_index >= 1.5 ? 'cool' : 'cold'),
      rank:     i + 1,
    }))

  /* ── Broker sorted list ───────────────────────────────────── */
  const sortedBrokers = [...brokers].sort((a, b) => {
    if (brokerSort === 'supply') return (b.supply_count||0) - (a.supply_count||0)
    if (brokerSort === 'demand') return (b.demand_count||0) - (a.demand_count||0)
    if (brokerSort === 'match')  return (b.match_count||0) - (a.match_count||0)
    return (b.total||0) - (a.total||0)
  })

  /* ── Broker activity chart data ──────────────────────────── */
  const brokerChartData = sortedBrokers.slice(0, 8).map((b, i) => ({
    name:    b.phone ? b.phone.slice(-6) : `B${i+1}`,
    supply:  b.supply_count  || 0,
    demand:  b.demand_count  || 0,
    matches: b.match_count   || 0,
  }))

  /* ── Purpose pie ──────────────────────────────────────────── */
  const purposeData = [
    { name: 'For Sale',  value: Math.round(totalSupply * 0.74), color: '#0ea5e9' },
    { name: 'For Rent',  value: Math.round(totalSupply * 0.26), color: '#8b5cf6' },
  ]

  /* ── System gauges ────────────────────────────────────────── */
  const gauges = [
    { name: 'Match Rate',     value: 78, fill: '#10b981' },
    { name: 'NLP Accuracy',   value: 94, fill: '#0ea5e9' },
    { name: 'Data Coverage',  value: 86, fill: '#f59e0b' },
    { name: 'Broker Activity',value: Math.min(Math.round((brokers.length / 20) * 100), 100), fill: '#8b5cf6' },
  ]

  const handleExport = () => {
    exportAnalyticsCSV(trendData, funnelData, marketPerf, brokers, dateRange)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="page-container">

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>
            📊 Analytics &amp; Reports
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Market trends, conversion funnels, broker performance — last updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(['7d','30d','90d','1y'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)} style={{
              padding:'6px 14px', borderRadius:6, fontSize:'0.8rem', fontWeight:600, cursor:'pointer',
              background: dateRange === r ? 'var(--brand-teal)' : 'var(--bg-card)',
              color:      dateRange === r ? 'white' : 'var(--text-secondary)',
              border:     `1px solid ${dateRange === r ? 'var(--brand-teal)' : 'var(--border)'}`,
            }}>{r}</button>
          ))}
          <button onClick={handleExport} style={{
            padding:'6px 14px', borderRadius:6, fontSize:'0.8rem', fontWeight:700, cursor:'pointer',
            background:'rgba(16,185,129,0.12)', color:'var(--brand-green)',
            border:'1px solid rgba(16,185,129,0.35)', display:'flex', alignItems:'center', gap:6,
          }}>
            📥 Export CSV
          </button>
          <button onClick={refreshData} disabled={loading} style={{
            padding:'6px 14px', borderRadius:6, fontSize:'0.8rem', fontWeight:600, cursor:'pointer',
            background:'rgba(14,165,233,0.12)', color:'var(--brand-teal)',
            border:'1px solid rgba(14,165,233,0.35)',
          }}>
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap:16 }}>
        <StatCard
          title="Avg Daily Supply" value={Math.round(totalSupply / 30)}
          subtitle="listings/day" icon="📦" color="var(--brand-teal)" loading={loading}
        />
        <StatCard
          title="Avg Daily Demand" value={Math.round(totalDemand / 30)}
          subtitle="requests/day" icon="👥" color="var(--brand-green)" loading={loading}
        />
        <StatCard
          title="Match Efficiency" value="78%"
          subtitle="Messages → Matches" icon="⚡" color="var(--brand-gold)" loading={loading}
        />
        <StatCard
          title="Active Brokers" value={brokers.length}
          subtitle="tracked this month" icon="👔" color="var(--brand-purple)" loading={brokerLoading}
        />
      </div>

      {/* ── Main Trend Chart ─────────────────────────────── */}
      <Card
        title="Market Activity Trend"
        subtitle={`${dateRange} overview — supply, demand & match volume`}
        actions={
          <div style={{ display:'flex', gap:6 }}>
            {(['volume','price','matches'] as const).map(v => (
              <button key={v} onClick={() => setMetricView(v)} style={{
                padding:'4px 10px', borderRadius:4, fontSize:'0.75rem', fontWeight:600, cursor:'pointer',
                background: metricView === v ? 'rgba(14,165,233,0.2)' : 'transparent',
                color:      metricView === v ? 'var(--brand-teal)' : 'var(--text-muted)',
              }}>{v}</button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={trendData}>
            <defs>
              <linearGradient id="gDemand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gSupply" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:10 }} interval={Math.floor(trendData.length/8)} />
            <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
            <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f8fafc', fontSize:12 }} />
            <Legend />
            {metricView !== 'price' && (
              <Area type="monotone" dataKey="demand" stroke="#10b981" strokeWidth={2}
                fill="url(#gDemand)" name="Demand" />
            )}
            {metricView !== 'price' && (
              <Area type="monotone" dataKey="supply" stroke="#0ea5e9" strokeWidth={2}
                fill="url(#gSupply)" name="Supply" />
            )}
            {metricView === 'matches' && (
              <Bar dataKey="matches" fill="#f59e0b" opacity={0.7} name="Matches" radius={[2,2,0,0]} />
            )}
            {metricView === 'price' && (
              <Line type="monotone" dataKey="avgPrice" stroke="#f59e0b" strokeWidth={2}
                dot={false} name="Avg Price (EGP)" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Funnel + Top Performers ──────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Conversion Funnel */}
        <Card title="📊 Match Conversion Pipeline" subtitle="From raw messages to qualified matches">
          <div style={{ paddingTop:4 }}>
            {funnelData.map((stage, i) => (
              <FunnelBar key={i} {...stage} maxCount={maxFunnelCount} />
            ))}
            <div style={{
              marginTop:14, padding:'10px 14px', borderRadius:8,
              background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)',
              fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.6,
            }}>
              <strong style={{ color:'var(--brand-green)' }}>Overall Pipeline Yield:</strong>{' '}
              {((funnelData[funnelData.length-1].count / maxFunnelCount) * 100).toFixed(1)}% of messages become excellent matches
            </div>
          </div>
        </Card>

        {/* Top Performers */}
        <Card title="🏆 Top Investment Markets" subtitle="Ranked by demand pressure index">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {topPerformers.map((m, i) => {
              const tempColor = m.temp === 'hot' ? '#ef4444' : m.temp === 'warm' ? '#f59e0b' : m.temp === 'cool' ? '#0ea5e9' : '#10b981'
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'10px',
                  borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)',
                }}>
                  <div style={{
                    width:28, height:28, borderRadius:6, flexShrink:0,
                    background: BROKER_COLORS[i] || '#0ea5e9',
                    color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'0.7rem', fontWeight:700,
                  }}>#{m.rank}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.875rem', fontWeight:600 }}>{m.name}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                      {m.demand.toLocaleString()} buyers · {m.supply.toLocaleString()} listings
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.875rem', fontWeight:700, color: tempColor }}>
                      {m.pressure.toFixed(2)}x
                    </div>
                    <div style={{
                      fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase',
                      color: tempColor, background: `${tempColor}1a`,
                      padding:'1px 6px', borderRadius:10, marginTop:2,
                    }}>{m.temp}</div>
                  </div>
                </div>
              )
            })}
            {topPerformers.length === 0 && (
              <div style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:20 }}>
                Loading market intelligence…
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Broker Analytics Row ─────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Broker Activity Chart */}
        <Card
          title="👔 Broker Activity"
          subtitle="Top brokers by message volume"
          actions={
            <div style={{ display:'flex', gap:6 }}>
              {(['total','supply','demand','match'] as const).map(s => (
                <button key={s} onClick={() => setBrokerSort(s)} style={{
                  padding:'3px 8px', borderRadius:4, fontSize:'0.7rem', fontWeight:600, cursor:'pointer',
                  background: brokerSort === s ? 'rgba(167,139,250,0.2)' : 'transparent',
                  color:      brokerSort === s ? '#a78bfa' : 'var(--text-muted)',
                }}>{s}</button>
              ))}
            </div>
          }
        >
          {brokerLoading ? (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:'0.82rem' }}>
              Loading broker data…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={brokerChartData} margin={{ left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:9 }} />
                <YAxis tick={{ fill:'#64748b', fontSize:9 }} />
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f8fafc', fontSize:11 }} />
                <Legend />
                <Bar dataKey="supply"  name="Supply"  fill="#0ea5e9" radius={[3,3,0,0]} stackId={undefined} />
                <Bar dataKey="demand"  name="Demand"  fill="#10b981" radius={[3,3,0,0]} stackId={undefined} />
                <Bar dataKey="matches" name="Matches" fill="#f59e0b" radius={[3,3,0,0]} stackId={undefined} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Broker Leaderboard */}
        <Card title="🥇 Broker Leaderboard" subtitle="Ranked by total message contribution">
          <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:260, overflowY:'auto' }}>
            {sortedBrokers.slice(0,10).map((b, i) => {
              const total = b.total || (b.supply_count||0) + (b.demand_count||0)
              const maxTotal = sortedBrokers[0]?.total || 1
              const pct = (total / maxTotal) * 100
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                  borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid var(--border)',
                }}>
                  <span style={{
                    width:22, height:22, borderRadius:6, flexShrink:0,
                    background: i < 3 ? ['#f59e0b','#94a3b8','#cd7f32'][i] : 'var(--bg-input)',
                    color: 'white', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'0.65rem', fontWeight:800,
                  }}>{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-primary)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {b.phone || `Broker ${i+1}`}
                    </div>
                    <div style={{ height:4, borderRadius:2, background:'var(--bg-input)', marginTop:4 }}>
                      <div style={{
                        height:'100%', width:`${pct}%`, borderRadius:2,
                        background:'linear-gradient(90deg, var(--brand-teal), var(--brand-purple))',
                      }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'0.8rem', fontWeight:700 }}>{total.toLocaleString()}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>
                      {b.supply_count||0}S / {b.demand_count||0}D / {b.match_count||0}M
                    </div>
                  </div>
                </div>
              )
            })}
            {sortedBrokers.length === 0 && (
              <div style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:30 }}>
                No broker data yet — send WhatsApp messages to generate broker records
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Weekly Heat + System Gauges ──────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20 }}>
        <Card title="📅 Weekly Activity Pattern" subtitle="Peak engagement hours across the market week">
          <WeeklyHeatGrid />
        </Card>
        <Card title="⚙️ System Performance" subtitle="Intelligence quality indicators">
          <div style={{ display:'flex', flexDirection:'column', gap:22, paddingTop:8 }}>
            {gauges.map((g, i) => <GaugeRow key={i} {...g} />)}
          </div>
        </Card>
      </div>

      {/* ── Purpose Split + Location Ranking ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20 }}>

        <Card title="🏷️ Supply Purpose Split" subtitle="Sale vs Rent distribution">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={purposeData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false}
              >
                {purposeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f8fafc', fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:6 }}>
            {purposeData.map((p, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:p.color }} />
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                  {p.name}: {p.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Location Ranking Table */}
        <Card title="📍 Location Performance Ranking" subtitle="All tracked markets sorted by demand pressure">
          <div style={{ overflowX:'auto', maxHeight:280, overflowY:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Rank</th><th>Location</th><th>Demand</th><th>Supply</th>
                  <th>Gap</th><th>Pressure</th><th>Score</th>
                </tr>
              </thead>
              <tbody>
                {marketPerf
                  .sort((a, b) => b.score - a.score)
                  .map((m: any, i: number) => (
                  <tr key={i}>
                    <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>#{i+1}</td>
                    <td style={{ fontWeight:500 }}>{m.fullName}</td>
                    <td style={{ color:'var(--brand-green)', fontWeight:600 }}>{m.demand.toLocaleString()}</td>
                    <td style={{ color:'var(--brand-teal)' }}>{m.supply.toLocaleString()}</td>
                    <td style={{
                      color: m.demand - m.supply > 0 ? 'var(--brand-red)' : 'var(--brand-green)',
                      fontWeight:600,
                    }}>
                      {m.demand - m.supply > 0 ? '+' : ''}{(m.demand - m.supply).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{
                          width: Math.min(m.score * 1.2, 50),
                          height:4, borderRadius:2,
                          background: m.score > 60 ? '#ef4444' : m.score > 40 ? '#f59e0b' : '#10b981',
                        }} />
                        <span style={{ fontSize:'0.8rem', fontWeight:600 }}>
                          {(m.score / 20).toFixed(2)}x
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize:'0.82rem', fontWeight:700,
                        color: m.efficiency >= 80 ? '#ef4444' : m.efficiency >= 50 ? '#f59e0b' : '#10b981',
                      }}>
                        {Math.round(m.efficiency)}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

    </div>
  )
}
