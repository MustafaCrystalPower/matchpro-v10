import { useState, useEffect, useRef } from 'react'
import Card from '../components/Card'
import Badge, { getPressureVariant, getTemperatureLabel } from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

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
                <option value="all">All</option>
                <option value="supply">Supply Only</option>
                <option value="demand">Demand Only</option>
              </select>
            </div>
          }
        >
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
                const scaleX = canvas.width  / rect.width
                const scaleY = canvas.height / rect.height
                const cx     = (e.clientX - rect.left) * scaleX
                const cy     = (e.clientY - rect.top)  * scaleY
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
            </div>
          </Card>
        </div>
      </div>

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
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
