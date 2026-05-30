import { useState, useEffect, useRef } from 'react'
<<<<<<< HEAD
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
=======
>>>>>>> origin/main
import Card from '../components/Card'
import Badge, { getPressureVariant, getTemperatureLabel } from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

<<<<<<< HEAD
/* ─── Egyptian location coordinates ────────────────────────── */
const locationCoords: Record<string, { lat: number; lng: number; area: string }> = {
  'Madinaty':         { lat: 30.115, lng: 31.637, area: 'New Cairo' },
  'Fifth Settlement': { lat: 30.021, lng: 31.461, area: 'New Cairo' },
  'New Capital':      { lat: 30.052, lng: 31.739, area: 'East Cairo' },
  'Sheikh Zayed':     { lat: 30.020, lng: 30.956, area: 'West Cairo' },
  'Rehab City':       { lat: 30.068, lng: 31.533, area: 'East Cairo' },
  'Nasr City':        { lat: 30.063, lng: 31.328, area: 'East Cairo' },
  'Heliopolis':       { lat: 30.091, lng: 31.321, area: 'East Cairo' },
  'Zamalek':          { lat: 30.062, lng: 31.224, area: 'Central Cairo' },
  'Maadi':            { lat: 29.960, lng: 31.255, area: 'South Cairo' },
  'North Coast':      { lat: 30.932, lng: 29.035, area: 'Alexandria' },
  'Mivida':           { lat: 30.032, lng: 31.501, area: 'New Cairo' },
  'Hyde Park':        { lat: 30.024, lng: 31.467, area: 'New Cairo' },
  'Palm Hills':       { lat: 30.003, lng: 30.931, area: 'West Cairo' },
  'New Zayed':        { lat: 30.028, lng: 30.921, area: 'West Cairo' },
  'Shorouk':          { lat: 30.126, lng: 31.590, area: 'East Cairo' },
  'Ain Sokhna':       { lat: 29.593, lng: 32.346, area: 'Suez' },
  'October City':     { lat: 29.982, lng: 30.916, area: 'West Cairo' },
}

/* ─── Temperature helpers ───────────────────────────────────── */
function tempFromPressure(p: number) {
  if (p >= 3.5) return 'hot'
  if (p >= 2.5) return 'warm'
  if (p >= 1.5) return 'cool'
  return 'cold'
}
function tempColor(temp: string, alpha = 1) {
  if (temp === 'hot')  return `rgba(239,68,68,${alpha})`
  if (temp === 'warm') return `rgba(245,158,11,${alpha})`
  if (temp === 'cool') return `rgba(14,165,233,${alpha})`
  return `rgba(16,185,129,${alpha})`
}
function tempLabel(temp: string) {
  if (temp === 'hot')  return '🔥 HOT'
  if (temp === 'warm') return '♨️ WARM'
  if (temp === 'cool') return '🌤 COOL'
  return '❄️ COLD'
}

/* ─── Draw canvas ──────────────────────────────────────────── */
function drawMap(
  canvas: HTMLCanvasElement,
  locations: any[],
  mapView: string,
  filterType: string,
  selectedLocation: string | null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height

  ctx.clearRect(0, 0, W, H)

  // Dark map background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.7
  for (let x = 0; x < W; x += 45) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 45) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Nile suggestion (west-central line)
  ctx.strokeStyle = 'rgba(14,165,233,0.18)'; ctx.lineWidth = 3; ctx.setLineDash([4,6])
  ctx.beginPath(); ctx.moveTo(W*0.36, 0); ctx.lineTo(W*0.28, H); ctx.stroke()
  ctx.setLineDash([])

  const minLat = 29.5, maxLat = 31.15
  const minLng = 29.0, maxLng = 32.6
  const latToY = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H
  const lngToX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W

  // Draw heat blobs first
  if (mapView === 'heatmap' || mapView === 'split') {
    locations.forEach((loc: any) => {
      const x = lngToX(loc.coords.lng)
      const y = latToY(loc.coords.lat)
      const temp = loc.market?.temperature || tempFromPressure(loc.pressure)
      const r = Math.min(loc.pressure * 22 + 18, 90)
      const c = temp === 'hot'  ? '239,68,68'
              : temp === 'warm' ? '245,158,11'
              : temp === 'cool' ? '14,165,233' : '16,185,129'
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0,   `rgba(${c},0.55)`)
      grad.addColorStop(0.4, `rgba(${c},0.28)`)
      grad.addColorStop(1,   `rgba(${c},0)`)
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2)
      ctx.fillStyle = grad; ctx.fill()
    })
  }

  // Draw markers
  if (mapView === 'markers' || mapView === 'split') {
    locations.forEach((loc: any) => {
      const x  = lngToX(loc.coords.lng)
      const y  = latToY(loc.coords.lat)
      const temp = loc.market?.temperature || tempFromPressure(loc.pressure)
      const col = temp === 'hot'  ? '#ef4444'
                : temp === 'warm' ? '#f59e0b'
                : temp === 'cool' ? '#0ea5e9' : '#10b981'
      const isSelected = selectedLocation === loc.name
      const ringR  = Math.max(6, Math.log(Math.max(loc.pressure * 3, 1)) * 5 + 5)

      // Supply dot (left)
      if (filterType !== 'demand') {
        const r = Math.max(4, Math.log(Math.max(loc.supply, 1)) * 2.2)
        ctx.beginPath(); ctx.arc(x - ringR - 2, y, r, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(14,165,233,0.85)'; ctx.fill()
        ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 1.2; ctx.stroke()
      }

      // Demand dot (right)
      if (filterType !== 'supply') {
        const r = Math.max(4, Math.log(Math.max(loc.demand, 1)) * 2.2)
        ctx.beginPath(); ctx.arc(x + ringR + 2, y, r, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(16,185,129,0.85)'; ctx.fill()
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.2; ctx.stroke()
      }

      // Center ring (pressure-sized, temperature-colored)
      ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI*2)
      ctx.fillStyle = `${col}30`; ctx.fill()
      ctx.strokeStyle = col; ctx.lineWidth = isSelected ? 3 : 1.8; ctx.stroke()

      // Selection glow
      if (isSelected) {
        ctx.beginPath(); ctx.arc(x, y, ringR + 6, 0, Math.PI*2)
        ctx.strokeStyle = `${col}88`; ctx.lineWidth = 2; ctx.stroke()
      }

      // Label
      ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1'
      ctx.font = `${isSelected ? 'bold ' : ''}10px sans-serif`
      ctx.textAlign = 'center'
      const label = loc.name.length > 11 ? loc.name.slice(0,10)+'…' : loc.name
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4
      ctx.fillText(label, x, y - ringR - 6)
      ctx.shadowBlur = 0
    })
  }

  // Legend box
  ctx.fillStyle = 'rgba(15,23,42,0.88)'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 1
  ctx.beginPath()
  const lx = W - 145, ly = 12, lw = 134, lh = 110
  ctx.roundRect(lx, ly, lw, lh, 8)
  ctx.fill(); ctx.stroke()

  ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('Legend', lx + 10, ly + 22)

  const legItems = [
    { c: 'rgba(239,68,68,0.75)',   l: '🔥 Hot Zone (≥3.5x)' },
    { c: 'rgba(245,158,11,0.75)',  l: '♨️ Warm (2.5–3.5x)' },
    { c: 'rgba(14,165,233,0.75)',  l: '🌤 Cool (1.5–2.5x)' },
    { c: 'rgba(16,185,129,0.75)',  l: '❄️ Cold (<1.5x)' },
  ]
  legItems.forEach((item, i) => {
    ctx.fillStyle = item.c
    ctx.beginPath(); ctx.arc(lx + 18, ly + 40 + i*17, 6, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#94a3b8'; ctx.font = '9.5px sans-serif'
    ctx.fillText(item.l, lx + 30, ly + 44 + i*17)
  })
}

/* ─── Location Detail Panel ─────────────────────────────────── */
function LocationDetailPanel({ loc, onClose }: { loc: any; onClose: () => void }) {
  const temp = loc.market?.temperature || tempFromPressure(loc.pressure)
  const col  = temp === 'hot' ? '#ef4444' : temp === 'warm' ? '#f59e0b' : temp === 'cool' ? '#0ea5e9' : '#10b981'
  const investScore = loc.market?.investment_score || Math.min(Math.round(loc.pressure * 20), 99)

  const recentSupply: any[] = loc.market?.recent_supply || []
  const recentDemand: any[] = loc.market?.recent_demand || []

  const radarData = [
    { metric: 'Demand',    value: Math.min(Math.round((loc.demand / 2000) * 100), 100) },
    { metric: 'Supply',    value: Math.min(Math.round((loc.supply / 600) * 100), 100) },
    { metric: 'Pressure',  value: Math.min(Math.round(loc.pressure * 22), 100) },
    { metric: 'Investment',value: investScore },
    { metric: 'Activity',  value: Math.min(Math.round(((loc.demand + loc.supply) / 2500) * 100), 100) },
  ]

  return (
    <div style={{
      position: 'fixed', right: 24, top: 80, width: 340,
      background: 'var(--bg-card)', border: `1px solid ${col}44`,
      borderRadius: 12, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${col}22`,
      zIndex: 100, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${col}22`, background:`${col}0d`,
        display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'1.05rem', color:'var(--text-primary)', marginBottom:2 }}>
            {loc.name}
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
            📍 {loc.coords?.area || 'Cairo'} &nbsp;·&nbsp; {tempLabel(temp)}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <button onClick={onClose} style={{
            width:24, height:24, borderRadius:6, background:'rgba(0,0,0,0.3)',
            border:'1px solid var(--border)', color:'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer',
          }}>✕</button>
          <div style={{ fontSize:'1.1rem', fontWeight:800, color: col }}>{loc.pressure.toFixed(2)}x</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--border)' }}>
        {[
          { label:'Supply', value: loc.supply.toLocaleString(), color:'#0ea5e9' },
          { label:'Demand', value: loc.demand.toLocaleString(), color:'#10b981' },
          { label:'Invest Score', value: `${investScore}/100`, color: col },
        ].map((s, i) => (
          <div key={i} style={{ padding:'10px 12px', background:'var(--bg-card)', textAlign:'center' }}>
            <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
            <div style={{ fontSize:'0.95rem', fontWeight:800, color: s.color, marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Radar chart */}
      <div style={{ padding:'10px 16px' }}>
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
          Market Profile
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="metric" tick={{ fill:'#64748b', fontSize:9 }} />
            <PolarRadiusAxis angle={30} domain={[0,100]} tick={false} axisLine={false} />
            <Radar name="Profile" dataKey="value" stroke={col} fill={col} fillOpacity={0.18} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent supply */}
      {recentSupply.length > 0 && (
        <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'0.72rem', color:'#0ea5e9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
            📦 Recent Supply
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {recentSupply.slice(0,3).map((item: any, i: number) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                <span>{item.bedrooms}BR {item.type} {item.finishing ? `· ${item.finishing}` : ''}</span>
                <span style={{ fontWeight:600, color:'#0ea5e9' }}>
                  {(item.price/1000000).toFixed(1)}M
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent demand */}
      {recentDemand.length > 0 && (
        <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'0.72rem', color:'#10b981', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
            👥 Recent Demand
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {recentDemand.slice(0,3).map((item: any, i: number) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                <span>{item.bedrooms}BR {item.type}</span>
                <span style={{ fontWeight:600, color:'#10b981' }}>
                  {(item.budget_min/1000000).toFixed(1)}–{(item.budget_max/1000000).toFixed(1)}M
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment signal */}
      <div style={{ padding:'10px 16px 14px', borderTop:'1px solid var(--border)' }}>
        <div style={{
          padding:'8px 12px', borderRadius:8,
          background: `${col}0d`, border:`1px solid ${col}33`,
          fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:1.5,
        }}>
          <strong style={{ color: col }}>
            {temp === 'hot' ? '🔥 Strong Seller Market' : temp === 'warm' ? '♨️ Active Market' : temp === 'cool' ? '🌤 Balanced Market' : '❄️ Buyer Market'}
          </strong>
          <br />
          {loc.demand.toLocaleString()} buyers chasing {loc.supply.toLocaleString()} listings.
          {loc.pressure >= 2.5 ? ' High investment potential — limited supply.' : ' Equilibrium emerging.'}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────── */
export default function HeatMap({ apiData, loading }: Props) {
  const [mapView,           setMapView]           = useState<'heatmap'|'markers'|'split'>('split')
  const [filterType,        setFilterType]        = useState<'all'|'supply'|'demand'>('all')
  const [selectedLocation,  setSelectedLocation]  = useState<string|null>(null)
  const [filterTemp,        setFilterTemp]        = useState<string>('all')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const topLocations: any[] = apiData?.summary?.top_locations || []
  const markets: any[]      = apiData?.intelligence?.markets  || []

  // Merge location data with market intelligence
  const enriched = topLocations.map((l: any) => {
    const market = markets.find((m: any) => m.location === l.name) || {}
    return {
      ...l,
      coords:   locationCoords[l.name] || { lat: 30.0 + Math.random()*0.4, lng: 31.2 + Math.random()*0.4, area: 'Cairo' },
      pressure: parseFloat(l.pressure) || 1,
      market,
    }
  })

  // Apply temperature filter
  const filtered = filterTemp === 'all'
    ? enriched
    : enriched.filter((l: any) => {
        const t = l.market?.temperature || tempFromPressure(l.pressure)
        return t === filterTemp
      })

  const selectedLoc = selectedLocation
    ? enriched.find((l: any) => l.name === selectedLocation)
    : null

  // Redraw canvas whenever data/view/filter changes
  useEffect(() => {
    if (!canvasRef.current || filtered.length === 0) return
    drawMap(canvasRef.current, filtered, mapView, filterType, selectedLocation)
  }, [filtered, mapView, filterType, selectedLocation])

  const hotZones  = enriched.filter((l: any) => (l.market?.temperature || tempFromPressure(l.pressure)) === 'hot')
  const warmZones = enriched.filter((l: any) => (l.market?.temperature || tempFromPressure(l.pressure)) === 'warm')
  const peakPressure = enriched.length > 0 ? Math.max(...enriched.map((l: any) => l.pressure)) : 0
  const avgPressure  = enriched.length > 0
    ? enriched.reduce((s: number, l: any) => s + l.pressure, 0) / enriched.length
    : 0

  // Bar chart: top 8 by pressure
  const pressureChartData = [...enriched]
    .sort((a: any, b: any) => b.pressure - a.pressure)
    .slice(0, 8)
    .map((l: any) => {
      const temp = l.market?.temperature || tempFromPressure(l.pressure)
      return {
        name:  l.name.length > 10 ? l.name.slice(0,10)+'…' : l.name,
        value: l.pressure,
        fill:  temp === 'hot' ? '#ef4444' : temp === 'warm' ? '#f59e0b' : temp === 'cool' ? '#0ea5e9' : '#10b981',
      }
    })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="page-container">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-primary)', marginBottom:4, letterSpacing:'-0.02em' }}>
          🗺️ Market Heat Map
        </h1>
        <p style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>
          Geographic demand pressure across Egyptian real estate markets — color-coded by temperature
        </p>
      </div>

      {/* ── Temperature filter pills ─────────────────────────── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { v:'all',  label:'🌍 All Markets',  bg:'rgba(148,163,184,0.15)', col:'var(--text-secondary)' },
          { v:'hot',  label:'🔥 Hot Zones',    bg:'rgba(239,68,68,0.12)',   col:'#ef4444' },
          { v:'warm', label:'♨️ Warm Markets', bg:'rgba(245,158,11,0.12)',  col:'#f59e0b' },
          { v:'cool', label:'🌤 Cool Markets', bg:'rgba(14,165,233,0.12)',  col:'#0ea5e9' },
          { v:'cold', label:'❄️ Cold Markets', bg:'rgba(16,185,129,0.12)', col:'#10b981' },
        ].map(({ v, label, bg, col }) => (
          <button key={v} onClick={() => setFilterTemp(v)} style={{
            padding:'6px 14px', borderRadius:20, fontSize:'0.78rem', fontWeight:600, cursor:'pointer',
            background: filterTemp === v ? bg : 'transparent',
            color:       filterTemp === v ? col : 'var(--text-muted)',
            border:      filterTemp === v ? `1px solid ${col}55` : '1px solid var(--border)',
            transition:  'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap:16 }}>
        <StatCard title="🔥 Hot Zones"      value={hotZones.length}          subtitle="Pressure ≥ 3.5x"    icon="🔥" color="var(--brand-red)"    loading={loading} />
        <StatCard title="♨️ Warm Zones"    value={warmZones.length}         subtitle="Pressure 2.5–3.5x"  icon="♨️" color="var(--brand-gold)"   loading={loading} />
        <StatCard title="Peak Pressure"     value={`${peakPressure.toFixed(2)}x`}  subtitle="Highest D/S ratio"  icon="🌡️" color="var(--brand-teal)"  loading={loading} />
        <StatCard title="Avg Market Pressure" value={`${avgPressure.toFixed(2)}x`} subtitle="Market average"    icon="⚖️" color="var(--brand-purple)" loading={loading} />
      </div>

      {/* ── Map + Sidebar ────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:24 }}>

        {/* Canvas Map */}
        <Card
          title="Geographic Market Intelligence"
          subtitle="Click a market to see full detail — size reflects pressure"
          actions={
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                { v:'markers', label:'📍 Pins' },
                { v:'heatmap', label:'🌡️ Heat' },
                { v:'split',   label:'🔀 Both' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setMapView(v as any)} style={{
                  padding:'5px 12px', borderRadius:6, fontSize:'0.75rem', fontWeight:600, cursor:'pointer',
                  background: mapView === v ? 'var(--brand-teal)' : 'var(--bg-input)',
                  color:      mapView === v ? 'white' : 'var(--text-secondary)',
                }}>{label}</button>
              ))}
              <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                style={{ padding:'5px 10px', fontSize:'0.75rem', width:'auto' }}>
=======
// Egyptian locations with lat/lng
const locationCoords: Record<string, { lat: number; lng: number; area: string }> = {
  'Madinaty': { lat: 30.115, lng: 31.637, area: 'New Cairo' },
  'Fifth Settlement': { lat: 30.021, lng: 31.461, area: 'New Cairo' },
  'New Capital': { lat: 30.052, lng: 31.739, area: 'East Cairo' },
  'Sheikh Zayed': { lat: 30.020, lng: 30.956, area: 'West Cairo' },
  'Rehab City': { lat: 30.068, lng: 31.533, area: 'East Cairo' },
  'Nasr City': { lat: 30.063, lng: 31.328, area: 'East Cairo' },
  'Heliopolis': { lat: 30.091, lng: 31.321, area: 'East Cairo' },
  'Zamalek': { lat: 30.062, lng: 31.224, area: 'Central Cairo' },
  'Maadi': { lat: 29.960, lng: 31.255, area: 'South Cairo' },
  'North Coast': { lat: 30.932, lng: 29.035, area: 'Alexandria' },
  'Mivida': { lat: 30.032, lng: 31.501, area: 'New Cairo' },
  'Hyde Park': { lat: 30.024, lng: 31.467, area: 'New Cairo' },
  'Palm Hills': { lat: 30.003, lng: 30.931, area: 'West Cairo' },
  'New Zayed': { lat: 30.028, lng: 30.921, area: 'West Cairo' },
  'Shorouk': { lat: 30.126, lng: 31.590, area: 'East Cairo' },
  'Ain Sokhna': { lat: 29.593, lng: 32.346, area: 'Suez' },
  'October City': { lat: 29.982, lng: 30.916, area: 'West Cairo' },
}

export default function HeatMap({ apiData, loading }: Props) {
  const [mapView, setMapView] = useState<'heatmap' | 'markers' | 'split'>('markers')
  const [filterType, setFilterType] = useState<'all' | 'supply' | 'demand'>('all')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const topLocations = apiData?.summary?.top_locations || []
  const markets = apiData?.intelligence?.markets || []

  // Enrich with coords
  const enrichedLocations = topLocations.map((l: any) => ({
    ...l,
    coords: locationCoords[l.name] || { lat: 30.0 + Math.random() * 0.5, lng: 31.2 + Math.random() * 0.5, area: 'Cairo' },
    pressure: parseFloat(l.pressure) || 1,
    market: markets.find((m: any) => m.location === l.name) || {}
  }))

  // Draw heatmap on canvas
  useEffect(() => {
    if (!canvasRef.current || enrichedLocations.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Background map approximation
    ctx.fillStyle = '#1a2535'
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines
    ctx.strokeStyle = '#2a3548'
    ctx.lineWidth = 0.5
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }

    // Lat/lng bounds for Egypt region
    const minLat = 29.5, maxLat = 31.2
    const minLng = 29.0, maxLng = 32.0

    const latToY = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height
    const lngToX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * width

    enrichedLocations.forEach((loc: any) => {
      const x = lngToX(loc.coords.lng)
      const y = latToY(loc.coords.lat)
      const pressure = loc.pressure

      if (mapView === 'heatmap' || mapView === 'split') {
        // Draw heat blob
        const radius = Math.min(pressure * 25, 80)
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        const color = pressure >= 3.5 ? '239, 68, 68' :
                      pressure >= 2.5 ? '245, 158, 11' :
                      pressure >= 1.5 ? '14, 165, 233' : '16, 185, 129'
        gradient.addColorStop(0, `rgba(${color}, 0.6)`)
        gradient.addColorStop(0.5, `rgba(${color}, 0.2)`)
        gradient.addColorStop(1, `rgba(${color}, 0)`)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      if (mapView === 'markers' || mapView === 'split') {
        // Draw supply marker (blue)
        if (filterType !== 'demand') {
          const supplySize = Math.max(5, Math.log(loc.supply) * 2.5)
          ctx.beginPath()
          ctx.arc(x - 6, y, supplySize, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(14, 165, 233, 0.8)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(14, 165, 233, 1)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Draw demand marker (green)
        if (filterType !== 'supply') {
          const demandSize = Math.max(5, Math.log(loc.demand) * 2.5)
          ctx.beginPath()
          ctx.arc(x + 6, y, demandSize, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(16, 185, 129, 0.8)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(16, 185, 129, 1)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Label
        ctx.fillStyle = '#f8fafc'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(loc.name.length > 10 ? loc.name.substring(0, 10) + '...' : loc.name, x, y - 14)
      }
    })

    // Legend
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
    ctx.fillRect(width - 130, 10, 120, 90)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.strokeRect(width - 130, 10, 120, 90)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Legend', width - 120, 28)

    const legendItems = [
      { color: 'rgba(14, 165, 233, 0.8)', label: 'Supply' },
      { color: 'rgba(16, 185, 129, 0.8)', label: 'Demand' },
      { color: 'rgba(239, 68, 68, 0.6)', label: 'Hot Zone' },
      { color: 'rgba(245, 158, 11, 0.6)', label: 'Warm Zone' },
    ]
    legendItems.forEach((item, i) => {
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.arc(width - 116, 42 + i * 16, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(item.label, width - 108, 46 + i * 16)
    })

  }, [enrichedLocations, mapView, filterType])

  const hotZones = enrichedLocations.filter((l: any) => l.pressure >= 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          Market Heat Map
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Geographic distribution of supply and demand across Egyptian real estate markets
        </p>
      </div>

      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        <StatCard title="Hot Zones" value={hotZones.length} subtitle="Pressure ≥ 3x" icon="🔥" color="var(--brand-red)" loading={loading} />
        <StatCard title="Markets Tracked" value={enrichedLocations.length} subtitle="All regions" icon="📍" color="var(--brand-teal)" loading={loading} />
        <StatCard title="Peak Pressure" value={enrichedLocations.length > 0 ? `${Math.max(...enrichedLocations.map((l: any) => l.pressure)).toFixed(2)}x` : '—'} subtitle="Highest demand ratio" icon="🌡️" color="var(--brand-gold)" loading={loading} />
        <StatCard title="Avg Pressure" value={enrichedLocations.length > 0 ? `${(enrichedLocations.reduce((s: number, l: any) => s + l.pressure, 0) / enrichedLocations.length).toFixed(2)}x` : '—'} subtitle="Market average" icon="⚖️" color="var(--brand-purple)" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Map Canvas */}
        <Card
          title="Geographic Market Map"
          subtitle="Supply (blue) and Demand (green) distribution"
          actions={
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { v: 'markers', label: '📍 Pins' },
                { v: 'heatmap', label: '🌡️ Heat' },
                { v: 'split', label: '🔀 Both' },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setMapView(v as any)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: mapView === v ? 'var(--brand-teal)' : 'var(--bg-input)',
                    color: mapView === v ? 'white' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >{label}</button>
              ))}
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                style={{ padding: '5px 10px', fontSize: '0.75rem', width: 'auto' }}
              >
>>>>>>> origin/main
                <option value="all">All</option>
                <option value="supply">Supply Only</option>
                <option value="demand">Demand Only</option>
              </select>
            </div>
          }
        >
<<<<<<< HEAD
          <div style={{ position:'relative', borderRadius:8, overflow:'hidden' }}>
            <canvas
              ref={canvasRef}
              width={700}
              height={420}
              style={{ width:'100%', borderRadius:8, cursor:'crosshair', display:'block' }}
              onClick={(e) => {
                const canvas = canvasRef.current; if (!canvas) return
                const rect   = canvas.getBoundingClientRect()
=======
          <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={700}
              height={400}
              style={{ width: '100%', borderRadius: '8px', cursor: 'crosshair' }}
              onClick={(e) => {
                // Canvas click — find nearest location
                const canvas = canvasRef.current
                if (!canvas) return
                const rect   = canvasRef.current!.getBoundingClientRect()
>>>>>>> origin/main
                const scaleX = canvas.width  / rect.width
                const scaleY = canvas.height / rect.height
                const cx     = (e.clientX - rect.left) * scaleX
                const cy     = (e.clientY - rect.top)  * scaleY
<<<<<<< HEAD
                const minLat = 29.5, maxLat = 31.15, minLng = 29.0, maxLng = 32.6
                const latToY = (lat: number) => canvas.height - ((lat - minLat)/(maxLat - minLat))*canvas.height
                const lngToX = (lng: number) => ((lng - minLng)/(maxLng - minLng))*canvas.width
                let closest: string | null = null; let minDist = 999
                filtered.forEach((loc: any) => {
                  const px = lngToX(loc.coords.lng); const py = latToY(loc.coords.lat)
                  const d  = Math.hypot(cx - px, cy - py)
                  if (d < minDist) { minDist = d; closest = loc.name }
                })
                if (minDist < 45 && closest) {
                  setSelectedLocation(prev => prev === closest ? null : closest)
                }
              }}
            />
            {loading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                justifyContent:'center', background:'rgba(15,23,42,0.7)', borderRadius:8 }}>
                <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Loading map data…</div>
              </div>
            )}
          </div>
          <div style={{ marginTop:6, fontSize:'0.68rem', color:'var(--text-muted)', textAlign:'center' }}>
            🔵 Supply (left dot) · 🟢 Demand (right dot) · Ring color = market temperature · Click marker to inspect
          </div>
        </Card>

        {/* Hot Zones + Pressure Chart */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Pressure ranking */}
          <Card title="📊 Pressure Ranking" subtitle="Top markets by D/S ratio">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pressureChartData} layout="vertical" margin={{ left:4, right:20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" domain={[0,'dataMax']} tick={{ fill:'#64748b', fontSize:9 }}
                  tickFormatter={v => `${v.toFixed(1)}x`} />
                <YAxis type="category" dataKey="name" tick={{ fill:'#cbd5e1', fontSize:9 }} width={72} />
                <Tooltip
                  contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f8fafc', fontSize:11 }}
                  formatter={(v: any) => [`${v.toFixed(2)}x`, 'D/S Ratio']}
                />
                <Bar dataKey="value" radius={[0,3,3,0]}>
                  {pressureChartData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Hot Zones list */}
          <Card title="🔥 Hot Investment Zones" subtitle="Click to inspect on map">
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto' }}>
              {[...enriched]
                .sort((a: any, b: any) => b.pressure - a.pressure)
                .slice(0, 8)
                .map((loc: any, i: number) => {
                  const temp = loc.market?.temperature || tempFromPressure(loc.pressure)
                  const col  = temp === 'hot' ? '#ef4444' : temp === 'warm' ? '#f59e0b' : temp === 'cool' ? '#0ea5e9' : '#10b981'
                  const isSelected = selectedLocation === loc.name
                  return (
                    <div key={i} onClick={() => setSelectedLocation(prev => prev === loc.name ? null : loc.name)} style={{
                      padding:'9px 11px', borderRadius:8, cursor:'pointer', transition:'all 0.2s',
                      background: isSelected ? `${col}14` : 'rgba(0,0,0,0.2)',
                      border:     isSelected ? `1px solid ${col}44` : '1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                        <span style={{ fontWeight:600, fontSize:'0.875rem' }}>{loc.name}</span>
                        <span style={{
                          fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase',
                          color: col, background:`${col}18`, padding:'2px 7px', borderRadius:10,
                        }}>{tempLabel(temp)}</span>
                      </div>
                      <div style={{ display:'flex', gap:12, fontSize:'0.72rem', color:'var(--text-muted)' }}>
                        <span>📦 {loc.supply.toLocaleString()}</span>
                        <span>👥 {loc.demand.toLocaleString()}</span>
                        <span style={{ color: col, fontWeight:700 }}>{loc.pressure.toFixed(2)}x</span>
                      </div>
                    </div>
                  )
                })}
=======
                const minLat = 29.5, maxLat = 31.2, minLng = 29.0, maxLng = 32.0
                const latToY = (lat: number) => canvas.height - ((lat - minLat) / (maxLat - minLat)) * canvas.height
                const lngToX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * canvas.width
                let closest: string | null = null, minDist = 999
                enrichedLocations.forEach((loc: any) => {
                  const px = lngToX(loc.coords.lng)
                  const py = latToY(loc.coords.lat)
                  const d  = Math.hypot(cx - px, cy - py)
                  if (d < minDist) { minDist = d; closest = loc.name }
                })
                if (minDist < 40 && closest) setSelectedLocation((prev: string | null) => prev === closest ? null : closest)
              }}
            />
            {loading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15,23,42,0.7)',
                borderRadius: '8px'
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading map data...</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Note: Marker sizes represent relative supply/demand volume. Map shows approximate geographic positioning.
          </div>
        </Card>

        {/* Hot Zones List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card title="🔥 Hot Investment Zones" subtitle="Highest demand-supply pressure">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
              {enrichedLocations
                .sort((a: any, b: any) => b.pressure - a.pressure)
                .slice(0, 8)
                .map((loc: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => setSelectedLocation(loc.name === selectedLocation ? null : loc.name)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedLocation === loc.name ? 'rgba(14,165,233,0.1)' : 'rgba(0,0,0,0.2)',
                      border: selectedLocation === loc.name ? '1px solid rgba(14,165,233,0.3)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{loc.name}</div>
                      <Badge variant={getPressureVariant(loc.pressure)}>
                        {loc.pressure.toFixed(2)}x
                      </Badge>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>📦 {loc.supply.toLocaleString()}</span>
                      <span>👥 {loc.demand.toLocaleString()}</span>
                      <span style={{ color: loc.pressure >= 3 ? 'var(--brand-red)' : loc.pressure >= 2 ? 'var(--brand-gold)' : 'var(--brand-green)' }}>
                        {getTemperatureLabel(loc.pressure)}
                      </span>
                    </div>
                    {loc.coords.area && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        📍 {loc.coords.area}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Card>

          {/* Investment Insight */}
          <Card title="💡 Market Opportunity" subtitle="AI-powered investment insight">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {enrichedLocations
                .filter((l: any) => l.pressure >= 3)
                .slice(0, 3)
                .map((loc: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{loc.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--brand-red)', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                        HOT
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {loc.demand.toLocaleString()} active buyers with only {loc.supply.toLocaleString()} listings.
                      Strong seller's market — ideal for investment.
                    </div>
                    {loc.market?.price_trend && (
                      <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 600 }}>
                        📈 Price trend: {loc.market.price_trend}
                      </div>
                    )}
                  </div>
                ))}
>>>>>>> origin/main
            </div>
          </Card>
        </div>
      </div>

<<<<<<< HEAD
      {/* ── All Locations Table ───────────────────────────────── */}
      <Card title="📋 All Markets — Geographic Summary" subtitle="Complete overview sorted by pressure index">
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Location</th><th>Area</th><th>Supply</th><th>Demand</th>
                <th>Gap</th><th>Pressure</th><th>Temperature</th><th>Investment</th>
              </tr>
            </thead>
            <tbody>
              {[...enriched]
                .sort((a: any, b: any) => b.pressure - a.pressure)
                .map((loc: any, i: number) => {
                  const temp = loc.market?.temperature || tempFromPressure(loc.pressure)
                  const col  = temp === 'hot' ? '#ef4444' : temp === 'warm' ? '#f59e0b' : temp === 'cool' ? '#0ea5e9' : '#10b981'
                  const score = loc.market?.investment_score || Math.min(Math.round(loc.pressure * 20), 99)
                  return (
                    <tr key={i} style={{ cursor:'pointer', background: selectedLocation === loc.name ? `${col}0a` : undefined }}
                      onClick={() => setSelectedLocation(prev => prev === loc.name ? null : loc.name)}>
                      <td style={{ fontWeight:500, color: selectedLocation === loc.name ? col : undefined }}>
                        {loc.name}
                      </td>
                      <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{loc.coords.area}</td>
                      <td style={{ color:'#0ea5e9' }}>{loc.supply.toLocaleString()}</td>
                      <td style={{ color:'#10b981', fontWeight:600 }}>{loc.demand.toLocaleString()}</td>
                      <td style={{ color: loc.demand - loc.supply > 0 ? '#ef4444' : '#10b981', fontWeight:600 }}>
                        {loc.demand - loc.supply > 0 ? '+' : ''}{(loc.demand - loc.supply).toLocaleString()}
                      </td>
                      <td style={{ fontWeight:700, color: col }}>{loc.pressure.toFixed(2)}x</td>
                      <td>
                        <span style={{
                          fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase',
                          color: col, background:`${col}18`, padding:'2px 8px', borderRadius:10,
                        }}>{tempLabel(temp)}</span>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{
                            width: Math.round(score * 0.42), height:5, borderRadius:3,
                            background:`linear-gradient(90deg, ${col}88, ${col})`,
                          }} />
                          <span style={{ fontSize:'0.8rem', fontWeight:700, color: col }}>{score}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
=======
      {/* Location table */}
      <Card title="All Locations — Market Summary" subtitle="Complete geographic breakdown">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Area</th>
                <th>Supply</th>
                <th>Demand</th>
                <th>Gap</th>
                <th>Pressure</th>
                <th>Temperature</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {enrichedLocations
                .sort((a: any, b: any) => b.pressure - a.pressure)
                .map((loc: any, i: number) => (
                  <tr key={i}
                    style={{ cursor: 'pointer', background: selectedLocation === loc.name ? 'rgba(14,165,233,0.06)' : undefined }}
                    onClick={() => setSelectedLocation(loc.name === selectedLocation ? null : loc.name)}
                  >
                    <td style={{ fontWeight: 500 }}>{loc.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{loc.coords.area}</td>
                    <td style={{ color: 'var(--brand-teal)' }}>{loc.supply.toLocaleString()}</td>
                    <td style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{loc.demand.toLocaleString()}</td>
                    <td style={{ color: loc.demand - loc.supply > 0 ? 'var(--brand-red)' : 'var(--brand-green)', fontWeight: 600 }}>
                      {loc.demand - loc.supply > 0 ? '+' : ''}{(loc.demand - loc.supply).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{loc.pressure.toFixed(2)}x</td>
                    <td>{getTemperatureLabel(loc.pressure)}</td>
                    <td>
                      <Badge variant={getPressureVariant(loc.pressure)}>
                        {loc.pressure >= 3.5 ? 'Very Hot' : loc.pressure >= 2.5 ? 'Hot' : loc.pressure >= 1.5 ? 'Warm' : 'Cool'}
                      </Badge>
                    </td>
                  </tr>
                ))}
>>>>>>> origin/main
            </tbody>
          </table>
        </div>
      </Card>
<<<<<<< HEAD

      {/* ── Location Detail Panel (floating) ─────────────────── */}
      {selectedLoc && (
        <LocationDetailPanel
          loc={selectedLoc}
          onClose={() => setSelectedLocation(null)}
        />
      )}
=======
>>>>>>> origin/main
    </div>
  )
}
