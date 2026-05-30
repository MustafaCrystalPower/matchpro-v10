import { useState, useEffect, useRef, useCallback } from 'react'

<<<<<<< HEAD
// ─── Location data (lat/lng pinned to accurate city centers) ─────────────────
const LOCATIONS = [
  { id: 'madinaty',      name: 'Madinaty',         nameAr: 'مدينتي',           lat: 30.1167, lng: 31.6474, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: 'rehab',         name: 'Rehab City',        nameAr: 'الرحاب',           lat: 30.0739, lng: 31.6144, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: 'new-cairo',     name: 'New Cairo',         nameAr: 'القاهرة الجديدة',  lat: 30.0131, lng: 31.4700, demand: 0, supply: 0, avgBudget: 0, signal: 'hot'      as MarketSignal },
  { id: 'sheikh-zayed',  name: 'Sheikh Zayed',      nameAr: 'الشيخ زايد',       lat: 30.0626, lng: 30.9400, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: '6th-october',   name: '6th October',       nameAr: 'السادس من أكتوبر', lat: 29.9602, lng: 30.9276, demand: 0, supply: 0, avgBudget: 0, signal: 'cold'     as MarketSignal },
  { id: 'mostakbal',     name: 'Mostakbal City',    nameAr: 'مدينة المستقبل',   lat: 30.1500, lng: 31.7200, demand: 0, supply: 0, avgBudget: 0, signal: 'hot'      as MarketSignal },
  { id: 'heliopolis',    name: 'Heliopolis',        nameAr: 'مصر الجديدة',      lat: 30.0900, lng: 31.3200, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: 'nasr-city',     name: 'Nasr City',         nameAr: 'مدينة نصر',        lat: 30.0600, lng: 31.3400, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: 'obour',         name: 'Obour City',        nameAr: 'مدينة العبور',     lat: 30.2000, lng: 31.4800, demand: 0, supply: 0, avgBudget: 0, signal: 'cold'     as MarketSignal },
  { id: 'fifth',         name: '5th Settlement',    nameAr: 'التجمع الخامس',    lat: 30.0100, lng: 31.4500, demand: 0, supply: 0, avgBudget: 0, signal: 'hot'      as MarketSignal },
  { id: 'zamalek',       name: 'Zamalek',           nameAr: 'الزمالك',          lat: 30.0626, lng: 31.2197, demand: 0, supply: 0, avgBudget: 0, signal: 'balanced' as MarketSignal },
  { id: 'tagamoa',       name: 'El Tagamoa',        nameAr: 'التجمع',           lat: 30.0270, lng: 31.4600, demand: 0, supply: 0, avgBudget: 0, signal: 'hot'      as MarketSignal },
]

type MarketSignal = 'hot' | 'balanced' | 'cold'
type FilterPurpose = 'all' | 'sale' | 'rent'
type FilterBedrooms = 'all' | '1' | '2' | '3' | '4+'
type MapStyle = 'satellite' | 'dark' | 'streets'

interface LocationData {
  id: string; name: string; nameAr: string
  lat: number; lng: number
  demand: number; supply: number; avgBudget: number
  signal: MarketSignal
  topTypes?: string[]
  priceMin?: number; priceMax?: number
  realDemand?: number; realSupply?: number
}

// ─── Signal helpers ───────────────────────────────────────────────────────────
const signalColor = (s: MarketSignal, alpha = 1) => ({
  hot:      `rgba(239,68,68,${alpha})`,
  balanced: `rgba(234,179,8,${alpha})`,
  cold:     `rgba(59,130,246,${alpha})`,
}[s])

const signalEmoji = (s: MarketSignal) => ({ hot: '🔴', balanced: '🟡', cold: '🔵' }[s])
const signalLabel = (s: MarketSignal) => ({ hot: 'HOT', balanced: 'BALANCED', cold: 'COLD' }[s])

// ─── Map style configs ────────────────────────────────────────────────────────
const MAP_STYLES: Record<MapStyle, { mapbox: string; leaflet: string; label: string; icon: string }> = {
  satellite: {
    mapbox:  'mapbox://styles/mapbox/satellite-streets-v12',
    leaflet: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    label:   'Satellite',
    icon:    '🛰️',
  },
  dark: {
    mapbox:  'mapbox://styles/mapbox/dark-v11',
    leaflet: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    label:   'Dark',
    icon:    '🌙',
  },
  streets: {
    mapbox:  'mapbox://styles/mapbox/streets-v12',
    leaflet: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    label:   'Streets',
    icon:    '🗺️',
  },
}

// ─── Leaflet Map ──────────────────────────────────────────────────────────────
function LeafletMap({ locations, onSelect, selected, mapStyle }: {
  locations: LocationData[]; onSelect: (l: LocationData) => void
  selected: LocationData | null; mapStyle: MapStyle
}) {
  const mapRef     = useRef<any>(null)
  const divRef     = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const tileRef    = useRef<any>(null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    import('leaflet').then(L => {
      const map = L.map(divRef.current!, {
        center: [30.0444, 31.2357], zoom: 10,
        zoomControl: true, attributionControl: false,
      })
      const cfg = MAP_STYLES[mapStyle]
      tileRef.current = L.tileLayer(cfg.leaflet, {
        subdomains: mapStyle === 'dark' ? 'abcd' : 'abc',
        maxZoom: 19,
        attribution: mapStyle === 'satellite' ? '© Esri' : '',
      }).addTo(map)
      mapRef.current = map
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tile layer when style changes
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      if (tileRef.current) { mapRef.current.removeLayer(tileRef.current); tileRef.current = null }
      const cfg = MAP_STYLES[mapStyle]
      tileRef.current = L.tileLayer(cfg.leaflet, {
        subdomains: mapStyle === 'dark' ? 'abcd' : 'abc', maxZoom: 19,
      }).addTo(mapRef.current)
    })
  }, [mapStyle])

  // Re-draw markers
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      locations.forEach(loc => {
        const r = Math.max(14, Math.min(44, 14 + (loc.demand / 10)))
        const col = signalColor(loc.signal)
        const isSel = selected?.id === loc.id
        const hasReal = (loc.realDemand || 0) > 0 || (loc.realSupply || 0) > 0
        const svg = `<svg width="${r*2}" height="${r*2}" viewBox="0 0 ${r*2} ${r*2}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${r}" cy="${r}" r="${r-2}" fill="${col}" fill-opacity="0.88"
            stroke="${isSel ? '#fff' : hasReal ? '#ffed4a' : col}" stroke-width="${isSel ? 3 : hasReal ? 2.5 : 1.5}"/>
          <text x="${r}" y="${r+4}" text-anchor="middle" fill="white" font-size="11" font-weight="800" font-family="sans-serif">${loc.demand}</text>
          <text x="${r}" y="${r+14}" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="7" font-family="sans-serif">${loc.name.split(' ')[0]}</text>
        </svg>`
        const icon = L.divIcon({ className: '', html: svg, iconSize: [r*2, r*2], iconAnchor: [r, r] })
        const marker = L.marker([loc.lat, loc.lng], { icon })
          .addTo(mapRef.current).on('click', () => onSelect(loc))
        markersRef.current.push(marker)
      })
    })
  }, [locations, selected, onSelect])

  return <div ref={divRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
}

// ─── Mapbox Map ───────────────────────────────────────────────────────────────
function MapboxMap({ locations, onSelect, selected, token, mapStyle }: {
  locations: LocationData[]; onSelect: (l: LocationData) => void
  selected: LocationData | null; token: string; mapStyle: MapStyle
}) {
  const mapRef    = useRef<any>(null)
  const divRef    = useRef<HTMLDivElement>(null)
  const markElems = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    if (!document.getElementById('mapbox-css')) {
      const link = document.createElement('link')
      link.id = 'mapbox-css'; link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    import('mapbox-gl').then(mapboxgl => {
      mapboxgl.default.accessToken = token
      const map = new mapboxgl.default.Map({
        container: divRef.current!,
        style: MAP_STYLES[mapStyle].mapbox,
        center: [31.2357, 30.0444],
        zoom: 9.5,
        attributionControl: false,
        logoPosition: 'bottom-right',
        pitch: mapStyle === 'satellite' ? 30 : 0,   // slight tilt for satellite — more Google Maps feel
        bearing: 0,
      })

      // Add navigation controls
      import('mapbox-gl').then(mb => {
        map.addControl(new mb.default.NavigationControl({ visualizePitch: true }), 'bottom-right')
        map.addControl(new mb.default.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
        map.addControl(new mb.default.FullscreenControl(), 'top-right')
      })

      mapRef.current = map

      map.on('load', () => {
        // ── Heatmap layer ─────────────────────────────────────────────
        const heatGeoJSON: any = {
          type: 'FeatureCollection',
          features: locations.map(loc => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
            properties: { demand: loc.demand, supply: loc.supply, signal: loc.signal },
          }))
        }
        map.addSource('heat-source', { type: 'geojson', data: heatGeoJSON })
        map.addLayer({
          id:     'heatmap-layer',
          type:   'heatmap',
          source: 'heat-source',
          paint: {
            'heatmap-weight':     ['interpolate', ['linear'], ['get', 'demand'], 0, 0, 2000, 1],
            'heatmap-intensity':  ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 4],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,    'rgba(0,0,255,0)',
              0.15, 'rgba(0,80,255,0.5)',
              0.35, 'rgba(0,200,255,0.65)',
              0.55, 'rgba(0,255,140,0.75)',
              0.75, 'rgba(255,220,0,0.85)',
              0.9,  'rgba(255,100,0,0.92)',
              1,    'rgba(255,0,0,1)',
            ],
            'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 5, 25, 15, 80],
            'heatmap-opacity': mapStyle === 'satellite' ? 0.55 : 0.70,
          }
        })

        // ── Bubble markers ────────────────────────────────────────────
        locations.forEach(loc => {
          const r = Math.max(20, Math.min(54, 20 + (loc.demand / 7)))
          const hasReal = (loc.realDemand || 0) > 0 || (loc.realSupply || 0) > 0
          const el = document.createElement('div')
          el.style.cssText = `
            width:${r*2}px; height:${r*2}px; border-radius:50%;
            background: radial-gradient(circle at 35% 35%, ${signalColor(loc.signal, 0.95)}, ${signalColor(loc.signal, 0.6)});
            border:${hasReal ? '3px solid #fbbf24' : `2px solid ${signalColor(loc.signal)}`};
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            cursor:pointer; transition:transform 0.18s, box-shadow 0.18s;
            box-shadow: 0 0 ${r}px ${signalColor(loc.signal, 0.45)},
                        0 2px 12px rgba(0,0,0,0.6),
                        inset 0 1px 0 rgba(255,255,255,0.2);
            backdrop-filter: blur(4px);
          `
          el.innerHTML = `
            <span style="font-size:${r > 28 ? 14 : 11}px;font-weight:800;color:#fff;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,0.8)">${loc.demand}</span>
            <span style="font-size:${r > 28 ? 9 : 7}px;color:rgba(255,255,255,0.85);line-height:1.3;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.7)">${loc.name.split(' ')[0]}</span>
            ${hasReal ? `<span style="font-size:7px;color:#fbbf24;line-height:1">●LIVE</span>` : ''}
          `
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.22)'
            el.style.zIndex = '100'
            el.style.boxShadow = `0 0 ${r*1.5}px ${signalColor(loc.signal, 0.7)}, 0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.3)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)'
            el.style.zIndex = ''
            el.style.boxShadow = `0 0 ${r}px ${signalColor(loc.signal, 0.45)}, 0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2)`
          })
          el.addEventListener('click', () => onSelect(loc))
          markElems.current.set(loc.id, el)

          new mapboxgl.default.Marker({ element: el, anchor: 'center' })
            .setLngLat([loc.lng, loc.lat])
            .addTo(map)
        })
      })
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markElems.current.clear() } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update selection ring
  useEffect(() => {
    markElems.current.forEach((el, id) => {
      const loc = locations.find(l => l.id === id)
      if (!loc) return
      el.style.border = selected?.id === id
        ? '3px solid #ffffff'
        : (loc.realDemand || 0) > 0 || (loc.realSupply || 0) > 0
          ? '3px solid #fbbf24'
          : `2px solid ${signalColor(loc.signal)}`
      el.style.transform = selected?.id === id ? 'scale(1.15)' : 'scale(1)'
    })
  }, [selected, locations])

  return <div ref={divRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
}

// ─── Location Popup ───────────────────────────────────────────────────────────
function LocationPopup({ loc, onClose, onViewMatches }: {
  loc: LocationData; onClose: () => void; onViewMatches: (loc: LocationData) => void
}) {
  const total         = loc.demand + loc.supply
  const dPct          = total > 0 ? Math.round((loc.demand / total) * 100) : 50
  const sPct          = 100 - dPct
  const pressureRatio = loc.supply > 0 ? (loc.demand / loc.supply).toFixed(1) : '∞'
  const types         = loc.topTypes || ['Apartment', 'Duplex', 'Villa']
  const budgetK       = loc.avgBudget >= 1_000_000 ? `${(loc.avgBudget/1_000_000).toFixed(1)}M` : `${Math.round(loc.avgBudget/1_000)}K`
  const hasRealData   = (loc.realDemand || 0) > 0 || (loc.realSupply || 0) > 0

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20, width: 330, zIndex: 1000,
      background: 'linear-gradient(135deg,rgba(6,10,24,0.98),rgba(12,18,38,0.98))',
      border: `1px solid ${signalColor(loc.signal, 0.6)}`,
      borderRadius: 16, padding: 20, boxShadow: `0 0 50px ${signalColor(loc.signal, 0.25)}, 0 10px 40px rgba(0,0,0,0.7)`,
      backdropFilter: 'blur(24px)',
    }}>
      {/* Data source badge */}
      {hasRealData && (
        <div style={{ position: 'absolute', top: -10, left: 16, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', color: '#000', borderRadius: 10, padding: '2px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
          ● LIVE DATA
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{loc.name}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', direction: 'rtl' }}>{loc.nameAr}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: signalColor(loc.signal, 0.18), color: signalColor(loc.signal),
            border: `1px solid ${signalColor(loc.signal, 0.5)}`,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
          }}>{signalEmoji(loc.signal)} {signalLabel(loc.signal)}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 8, width: 28, height: 28, fontSize: 16, lineHeight: '28px' }}>×</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Buyers', value: loc.demand, sub: hasRealData ? `+${loc.realDemand} live` : null, color: '#ef4444' },
          { label: 'Listings', value: loc.supply, sub: hasRealData ? `+${loc.realSupply} live` : null, color: '#0ea5e9' },
          { label: 'Pressure', value: pressureRatio + 'x', sub: null, color: signalColor(loc.signal) },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
            {sub && <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Demand vs Supply bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: '#ef4444' }}>🔴 Demand {dPct}%</span>
          <span style={{ color: '#0ea5e9' }}>Supply {sPct}% 🔵</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ width: `${dPct}%`, background: 'linear-gradient(90deg,#ef4444,#f97316)', transition: 'width 0.5s' }} />
          <div style={{ width: `${sPct}%`, background: 'linear-gradient(90deg,#3b82f6,#0ea5e9)', transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Avg budget + price range */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 3 }}>Avg Budget</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>EGP {budgetK}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 3 }}>Price Range</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            {loc.priceMin ? `${(loc.priceMin/1e6).toFixed(1)}M – ${((loc.priceMax||0)/1e6).toFixed(1)}M` : 'Varies'}
          </div>
        </div>
      </div>

      {/* Top property types */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Top Property Types</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {types.map((t: string) => (
            <span key={t} style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}>{t}</span>
=======
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
>>>>>>> origin/main
          ))}
        </div>
      </div>

<<<<<<< HEAD
      {/* Demand/Supply mini-chart */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Market Balance</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 52 }}>
          {[
            { label: 'Demand', value: loc.demand, color: '#ef4444' },
            { label: 'Supply', value: loc.supply, color: '#0ea5e9' },
          ].map(({ label, value, color }) => {
            const max = Math.max(loc.demand, loc.supply, 1)
            const h = Math.max(8, Math.round((value / max) * 100))
            return (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ fontSize: 10, color, fontWeight: 700 }}>{value}</div>
                <div style={{ width: '100%', height: `${h}%`, background: `linear-gradient(180deg,${color},${color}88)`, borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }} />
                <div style={{ fontSize: 9, color: '#64748b' }}>{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={() => onViewMatches(loc)}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
          background: `linear-gradient(135deg,${signalColor(loc.signal)},${signalColor(loc.signal, 0.55)})`,
          color: '#fff', fontSize: 14, transition: 'opacity 0.2s, transform 0.1s',
          boxShadow: `0 4px 14px ${signalColor(loc.signal, 0.4)}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(0.98)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        🎯 View Matches in {loc.name}
      </button>
    </div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({
  purpose, setPurpose, bedrooms, setBedrooms,
  budget, setBudget, locType, setLocType,
}: {
  purpose: FilterPurpose; setPurpose: (v: FilterPurpose) => void
  bedrooms: FilterBedrooms; setBedrooms: (v: FilterBedrooms) => void
  budget: [number, number]; setBudget: (v: [number, number]) => void
  locType: string; setLocType: (v: string) => void
}) {
  const BtnGroup = <T extends string>({ label, opts, current, set }: { label: string; opts: { label: string; value: T }[]; current: T; set: (v: T) => void }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 5, letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {opts.map(({ label: l, value }) => (
          <button key={value} onClick={() => set(value)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            background: current === value ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.04)',
            border: current === value ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
            color: current === value ? '#0ea5e9' : '#94a3b8',
          }}>{l}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', top: 20, left: 20, width: 220, zIndex: 999,
      background: 'rgba(6,10,24,0.96)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 16, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        🔍 Filter Map
      </div>
      <BtnGroup label="Purpose" opts={[
        { label: 'All', value: 'all' as FilterPurpose },
        { label: 'Sale', value: 'sale' as FilterPurpose },
        { label: 'Rent', value: 'rent' as FilterPurpose },
      ]} current={purpose} set={setPurpose} />
      <BtnGroup label="Bedrooms" opts={[
        { label: 'All', value: 'all' as FilterBedrooms },
        { label: '1BR', value: '1' as FilterBedrooms },
        { label: '2BR', value: '2' as FilterBedrooms },
        { label: '3BR', value: '3' as FilterBedrooms },
        { label: '4BR+', value: '4+' as FilterBedrooms },
      ]} current={bedrooms} set={setBedrooms} />
      <BtnGroup label="Location Type" opts={[
        { label: 'All', value: 'all' },
        { label: 'Compound', value: 'compound' },
        { label: 'City', value: 'city' },
        { label: 'District', value: 'district' },
      ]} current={locType} set={setLocType} />

      {/* Budget Range */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 5, letterSpacing: 1 }}>Budget Range (EGP)</div>
        <div style={{ fontSize: 12, color: '#0ea5e9', fontWeight: 600, marginBottom: 6 }}>
          {budget[0] >= 1e6 ? `${(budget[0]/1e6).toFixed(1)}M` : `${(budget[0]/1000).toFixed(0)}K`}
          {' – '}
          {budget[1] >= 1e6 ? `${(budget[1]/1e6).toFixed(1)}M` : `${(budget[1]/1000).toFixed(0)}K`}
        </div>
        <input type="range" min={500000} max={30000000} step={500000}
          value={budget[0]} onChange={e => setBudget([+e.target.value, budget[1]])}
          style={{ width: '100%', accentColor: '#0ea5e9', marginBottom: 4 }}
        />
        <input type="range" min={500000} max={30000000} step={500000}
          value={budget[1]} onChange={e => setBudget([budget[0], +e.target.value])}
          style={{ width: '100%', accentColor: '#ef4444' }}
        />
      </div>

      {/* Legend */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 7, letterSpacing: 1 }}>Legend</div>
        {(['hot', 'balanced', 'cold'] as MarketSignal[]).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: signalColor(s) }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{signalEmoji(s)} {signalLabel(s)}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, fontSize: 10, color: '#475569' }}>Bubble size = demand count</div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#fbbf24' }}>🟡 Gold ring = live WA data</div>
      </div>
    </div>
  )
}

// ─── Map Style Switcher ───────────────────────────────────────────────────────
function MapStyleSwitcher({ current, onChange }: { current: MapStyle; onChange: (s: MapStyle) => void }) {
  return (
    <div style={{
      position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
      zIndex: 998, display: 'flex', gap: 6,
      background: 'rgba(6,10,24,0.94)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 24, padding: '5px 8px', backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    }}>
      {(Object.entries(MAP_STYLES) as [MapStyle, typeof MAP_STYLES[MapStyle]][]).map(([key, cfg]) => (
        <button key={key} onClick={() => onChange(key)} style={{
          padding: '5px 14px', borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s',
          background: current === key ? 'rgba(14,165,233,0.3)' : 'transparent',
          border: current === key ? '1px solid #0ea5e9' : '1px solid transparent',
          color: current === key ? '#0ea5e9' : '#94a3b8',
        }}>
          {cfg.icon} {cfg.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main MarketMap ───────────────────────────────────────────────────────────
export default function MarketMap() {
  const [locations, setLocations] = useState<LocationData[]>(LOCATIONS)
  const [selected,  setSelected]  = useState<LocationData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [useMapbox, setUseMapbox] = useState(false)
  const [mapStyle,  setMapStyle]  = useState<MapStyle>('satellite')
  const [purpose,   setPurpose]   = useState<FilterPurpose>('all')
  const [bedrooms,  setBedrooms]  = useState<FilterBedrooms>('all')
  const [budget,    setBudget]    = useState<[number, number]>([500_000, 30_000_000])
  const [locType,   setLocType]   = useState('all')
  const [mapKey,    setMapKey]    = useState(0)
  const [dataSource, setDataSource] = useState<'live' | 'mock'>('mock')

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

  // ── Fetch real location stats from DB endpoint ────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Try the new persistent DB endpoint first
      const res = await fetch('/api/locations/stats', { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json()
        if (data.locations && data.locations.length > 0) {
          setDataSource(data.dataSource === 'db+baseline' ? 'live' : 'mock')
          setLocations(prev => prev.map(loc => {
            const m = data.locations.find((a: any) =>
              a.location?.toLowerCase().replace(/['\s-]/g, '') === loc.name.toLowerCase().replace(/['\s-]/g, '') ||
              a.location?.toLowerCase().includes(loc.name.split(' ')[0].toLowerCase()) ||
              loc.name.toLowerCase().includes((a.location || '').split(' ')[0].toLowerCase())
            )
            if (!m) return loc
            const d = m.demand || 0
            const s = m.supply  || 0
            const pressure = s > 0 ? d / s : 2
            const signal: MarketSignal = pressure >= 3 ? 'hot' : pressure >= 1.5 ? 'balanced' : 'cold'
            return {
              ...loc,
              demand: d, supply: s,
              realDemand: m.realDemand || 0,
              realSupply: m.realSupply || 0,
              signal,
              avgBudget: m.avg_budget || loc.avgBudget,
              topTypes: ['Apartment', 'Duplex', 'Villa'],
              priceMin: (m.avg_budget || 4e6) * 0.55,
              priceMax: (m.avg_budget || 4e6) * 1.55,
            }
          }))
          return
        }
      }
    } catch { /* fall through to mock */ }

    // Fallback mock seeds
    setDataSource('mock')
    setLocations(prev => prev.map((loc, i) => {
      const seeds    = [1931, 420, 1450, 890, 980, 640, 720, 850, 310, 380, 380, 590]
      const supSeeds = [478,  195, 620,  380, 510, 350, 290, 440, 165, 220, 120, 280]
      const budgets  = [4200000, 3800000, 5100000, 7500000, 3200000, 3900000, 6200000, 3600000, 8500000, 4800000, 8500000, 5200000]
      const d = seeds[i] || 50; const s = supSeeds[i] || 20
      const pressure = d / s
      const signal: MarketSignal = pressure >= 3 ? 'hot' : pressure >= 1.5 ? 'balanced' : 'cold'
      return { ...loc, demand: d, supply: s, signal, avgBudget: budgets[i] || 4000000, realDemand: 0, realSupply: 0,
        topTypes: ['Apartment', 'Studio', 'Duplex'].slice(0, 2 + (i % 2)),
        priceMin: budgets[i] * 0.55, priceMax: budgets[i] * 1.55 }
    }))
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  useEffect(() => { setUseMapbox(!!MAPBOX_TOKEN) }, [MAPBOX_TOKEN])

  // Re-render map when style changes
  useEffect(() => { setMapKey(k => k + 1) }, [mapStyle])

  const prevFilters = useRef({ purpose, bedrooms, locType })
  useEffect(() => {
    const p = prevFilters.current
    if (p.purpose !== purpose || p.bedrooms !== bedrooms || p.locType !== locType) {
      prevFilters.current = { purpose, bedrooms, locType }
      setMapKey(k => k + 1)
    }
  }, [purpose, bedrooms, locType])

  const filtered = locations.filter(loc => {
    if (budget[0] > 0 || budget[1] < 30_000_000) {
      const b = loc.avgBudget || 4_000_000
      if (b < budget[0] || b > budget[1]) return false
    }
    return true
  })

  const handleViewMatches = (loc: LocationData) => {
    window.dispatchEvent(new CustomEvent('matchpro:navigate', { detail: { page: 'matches', location: loc.name } }))
  }

  const totalDemand = filtered.reduce((a, l) => a + l.demand, 0)
  const totalSupply = filtered.reduce((a, l) => a + l.supply, 0)
  const hotCount    = filtered.filter(l => l.signal === 'hot').length
  const avgPressure = totalSupply > 0 ? (totalDemand / totalSupply).toFixed(1) : '—'
  const totalRealData = filtered.reduce((a, l) => a + (l.realDemand || 0) + (l.realSupply || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600, background: '#040810', borderRadius: 16, overflow: 'hidden' }}>

      {/* Top Stats Bar */}
      <div style={{ display: 'flex', gap: 1, background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 18px', flexShrink: 0, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛰️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Market Intelligence Map</div>
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              Live demand density · Cairo & Greater Egypt
              {dataSource === 'live' && totalRealData > 0 && (
                <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 8, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  ● {totalRealData} real WA signals
                </span>
              )}
            </div>
          </div>
        </div>
        {[
          { label: 'Total Buyers', value: totalDemand, color: '#ef4444' },
          { label: 'Total Listings', value: totalSupply, color: '#0ea5e9' },
          { label: 'Hot Zones', value: hotCount, color: '#f97316' },
          { label: 'Avg Pressure', value: avgPressure + 'x', color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '5px 18px', borderLeft: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
        <div style={{ padding: '5px 14px', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setUseMapbox(m => !m); setMapKey(k => k + 1) }}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >{useMapbox ? '🗺️ Leaflet' : '🔷 Mapbox'}</button>
          <button onClick={() => fetchData()} style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)', color: '#0ea5e9', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>↻ Refresh</button>
        </div>
      </div>

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, background: '#040810' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(14,165,233,0.3)', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading satellite market intelligence…</div>
            <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
          </div>
        ) : (
          <div key={mapKey} style={{ width: '100%', height: '100%', minHeight: 500 }}>
            {useMapbox ? (
              <MapboxMap locations={filtered} onSelect={setSelected} selected={selected} token={MAPBOX_TOKEN} mapStyle={mapStyle} />
            ) : (
              <LeafletMap locations={filtered} onSelect={setSelected} selected={selected} mapStyle={mapStyle} />
            )}
          </div>
        )}

        {/* Filter Panel */}
        {!loading && (
          <FilterPanel
            purpose={purpose} setPurpose={setPurpose}
            bedrooms={bedrooms} setBedrooms={setBedrooms}
            budget={budget} setBudget={setBudget}
            locType={locType} setLocType={setLocType}
          />
        )}

        {/* Location Detail Popup */}
        {selected && (
          <LocationPopup loc={selected} onClose={() => setSelected(null)} onViewMatches={handleViewMatches} />
        )}

        {/* Map Style Switcher */}
        {!loading && <MapStyleSwitcher current={mapStyle} onChange={setMapStyle} />}

        {/* Map type badge */}
        <div style={{ position: 'absolute', bottom: 16, right: 20, background: 'rgba(4,8,16,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '3px 12px', fontSize: 10, color: '#64748b', backdropFilter: 'blur(8px)' }}>
          {useMapbox ? `🔷 Mapbox GL JS v3 · ${MAP_STYLES[mapStyle].label}` : `🗺️ Leaflet · ${MAP_STYLES[mapStyle].label}`}
          {' · '}{filtered.length} zones
        </div>
      </div>

      {/* Bottom Locations List */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 18px', background: 'rgba(4,8,16,0.9)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', marginBottom: 7, letterSpacing: 1 }}>
          All Tracked Zones · Click to Inspect
          {dataSource === 'live' && <span style={{ color: '#fbbf24', marginLeft: 8 }}>● Live DB Data Active</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4 }}>
          {[...filtered].sort((a, b) => b.demand - a.demand).map(loc => {
            const hasReal = (loc.realDemand || 0) > 0 || (loc.realSupply || 0) > 0
            return (
              <button key={loc.id} onClick={() => setSelected(loc)} style={{
                flexShrink: 0, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                background: selected?.id === loc.id ? signalColor(loc.signal, 0.22) : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected?.id === loc.id ? signalColor(loc.signal) : hasReal ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: selected?.id === loc.id ? signalColor(loc.signal) : '#94a3b8',
                fontSize: 11, fontWeight: selected?.id === loc.id ? 700 : 400,
              }}>
                {signalEmoji(loc.signal)} {loc.name}
                <span style={{ opacity: 0.65, fontSize: 10, marginLeft: 4 }}>{loc.demand}D</span>
                {hasReal && <span style={{ color: '#fbbf24', marginLeft: 3, fontSize: 9 }}>●</span>}
              </button>
            )
          })}
        </div>
=======
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
>>>>>>> origin/main
      </div>
    </div>
  )
}
<<<<<<< HEAD
=======

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
>>>>>>> origin/main
