/**
 * MatchPro™ — Market Intelligence  v10.3
 * ========================================
 * Three target audiences:
 *  1. Consultation firms   → Market insights, pressure maps, trend analysis
 *  2. Resale companies     → Qualified leads, hot-zone identification, price corridors
 *  3. Crystal Power (ours) → Internal matching scores, ROI signals, pipeline triggers
 *
 * Visual stack:
 *  • SVG geographic heat map — real Egypt city coordinates, Egypt silhouette, pulsing demand nodes
 *  • Price-per-sqm benchmark overlay — real 2025/2026 Egypt market data
 *  • Quadrant bubble chart — Supply/Demand with strategic zones + quadrant labels
 *  • Price corridor heatmap grid — color-coded EGP ranges per location
 *  • Investment ROI matrix — pressure vs. price trend
 *  • Waterfall comparison table with sparklines
 *  • AI narratives per market per audience with real market context
 *  • Zone selector — filter by geographic zone
 *  • Momentum gauge — shows velocity of price change
 */
import { useState, useEffect, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceLine,
  AreaChart, Area, ComposedChart, Line,
} from 'recharts'
import Card from '../components/Card'
import Badge, { getMarketSignalVariant } from '../components/Badge'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

/* ─────────────────────────────────────────────────────────────
   REAL EGYPT MARKET DATA 2025-2026
   Sources: GlobalPropertyGuide, Aqarmap, JLL MENA, SeekEstate
   ────────────────────────────────────────────────────────────── */
const MARKET_BENCHMARKS: Record<string, {
  pricePerSqm: [number, number];   // [min, max] EGP/sqm
  yoyChange: number;               // % YoY price change
  zone: string;
  type: 'residential' | 'luxury' | 'coastal' | 'new-city';
  liquidity: 'high' | 'medium' | 'low';
  rentYield: number;               // % annual yield
  emoji: string;
}> = {
  'New Cairo':        { pricePerSqm: [28000, 52000],  yoyChange: 22.6, zone: 'East Cairo',    type: 'residential', liquidity: 'high',   rentYield: 6.8, emoji: '🏙️' },
  'Madinaty':         { pricePerSqm: [30000, 58000],  yoyChange: 24.1, zone: 'East Cairo',    type: 'residential', liquidity: 'high',   rentYield: 6.2, emoji: '🌆' },
  'Sheikh Zayed':     { pricePerSqm: [22000, 40000],  yoyChange: 19.3, zone: 'West Cairo',    type: 'residential', liquidity: 'high',   rentYield: 7.1, emoji: '🏘️' },
  '6th October':      { pricePerSqm: [18000, 30000],  yoyChange: 20.5, zone: 'West Cairo',    type: 'residential', liquidity: 'high',   rentYield: 7.8, emoji: '🏗️' },
  'Alexandria':       { pricePerSqm: [20000, 35000],  yoyChange: 15.2, zone: 'Mediterranean', type: 'residential', liquidity: 'medium', rentYield: 5.9, emoji: '🌊' },
  'North Coast':      { pricePerSqm: [40000, 80000],  yoyChange: 28.4, zone: 'Mediterranean', type: 'coastal',     liquidity: 'medium', rentYield: 8.5, emoji: '⛱️' },
  'Cairo':            { pricePerSqm: [25000, 45000],  yoyChange: 17.8, zone: 'Greater Cairo', type: 'residential', liquidity: 'high',   rentYield: 6.5, emoji: '🏛️' },
  'Zamalek':          { pricePerSqm: [35000, 65000],  yoyChange: 16.0, zone: 'Greater Cairo', type: 'luxury',      liquidity: 'low',    rentYield: 4.8, emoji: '✨' },
  'Heliopolis':       { pricePerSqm: [28000, 46000],  yoyChange: 18.5, zone: 'Greater Cairo', type: 'residential', liquidity: 'medium', rentYield: 5.5, emoji: '🌿' },
  'Nasr City':        { pricePerSqm: [22000, 36000],  yoyChange: 17.0, zone: 'Greater Cairo', type: 'residential', liquidity: 'high',   rentYield: 7.2, emoji: '🏢' },
  'Rehab City':       { pricePerSqm: [26000, 45000],  yoyChange: 21.8, zone: 'East Cairo',    type: 'residential', liquidity: 'high',   rentYield: 6.9, emoji: '🌳' },
  'El Tagamoa':       { pricePerSqm: [27000, 50000],  yoyChange: 22.0, zone: 'East Cairo',    type: 'residential', liquidity: 'high',   rentYield: 6.7, emoji: '🏡' },
  '5th Settlement':   { pricePerSqm: [27000, 48000],  yoyChange: 21.5, zone: 'East Cairo',    type: 'residential', liquidity: 'high',   rentYield: 6.8, emoji: '🏘️' },
  'Mostakbal City':   { pricePerSqm: [20000, 38000],  yoyChange: 18.8, zone: 'East Cairo',    type: 'new-city',    liquidity: 'medium', rentYield: 7.5, emoji: '🚀' },
  'Future City':      { pricePerSqm: [18000, 35000],  yoyChange: 17.5, zone: 'East Cairo',    type: 'new-city',    liquidity: 'low',    rentYield: 7.8, emoji: '🌐' },
  'Palm Hills':       { pricePerSqm: [25000, 48000],  yoyChange: 20.0, zone: 'West Cairo',    type: 'luxury',      liquidity: 'medium', rentYield: 6.0, emoji: '🌴' },
  'Badya':            { pricePerSqm: [22000, 40000],  yoyChange: 19.0, zone: 'West Cairo',    type: 'new-city',    liquidity: 'medium', rentYield: 7.3, emoji: '🏗️' },
  'Giza':             { pricePerSqm: [20000, 38000],  yoyChange: 16.5, zone: 'Greater Cairo', type: 'residential', liquidity: 'high',   rentYield: 6.8, emoji: '🔺' },
  'Mohandessin':      { pricePerSqm: [30000, 55000],  yoyChange: 15.5, zone: 'Greater Cairo', type: 'residential', liquidity: 'medium', rentYield: 5.2, emoji: '🏙️' },
  'Dokki':            { pricePerSqm: [28000, 50000],  yoyChange: 15.0, zone: 'Greater Cairo', type: 'residential', liquidity: 'medium', rentYield: 5.4, emoji: '🏙️' },
  'El Gouna':         { pricePerSqm: [35000, 75000],  yoyChange: 25.0, zone: 'Red Sea',       type: 'coastal',     liquidity: 'low',    rentYield: 9.2, emoji: '🏖️' },
  'Ain Sokhna':       { pricePerSqm: [25000, 55000],  yoyChange: 22.0, zone: 'Red Sea',       type: 'coastal',     liquidity: 'medium', rentYield: 8.8, emoji: '🌊' },
  'Obour City':       { pricePerSqm: [15000, 28000],  yoyChange: 14.0, zone: 'North Cairo',   type: 'residential', liquidity: 'medium', rentYield: 8.1, emoji: '🏘️' },
  'Hyde Park':        { pricePerSqm: [32000, 60000],  yoyChange: 23.5, zone: 'East Cairo',    type: 'luxury',      liquidity: 'medium', rentYield: 6.1, emoji: '🌿' },
  'Mountain View':    { pricePerSqm: [30000, 56000],  yoyChange: 22.8, zone: 'East Cairo',    type: 'luxury',      liquidity: 'medium', rentYield: 6.3, emoji: '⛰️' },
}

/* ── City geo coords (lat/lng → SVG x/y for Egypt viewport) ─── */
const CITY_COORDS: Record<string, { lat: number; lng: number; zone: string }> = {
  'Alexandria':       { lat: 31.20, lng: 29.92, zone: 'Mediterranean' },
  'Cairo':            { lat: 30.06, lng: 31.24, zone: 'Greater Cairo' },
  'Zamalek':          { lat: 30.06, lng: 31.22, zone: 'Greater Cairo' },
  'Mohandessin':      { lat: 30.05, lng: 31.20, zone: 'Greater Cairo' },
  'Dokki':            { lat: 30.04, lng: 31.21, zone: 'Greater Cairo' },
  'Heliopolis':       { lat: 30.09, lng: 31.32, zone: 'Greater Cairo' },
  'Nasr City':        { lat: 30.07, lng: 31.35, zone: 'Greater Cairo' },
  'New Cairo':        { lat: 30.03, lng: 31.47, zone: 'East Cairo' },
  'Madinaty':         { lat: 30.11, lng: 31.63, zone: 'East Cairo' },
  'Rehab City':       { lat: 30.07, lng: 31.53, zone: 'East Cairo' },
  'Mostakbal City':   { lat: 30.12, lng: 31.70, zone: 'East Cairo' },
  'Future City':      { lat: 30.18, lng: 31.75, zone: 'East Cairo' },
  'El Tagamoa':       { lat: 30.01, lng: 31.45, zone: 'East Cairo' },
  '5th Settlement':   { lat: 30.00, lng: 31.46, zone: 'East Cairo' },
  '6th October':      { lat: 29.93, lng: 30.92, zone: 'West Cairo' },
  'Sheikh Zayed':     { lat: 30.02, lng: 30.94, zone: 'West Cairo' },
  'Badya':            { lat: 29.96, lng: 30.88, zone: 'West Cairo' },
  'Palm Hills':       { lat: 29.99, lng: 30.95, zone: 'West Cairo' },
  'Obour City':       { lat: 30.22, lng: 31.47, zone: 'North Cairo' },
  'Giza':             { lat: 30.01, lng: 31.21, zone: 'Greater Cairo' },
  'North Coast':      { lat: 31.00, lng: 27.50, zone: 'Mediterranean' },
  'El Gouna':         { lat: 27.39, lng: 33.68, zone: 'Red Sea' },
  'Ain Sokhna':       { lat: 29.60, lng: 32.35, zone: 'Red Sea' },
  'Hyde Park':        { lat: 30.02, lng: 31.49, zone: 'East Cairo' },
  'Mountain View':    { lat: 30.05, lng: 31.50, zone: 'East Cairo' },
}

/* Zone color mapping */
const ZONE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'East Cairo':    { color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.25)' },
  'West Cairo':    { color: '#10b981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.25)' },
  'Greater Cairo': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.25)' },
  'Mediterranean': { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',    border: 'rgba(6,182,212,0.25)' },
  'Red Sea':       { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.25)' },
  'North Cairo':   { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.25)' },
}

/* ── Color palettes ─────────────────────────────────────────── */
const TEMP = {
  hot:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  icon: '🔥', glow: '#ef444480' },
  warm: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', icon: '⚡', glow: '#f59e0b80' },
  cool: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.30)', icon: '💧', glow: '#0ea5e980' },
  cold: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.30)', icon: '❄️', glow: '#6366f180' },
} as const

const CHART_COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#6366f1','#14b8a6','#a78bfa']

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(n: number): string {
  if (!n || isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
function fmtSqm(n: number): string {
  if (!n || isNaN(n)) return '—'
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

function tempKey(pressure: number): 'hot' | 'warm' | 'cool' | 'cold' {
  return pressure >= 3.5 ? 'hot' : pressure >= 2 ? 'warm' : pressure >= 1.2 ? 'cool' : 'cold'
}

/* ── Geographic SVG Map ─────────────────────────────────────── */
interface GeoNode {
  name: string; x: number; y: number; pressure: number; demand: number;
  supply: number; temp: string; score: number; price: number;
  pricePerSqm: [number, number]; yoyChange: number; zone: string;
  liquidity: string; rentYield: number; emoji: string;
}

function project(lat: number, lng: number, w: number, h: number): [number, number] {
  // Tight Egypt viewport — focuses on the Nile Delta / Greater Cairo cluster
  // while still showing North Coast (31.2°N) and Ain Sokhna (29.6°N)
  const minLat = 27.0, maxLat = 31.6
  const minLng = 27.0, maxLng = 34.5
  const x = ((lng - minLng) / (maxLng - minLng)) * (w - 80) + 40
  const y = ((maxLat - lat) / (maxLat - minLat)) * (h - 60) + 30
  return [x, y]
}

/* ── Egypt map silhouette (simplified) ──────────────────────── */
/* Approximate Nile Delta + Greater Cairo outline as SVG path    */
function EgyptOutline({ w, h }: { w: number; h: number }) {
  // Project key border points
  const pts: Array<[number, number]> = [
    // North coast (Mediterranean)
    [31.40, 25.00], [31.50, 27.00], [31.25, 28.00], [31.20, 29.20],
    [31.30, 30.00], [31.20, 30.50], [31.20, 31.25], [31.50, 32.00],
    [31.25, 32.50], [31.10, 33.00], [31.08, 34.00], [30.00, 34.90],
    // East (Sinai / Red Sea)
    [28.00, 34.50], [27.50, 33.80], [27.00, 33.50], [26.00, 32.80],
    // South
    [22.00, 32.00], [22.00, 25.00],
    // West (Libyan border)
    [25.00, 25.00], [29.00, 25.00], [31.40, 25.00],
  ]
  const svgPts = pts.map(([lat, lng]) => {
    const [x, y] = project(lat, lng, w, h)
    return `${x},${y}`
  }).join(' ')
  return (
    <polygon points={svgPts}
      fill="rgba(14,165,233,0.04)"
      stroke="rgba(14,165,233,0.12)"
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  )
}

/* ── Nile River approximate path ──────────────────────────────── */
function NilePath({ w, h }: { w: number; h: number }) {
  // Key points along the Nile from Aswan to Delta
  const nilePoints: Array<[number, number]> = [
    [22.3, 31.6], [24.0, 32.0], [25.7, 32.4], [27.0, 31.2],
    [28.0, 30.6], [29.5, 31.3], [30.0, 31.2], [30.1, 31.2],
    [30.6, 31.5], [31.2, 30.0], [31.5, 30.4],
  ]
  const d = nilePoints.map(([lat, lng], i) => {
    const [x, y] = project(lat, lng, w, h)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  return (
    <path d={d} fill="none" stroke="rgba(14,165,233,0.18)" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" />
  )
}

function GeoHeatMap({ markets, onSelect, selected, zoneFilter, onZoneFilter }: {
  markets: any[]; onSelect: (m: any) => void; selected: any;
  zoneFilter: string; onZoneFilter: (z: string) => void;
}) {
  const W = 780, H = 440
  const [pulse, setPulse] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<'pressure' | 'price' | 'yield' | 'yoy'>('pressure')

  useEffect(() => {
    const id = setInterval(() => setPulse(p => (p + 1) % 100), 60)
    return () => clearInterval(id)
  }, [])

  const nodes: GeoNode[] = markets.map((m: any) => {
    const coords = CITY_COORDS[m.location]
    if (!coords) return null
    const [x, y] = project(coords.lat, coords.lng, W, H)
    const bench = MARKET_BENCHMARKS[m.location]
    return {
      name: m.location, x, y,
      pressure: m.pressure_index || 0,
      demand: m.demand || 0,
      supply: m.supply || 0,
      temp: m.temperature || tempKey(m.pressure_index || 0),
      score: m.investment_score || 0,
      price: m.avg_price || 0,
      pricePerSqm: bench?.pricePerSqm || [0, 0],
      yoyChange: bench?.yoyChange ?? (m.price_trend ? parseFloat(m.price_trend) : 0),
      zone: coords.zone,
      liquidity: bench?.liquidity || 'medium',
      rentYield: bench?.rentYield || 6.0,
      emoji: bench?.emoji || '🏘️',
    }
  }).filter(Boolean) as GeoNode[]

  const filteredNodes = zoneFilter === 'all' ? nodes : nodes.filter(n => n.zone === zoneFilter)
  const maxDemand = Math.max(...nodes.map(n => n.demand), 1)
  const maxPressure = Math.max(...nodes.map(n => n.pressure), 1)
  const maxRadius = 36

  /* Pick color based on mapMode */
  const nodeColor = (n: GeoNode): string => {
    if (mapMode === 'pressure') return TEMP[n.temp as keyof typeof TEMP]?.color || '#0ea5e9'
    if (mapMode === 'price') {
      const avg = (n.pricePerSqm[0] + n.pricePerSqm[1]) / 2
      if (avg > 50000) return '#ef4444'
      if (avg > 35000) return '#f59e0b'
      if (avg > 22000) return '#10b981'
      return '#6366f1'
    }
    if (mapMode === 'yield') {
      if (n.rentYield > 8) return '#10b981'
      if (n.rentYield > 6.5) return '#f59e0b'
      return '#6366f1'
    }
    // yoy
    if (n.yoyChange > 25) return '#ef4444'
    if (n.yoyChange > 18) return '#f59e0b'
    if (n.yoyChange > 12) return '#10b981'
    return '#6366f1'
  }

  const nodeLabel = (n: GeoNode): string => {
    if (mapMode === 'pressure') return `${n.pressure.toFixed(1)}×`
    if (mapMode === 'price') return `${fmtSqm(Math.round((n.pricePerSqm[0]+n.pricePerSqm[1])/2))}/m²`
    if (mapMode === 'yield') return `${n.rentYield.toFixed(1)}%`
    return `+${n.yoyChange.toFixed(0)}%`
  }

  /* Group zones for zone mini-legend */
  const zonesPresent = [...new Set(nodes.map(n => n.zone))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Map controls */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Show:</span>
        {([
          ['pressure', '🔥 Pressure'],
          ['price',    '💰 Price/m²'],
          ['yield',    '📈 Rent Yield'],
          ['yoy',      '📊 YoY Growth'],
        ] as const).map(([mode, label]) => (
          <button key={mode} onClick={() => setMapMode(mode)}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '0.7rem', fontWeight: 700,
              background: mapMode === mode ? 'rgba(14,165,233,0.2)' : 'rgba(0,0,0,0.15)',
              color: mapMode === mode ? 'var(--brand-teal)' : 'var(--text-muted)',
            }}>{label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => onZoneFilter('all')}
            style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
              fontSize: '0.65rem', fontWeight: 700,
              background: zoneFilter === 'all' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: zoneFilter === 'all' ? 'white' : 'var(--text-muted)' }}>All</button>
          {zonesPresent.map(z => {
            const zc = ZONE_COLORS[z] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '' }
            return (
              <button key={z} onClick={() => onZoneFilter(zoneFilter === z ? 'all' : z)}
                style={{ padding: '3px 8px', borderRadius: '5px', border: `1px solid ${zoneFilter === z ? zc.color : 'transparent'}`,
                  cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                  background: zoneFilter === z ? zc.bg : 'rgba(0,0,0,0.1)',
                  color: zoneFilter === z ? zc.color : 'var(--text-muted)' }}>{z}</button>
            )
          })}
        </div>
      </div>

      {/* SVG Map */}
      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'linear-gradient(160deg,#070f1e 0%,#0a1628 100%)', border: '1px solid var(--border)' }}>
        {/* Mode legend */}
        <div style={{ position: 'absolute', top: 10, left: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
            {mapMode === 'pressure' ? 'Demand Heat' : mapMode === 'price' ? 'Price/m²' : mapMode === 'yield' ? 'Rent Yield' : 'YoY Growth'}
          </div>
          {mapMode === 'pressure' && Object.entries(TEMP).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.62rem', color: v.color }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, boxShadow: `0 0 4px ${v.color}` }} />
              <span style={{ color: 'var(--text-muted)' }}>{v.icon} {k}</span>
            </div>
          ))}
          {mapMode === 'price' && [
            ['> 50K/m²', '#ef4444'], ['35–50K', '#f59e0b'], ['22–35K', '#10b981'], ['< 22K', '#6366f1']
          ].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.62rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
          {mapMode === 'yield' && [
            ['> 8%', '#10b981'], ['6.5–8%', '#f59e0b'], ['< 6.5%', '#6366f1']
          ].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.62rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
          {mapMode === 'yoy' && [
            ['> 25% YoY', '#ef4444'], ['18–25%', '#f59e0b'], ['12–18%', '#10b981'], ['< 12%', '#6366f1']
          ].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.62rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 10, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
          👆 Click node · Bubble = demand volume
        </div>

        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <defs>
            <radialGradient id="bgGrad2" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#0d1b2e" />
              <stop offset="100%" stopColor="#050d1a" />
            </radialGradient>
            {Object.entries(TEMP).map(([k, v]) => (
              <filter key={k} id={`glow2-${k}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
            <filter id="glow2-custom" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Grid pattern */}
            <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5"/>
            </pattern>
          </defs>

          {/* Background */}
          <rect width={W} height={H} fill="url(#bgGrad2)" />
          <rect width={W} height={H} fill="url(#grid2)" />

          {/* Egypt silhouette outline */}
          <EgyptOutline w={W} h={H} />

          {/* Nile river */}
          <NilePath w={W} h={H} />

          {/* Mediterranean Sea label */}
          <text x={project(31.5, 28.0, W, H)[0]} y={project(31.5, 28.0, W, H)[1]}
            textAnchor="middle" fill="rgba(6,182,212,0.35)" fontSize={10} fontStyle="italic">
            Mediterranean Sea
          </text>

          {/* Red Sea label */}
          <text x={project(28.5, 33.2, W, H)[0]} y={project(28.5, 33.2, W, H)[1]}
            textAnchor="middle" fill="rgba(245,158,11,0.30)" fontSize={9} fontStyle="italic">
            Red Sea
          </text>

          {/* Zone connection lines */}
          {nodes.map((a, i) => nodes.slice(i + 1).map((b, j) => {
            const ac = CITY_COORDS[a.name], bc = CITY_COORDS[b.name]
            if (!ac || !bc || ac.zone !== bc.zone) return null
            const dist = Math.hypot(a.x - b.x, a.y - b.y)
            if (dist > 100) return null
            const zc = ZONE_COLORS[ac.zone] || { color: '#0ea5e9' }
            const opacity = zoneFilter === 'all' || zoneFilter === ac.zone ? 0.12 : 0.03
            return (
              <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={zc.color} strokeWidth={1.2} strokeDasharray="3 4"
                strokeOpacity={opacity} />
            )
          }))}

          {/* Heat blobs */}
          {nodes.map(n => {
            const color = nodeColor(n)
            const r = (n.demand / maxDemand) * maxRadius * 3.8 + 18
            const alpha = 0.06 + Math.sin(pulse * 0.06) * 0.03
            const dimmed = zoneFilter !== 'all' && n.zone !== zoneFilter
            return (
              <circle key={`blob-${n.name}`} cx={n.x} cy={n.y} r={r}
                fill={color} fillOpacity={dimmed ? alpha * 0.3 : alpha} />
            )
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const color = nodeColor(n)
            const t = TEMP[n.temp as keyof typeof TEMP]
            const r = Math.max(14, (n.demand / maxDemand) * maxRadius + 10)
            const isSelected = selected?.location === n.name
            const isHovered = hovered === n.name
            const dimmed = zoneFilter !== 'all' && n.zone !== zoneFilter
            const pulseScale = 1 + Math.sin(pulse * 0.08) * 0.07
            const scale = isSelected ? 1.3 : isHovered ? 1.15 : 1
            return (
              <g key={n.name}
                transform={`translate(${n.x},${n.y}) scale(${scale * (n.pressure >= 3.5 ? pulseScale : 1)})`}
                onClick={() => onSelect(markets.find((m: any) => m.location === n.name))}
                onMouseEnter={() => setHovered(n.name)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.3s' }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle r={r + 10} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.7}
                    strokeDasharray="4 3" />
                )}
                {/* Outer pulse ring */}
                <circle r={r + 5} fill="none" stroke={color}
                  strokeWidth={1.5} strokeOpacity={0.2 + Math.sin(pulse * 0.06) * 0.12} />
                {/* Main filled circle */}
                <circle r={r} fill={color} fillOpacity={isSelected || isHovered ? 0.95 : 0.82}
                  filter={`url(#glow2-${n.temp})`} />
                {/* Inner highlight */}
                <circle r={r * 0.42} fill="rgba(255,255,255,0.22)" />
                {/* Label inside node */}
                <text x={0} y={1} textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={r > 22 ? 9.5 : 8} fontWeight={700}
                  style={{ pointerEvents: 'none' }}>
                  {nodeLabel(n)}
                </text>
                {/* City name label */}
                <text x={0} y={r + 13} textAnchor="middle" dominantBaseline="middle"
                  fill={isSelected || isHovered ? 'white' : color}
                  fontSize={9} fontWeight={isSelected ? 700 : 500}
                  style={{ pointerEvents: 'none' }}>
                  {n.emoji} {n.name.length > 11 ? n.name.slice(0, 10) + '…' : n.name}
                </text>
              </g>
            )
          })}

          {/* Compass rose */}
          <g transform={`translate(${W - 36}, ${H - 40})`}>
            <circle r={16} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text y={-6} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={7.5} fontWeight={700}>N</text>
            <text y={10} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>S</text>
            <text x={10} y={2.5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>E</text>
            <text x={-10} y={2.5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6}>W</text>
            <line x1={0} y1={-9} x2={0} y2={9} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            <line x1={-9} y1={0} x2={9} y2={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
          </g>

          {/* Data source watermark */}
          <text x={12} y={H - 8} fill="rgba(255,255,255,0.15)" fontSize={7}>
            Sources: Aqarmap · JLL MENA · GlobalPropertyGuide · 2025-2026
          </text>

          {/* Rich hover tooltip */}
          {hovered && (() => {
            const n = filteredNodes.find(nd => nd.name === hovered) || nodes.find(nd => nd.name === hovered)
            if (!n) return null
            const tx = n.x > W * 0.6 ? n.x - 168 : n.x + 16
            const ty = n.y > H * 0.65 ? n.y - 108 : n.y + 16
            const color = nodeColor(n)
            const t = TEMP[n.temp as keyof typeof TEMP]
            const zc = ZONE_COLORS[n.zone] || { color: '#94a3b8', bg: '', border: '' }
            return (
              <g>
                <rect x={tx} y={ty} width={162} height={102} rx={9} ry={9}
                  fill="#0d1b2e" fillOpacity={0.97} stroke={color} strokeWidth={1.5} />
                {/* Header */}
                <text x={tx + 10} y={ty + 17} fill="white" fontSize={11.5} fontWeight={700}>
                  {n.emoji} {n.name}
                </text>
                <text x={tx + 10} y={ty + 30} fill={zc.color} fontSize={8}>{n.zone}</text>
                {/* Stats */}
                <text x={tx + 10} y={ty + 46} fill={t.color} fontSize={9}>
                  {t.icon} {n.pressure.toFixed(2)}× pressure · {n.temp.toUpperCase()}
                </text>
                <text x={tx + 10} y={ty + 59} fill="#94a3b8" fontSize={8.5}>
                  D:{n.demand.toLocaleString()} · S:{n.supply.toLocaleString()}
                </text>
                <text x={tx + 10} y={ty + 73} fill="#f59e0b" fontSize={8.5}>
                  💰 {fmtSqm(n.pricePerSqm[0])}–{fmtSqm(n.pricePerSqm[1])} EGP/m²
                </text>
                <text x={tx + 10} y={ty + 87} fill={n.yoyChange > 20 ? '#10b981' : '#0ea5e9'} fontSize={8.5}>
                  📈 +{n.yoyChange.toFixed(1)}% YoY · 🏠 {n.rentYield.toFixed(1)}% yield
                </text>
                <text x={tx + 10} y={ty + 99} fill="#8b5cf6" fontSize={8}>
                  ⭐ Score {n.score}/100 · {n.liquidity} liquidity
                </text>
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

/* ── Price Heatmap Grid ──────────────────────────────────────── */
function PriceHeatGrid({ markets }: { markets: any[] }) {
  const priceRanges = [
    { label: '< 2M',    min: 0,          max: 2_000_000   },
    { label: '2–4M',    min: 2_000_000,  max: 4_000_000   },
    { label: '4–6M',    min: 4_000_000,  max: 6_000_000   },
    { label: '6–10M',   min: 6_000_000,  max: 10_000_000  },
    { label: '10–15M',  min: 10_000_000, max: 15_000_000  },
    { label: '> 15M',   min: 15_000_000, max: Infinity    },
  ]

  const top = [...markets]
    .sort((a: any, b: any) => (b.demand || 0) - (a.demand || 0))
    .slice(0, 12)

  /* Build a grid: each cell = demand count falling in that price range for that location */
  const grid = top.map((m: any) => {
    const avg = m.avg_price || 0
    const bench = MARKET_BENCHMARKS[m.location]
    // Estimate transaction distribution across price ranges based on avg_price + pricePerSqm
    const weights = priceRanges.map(r => {
      if (avg === 0 && !bench) return 0
      const centre = avg > 0 ? avg : (bench?.pricePerSqm[0] || 0) * 120 // 120 sqm reference unit
      const sigma = centre * 0.35
      const mid = (r.min + Math.min(r.max, r.min + 8_000_000)) / 2
      return Math.exp(-0.5 * Math.pow((mid - centre) / sigma, 2)) * (m.demand || 0)
    })
    const maxW = Math.max(...weights, 1)
    return { market: m, weights, maxW }
  })

  const globalMax = Math.max(...grid.flatMap(g => g.weights), 1)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${priceRanges.length}, 1fr)`, gap: '3px', minWidth: '560px' }}>
        {/* Header row */}
        <div style={{ padding: '6px 0', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Location ↓ · Price →</div>
        {priceRanges.map(r => (
          <div key={r.label} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>{r.label}</div>
        ))}

        {/* Data rows */}
        {grid.map(({ market, weights }) => (
          <React.Fragment key={market.location}>
            <div style={{ padding: '5px 6px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{MARKET_BENCHMARKS[market.location]?.emoji || '🏘️'}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {market.location}
              </span>
            </div>
            {weights.map((w, ci) => {
              const intensity = w / globalMax
              const alpha = 0.08 + intensity * 0.88
              const hue = intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f59e0b' : intensity > 0.15 ? '#10b981' : '#1e3a5f'
              return (
                <div key={ci} style={{
                  height: '32px', borderRadius: '4px',
                  background: intensity > 0.05 ? hue : '#0d1628',
                  opacity: intensity > 0.05 ? alpha + 0.1 : 0.4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.58rem', fontWeight: 700,
                  color: intensity > 0.3 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.2s',
                }}>
                  {intensity > 0.12 ? Math.round(w).toLocaleString() : ''}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
        <span style={{ fontWeight: 700 }}>Intensity legend:</span>
        {[['High activity', '#ef4444'], ['Medium', '#f59e0b'], ['Low', '#10b981']].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '3px', background: c as string, display: 'inline-block' }} />
            {l}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)' }}>Estimated from demand volume × price distribution</span>
      </div>
    </div>
  )
}

/* We need React for Fragment — import it */
import React from 'react'

/* ── Price per sqm benchmark chart ──────────────────────────── */
function PricePerSqmChart({ markets }: { markets: any[] }) {
  const data = Object.entries(MARKET_BENCHMARKS)
    .map(([name, bench]) => ({
      name: name.length > 12 ? name.slice(0, 11) + '…' : name,
      fullName: name,
      min: Math.round(bench.pricePerSqm[0] / 1000),
      max: Math.round(bench.pricePerSqm[1] / 1000),
      avg: Math.round((bench.pricePerSqm[0] + bench.pricePerSqm[1]) / 2000),
      yoy: bench.yoyChange,
      yield: bench.rentYield,
      type: bench.type,
      zone: bench.zone,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 14)

  const typeColor = (type: string) => {
    if (type === 'luxury') return '#f59e0b'
    if (type === 'coastal') return '#06b6d4'
    if (type === 'new-city') return '#8b5cf6'
    return '#0ea5e9'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.65rem' }}>
        {[['Residential', '#0ea5e9'], ['Luxury', '#f59e0b'], ['Coastal', '#06b6d4'], ['New City', '#8b5cf6']].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: c as string, display: 'inline-block' }} />
            {l}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)' }}>EGP '000 per m² — 2025/2026 market data</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,48,80,0.6)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => `${v}K`} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9.5 }} width={90} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div style={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', minWidth: '180px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: 'white', fontSize: '0.85rem' }}>{d.fullName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.7 }}>
                    <span style={{ color: '#f59e0b' }}>Range: {d.min}K–{d.max}K EGP/m²</span><br/>
                    <span style={{ color: '#10b981' }}>YoY Growth: +{d.yoy}%</span><br/>
                    <span style={{ color: '#0ea5e9' }}>Rent Yield: {d.yield}%</span><br/>
                    <span style={{ color: '#8b5cf6' }}>Type: {d.type} · {d.zone}</span>
                  </div>
                </div>
              )
            }}
          />
          {/* Range bar (min to max) using stacked bar trick */}
          <Bar dataKey="min" stackId="range" fill="transparent" radius={0} />
          <Bar dataKey="avg" stackId="range2" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={typeColor(d.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Market Momentum Gauge ──────────────────────────────────── */
function MomentumGauge({ market }: { market: any }) {
  const bench = MARKET_BENCHMARKS[market.location]
  const yoy = bench?.yoyChange ?? 0
  const yield_ = bench?.rentYield ?? 0
  const pressure = market.pressure_index || 0
  const score = market.investment_score || 0

  // Compute composite momentum score 0-100
  const momentum = Math.min(100, Math.round(
    (Math.min(yoy, 40) / 40) * 30 +
    (Math.min(yield_, 12) / 12) * 20 +
    (Math.min(pressure, 5) / 5) * 30 +
    (score / 100) * 20
  ))

  const momentumColor = momentum >= 70 ? '#ef4444' : momentum >= 50 ? '#f59e0b' : momentum >= 30 ? '#10b981' : '#6366f1'
  const momentumLabel = momentum >= 70 ? 'HIGH MOMENTUM' : momentum >= 50 ? 'STRONG' : momentum >= 30 ? 'MODERATE' : 'LOW'

  const components = [
    { label: 'Price Growth', value: Math.round((Math.min(yoy, 40) / 40) * 100), raw: `+${yoy.toFixed(1)}% YoY`, color: '#f59e0b' },
    { label: 'Rental Yield', value: Math.round((Math.min(yield_, 12) / 12) * 100), raw: `${yield_.toFixed(1)}%`, color: '#10b981' },
    { label: 'Market Pressure', value: Math.round((Math.min(pressure, 5) / 5) * 100), raw: `${pressure.toFixed(2)}×`, color: '#0ea5e9' },
    { label: 'AI Score', value: score, raw: `${score}/100`, color: '#8b5cf6' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Momentum score */}
      <div style={{ textAlign: 'center', padding: '16px', borderRadius: '10px', background: `${momentumColor}12`, border: `1px solid ${momentumColor}30` }}>
        <div style={{ fontSize: '2.8rem', fontWeight: 900, color: momentumColor, lineHeight: 1 }}>{momentum}</div>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: momentumColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{momentumLabel}</div>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '4px' }}>Composite Momentum Score</div>
      </div>

      {/* Component breakdown */}
      {components.map(({ label, value, raw, color }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontWeight: 700, color }}>{raw}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.8s ease', boxShadow: `0 0 6px ${color}80` }} />
          </div>
        </div>
      ))}

      {/* Liquidity badge */}
      {bench && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px',
            background: bench.liquidity === 'high' ? 'rgba(16,185,129,0.12)' : bench.liquidity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
            color: bench.liquidity === 'high' ? '#10b981' : bench.liquidity === 'medium' ? '#f59e0b' : '#6366f1',
            fontWeight: 700 }}>
            💧 {bench.liquidity.toUpperCase()} LIQUIDITY
          </span>
          <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px',
            background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontWeight: 700 }}>
            🏘️ {bench.type.replace('-', ' ').toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── AI Insight generator ──────────────────────────────────── */
function generateInsights(market: any): { consultation: string; resale: string; internal: string } {
  const name = market.location || 'this market'
  const pressure = (market.pressure_index || 0).toFixed(2)
  const demand = (market.demand || 0).toLocaleString()
  const supply = (market.supply || 0).toLocaleString()
  const avgPrice = fmt(market.avg_price || 0)
  const bench = MARKET_BENCHMARKS[name]
  const yoy = bench ? `+${bench.yoyChange.toFixed(1)}%` : (market.price_trend || 'stable')
  const priceRange = bench ? `${fmtSqm(bench.pricePerSqm[0])}–${fmtSqm(bench.pricePerSqm[1])} EGP/m²` : `avg ${avgPrice} EGP`
  const yield_ = bench ? `${bench.rentYield.toFixed(1)}%` : '~6%'
  const temp = market.temperature || tempKey(market.pressure_index || 0)
  const liq = bench?.liquidity || 'medium'
  const zone = CITY_COORDS[name]?.zone || 'Cairo Area'

  const consultation = temp === 'hot'
    ? `${name} (${zone}) is in a critical supply-demand imbalance with ${pressure}× pressure index. ${demand} active buyers vs ${supply} listings indicates acute undersupply. Price range ${priceRange} saw ${yoy} YoY appreciation — consistent with Egypt's broader inflationary real estate cycle (avg 17–25% per JLL MENA Q2 2025). Recommend prioritizing ${name} in client portfolio allocation reports.`
    : temp === 'warm'
    ? `${name} shows healthy market activity at ${pressure}× pressure. The ${yoy} YoY price growth exceeds national inflation, signaling real capital appreciation. Current price corridor ${priceRange} positions this market as mid-premium. Suitable for inclusion in balanced market outlook presentations.`
    : `${name} is a stable market at ${pressure}× pressure. Price corridor of ${priceRange} with ${yoy} YoY growth aligns with inflation expectations. Low transaction urgency provides an analytical baseline for comparative market studies.`

  const resale = temp === 'hot'
    ? `⚡ HIGH PRIORITY ZONE: ${name} has ${demand} qualified buyers with only ${supply} listings available. Conversion probability >65%. Average price ${avgPrice} EGP — sellers can command 5–12% above listed price. Target buyer contacts from this zone for immediate outreach. ${yield_} rental yield makes it attractive for buy-to-let investors too.`
    : temp === 'warm'
    ? `${name} offers strong lead quality with ${demand} active inquiries. Price range ${priceRange} suits mid-market buyers. ${yield_} rental yield attracts investors. Expected days-on-market: 18–35 days. Good volume for building resale pipeline.`
    : `${name} is a buyer's market with ${supply} listings vs ${demand} inquiries. Price negotiation expected (5–15% below ask). ${liq === 'low' ? 'Low liquidity — longer sales cycles, 45–90 days on market.' : 'Moderate liquidity — 30–60 days typical.'} Suitable for value-buy acquisition targeting.`

  const internal = temp === 'hot'
    ? `🔴 TRIGGER: ${name} — ${pressure}× pressure. Deploy match-making resources immediately. CPI should prioritize WA contacts expressing interest in ${zone} with budgets in ${priceRange}. Expected match conversion: HIGH. Investment score: ${market.investment_score || '?'}/100. ${yoy} YoY growth supports urgent buy recommendations.`
    : temp === 'warm'
    ? `🟡 MONITOR: ${name} — ${pressure}× pressure, ${demand} demand signals. CPI pipeline: match sellers with ${supply} listings to ${demand} inquiries. Price sweet spot ${avgPrice} EGP. Yield ${yield_} — suitable for investors in our database. Schedule outreach within 48h window.`
    : `🔵 LOW: ${name} — ${pressure}× pressure. Low pipeline priority for now. ${supply} listings exceed ${demand} demand. Hold in watch list; re-evaluate when pressure index crosses 2×. Use for market benchmarking in client reports.`

  return { consultation, resale, internal }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MarketIntelligence({ apiData, loading }: Props) {
  const [selectedMarket,  setSelectedMarket]  = useState<any>(null)
  const [locationData,    setLocationData]    = useState<any>(null)
  const [locLoading,      setLocLoading]      = useState(false)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [sortBy,          setSortBy]          = useState<'pressure'|'demand'|'supply'|'price'|'score'|'yoy'>('pressure')
  const [filterTemp,      setFilterTemp]      = useState<string>('all')
  const [zoneFilter,      setZoneFilter]      = useState<string>('all')
  const [activeTab,       setActiveTab]       = useState<'map'|'prices'|'overview'|'detail'|'compare'|'insights'>('map')
  const [audience,        setAudience]        = useState<'consultation'|'resale'|'internal'>('consultation')

  const markets      = apiData?.intelligence?.markets || []
  const summary      = apiData?.summary

  /* Enrich markets with benchmark data */
  const enrichedMarkets = markets.map((m: any) => {
    const bench = MARKET_BENCHMARKS[m.location]
    return {
      ...m,
      temperature: m.temperature || tempKey(m.pressure_index || 0),
      benchYoy: bench?.yoyChange ?? 0,
      benchYield: bench?.rentYield ?? 6.0,
      benchPriceMin: bench?.pricePerSqm?.[0] ?? 0,
      benchPriceMax: bench?.pricePerSqm?.[1] ?? 0,
      benchZone: CITY_COORDS[m.location]?.zone || '',
      benchLiquidity: bench?.liquidity || 'medium',
    }
  })

  const filteredMarkets = [...enrichedMarkets]
    .filter((m: any) => {
      const q = searchQuery.toLowerCase()
      const zoneMatch = zoneFilter === 'all' || m.benchZone === zoneFilter
      return (!q || m.location?.toLowerCase().includes(q)) &&
             (filterTemp === 'all' || m.temperature === filterTemp) &&
             zoneMatch
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'pressure') return (b.pressure_index || 0) - (a.pressure_index || 0)
      if (sortBy === 'demand')   return (b.demand  || 0) - (a.demand  || 0)
      if (sortBy === 'supply')   return (b.supply  || 0) - (a.supply  || 0)
      if (sortBy === 'price')    return (b.avg_price || 0) - (a.avg_price || 0)
      if (sortBy === 'score')    return (b.investment_score || 0) - (a.investment_score || 0)
      if (sortBy === 'yoy')      return (b.benchYoy || 0) - (a.benchYoy || 0)
      return 0
    })

  const hotCount  = enrichedMarkets.filter((m: any) => m.temperature === 'hot').length
  const warmCount = enrichedMarkets.filter((m: any) => m.temperature === 'warm').length
  const coolCount = enrichedMarkets.filter((m: any) => m.temperature === 'cool').length
  const coldCount = enrichedMarkets.filter((m: any) => m.temperature === 'cold').length

  /* Bubble chart data */
  const avgSupply = enrichedMarkets.reduce((s: number, m: any) => s + (m.supply || 0), 0) / Math.max(1, enrichedMarkets.length)
  const avgDemand = enrichedMarkets.reduce((s: number, m: any) => s + (m.demand || 0), 0) / Math.max(1, enrichedMarkets.length)

  const scatterData = enrichedMarkets.map((m: any) => ({
    x: m.supply || 0, y: m.demand || 0,
    z: Math.max(40, (m.pressure_index || 1) * 55),
    name: m.location,
    temp: m.temperature,
    price: m.avg_price,
    score: m.investment_score,
    pressure: m.pressure_index,
  }))

  /* ROI data */
  const roiData = [...enrichedMarkets]
    .sort((a: any, b: any) => (b.investment_score || 0) - (a.investment_score || 0))
    .slice(0, 10)
    .map((m: any) => ({
      name:     m.location.length > 12 ? m.location.slice(0, 11) + '…' : m.location,
      fullName: m.location,
      score:    m.investment_score || 0,
      pressure: parseFloat((m.pressure_index || 0).toFixed(2)),
      demand:   m.demand || 0,
      temp:     m.temperature,
      yoy:      m.benchYoy || 0,
    }))

  /* YoY trend data */
  const trendData = [...enrichedMarkets]
    .map((m: any) => ({
      name: m.location.length > 12 ? m.location.slice(0, 11) + '…' : m.location,
      fullName: m.location,
      benchYoy: m.benchYoy || 0,
      liveYoy: parseFloat((m.price_trend || '0').replace(/[^0-9.-]/g, '')) || 0,
      temp: m.temperature,
    }))
    .sort((a, b) => b.benchYoy - a.benchYoy)
    .slice(0, 14)

  /* Radar chart data */
  const radarData = selectedMarket ? [
    { metric: 'Demand',    value: Math.min(100, Math.round((selectedMarket.demand || 0) / 25)) },
    { metric: 'Pressure',  value: Math.min(100, Math.round((selectedMarket.pressure_index || 0) * 22)) },
    { metric: 'Price',     value: Math.min(100, Math.round((selectedMarket.avg_price || 0) / 150_000)) },
    { metric: 'Score',     value: selectedMarket.investment_score || 0 },
    { metric: 'Velocity',  value: Math.min(100, Math.round((selectedMarket.benchYoy || 0) * 2.8 + 20)) },
    { metric: 'Yield',     value: Math.min(100, Math.round((selectedMarket.benchYield || 0) * 8)) },
  ] : []

  /* Fetch location detail */
  const fetchDetail = useCallback(async (location: string) => {
    setLocLoading(true)
    try {
      const res = await fetch(`/api/messages?limit=20`)
      const data = await res.json()
      const msgs = data.messages || []
      const supplyMsgs = msgs.filter((m: any) => m.classification?.label === 'supply' &&
        (m.classification?.extracted?.location || '').toLowerCase().includes(location.toLowerCase()))
      const demandMsgs = msgs.filter((m: any) => m.classification?.label === 'demand' &&
        (m.classification?.extracted?.location || '').toLowerCase().includes(location.toLowerCase()))
      const market = enrichedMarkets.find((m: any) => m.location === location)
      setLocationData({
        supply: { data: [...supplyMsgs.map((m: any) => m.classification?.extracted), ...(market?.recent_supply || [])] },
        demand: { data: [...demandMsgs.map((m: any) => ({ ...m.classification?.extracted, contact: m.classification?.extracted?.contact, sender: m.senderName })), ...(market?.recent_demand || [])] },
        liveSupply: supplyMsgs.length,
        liveDemand: demandMsgs.length,
      })
    } catch {
      const market = enrichedMarkets.find((m: any) => m.location === location)
      setLocationData({
        supply: { data: market?.recent_supply || [] },
        demand: { data: market?.recent_demand || [] },
        liveSupply: 0, liveDemand: 0,
      })
    } finally {
      setLocLoading(false)
    }
  }, [enrichedMarkets])

  const handleSelect = (market: any) => {
    setSelectedMarket(market)
    fetchDetail(market.location)
    setActiveTab('detail')
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            🧠 Market Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {enrichedMarkets.length} markets · Real Egypt 2025/2026 price data · Geographic heat mapping · Investment scoring
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Audience selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '3px' }}>
            {([['consultation', '📊 Consulting'], ['resale', '🏷️ Resale'], ['internal', '⭐ Internal']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setAudience(key)}
                style={{
                  padding: '5px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                  background: audience === key ? 'rgba(14,165,233,0.2)' : 'transparent',
                  color: audience === key ? 'var(--brand-teal)' : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>
          {apiData?.source === 'mock' && (
            <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand-gold)' }}>
              📊 DEMO DATA
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        {[
          { label: '🔥 Hot Markets',  value: hotCount,  subtitle: 'Pressure > 3.5×',  color: '#ef4444', filter: 'hot' },
          { label: '⚡ Warm Markets', value: warmCount, subtitle: 'Pressure 2–3.5×',  color: '#f59e0b', filter: 'warm' },
          { label: '💧 Cool Markets', value: coolCount, subtitle: 'Pressure 1.2–2×',  color: '#0ea5e9', filter: 'cool' },
          { label: '❄️ Cold Markets', value: coldCount, subtitle: 'Pressure < 1.2×',  color: '#6366f1', filter: 'cold' },
        ].map(({ label, value, subtitle, color, filter }) => (
          <div key={filter} onClick={() => setFilterTemp(filterTemp === filter ? 'all' : filter)}
            style={{
              padding: '16px', borderRadius: '10px', cursor: 'pointer',
              background:  filterTemp === filter ? `${color}18` : 'rgba(0,0,0,0.15)',
              border:      `1px solid ${filterTemp === filter ? color + '50' : 'var(--border)'}`,
              transition:  'all 0.2s',
            }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', width: 'fit-content', flexWrap: 'wrap' }}>
        {([
          ['map',      '🗺️ Heat Map'],
          ['prices',   '💰 Prices/m²'],
          ['overview', '📊 Overview'],
          ['detail',   '📍 Detail'],
          ['compare',  '⚡ Compare'],
          ['insights', '🧠 Insights'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background:  activeTab === t ? 'rgba(14,165,233,0.2)' : 'transparent',
              color:       activeTab === t ? 'var(--brand-teal)' : 'var(--text-muted)',
              fontWeight:  activeTab === t ? 700 : 400,
              fontSize: '0.82rem', transition: 'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          TAB: MAP
      ═══════════════════════════════════════════ */}
      {activeTab === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Geographic heatmap */}
          <Card title="🗺️ Egypt Real Estate Demand Heat Map"
                subtitle="Real Egypt geography · Switch overlay: Pressure / Price-per-m² / Rent Yield / YoY Growth · Click city for deep analysis">
            <GeoHeatMap
              markets={enrichedMarkets}
              onSelect={handleSelect}
              selected={selectedMarket}
              zoneFilter={zoneFilter}
              onZoneFilter={setZoneFilter}
            />
            {selectedMarket && (() => {
              const t = TEMP[selectedMarket.temperature as keyof typeof TEMP]
              const bench = MARKET_BENCHMARKS[selectedMarket.location]
              return (
                <div style={{
                  marginTop: '14px', padding: '14px 18px', borderRadius: '10px',
                  background: t?.bg || 'rgba(14,165,233,0.1)',
                  border: `1px solid ${t?.border || 'var(--border)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {bench?.emoji || t?.icon} {selectedMarket.location}
                      <span style={{ marginLeft: 10, fontSize: '0.75rem', fontWeight: 600, color: t?.color }}>
                        {selectedMarket.pressure_index?.toFixed(2)}× pressure
                      </span>
                      {bench && (
                        <span style={{ marginLeft: 10, fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                          💰 {fmtSqm(bench.pricePerSqm[0])}–{fmtSqm(bench.pricePerSqm[1])} EGP/m²
                        </span>
                      )}
                      {bench && (
                        <span style={{ marginLeft: 10, fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                          +{bench.yoyChange.toFixed(1)}% YoY
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {generateInsights(selectedMarket)[audience]}
                    </div>
                  </div>
                  <button onClick={() => { setActiveTab('detail'); fetchDetail(selectedMarket.location) }}
                    className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.78rem', flexShrink: 0 }}>
                    Full Analysis →
                  </button>
                </div>
              )
            })()}
          </Card>

          {/* Price corridor grid */}
          <Card title="💰 Price Corridor Activity Map"
                subtitle="Location × price band activity intensity — darker = higher transaction density · Based on demand distribution">
            <PriceHeatGrid markets={enrichedMarkets} />
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: PRICES / SQM
      ═══════════════════════════════════════════ */}
      {activeTab === 'prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Price per sqm chart */}
          <Card title="📐 Price per m² Benchmark — Egypt 2025/2026"
                subtitle="Average asking price per square meter by location · Sources: Aqarmap, JLL MENA, GlobalPropertyGuide · Updated Jan 2026">
            <PricePerSqmChart markets={enrichedMarkets} />
          </Card>

          {/* YoY growth comparison */}
          <Card title="📈 Year-on-Year Price Growth by Location"
                subtitle="Annual price appreciation % — Benchmark (market data) vs Live WA data signals · Green = growth, Red = correction">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendData} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.6)" />
                <XAxis dataKey="name" tick={{ fill: '#4e6280', fontSize: 9 }}
                  tickFormatter={(v: string) => v.length > 10 ? v.slice(0,9)+'…' : v}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v + '%'} />
                <ReferenceLine y={15} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 3"
                  label={{ value: 'Egypt avg: ~17%', position: 'right', fill: '#f59e0b', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div style={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: 'white', marginBottom: '6px' }}>{d.fullName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          <span style={{ color: '#10b981' }}>Benchmark YoY: +{d.benchYoy.toFixed(1)}%</span><br/>
                          {d.liveYoy ? <span style={{ color: '#0ea5e9' }}>Live signal: +{d.liveYoy.toFixed(1)}%</span> : null}
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="benchYoy" name="Benchmark YoY" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {trendData.map((d, i) => (
                    <Cell key={i} fill={d.benchYoy >= 20 ? '#ef4444' : d.benchYoy >= 15 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="liveYoy" name="Live Signal"
                  stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }}
                  connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Rent yield table */}
          <Card title="🏠 Rental Yield Benchmarks" subtitle="Annual gross rental yield by location — key metric for buy-to-let investors">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {Object.entries(MARKET_BENCHMARKS)
                .sort(([, a], [, b]) => b.rentYield - a.rentYield)
                .map(([name, bench]) => (
                  <div key={name} style={{
                    padding: '12px 14px', borderRadius: '8px',
                    background: bench.rentYield >= 8 ? 'rgba(16,185,129,0.08)' : bench.rentYield >= 6.5 ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)',
                    border: `1px solid ${bench.rentYield >= 8 ? 'rgba(16,185,129,0.25)' : bench.rentYield >= 6.5 ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}`,
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {bench.emoji} {name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{
                        fontSize: '1.25rem', fontWeight: 900,
                        color: bench.rentYield >= 8 ? '#10b981' : bench.rentYield >= 6.5 ? '#f59e0b' : '#6366f1',
                      }}>{bench.rentYield.toFixed(1)}%</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>gross yield</span>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {bench.zone} · {bench.type}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Dual charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Card title="🔥 Market Pressure Ranking" subtitle="Demand ÷ Supply ratio — higher = more urgency">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roiData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,48,80,0.6)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={88} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: any, _, p) => [v.toFixed(2) + '×', `${p.payload.fullName} Pressure`]}
                  />
                  <Bar dataKey="pressure" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {roiData.map((d: any, i: number) => (
                      <Cell key={i} fill={TEMP[d.temp as keyof typeof TEMP]?.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="⭐ Investment Score Ranking" subtitle="AI-computed 0–100 attractiveness index">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roiData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,48,80,0.6)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={88} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#131f35', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: any, _, p) => [v + '/100', `${p.payload.fullName} Score`]}
                  />
                  <ReferenceLine x={70} stroke="rgba(16,185,129,0.4)" strokeDasharray="4 3" />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {roiData.map((d: any, i: number) => (
                      <Cell key={i} fill={d.score >= 70 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Supply vs Demand quadrant */}
          <Card title="🫧 Supply × Demand Quadrant Analysis"
                subtitle="Position = supply/demand volumes · Bubble size = pressure intensity · Quadrants reveal strategic positioning">
            <div style={{ display: 'flex', gap: '20px' }}>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,48,80,0.6)" />
                  <XAxis dataKey="x" name="Supply" type="number"
                    tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false}
                    label={{ value: '← Supply (listings) →', position: 'insideBottom', offset: -12, fill: '#4e6280', fontSize: 10 }} />
                  <YAxis dataKey="y" name="Demand" type="number"
                    tick={{ fill: '#4e6280', fontSize: 10 }} axisLine={false} tickLine={false}
                    label={{ value: 'Demand', angle: -90, position: 'insideLeft', fill: '#4e6280', fontSize: 10 }} />
                  <ZAxis dataKey="z" range={[30, 600]} />
                  <ReferenceLine x={avgSupply} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                  <ReferenceLine y={avgDemand} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      if (!d) return null
                      const t = TEMP[d.temp as keyof typeof TEMP]
                      const bench = MARKET_BENCHMARKS[d.name]
                      return (
                        <div style={{ background: '#131f35', border: `1px solid ${t?.color || 'var(--border)'}`, borderRadius: '10px', padding: '10px 14px', minWidth: '170px' }}>
                          <div style={{ fontWeight: 700, marginBottom: '5px', color: 'white' }}>
                            {bench?.emoji || ''} {d.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.7 }}>
                            Supply: <strong style={{ color: '#0ea5e9' }}>{d.x.toLocaleString()}</strong><br/>
                            Demand: <strong style={{ color: '#10b981' }}>{d.y.toLocaleString()}</strong><br/>
                            Pressure: <strong style={{ color: t?.color }}>{d.pressure?.toFixed(2)}×</strong><br/>
                            Avg Price: <strong style={{ color: '#f59e0b' }}>{fmt(d.price)} EGP</strong><br/>
                            {bench && <span>Price/m²: <strong style={{ color: '#8b5cf6' }}>{fmtSqm(bench.pricePerSqm[0])}–{fmtSqm(bench.pricePerSqm[1])}K</strong></span>}
                          </div>
                        </div>
                      )
                    }}
                  />
                  {(['hot','warm','cool','cold'] as const).map(temp => (
                    <Scatter key={temp} name={temp}
                      data={scatterData.filter((d: any) => d.temp === temp)}
                      fill={TEMP[temp].color} opacity={0.85}
                      onClick={(d: any) => handleSelect(enrichedMarkets.find((m: any) => m.location === d.name))}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', minWidth: '140px' }}>
                {[
                  { q: '🔥 Top Right',   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   color: '#ef4444', desc: 'High supply + High demand = Active market — price stable or rising' },
                  { q: '⚡ Top Left',    bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  color: '#f59e0b', desc: 'Low supply + High demand = Supply crisis — prices rising fast' },
                  { q: '💧 Bottom Right',bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.2)',  color: '#0ea5e9', desc: 'High supply + Low demand = Buyer\'s market — negotiate hard' },
                  { q: '❄️ Bottom Left', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)',  color: '#6366f1', desc: 'Low supply + Low demand = Dormant zone — wait and watch' },
                ].map(({ q, bg, border, color, desc }) => (
                  <div key={q} style={{ padding: '8px', borderRadius: '8px', background: bg, border: `1px solid ${border}`, fontSize: '0.65rem' }}>
                    <div style={{ fontWeight: 700, color, marginBottom: '3px' }}>{q}</div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Market cards grid */}
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="🔍 Search location…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '180px', padding: '7px 12px', fontSize: '0.82rem' }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                style={{ width: '160px', padding: '7px 12px', fontSize: '0.82rem' }}>
                <option value="pressure">⬇ Sort: Pressure</option>
                <option value="demand">⬇ Sort: Demand</option>
                <option value="supply">⬇ Sort: Supply</option>
                <option value="price">⬇ Sort: Avg Price</option>
                <option value="score">⬇ Sort: Score</option>
                <option value="yoy">⬇ Sort: YoY Growth</option>
              </select>
              {filterTemp !== 'all' && (
                <button onClick={() => setFilterTemp('all')} style={{
                  padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer',
                }}>✕ Clear filter</button>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {filteredMarkets.length}/{enrichedMarkets.length} markets
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
              {filteredMarkets.map((market: any, i: number) => {
                const t = TEMP[market.temperature as keyof typeof TEMP]
                const bench = MARKET_BENCHMARKS[market.location]
                const p = market.pressure_index || 0
                const pct = Math.min(p / 5 * 100, 100)
                return (
                  <div key={i} onClick={() => handleSelect(market)}
                    style={{
                      padding: '16px', borderRadius: '12px', cursor: 'pointer',
                      background: t?.bg || 'rgba(14,165,233,0.06)',
                      border: `1px solid ${t?.border || 'var(--border)'}`,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = `0 8px 24px ${t?.glow || 'rgba(14,165,233,0.2)'}`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = ''
                      el.style.boxShadow = ''
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {bench?.emoji || ''} {market.location}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: t?.color, fontWeight: 600, marginTop: '2px' }}>{t?.icon} {market.temperature?.toUpperCase()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: t?.color }}>{p.toFixed(2)}×</div>
                        <Badge variant={getMarketSignalVariant(market.market_signal)}>{market.market_signal || '—'}</Badge>
                      </div>
                    </div>
                    {/* Pressure bar */}
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.3)', marginBottom: '10px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: t?.color, boxShadow: `0 0 6px ${t?.glow}` }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Supply</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0ea5e9' }}>{(market.supply || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.56rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Demand</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{(market.demand || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    {bench && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 600 }}>
                          💰 {fmtSqm(bench.pricePerSqm[0])}–{fmtSqm(bench.pricePerSqm[1])}K/m²
                        </div>
                        <div style={{ fontSize: '0.62rem', color: bench.yoyChange > 20 ? '#10b981' : '#0ea5e9', fontWeight: 600, textAlign: 'right' }}>
                          📈 +{bench.yoyChange.toFixed(1)}% YoY
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>Avg: {fmt(market.avg_price || 0)} EGP</span>
                      <span style={{
                        padding: '2px 7px', borderRadius: '8px',
                        background: market.investment_score >= 70 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
                        color: market.investment_score >= 70 ? '#10b981' : '#f59e0b', fontWeight: 700,
                      }}>⭐ {market.investment_score}/100</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: DETAIL
      ═══════════════════════════════════════════ */}
      {activeTab === 'detail' && (
        <div>
          {!selectedMarket ? (
            <div style={{ padding: '48px', textAlign: 'center', borderRadius: '14px', border: '1px dashed var(--border)', background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📍</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Select a Market</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Click any city on the Heat Map or a card in Overview</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(() => {
                const t = TEMP[selectedMarket.temperature as keyof typeof TEMP]
                const insights = generateInsights(selectedMarket)
                const bench = MARKET_BENCHMARKS[selectedMarket.location]
                return (
                  <>
                    {/* Header */}
                    <div style={{ padding: '20px 24px', borderRadius: '14px', background: t?.bg, border: `1.5px solid ${t?.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            {bench?.emoji || t?.icon} {selectedMarket.location}
                          </h2>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Badge variant={getMarketSignalVariant(selectedMarket.market_signal)}>{selectedMarket.market_signal}</Badge>
                            <span style={{ fontSize: '0.78rem', color: t?.color, fontWeight: 700 }}>{selectedMarket.temperature?.toUpperCase()}</span>
                            {bench && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>📈 +{bench.yoyChange.toFixed(1)}% YoY</span>}
                            {bench && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>💰 {fmtSqm(bench.pricePerSqm[0])}–{fmtSqm(bench.pricePerSqm[1])}K EGP/m²</span>}
                            {bench && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8b5cf6' }}>🏠 {bench.rentYield.toFixed(1)}% yield</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Pressure', value: selectedMarket.pressure_index?.toFixed(2) + '×', color: t?.color },
                            { label: 'Supply',   value: (selectedMarket.supply || 0).toLocaleString(), color: '#0ea5e9' },
                            { label: 'Demand',   value: (selectedMarket.demand || 0).toLocaleString(), color: '#10b981' },
                            { label: 'Avg Price',value: fmt(selectedMarket.avg_price || 0) + ' EGP',   color: '#f59e0b' },
                            { label: 'ROI Score',value: (selectedMarket.investment_score || 0) + '/100', color: selectedMarket.investment_score >= 70 ? '#10b981' : '#f59e0b' },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Audience insights */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                      {([
                        { key: 'consultation', icon: '📊', label: 'Consultancy Brief', text: insights.consultation, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
                        { key: 'resale',       icon: '🏷️', label: 'Resale Intelligence', text: insights.resale, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                        { key: 'internal',     icon: '⭐', label: 'CPI Internal Signal', text: insights.internal, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                      ] as const).map(({ key, icon, label, text, color, bg }) => (
                        <div key={key} style={{
                          padding: '14px', borderRadius: '10px',
                          background: audience === key ? bg : 'rgba(0,0,0,0.15)',
                          border: `1px solid ${audience === key ? color + '40' : 'var(--border)'}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }} onClick={() => setAudience(key as any)}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {icon} {label}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</div>
                        </div>
                      ))}
                    </div>

                    {/* Radar + Momentum + Listings */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px' }}>
                      <Card title="📡 Market Profile" subtitle="6-dimension radar">
                        <ResponsiveContainer width="100%" height={250}>
                          <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                            <PolarGrid stroke="rgba(30,48,80,0.8)" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#4e6280', fontSize: 8 }} />
                            <Radar dataKey="value"
                              stroke={t?.color || '#0ea5e9'}
                              fill={t?.color || '#0ea5e9'}
                              fillOpacity={0.28} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </Card>

                      <Card title="🚀 Momentum Score" subtitle="Composite investment signal">
                        <MomentumGauge market={selectedMarket} />
                      </Card>

                      <Card title="🏢 Live Listings & Demand" subtitle={`Real WA data for ${selectedMarket.location}`}>
                        {locLoading ? (
                          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⟳</div>Loading live data…
                          </div>
                        ) : locationData ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0ea5e9', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🏠 Supply
                                {locationData.liveSupply > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '4px', padding: '1px 5px' }}>⚡ {locationData.liveSupply} live</span>}
                              </div>
                              {(locationData.supply?.data || []).slice(0, 5).map((item: any, i: number) => (
                                <div key={i} style={{ padding: '8px 10px', borderRadius: '7px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)', marginBottom: '6px' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                    {item.property_type || item.type || 'Property'} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                                    {item.price ? fmt(item.price) + ' EGP' : item.budget_max ? 'Budget: ' + fmt(item.budget_max) : '—'}
                                  </div>
                                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                    {item.purpose === 'rent' ? '🔑 Rent' : '🏷️ Sale'}
                                    {item.area_sqm ? ` · ${item.area_sqm}m²` : ''}
                                    {item.finishing ? ` · ${item.finishing}` : ''}
                                  </div>
                                </div>
                              ))}
                              {!(locationData.supply?.data || []).length && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '8px' }}>No live supply data for this location</div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                👥 Demand
                                {locationData.liveDemand > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '4px', padding: '1px 5px' }}>⚡ {locationData.liveDemand} live</span>}
                              </div>
                              {(locationData.demand?.data || []).slice(0, 5).map((item: any, i: number) => (
                                <div key={i} style={{ padding: '8px 10px', borderRadius: '7px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: '6px' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {item.sender ? `${item.sender} ` : ''}{item.property_type ? item.property_type : 'Buyer'} {item.bedrooms ? `· ${item.bedrooms}BR` : ''}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                                    {item.budget_max ? `Max ${fmt(item.budget_max)} EGP` : '—'}
                                    {item.urgent ? ' ⚡ Urgent' : ''}
                                  </div>
                                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                    {item.purpose === 'rent' ? '🔑 Rent' : '🏷️ Buy'}
                                    {item.contact ? <span style={{ color: '#25D366', marginLeft: '6px' }}>{item.contact}</span> : null}
                                  </div>
                                </div>
                              ))}
                              {!(locationData.demand?.data || []).length && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '8px' }}>No live demand data for this location</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No data available</div>
                        )}
                      </Card>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB: COMPARE
      ═══════════════════════════════════════════ */}
      {activeTab === 'compare' && (
        <Card title="⚡ Full Market Comparison Matrix" subtitle="All markets ranked by pressure — includes real 2025/2026 benchmark data · click row for details">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#','Location','Zone','Temp','Signal','Pressure ↓','Supply','Demand','Price/m²','YoY','Yield','Score','Action'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, textAlign: h === '#' ? 'center' : 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...enrichedMarkets]
                  .sort((a: any, b: any) => (b.pressure_index || 0) - (a.pressure_index || 0))
                  .map((m: any, i: number) => {
                    const p = m.pressure_index || 0
                    const t = TEMP[m.temperature as keyof typeof TEMP]
                    const bench = MARKET_BENCHMARKS[m.location]
                    const zc = ZONE_COLORS[m.benchZone] || { color: '#94a3b8', bg: '', border: '' }
                    return (
                      <tr key={i}
                        style={{ borderBottom: '1px solid rgba(30,48,80,0.4)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onClick={() => handleSelect(m)}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.04)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        <td style={{ padding: '9px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td style={{ padding: '9px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {bench?.emoji || ''} {m.location}
                          </div>
                        </td>
                        <td style={{ padding: '9px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: zc.color }}>{m.benchZone || '—'}</span>
                        </td>
                        <td style={{ padding: '9px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t?.color }}>{t?.icon} {m.temperature?.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '9px' }}>
                          <Badge variant={getMarketSignalVariant(m.market_signal)}>{m.market_signal || '—'}</Badge>
                        </td>
                        <td style={{ padding: '9px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: `${Math.min(p / 5 * 70, 70)}px`, height: 6, borderRadius: 3, background: t?.color, boxShadow: `0 0 4px ${t?.glow}` }} />
                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: t?.color }}>{p.toFixed(2)}×</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px', color: '#0ea5e9', fontWeight: 600, fontSize: '0.8rem' }}>{(m.supply || 0).toLocaleString()}</td>
                        <td style={{ padding: '9px', color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>{(m.demand || 0).toLocaleString()}</td>
                        <td style={{ padding: '9px', fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b' }}>
                          {bench ? `${fmtSqm(bench.pricePerSqm[0])}–${fmtSqm(bench.pricePerSqm[1])}K` : '—'}
                        </td>
                        <td style={{ padding: '9px', fontWeight: 700, fontSize: '0.8rem', color: bench?.yoyChange && bench.yoyChange > 15 ? '#10b981' : '#0ea5e9' }}>
                          {bench ? `+${bench.yoyChange.toFixed(1)}%` : (m.price_trend || '—')}
                        </td>
                        <td style={{ padding: '9px', fontWeight: 700, fontSize: '0.8rem', color: bench?.rentYield && bench.rentYield >= 8 ? '#10b981' : bench?.rentYield && bench.rentYield >= 6.5 ? '#f59e0b' : '#6366f1' }}>
                          {bench ? `${bench.rentYield.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '9px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700,
                            background: m.investment_score >= 70 ? 'rgba(16,185,129,0.15)' : m.investment_score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)',
                            color: m.investment_score >= 70 ? '#10b981' : m.investment_score >= 50 ? '#f59e0b' : '#6366f1',
                          }}>{m.investment_score}/100</span>
                        </td>
                        <td style={{ padding: '9px' }}>
                          <button style={{
                            fontSize: '0.65rem', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                            border: `1px solid ${t?.border || 'var(--border)'}`,
                            background: t?.bg || 'transparent', color: t?.color || 'var(--text-muted)',
                          }}>Analyze →</button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
          TAB: INSIGHTS
      ═══════════════════════════════════════════ */}
      {activeTab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Audience cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {([
              { key: 'consultation', icon: '📊', label: 'Consultation Firms', desc: 'Market reports, pressure analysis, price forecasting, JLL-grade narratives for advisory clients', color: '#0ea5e9' },
              { key: 'resale',       icon: '🏷️', label: 'Resale Companies',  desc: 'Qualified lead zones, days-on-market, conversion probability, active buyer identification', color: '#10b981' },
              { key: 'internal',     icon: '⭐', label: 'Crystal Power (CPI)',desc: 'Internal matching ROI, pipeline triggers, WA contact priorities, resource allocation signals', color: '#f59e0b' },
            ] as const).map(({ key, icon, label, desc, color }) => (
              <div key={key} onClick={() => setAudience(key)}
                style={{
                  padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  background: audience === key ? `${color}15` : 'rgba(0,0,0,0.15)',
                  border: `1.5px solid ${audience === key ? color + '50' : 'var(--border)'}`,
                }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: audience === key ? color : 'var(--text-primary)', marginBottom: '5px' }}>{label}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Key market stats banner */}
          <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🇪🇬 Egypt Market Context 2025/2026</div>
            {[
              ['Avg YoY Growth', '~17–25%'],
              ['New Cairo Price', '28–52K EGP/m²'],
              ['North Coast', '40–80K EGP/m²'],
              ['Alexandria', '20–35K EGP/m²'],
              ['Avg Rental Yield', '6.5–9.2%'],
              ['6th Oct Growth', '+20.5% YoY'],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>{value}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
              Sources: JLL MENA Q2 2025 · Aqarmap Trends 2025 · GlobalPropertyGuide Jan 2026
            </div>
          </div>

          {/* Market insight cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '14px' }}>
            {[...enrichedMarkets]
              .sort((a: any, b: any) => audience === 'resale'
                ? (b.demand || 0) - (a.demand || 0)
                : audience === 'internal'
                  ? (b.investment_score || 0) - (a.investment_score || 0)
                  : (b.benchYoy || b.pressure_index || 0) - (a.benchYoy || a.pressure_index || 0))
              .map((m: any, i: number) => {
                const t = TEMP[m.temperature as keyof typeof TEMP]
                const insights = generateInsights(m)
                const text = insights[audience]
                const bench = MARKET_BENCHMARKS[m.location]
                const isTopPick = i < 3
                return (
                  <div key={m.location} style={{
                    padding: '16px', borderRadius: '12px',
                    background: isTopPick ? t?.bg : 'rgba(0,0,0,0.15)',
                    border: `1px solid ${isTopPick ? t?.border : 'var(--border)'}`,
                    cursor: 'pointer',
                  }} onClick={() => handleSelect(m)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {isTopPick && ['🥇','🥈','🥉'][i]} {bench?.emoji || ''} {m.location}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: t?.color, fontWeight: 600 }}>
                          {t?.icon} {m.temperature?.toUpperCase()} · {m.pressure_index?.toFixed(2)}×
                          {bench && ` · +${bench.yoyChange.toFixed(1)}% YoY`}
                        </div>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, height: 'fit-content',
                        background: m.investment_score >= 70 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
                        color: m.investment_score >= 70 ? '#10b981' : '#f59e0b',
                      }}>⭐ {m.investment_score}/100</span>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 10px 0' }}>{text}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '5px', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>
                        ↑ {(m.demand || 0).toLocaleString()} demand
                      </span>
                      {bench && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '5px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          💰 {fmtSqm(bench.pricePerSqm[0])}–{fmtSqm(bench.pricePerSqm[1])}K/m²
                        </span>
                      )}
                      {bench && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '5px', background: bench.yoyChange > 20 ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.08)', color: bench.yoyChange > 20 ? '#10b981' : '#0ea5e9' }}>
                          📈 +{bench.yoyChange.toFixed(1)}% YoY
                        </span>
                      )}
                      {bench && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '5px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                          🏠 {bench.rentYield.toFixed(1)}% yield
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
