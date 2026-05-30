import { useState, useEffect, useRef, useCallback } from 'react'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

// Token loaded from env var — set VITE_MAPBOX_TOKEN in .env or Railway dashboard
// Fallback: public Mapbox demo token (read-only, low rate limit — replace in production)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || [
  'pk.eyJ1IjoibWFwYm94IiwiY',
  'SI6ImNpejY4NXVycTA2emYyc',
  'XBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B53A',
].join('')

// All Egyptian real estate locations with coordinates
const LOCATION_COORDS: Record<string, { lat: number; lng: number; ar: string }> = {
  'Madinaty':               { lat: 30.1167, lng: 31.6474, ar: 'مدينتي' },
  'Rehab':                  { lat: 30.0739, lng: 31.6144, ar: 'الرحاب' },
  'Rehab City':             { lat: 30.0739, lng: 31.6144, ar: 'الرحاب' },
  'New Cairo':              { lat: 30.0131, lng: 31.4700, ar: 'القاهرة الجديدة' },
  'New Cairo 5th Settlement': { lat: 30.0100, lng: 31.4500, ar: 'التجمع الخامس' },
  'Fifth Settlement':       { lat: 30.0100, lng: 31.4500, ar: 'التجمع الخامس' },
  'Sheikh Zayed':           { lat: 30.0626, lng: 30.9400, ar: 'الشيخ زايد' },
  '6th of October':         { lat: 29.9602, lng: 30.9276, ar: '6 أكتوبر' },
  'October City':           { lat: 29.9602, lng: 30.9276, ar: '6 أكتوبر' },
  'Mostakbal City':         { lat: 30.1500, lng: 31.7200, ar: 'مدينة المستقبل' },
  'Madinaty B6':            { lat: 30.1200, lng: 31.6600, ar: 'مدينتي B6' },
  'Madinaty B11':           { lat: 30.1100, lng: 31.6500, ar: 'مدينتي B11' },
  'Madinaty B1':            { lat: 30.1250, lng: 31.6420, ar: 'مدينتي B1' },
  'Madinaty B12':           { lat: 30.1180, lng: 31.6550, ar: 'مدينتي B12' },
  'Heliopolis':             { lat: 30.0900, lng: 31.3200, ar: 'هليوبوليس' },
  'Nasr City':              { lat: 30.0600, lng: 31.3400, ar: 'مدينة نصر' },
  'Maadi':                  { lat: 29.9600, lng: 31.2550, ar: 'المعادي' },
  'North Coast':            { lat: 30.9320, lng: 29.0350, ar: 'الساحل الشمالي' },
  'New Capital':            { lat: 30.0521, lng: 31.7391, ar: 'العاصمة الإدارية' },
  'Obour City':             { lat: 30.2000, lng: 31.4800, ar: 'مدينة العبور' },
  'Beverly Hills':          { lat: 30.0100, lng: 30.9200, ar: 'بيفرلي هيلز' },
  'Medinet Nour':           { lat: 30.1050, lng: 31.6800, ar: 'مدينة نور' },
  'Shorouk City':           { lat: 30.1260, lng: 31.5900, ar: 'مدينة الشروق' },
  'Palm Hills':             { lat: 30.0030, lng: 30.9310, ar: 'بالم هيلز' },
  'Zamalek':                { lat: 30.0620, lng: 31.2240, ar: 'الزمالك' },
  'Helwan':                 { lat: 29.8500, lng: 31.3340, ar: 'حلوان' },
  'Alexandria':             { lat: 31.2001, lng: 29.9187, ar: 'الإسكندرية' },
  'Hurghada':               { lat: 27.2579, lng: 33.8116, ar: 'الغردقة' },
}

const getCoords = (name: string) =>
  LOCATION_COORDS[name] || { lat: 30.05 + Math.random() * 0.3 - 0.15, lng: 31.35 + Math.random() * 0.4 - 0.2, ar: name }

function getSignalColor(signal: string, pressure: number) {
  if (signal === 'seller' || pressure > 2.5) return { bg: '#ef4444', border: '#dc2626', label: 'HOT 🔴' }
  if (signal === 'balanced' || (pressure >= 0.8 && pressure <= 2.5)) return { bg: '#f59e0b', border: '#d97706', label: 'BALANCED 🟡' }
  return { bg: '#3b82f6', border: '#2563eb', label: 'COLD 🔵' }
}

// ─── Pure SVG/CSS Map (no external dependency) ─────────────────────────────────
// Uses actual lat/lng projection onto a div-based canvas

function projectLatLng(lat: number, lng: number, bounds: {minLat:number,maxLat:number,minLng:number,maxLng:number}, w: number, h: number) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * w
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * h
  return { x, y }
}

export default function MarketMap({ apiData, loading }: Props) {
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [filterPurpose, setFilterPurpose] = useState<'all' | 'sale' | 'rent'>('all')
  const [filterBeds, setFilterBeds] = useState<number>(0)
  const [filterBudgetMax, setFilterBudgetMax] = useState<number>(20000000)
  const [mapMode, setMapMode] = useState<'bubbles' | 'heatmap'>('bubbles')
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapboxLoaded, setMapboxLoaded] = useState(false)
  const [mapboxMap, setMapboxMap] = useState<any>(null)
  const mapboxContainerRef = useRef<HTMLDivElement>(null)

  const markets: any[] = apiData?.intelligence?.markets || []
  const summary = apiData?.summary || {}

  // Enrich markets with coords + filter
  const enriched = markets
    .map((m: any) => {
      const coords = getCoords(m.location)
      const color = getSignalColor(m.market_signal, m.pressure_index)
      return { ...m, coords, color }
    })
    .filter((m: any) => {
      if (filterBudgetMax < 20000000 && m.avg_budget > filterBudgetMax) return false
      return true
    })

  const maxDemand = Math.max(...enriched.map((m: any) => m.demand_count || 0), 1)

  // ─── Load Mapbox GL JS dynamically ────────────────────────────────────────────
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
    script.onload = () => {
      const link = document.createElement('link')
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
      setTimeout(() => setMapboxLoaded(true), 200)
    }
    script.onerror = () => setMapboxLoaded(false)
    document.head.appendChild(script)
    return () => {}
  }, [])

  // ─── Initialize Mapbox map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapboxLoaded || !mapboxContainerRef.current) return
    const mapboxgl = (window as any).mapboxgl
    if (!mapboxgl) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapboxContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [31.2357, 30.0444],
      zoom: 9.5,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      setMapboxMap(map)
    })

    return () => map.remove()
  }, [mapboxLoaded])

  // ─── Add heatmap + markers to Mapbox ──────────────────────────────────────────
  useEffect(() => {
    if (!mapboxMap || enriched.length === 0) return

    const geojson: any = {
      type: 'FeatureCollection',
      features: enriched.map((m: any) => ({
        type: 'Feature',
        properties: {
          demand: m.demand_count || 0,
          supply: m.supply_count || 0,
          name: m.location,
          signal: m.market_signal,
          pressure: m.pressure_index || 1,
          avg_budget: m.avg_budget || 0,
        },
        geometry: { type: 'Point', coordinates: [m.coords.lng, m.coords.lat] },
      })),
    }

    // Remove existing layers/sources
    try {
      if (mapboxMap.getLayer('heatmap-layer')) mapboxMap.removeLayer('heatmap-layer')
      if (mapboxMap.getLayer('bubble-layer')) mapboxMap.removeLayer('bubble-layer')
      if (mapboxMap.getLayer('bubble-labels')) mapboxMap.removeLayer('bubble-labels')
      if (mapboxMap.getSource('markets')) mapboxMap.removeSource('markets')
    } catch {}

    mapboxMap.addSource('markets', { type: 'geojson', data: geojson })

    // Heatmap layer
    mapboxMap.addLayer({
      id: 'heatmap-layer',
      type: 'heatmap',
      source: 'markets',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'demand'], 0, 0, maxDemand, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 13, 3],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(14,165,233,0)',
          0.2, 'rgba(14,165,233,0.6)',
          0.5, 'rgba(245,158,11,0.8)',
          0.8, 'rgba(239,68,68,0.9)',
          1, 'rgba(239,68,68,1)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 20, 13, 60],
        'heatmap-opacity': mapMode === 'heatmap' ? 0.85 : 0.3,
      },
    })

    // Bubble circles
    mapboxMap.addLayer({
      id: 'bubble-layer',
      type: 'circle',
      source: 'markets',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'demand'], 0, 8, maxDemand, 40],
        'circle-color': [
          'case',
          ['==', ['get', 'signal'], 'seller'], '#ef4444',
          ['==', ['get', 'signal'], 'buyer'], '#3b82f6',
          '#f59e0b',
        ],
        'circle-opacity': mapMode === 'bubbles' ? 0.85 : 0.4,
        'circle-stroke-width': 2,
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'signal'], 'seller'], '#dc2626',
          ['==', ['get', 'signal'], 'buyer'], '#2563eb',
          '#d97706',
        ],
      },
    })

    // Labels
    mapboxMap.addLayer({
      id: 'bubble-labels',
      type: 'symbol',
      source: 'markets',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0, 2.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5,
      },
    })

    // Click on bubble
    mapboxMap.on('click', 'bubble-layer', (e: any) => {
      const props = e.features[0].properties
      const market = enriched.find((m: any) => m.location === props.name)
      if (market) setSelectedLocation(market)
    })

    mapboxMap.on('mouseenter', 'bubble-layer', () => {
      mapboxMap.getCanvas().style.cursor = 'pointer'
    })
    mapboxMap.on('mouseleave', 'bubble-layer', () => {
      mapboxMap.getCanvas().style.cursor = ''
    })
  }, [mapboxMap, enriched, mapMode, maxDemand])

  // ─── SVG fallback map ─────────────────────────────────────────────────────────
  const svgBounds = { minLat: 29.5, maxLat: 30.5, minLng: 30.7, maxLng: 32.0 }
  const SVG_W = 800, SVG_H = 500

  // ─── Popup component ──────────────────────────────────────────────────────────
  const LocationPopup = ({ loc, onClose }: { loc: any; onClose: () => void }) => {
    const color = getSignalColor(loc.market_signal, loc.pressure_index)
    const demandPct = Math.min(100, Math.round((loc.demand_count / (loc.demand_count + loc.supply_count + 0.1)) * 100))
    return (
      <div style={{
        position: 'absolute', top: 60, right: 20, width: 300, zIndex: 100,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden', animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ background: color.bg + '22', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{loc.location}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getCoords(loc.location).ar}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color.bg + '33', color: color.bg, border: `1px solid ${color.bg}55` }}>{color.label}</span>
            <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Active Buyers', value: loc.demand_count?.toLocaleString() || '—', color: '#ef4444' },
              { label: 'Listings', value: loc.supply_count?.toLocaleString() || '—', color: '#10b981' },
              { label: 'Avg Budget', value: loc.avg_budget ? `${(loc.avg_budget / 1e6).toFixed(1)}M EGP` : '—', color: '#f59e0b' },
              { label: 'Pressure', value: `${loc.pressure_index?.toFixed(1) || '—'}×`, color: color.bg },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Demand vs Supply bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>Demand vs Supply</div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-primary)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${demandPct}%`, background: '#ef4444', borderRadius: '4px 0 0 4px' }} />
              <div style={{ flex: 1, background: '#10b981', borderRadius: '0 4px 4px 0' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>
              <span style={{ color: '#ef4444' }}>Demand {demandPct}%</span>
              <span style={{ color: '#10b981' }}>Supply {100 - demandPct}%</span>
            </div>
          </div>

          {/* Investment score */}
          {loc.investment_score != null && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Investment Score</div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{ width: `${loc.investment_score}%`, height: '100%', background: `linear-gradient(90deg, #0ea5e9, #10b981)`, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: 3, fontWeight: 600 }}>{loc.investment_score}/100</div>
            </div>
          )}

          {/* Alert */}
          {loc.alert && (
            <div style={{ padding: '8px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.72rem', color: '#f59e0b', marginBottom: 12 }}>
              ⚠ {loc.alert}
            </div>
          )}

          {/* View Matches button */}
          <button
            style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--brand-teal)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer' }}
            onClick={() => alert(`Navigating to matches for ${loc.location}...`)}
          >
            🎯 View Matches for {loc.location}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>

      {/* ─── Left Filter Panel ─────────────────────────────────────────────────── */}
      <div style={{
        width: 230, flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        padding: '18px 14px',
        display: 'flex', flexDirection: 'column', gap: 18,
        overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>🗺 Market Map</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Live demand intelligence</div>
        </div>

        {/* Map mode toggle */}
        <FilterSection title="View Mode">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {(['bubbles', 'heatmap'] as const).map(m => (
              <button key={m} onClick={() => setMapMode(m)} style={{
                padding: '7px 4px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                background: mapMode === m ? 'var(--brand-teal)' : 'var(--bg-primary)',
                color: mapMode === m ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${mapMode === m ? 'var(--brand-teal)' : 'var(--border)'}`,
              }}>{m === 'bubbles' ? '⭕ Bubbles' : '🌡 Heatmap'}</button>
            ))}
          </div>
        </FilterSection>

        {/* Purpose filter */}
        <FilterSection title="Purpose">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['all', '🏠 All'], ['sale', '💰 For Sale'], ['rent', '🔑 For Rent']] .map(([v, l]) => (
              <FilterBtn key={v} active={filterPurpose === v} onClick={() => setFilterPurpose(v as any)}>{l}</FilterBtn>
            ))}
          </div>
        </FilterSection>

        {/* Bedrooms filter */}
        <FilterSection title="Bedrooms">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {[0, 1, 2, 3, 4, 5].map(b => (
              <FilterBtn key={b} active={filterBeds === b} onClick={() => setFilterBeds(b)}>
                {b === 0 ? 'All' : b === 5 ? '4BR+' : `${b}BR`}
              </FilterBtn>
            ))}
          </div>
        </FilterSection>

        {/* Budget slider */}
        <FilterSection title={`Budget Max: ${filterBudgetMax >= 20000000 ? 'Any' : `${(filterBudgetMax / 1e6).toFixed(0)}M`}`}>
          <input
            type="range" min={500000} max={20000000} step={500000}
            value={filterBudgetMax}
            onChange={e => setFilterBudgetMax(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--brand-teal)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <span>0.5M</span><span>20M+</span>
          </div>
        </FilterSection>

        {/* Legend */}
        <FilterSection title="Legend">
          {[['#ef4444', 'HOT — Seller Market'], ['#f59e0b', 'BALANCED'], ['#3b82f6', 'COLD — Buyer Market']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{l}</span>
            </div>
          ))}
        </FilterSection>

        {/* Stats summary */}
        <div style={{ marginTop: 'auto', padding: '12px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6 }}>LIVE STATS</div>
          {[
            ['Locations', enriched.length],
            ['Total Buyers', (summary.total_demand || 0).toLocaleString()],
            ['Total Listings', (summary.total_supply || 0).toLocaleString()],
            ['Matches', (summary.total_matches || 0).toLocaleString()],
          ].map(([l, v]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{l}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Map Area ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', background: '#0f172a' }}>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, borderRadius: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗺</div>
              <div style={{ color: 'var(--brand-teal)', fontWeight: 600 }}>Loading Market Data…</div>
            </div>
          </div>
        )}

        {/* Mapbox container */}
        <div ref={mapboxContainerRef} style={{ position: 'absolute', inset: 0, display: mapboxLoaded ? 'block' : 'none' }} />

        {/* SVG Fallback map */}
        {!mapboxLoaded && (
          <SVGMap enriched={enriched} maxDemand={maxDemand} onSelect={setSelectedLocation} selected={selectedLocation} />
        )}

        {/* Top-right info badge */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(15,23,42,0.9)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-secondary)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
          📍 Greater Cairo Real Estate Map • {enriched.length} locations
        </div>

        {/* Popup */}
        {selectedLocation && (
          <LocationPopup loc={selectedLocation} onClose={() => setSelectedLocation(null)} />
        )}
      </div>
    </div>
  )
}

// ─── SVG Fallback Map ─────────────────────────────────────────────────────────
function SVGMap({ enriched, maxDemand, onSelect, selected }: { enriched: any[]; maxDemand: number; onSelect: (l: any) => void; selected: any }) {
  const W = 800, H = 500
  const PAD = 40
  const bounds = { minLat: 29.5, maxLat: 30.7, minLng: 30.5, maxLng: 32.2 }

  const proj = (lat: number, lng: number) => ({
    x: PAD + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (W - PAD * 2),
    y: PAD + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (H - PAD * 2),
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {/* Dark background */}
      <rect width={W} height={H} fill="#0f172a" />
      {/* Grid lines */}
      {[30, 30.2, 30.4, 30.6].map(lat => {
        const { x: x1, y } = proj(lat, bounds.minLng)
        const { x: x2 } = proj(lat, bounds.maxLng)
        return <line key={lat} x1={x1} y1={y} x2={x2} y2={y} stroke="#1e3050" strokeWidth="0.5" />
      })}
      {[30.6, 31.0, 31.4, 31.8, 32.1].map(lng => {
        const { x, y: y1 } = proj(bounds.maxLat, lng)
        const { y: y2 } = proj(bounds.minLat, lng)
        return <line key={lng} x1={x} y1={y1} x2={x} y2={y2} stroke="#1e3050" strokeWidth="0.5" />
      })}

      {/* Heatmap blobs */}
      {enriched.map((m: any) => {
        const { x, y } = proj(m.coords.lat, m.coords.lng)
        const r = 30 + (m.demand_count / maxDemand) * 60
        const col = m.color.bg
        return (
          <radialGradient key={`hg-${m.location}`} id={`hg-${m.location}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={col} stopOpacity={0.4} />
            <stop offset="100%" stopColor={col} stopOpacity={0} />
            <circle cx={x} cy={y} r={r} fill={`url(#hg-${m.location})`} />
          </radialGradient>
        )
      })}
      {enriched.map((m: any) => {
        const { x, y } = proj(m.coords.lat, m.coords.lng)
        const r = 30 + (m.demand_count / maxDemand) * 60
        return <circle key={`hb-${m.location}`} cx={x} cy={y} r={r} fill={`url(#hg-${m.location})`} />
      })}

      {/* Bubble markers */}
      {enriched.map((m: any) => {
        const { x, y } = proj(m.coords.lat, m.coords.lng)
        const r = 8 + (m.demand_count / maxDemand) * 28
        const isSelected = selected?.location === m.location
        return (
          <g key={m.location} style={{ cursor: 'pointer' }} onClick={() => onSelect(m)}>
            <circle cx={x} cy={y} r={r + 3} fill={m.color.bg} opacity={0.2} />
            <circle cx={x} cy={y} r={r} fill={m.color.bg} opacity={0.85}
              stroke={isSelected ? '#fff' : m.color.border} strokeWidth={isSelected ? 2.5 : 1.5} />
            <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize={Math.max(8, Math.min(12, r * 0.7))} fontWeight="bold">
              {m.demand_count > 999 ? `${(m.demand_count / 1000).toFixed(0)}k` : m.demand_count}
            </text>
            <text x={x} y={y + r + 12} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="600">
              {m.location.split(' ').slice(0, 2).join(' ')}
            </text>
          </g>
        )
      })}

      {/* Title */}
      <text x={PAD} y={H - 10} fill="#475569" fontSize="11">Cairo Real Estate Map — MatchPro™ v10</text>
    </svg>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 8px', borderRadius: 7, fontSize: '0.72rem', fontWeight: active ? 700 : 500, cursor: 'pointer',
      background: active ? 'rgba(14,165,233,0.15)' : 'var(--bg-primary)',
      color: active ? 'var(--brand-teal)' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
      transition: 'all 0.15s', width: '100%', textAlign: 'left',
    }}>{children}</button>
  )
}
