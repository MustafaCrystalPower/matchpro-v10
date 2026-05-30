import { useState } from 'react'

/* ─── Types ─────────────────────────────────────────────────── */
interface SearchParams {
  location: string
  bedrooms: string
  price_min: string
  price_max: string
  purpose: string
  type: string
}

interface ScrapeMatch {
  id: string
  name: string
  match_score: number
  location: string
  bedrooms: number | null
  budget: number | null
  price: number | null
  message: string
  phone: string
  source: string
  source_url?: string
  posted_at: string
  property_type?: string
  intent: 'buy' | 'rent' | 'sell' | 'rent_out'
  urgency?: 'urgent' | 'normal'
  area_sqm?: number | null
}

interface SearchResult {
  matches: ScrapeMatch[]
  total: number
  sources: PlatformStatus[]
  search_time_ms: number
  cached: boolean
}

interface PlatformStatus {
  name: string
  status: 'ok' | 'degraded' | 'offline' | 'loading'
  last_scraped?: string
  count?: number
  error?: string
}

const LOCATIONS = [
  'Madinaty', 'Rehab City', 'New Cairo', 'Fifth Settlement', 'Sheikh Zayed',
  '6th October', 'Mostakbal City', 'Nasr City', 'Heliopolis', 'Zamalek',
  'Maadi', 'North Coast', 'New Capital', 'Badr City', 'Obour',
  'Shorouk', 'Katameya', 'Al Mohandiseen', 'Dokki', 'Agouza',
  'Ain Sokhna', 'El Gouna', 'New Zayed', 'Palm Hills', 'Compound Life',
]

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  'Property Finder': { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#ef4444', icon: '🏠' },
  'Dubizzle':        { bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.3)',   text: '#f59e0b', icon: '🏢' },
  'Aqarmap':         { bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.3)',   text: '#10b981', icon: '🗺️' },
  'OLX Egypt':       { bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.3)',   text: '#8b5cf6', icon: '📢' },
  'Facebook':        { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)',   text: '#3b82f6', icon: '👥' },
  'WhatsApp':        { bg: 'rgba(37,211,102,0.1)',   border: 'rgba(37,211,102,0.3)',   text: '#25d366', icon: '💬' },
  'MatchPro DB':     { bg: 'rgba(14,165,233,0.1)',   border: 'rgba(14,165,233,0.3)',   text: '#0ea5e9', icon: '⚡' },
  default:           { bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.3)',  text: '#6b7280', icon: '📋' },
}

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source] ?? SOURCE_COLORS.default
}

function maskPhone(phone: string): string {
  if (!phone) return '—'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length >= 10) {
    return cleaned.slice(0, 3) + '****' + cleaned.slice(-4)
  }
  return '****' + cleaned.slice(-4)
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}

function timeSince(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function scoreColor(s: number): string {
  if (s >= 90) return '#10b981'
  if (s >= 75) return '#22c55e'
  if (s >= 60) return '#f59e0b'
  return '#ef4444'
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LiveSearch({ apiData }: { apiData?: any }) {
  const [params, setParams] = useState<SearchParams>({
    location: '',
    bedrooms: '',
    price_min: '',
    price_max: '',
    purpose: 'buy',
    type: 'apartment',
  })
  const [results, setResults] = useState<SearchResult | null>(null)
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'score' | 'recent' | 'price'>('score')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [revealedPhones, setRevealedPhones] = useState<Set<string>>(new Set())

  const updateParam = (k: keyof SearchParams, v: string) => setParams(p => ({ ...p, [k]: v }))

  const search = async () => {
    if (!params.location) { setError('Please select a location'); return }
    setLoading(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch('/api/scrape/live-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: params.location,
          bedrooms: params.bedrooms ? parseInt(params.bedrooms) : null,
          price_min: params.price_min ? parseInt(params.price_min) * 1000 : null,
          price_max: params.price_max ? parseInt(params.price_max) * 1000 : null,
          purpose: params.purpose,
          type: params.type,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SearchResult = await res.json()
      setResults(data)
      setPlatforms(data.sources || [])
    } catch (e: any) {
      setError('Search failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadPlatformStatus = async () => {
    try {
      const res = await fetch('/api/scrape/status')
      const data = await res.json()
      setPlatforms(data.platforms || [])
    } catch { /* silent */ }
  }

  // Sort + filter matches
  const displayMatches = results ? [...results.matches]
    .filter(m => filterSource === 'all' || m.source === filterSource)
    .sort((a, b) => {
      if (sortBy === 'score') return b.match_score - a.match_score
      if (sortBy === 'recent') return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      if (sortBy === 'price') return (a.budget ?? a.price ?? 0) - (b.budget ?? b.price ?? 0)
      return 0
    }) : []

  const uniqueSources = results ? [...new Set(results.matches.map(m => m.source))] : []

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', boxShadow: '0 4px 12px rgba(14,165,233,0.4)',
          }}>🔭</div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              Live Market Scraper
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Real-time buyer &amp; seller search across PropertyFinder, Dubizzle, Aqarmap, OLX, WhatsApp
            </p>
          </div>
        </div>
        <button
          onClick={loadPlatformStatus}
          style={{
            padding: '7px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          🔄 Platform Status
        </button>
      </div>

      {/* Platform status bar */}
      {platforms.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {platforms.map(p => {
            const statusColor = p.status === 'ok' ? '#10b981' : p.status === 'degraded' ? '#f59e0b' : p.status === 'offline' ? '#ef4444' : '#6b7280'
            return (
              <div key={p.name} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: '0.72rem',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{p.name}</span>
                {p.count != null && <span style={{ color: 'var(--text-muted)' }}>{p.count} results</span>}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ─── Search Panel ─── */}
        <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🎯 Property Specifications
          </h3>

          {/* Purpose */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Purpose</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { v: 'buy',     l: '🏠 For Sale' },
                { v: 'rent',    l: '🔑 For Rent' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => updateParam('purpose', opt.v)}
                  style={{
                    padding: '8px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    background: params.purpose === opt.v ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${params.purpose === opt.v ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
                    color: params.purpose === opt.v ? 'var(--brand-teal)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >{opt.l}</button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Location *</label>
            <select
              value={params.location}
              onChange={e => updateParam('location', e.target.value)}
              style={selectStyle}
            >
              <option value="">Select location...</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Property Type */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Property Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {['apartment', 'villa', 'duplex', 'studio', 'townhouse', 'chalet'].map(t => (
                <button
                  key={t}
                  onClick={() => updateParam('type', t)}
                  style={{
                    padding: '6px 4px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer',
                    fontWeight: 500, textTransform: 'capitalize',
                    background: params.type === t ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${params.type === t ? 'rgba(14,165,233,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    color: params.type === t ? 'var(--brand-teal)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Bedrooms */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Bedrooms</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['', '1', '2', '3', '4'].map((b, i) => (
                <button
                  key={i}
                  onClick={() => updateParam('bedrooms', b)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: '0.78rem',
                    fontWeight: params.bedrooms === b ? 700 : 400, cursor: 'pointer',
                    background: params.bedrooms === b ? 'rgba(14,165,233,0.14)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${params.bedrooms === b ? 'rgba(14,165,233,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: params.bedrooms === b ? 'var(--brand-teal)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{b === '' ? 'Any' : b === '4' ? '4+' : b + 'BR'}</button>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Budget Range (EGP × 1,000)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <input
                  type="number"
                  value={params.price_min}
                  onChange={e => updateParam('price_min', e.target.value)}
                  placeholder="Min (e.g. 500)"
                  style={inputStyle}
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  {params.price_min ? fmt(parseInt(params.price_min) * 1000) + ' EGP' : 'No min'}
                </div>
              </div>
              <div>
                <input
                  type="number"
                  value={params.price_max}
                  onChange={e => updateParam('price_max', e.target.value)}
                  placeholder="Max (e.g. 5000)"
                  style={inputStyle}
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  {params.price_max ? fmt(parseInt(params.price_max) * 1000) + ' EGP' : 'No max'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={search}
            disabled={loading || !params.location}
            className="btn btn-primary"
            style={{
              width: '100%', fontSize: '0.9rem', fontWeight: 700,
              opacity: loading || !params.location ? 0.6 : 1,
              cursor: loading || !params.location ? 'not-allowed' : 'pointer',
              padding: '12px',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                Searching all platforms...
              </span>
            ) : '🔭 Find Buyers Now'}
          </button>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: '0.78rem' }}>
              ❌ {error}
            </div>
          )}

          {/* Search Stats */}
          {results && (
            <div style={{ marginTop: 14, padding: '10px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <MiniStat label="Matches" value={results.total.toString()} color="var(--brand-teal)" />
                <MiniStat label="Time" value={`${results.search_time_ms}ms`} color={results.search_time_ms < 15000 ? '#10b981' : '#f59e0b'} />
                <MiniStat label="Sources" value={results.sources?.length?.toString() ?? '0'} color="var(--text-secondary)" />
                <MiniStat label="Cache" value={results.cached ? 'HIT' : 'MISS'} color={results.cached ? '#10b981' : '#6b7280'} />
              </div>
            </div>
          )}
        </div>

        {/* ─── Results Panel ─── */}
        <div>
          {!results && !loading && (
            <div className="card" style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 400 }}>
              <div style={{ fontSize: '3.5rem', opacity: 0.2 }}>🔭</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                Set your property specs
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 300, lineHeight: 1.6 }}>
                We'll search PropertyFinder, Dubizzle, Aqarmap, OLX Egypt, and your WhatsApp database simultaneously
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                {['Property Finder', 'Dubizzle', 'Aqarmap', 'OLX Egypt', 'WhatsApp'].map(s => {
                  const sc = getSourceStyle(s)
                  return (
                    <span key={s} style={{
                      padding: '4px 10px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600,
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                    }}>{sc.icon} {s}</span>
                  )
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', minHeight: 300 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 48, height: 48, border: '3px solid rgba(14,165,233,0.15)', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Searching all platforms...</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Property Finder', 'Dubizzle', 'Aqarmap', 'OLX Egypt', 'MatchPro DB'].map((s, i) => (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9',
                        animation: `spin 1s linear ${i * 0.2}s infinite`,
                      }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Results in under 15 seconds</div>
              </div>
            </div>
          )}

          {results && (
            <>
              {/* Controls bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {displayMatches.length} matches found
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                    in {params.location}
                    {params.bedrooms && ` · ${params.bedrooms}BR`}
                    {params.purpose === 'rent' ? ' · Rental' : ' · Sale'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Source filter */}
                  <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    style={{ ...selectStyle, width: 'auto', padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    <option value="all">All Sources</option>
                    {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    style={{ ...selectStyle, width: 'auto', padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    <option value="score">Best Match</option>
                    <option value="recent">Most Recent</option>
                    <option value="price">Lowest Price</option>
                  </select>
                </div>
              </div>

              {/* Match cards */}
              {displayMatches.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matches found for selected filters
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {displayMatches.map(match => {
                    const sc = getSourceStyle(match.source)
                    const isSaved = savedLeads.has(match.id)
                    const phoneRevealed = revealedPhones.has(match.id)

                    return (
                      <div key={match.id} className="card fade-in" style={{
                        padding: '14px 16px',
                        borderLeft: `3px solid ${scoreColor(match.match_score)}`,
                        transition: 'all 0.2s',
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          {/* Left: Main info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Top row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 9,
                                background: `linear-gradient(135deg, ${scoreColor(match.match_score)}33, ${scoreColor(match.match_score)}11)`,
                                border: `1px solid ${scoreColor(match.match_score)}44`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', flexShrink: 0,
                              }}>
                                {match.intent === 'buy' || match.intent === 'rent' ? '👤' : '🏠'}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {match.name || 'Anonymous'}
                                  {match.urgency === 'urgent' && (
                                    <span style={{ marginLeft: 6, padding: '1px 6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, fontSize: '0.62rem', color: '#ef4444', fontWeight: 800 }}>URGENT</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  📍 {match.location}
                                  {match.bedrooms && ` · ${match.bedrooms}BR`}
                                  {(match.budget ?? match.price) ? ` · ${fmt(match.budget ?? match.price ?? 0)} EGP` : ''}
                                  {match.area_sqm ? ` · ${match.area_sqm}m²` : ''}
                                </div>
                              </div>
                            </div>

                            {/* Message */}
                            <div style={{
                              fontSize: '0.82rem', color: 'var(--text-secondary)',
                              padding: '7px 10px', background: 'rgba(255,255,255,0.03)',
                              borderRadius: 6, marginBottom: 10,
                              direction: match.message && /[\u0600-\u06FF]/.test(match.message[0]) ? 'rtl' : 'ltr',
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any,
                            }}>
                              "{match.message}"
                            </div>

                            {/* Meta row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700,
                                background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                              }}>{sc.icon} {match.source}</span>

                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                📅 {timeSince(match.posted_at)}
                              </span>

                              {match.property_type && (
                                <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.68rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                                  {match.property_type}
                                </span>
                              )}

                              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                📞 {phoneRevealed ? match.phone : maskPhone(match.phone)}
                                {!phoneRevealed && match.phone && (
                                  <button
                                    onClick={() => setRevealedPhones(prev => new Set([...prev, match.id]))}
                                    style={{ marginLeft: 6, fontSize: '0.62rem', color: 'var(--brand-teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                  >Reveal</button>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Right: Score + Actions */}
                          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            {/* Match score */}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{
                                width: 52, height: 52, borderRadius: '50%',
                                background: `conic-gradient(${scoreColor(match.match_score)} ${match.match_score * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 0 12px ${scoreColor(match.match_score)}44`,
                              }}>
                                <div style={{
                                  width: 38, height: 38, borderRadius: '50%',
                                  background: 'var(--bg-elevated)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.72rem', fontWeight: 800, color: scoreColor(match.match_score),
                                }}>
                                  {match.match_score}%
                                </div>
                              </div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>Match</div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 5 }}>
                              <ActionBtn
                                icon="📞"
                                label="Call"
                                color="#10b981"
                                onClick={() => phoneRevealed && window.open(`tel:${match.phone}`)}
                              />
                              <ActionBtn
                                icon="💬"
                                label="WhatsApp"
                                color="#25d366"
                                onClick={() => window.open(`https://wa.me/${match.phone?.replace(/\D/g, '')}`)}
                              />
                              <ActionBtn
                                icon={isSaved ? '★' : '☆'}
                                label={isSaved ? 'Saved' : 'Save'}
                                color="#f59e0b"
                                active={isSaved}
                                onClick={() => setSavedLeads(prev => {
                                  const next = new Set(prev)
                                  isSaved ? next.delete(match.id) : next.add(match.id)
                                  return next
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {savedLeads.size > 0 && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: '0.8rem', color: '#f59e0b' }}>
                  ★ {savedLeads.size} lead{savedLeads.size > 1 ? 's' : ''} saved to pipeline
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block',
  marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: '0.82rem',
  outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text-primary)', padding: '8px 10px', fontSize: '0.82rem',
  outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
}

/* ─── Sub-components ─────────────────────────────────────────── */
function ActionBtn({ icon, label, color, onClick, active }: { icon: string; label: string; color: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 30, height: 30, borderRadius: 7, border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
        background: active ? `${color}22` : 'rgba(255,255,255,0.03)', cursor: 'pointer',
        fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}22`; (e.currentTarget as HTMLElement).style.borderColor = color }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
        }
      }}
    >{icon}</button>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
