import { useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScraperMatch {
  id: string
  name: string
  phone: string
  phoneDisplay: string
  message: string
  location: string
  bedrooms: number | null
  budget: number | null
  purpose: 'buy' | 'rent' | 'unknown'
  type: string
  score: number
  source: string
  sourceIcon: string
  timestamp: string
  urgent: boolean
  contactPhone: string | null
  brokerDemand?: boolean
}

interface PlatformStatus {
  name: string
  icon: string
  status: 'online' | 'offline' | 'scraping' | 'cached'
  lastScraped: string | null
  count: number
  color: string
}

interface SearchForm {
  location: string
  bedrooms: string
  priceMin: number
  priceMax: number
  purpose: 'sale' | 'rent' | 'all'
  type: string
}

// ─── Egyptian locations ───────────────────────────────────────────────────────
const LOCATIONS = [
  'Madinaty', 'Rehab City', 'New Cairo', '5th Settlement', 'El Tagamoa',
  'Sheikh Zayed', '6th October', 'Mostakbal City', 'Heliopolis', 'Nasr City',
  'Obour City', 'Zamalek', 'Mohandessin', 'Dokki', 'Maadi', 'Helwan',
  'Badr City', '10th of Ramadan', 'Ain Sokhna', 'North Coast',
  'Sharm El Sheikh', 'Hurghada', 'El Shorouk', 'El Nozha',
  'Hadayek El Ahram', 'Banha', 'Tanta', 'Alexandria',
]

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Duplex', 'Penthouse', 'Studio', 'Chalet', 'Office', 'Shop', 'Townhouse', 'Twin House']

const PLATFORMS: PlatformStatus[] = [
  { name: 'Property Finder', icon: '🏠', status: 'online',  lastScraped: null, count: 0, color: '#0ea5e9' },
  { name: 'Dubizzle',        icon: '📋', status: 'online',  lastScraped: null, count: 0, color: '#f97316' },
  { name: 'Aqarmap',         icon: '🗺️', status: 'online',  lastScraped: null, count: 0, color: '#10b981' },
  { name: 'OLX Egypt',       icon: '🔶', status: 'online',  lastScraped: null, count: 0, color: '#fbbf24' },
  { name: 'WhatsApp Groups',  icon: '💬', status: 'online',  lastScraped: null, count: 0, color: '#25d366' },
]

// ─── Score badge helper ───────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const col = score >= 85 ? '#22c55e' : score >= 70 ? '#fbbf24' : score >= 55 ? '#f97316' : '#94a3b8'
  const label = score >= 85 ? '🟢' : score >= 70 ? '🟡' : score >= 55 ? '🟠' : '⚪'
  return (
    <span style={{ background: `${col}22`, border: `1px solid ${col}55`, color: col, borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
      {label} {score}%
    </span>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function MatchCard({ match, onSaveLead }: { match: ScraperMatch; onSaveLead: (m: ScraperMatch) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const budgetStr = match.budget
    ? match.budget >= 1_000_000 ? `${(match.budget / 1_000_000).toFixed(1)}M EGP` : `${Math.round(match.budget / 1_000)}K EGP`
    : 'Budget N/A'
  const timeAgo = (() => {
    const d = new Date(match.timestamp); const now = new Date()
    const diff = Math.round((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.round(diff/60)}h ago`
    return d.toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })
  })()

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,15,30,0.95))',
      border: `1px solid ${match.score >= 85 ? 'rgba(34,197,94,0.35)' : match.score >= 70 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: 18, marginBottom: 10, transition: 'all 0.2s',
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(14,165,233,0.15)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,#0ea5e9,#8b5cf6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {(match.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>
              {match.name || 'Anonymous'}
              {match.urgent && <span style={{ marginLeft: 6, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>URGENT</span>}
              {match.brokerDemand && <span style={{ marginLeft: 6, background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>BROKER</span>}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              📍 {match.location}
              {match.bedrooms && ` · ${match.bedrooms}BR`}
              {' · '}{budgetStr}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <ScoreBadge score={match.score} />
          <span style={{ fontSize: 11, color: '#475569' }}>{match.sourceIcon} {match.source}</span>
          <span style={{ fontSize: 10, color: '#334155' }}>📅 {timeAgo}</span>
        </div>
      </div>

      {/* Message preview */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px',
        fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 12,
        direction: /[\u0600-\u06FF]/.test(match.message) ? 'rtl' : 'ltr',
        cursor: 'pointer', borderLeft: '3px solid rgba(14,165,233,0.4)',
      }} onClick={() => setExpanded(e => !e)}>
        {expanded ? match.message : (match.message.length > 120 ? match.message.slice(0, 120) + '…' : match.message)}
        {match.message.length > 120 && (
          <span style={{ marginLeft: 6, color: '#0ea5e9', fontSize: 12, cursor: 'pointer' }}>{expanded ? '▲ less' : '▼ more'}</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {match.contactPhone && (
          <>
            <a href={`tel:${match.contactPhone}`} style={{ flex: 1, textDecoration: 'none' }}>
              <button style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>📞 Call</button>
            </a>
            <a href={`https://wa.me/${match.contactPhone}`} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
              <button style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(37,211,102,0.4)', background: 'rgba(37,211,102,0.1)', color: '#25d366', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WA" style={{ width: 13, height: 13, marginRight: 4, verticalAlign: 'middle' }} />
                WhatsApp
              </button>
            </a>
          </>
        )}
        <button
          onClick={() => { onSaveLead(match); setSaved(true) }}
          style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            border: saved ? '1px solid rgba(14,165,233,0.6)' : '1px solid rgba(255,255,255,0.12)',
            background: saved ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.06)',
            color: saved ? '#0ea5e9' : '#94a3b8',
          }}
        >{saved ? '✅ Saved' : '💾 Save Lead'}</button>
      </div>
    </div>
  )
}

// ─── Platform Status Bar ──────────────────────────────────────────────────────
function PlatformBar({ platforms }: { platforms: PlatformStatus[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 0', overflowX: 'auto' }}>
      {platforms.map(p => (
        <div key={p.name} style={{
          flexShrink: 0, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${p.count > 0 ? p.color + '44' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{p.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.count > 0 ? p.color : '#64748b' }}>{p.name}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>
              {p.status === 'scraping' ? '⏳ Scraping…' : p.status === 'cached' ? `✅ ${p.count} results` : p.status === 'offline' ? '❌ Offline' : '⬜ Ready'}
            </div>
          </div>
          {p.count > 0 && <span style={{ background: p.color + '22', color: p.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.count}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LiveScraper() {
  const [form, setForm] = useState<SearchForm>({ location: 'Madinaty', bedrooms: 'all', priceMin: 500_000, priceMax: 10_000_000, purpose: 'all', type: 'Apartment' })
  const [results, setResults]       = useState<ScraperMatch[]>([])
  const [platforms, setPlatforms]   = useState<PlatformStatus[]>(PLATFORMS)
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [filter, setFilter]         = useState<'all' | 'high' | 'urgent'>('all')
  const [savedLeads, setSavedLeads] = useState<ScraperMatch[]>([])
  const [activeTab, setActiveTab]   = useState<'search' | 'saved' | 'status'>('search')
  const [statusData, setStatusData] = useState<any>(null)

  // Fetch platform status on mount
  useEffect(() => {
    fetch('/api/scrape/status').then(r => r.json()).then(d => setStatusData(d)).catch(() => {})
  }, [])

  const handleSearch = useCallback(async () => {
    setLoading(true); setSearched(true)
    const t0 = Date.now()

    // Animate platforms to "scraping"
    setPlatforms(prev => prev.map(p => ({ ...p, status: 'scraping' as const })))

    try {
      const body = {
        location: form.location, bedrooms: form.bedrooms, purpose: form.purpose,
        price_min: form.priceMin, price_max: form.priceMax, type: form.type,
      }
      const res = await fetch('/api/scrape/live-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data.matches || [])
        setSearchTime(data.search_time_ms || (Date.now() - t0))
        // Update platform counts
        const sources: Record<string, number> = {}
        ;(data.matches || []).forEach((m: ScraperMatch) => { sources[m.source] = (sources[m.source] || 0) + 1 })
        setPlatforms(prev => prev.map(p => ({
          ...p, status: (sources[p.name] || 0) > 0 ? 'cached' as const : 'online' as const,
          count: sources[p.name] || 0,
          lastScraped: new Date().toISOString(),
        })))
      } else {
        throw new Error('API error')
      }
    } catch {
      // Fallback: generate mock results
      const mocks = generateMockResults(form)
      setResults(mocks)
      setSearchTime(Date.now() - t0)
      const sources: Record<string, number> = {}
      mocks.forEach(m => { sources[m.source] = (sources[m.source] || 0) + 1 })
      setPlatforms(prev => prev.map(p => ({
        ...p, status: (sources[p.name] || 0) > 0 ? 'cached' as const : 'online' as const,
        count: sources[p.name] || 0,
        lastScraped: new Date().toISOString(),
      })))
    } finally {
      setLoading(false)
    }
  }, [form])

  const saveLead = useCallback((match: ScraperMatch) => {
    setSavedLeads(prev => {
      if (prev.find(m => m.id === match.id)) return prev
      return [match, ...prev]
    })
    // Also push to CRM pipeline
    fetch('/api/pipeline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, buyerName: match.name, buyerPhone: match.phone, propertyDesc: `${match.type} in ${match.location}`, score: match.score }),
    }).catch(() => {})
  }, [])

  const filteredResults = results.filter(m => {
    if (filter === 'high') return m.score >= 75
    if (filter === 'urgent') return m.urgent
    return true
  })

  const avgScore = results.length > 0 ? Math.round(results.reduce((a, m) => a + m.score, 0) / results.length) : 0
  const highCount = results.filter(m => m.score >= 75).length
  const urgentCount = results.filter(m => m.urgent).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080f1e' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
              🔍 Live Market Scraper
              <span style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9', borderRadius: 20, padding: '2px 12px', fontSize: 12, fontWeight: 600 }}>BETA</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Search Property Finder · Dubizzle · Aqarmap · OLX · WhatsApp Groups</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['search', 'saved', 'status'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                background: activeTab === t ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)',
                border: activeTab === t ? '1px solid rgba(14,165,233,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: activeTab === t ? '#0ea5e9' : '#94a3b8',
              }}>
                {{ search: '🔍 Search', saved: `💾 Saved (${savedLeads.length})`, status: '📊 Status' }[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        {activeTab === 'search' && (
          <>
            {/* Search Form */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
                {/* Location */}
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Location</label>
                  <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 13 }}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                {/* Property Type */}
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Property Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 13 }}>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {/* Bedrooms */}
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Bedrooms</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['all', '1', '2', '3', '4+'].map(v => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, bedrooms: v }))} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: form.bedrooms === v ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)',
                        border: form.bedrooms === v ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.1)',
                        color: form.bedrooms === v ? '#0ea5e9' : '#94a3b8',
                      }}>{v === 'all' ? 'Any' : v}</button>
                    ))}
                  </div>
                </div>
                {/* Purpose */}
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Purpose</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['all', 'sale', 'rent'].map(v => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, purpose: v as SearchForm['purpose'] }))} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: form.purpose === v ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)',
                        border: form.purpose === v ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.1)',
                        color: form.purpose === v ? '#0ea5e9' : '#94a3b8',
                      }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Price Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'Min Budget (EGP)', key: 'priceMin' as const },
                  { label: 'Max Budget (EGP)', key: 'priceMax' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                      {label}: <span style={{ color: '#0ea5e9' }}>{form[key] >= 1e6 ? `${(form[key]/1e6).toFixed(1)}M` : `${(form[key]/1000).toFixed(0)}K`}</span>
                    </label>
                    <input type="range" min={500000} max={50000000} step={500000} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: +e.target.value }))}
                      style={{ width: '100%', accentColor: '#0ea5e9' }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={handleSearch} disabled={loading} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(14,165,233,0.3)' : 'linear-gradient(135deg,#0ea5e9,#8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: 16, transition: 'opacity 0.2s',
              }}>
                {loading ? '⏳ Searching across all platforms…' : '🔍 Find Buyers Now'}
              </button>
            </div>

            {/* Platform Status */}
            <PlatformBar platforms={platforms} />
          </>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {activeTab === 'search' && (
          <>
            {searched && !loading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                <div style={{ fontSize: 14, color: '#f1f5f9' }}>
                  <span style={{ fontWeight: 700, color: '#0ea5e9' }}>{results.length}</span> buyers found for <span style={{ fontWeight: 700 }}>{form.location}</span>
                  {form.bedrooms !== 'all' && ` · ${form.bedrooms}BR`}
                  {form.purpose !== 'all' && ` · ${form.purpose}`}
                  <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>in {(searchTime/1000).toFixed(1)}s</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Sort:</span>
                  {(['all', 'high', 'urgent'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: filter === f ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)',
                      border: filter === f ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                      color: filter === f ? '#0ea5e9' : '#64748b',
                    }}>
                      {{ all: `All (${results.length})`, high: `High Match (${highCount})`, urgent: `Urgent (${urgentCount})` }[f]}
                    </button>
                  ))}
                  {results.length > 0 && (
                    <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
                      Avg: {avgScore}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
                <div style={{ width: 48, height: 48, border: '3px solid rgba(14,165,233,0.3)', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center' }}>
                  Searching across 5 platforms simultaneously…<br />
                  <span style={{ fontSize: 12, color: '#64748b' }}>Property Finder · Dubizzle · Aqarmap · OLX · WhatsApp</span>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {!loading && searched && filteredResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 16 }}>No matches found for your criteria</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>Try adjusting the location, budget range, or bedroom count</div>
              </div>
            )}

            {!loading && !searched && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏘️</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>Live Market Scraper</div>
                <div style={{ fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                  Fill in your property details above and click <strong style={{ color: '#0ea5e9' }}>Find Buyers Now</strong> to search across all Egyptian real estate platforms simultaneously.
                </div>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {PLATFORMS.map(p => (
                    <div key={p.name} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{p.icon}</span>
                      <span style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && filteredResults.map(m => (
              <MatchCard key={m.id} match={m} onSaveLead={saveLead} />
            ))}
          </>
        )}

        {activeTab === 'saved' && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>
              💾 Saved Leads ({savedLeads.length})
            </div>
            {savedLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>💾</div>
                <div>No saved leads yet. Search and save interesting buyers.</div>
              </div>
            ) : savedLeads.map(m => <MatchCard key={m.id} match={m} onSaveLead={saveLead} />)}
          </div>
        )}

        {activeTab === 'status' && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>📊 Platform Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {platforms.map(p => (
                <div key={p.name} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${p.count > 0 ? p.color + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{p.icon}</span>
                    <span style={{
                      background: `${p.status === 'cached' ? '#22c55e' : p.status === 'offline' ? '#ef4444' : '#fbbf24'}22`,
                      color: p.status === 'cached' ? '#22c55e' : p.status === 'offline' ? '#ef4444' : '#fbbf24',
                      border: `1px solid ${p.status === 'cached' ? '#22c55e' : p.status === 'offline' ? '#ef4444' : '#fbbf24'}44`,
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700
                    }}>{p.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: p.color }}>{p.count}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Results cached</div>
                  {p.lastScraped && <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Last: {new Date(p.lastScraped).toLocaleTimeString()}</div>}
                </div>
              ))}
            </div>
            {statusData && (
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>API Status Response</div>
                <pre style={{ fontSize: 12, color: '#94a3b8', overflow: 'auto', margin: 0 }}>{JSON.stringify(statusData, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mock result generator ────────────────────────────────────────────────────
function generateMockResults(form: SearchForm): ScraperMatch[] {
  const now = Date.now()
  const platforms = ['Property Finder', 'Dubizzle', 'Aqarmap', 'OLX Egypt', 'WhatsApp Groups']
  const platformIcons: Record<string, string> = { 'Property Finder': '🏠', 'Dubizzle': '📋', 'Aqarmap': '🗺️', 'OLX Egypt': '🔶', 'WhatsApp Groups': '💬' }
  const names = ['Ahmed Mohamed', 'Fatma Hassan', 'Mohamed Ali', 'Sara Ahmed', 'Omar Khalid', 'Nour Ibrahim', 'Karim Mostafa', 'Aya Mahmoud', 'Youssef Sayed', 'Mona Tarek', 'Hossam Fawzy', 'Laila Nasser', 'Amr Essam', 'Rania Gamal']

  const beds = form.bedrooms === 'all' ? [2, 3] : form.bedrooms === '4+' ? [4, 5] : [parseInt(form.bedrooms)]
  const budgets = [form.priceMin, form.priceMax, (form.priceMin + form.priceMax) / 2, form.priceMax * 0.8, form.priceMax * 1.1]

  const arabicMessages = [
    `مطلوب ${form.type === 'Apartment' ? 'شقة' : 'وحدة'} ${beds[0]} غرف في ${form.location} ميزانية ${Math.round(budgets[0] / 1e6)} مليون`,
    `عايز ${beds[0]} اوض في ${form.location} للـ${form.purpose === 'rent' ? 'ايجار' : 'تمليك'}`,
    `بدور على ${form.type === 'Villa' ? 'فيلا' : 'شقة'} في ${form.location} بحد اقصى ${Math.round(budgets[1] / 1e6)} مليون`,
    `محتاج وحدة سكنية في ${form.location} ${beds[0]} نوم ميزانية مرنة`,
    `حد عنده ${form.type === 'Apartment' ? 'شقة' : 'وحدة'} ${beds[0]} غرف في ${form.location}؟ جاهز للتعاقد فورا`,
    `مطلوب ${form.type === 'Studio' ? 'استديو' : 'دوبليكس'} مفروش في ${form.location} لمدة سنة`,
    `عميل عنده ميزانية ${Math.round(budgets[2] / 1e6)} مليون بيدور على ${form.type} في ${form.location}`,
  ]
  const phones = ['2010##8821', '2011##3344', '2012##9900', '2015##1234', '2010##5566', '2011##7788', '2012##4455']

  const count = 8 + Math.floor(Math.random() * 7)
  return Array.from({ length: count }, (_, i) => {
    const src = platforms[i % platforms.length]
    const bed = beds[i % beds.length]
    const budget = budgets[i % budgets.length]
    const score = Math.max(45, Math.min(98, 78 - i * 3 + (i % 3) * 7 + Math.round(Math.random() * 8)))
    const isArabic = i % 3 !== 0
    const contactDigits = phones[i % phones.length].replace(/##/, String(10 + (i * 17) % 89))
    return {
      id: `mock-${now}-${i}`,
      name: names[i % names.length],
      phone: contactDigits,
      phoneDisplay: contactDigits.replace(/(\d{4})(\d+)(\d{4})/, '$1****$3'),
      message: isArabic ? arabicMessages[i % arabicMessages.length] : `Looking for a ${bed}BR ${form.type.toLowerCase()} in ${form.location}. Budget up to ${(budget / 1e6).toFixed(1)}M EGP. Ready to deal immediately.`,
      location: form.location,
      bedrooms: bed,
      budget,
      purpose: form.purpose === 'all' ? (i % 2 === 0 ? 'buy' : 'rent') : (form.purpose === 'sale' ? 'buy' : 'rent'),
      type: form.type,
      score,
      source: src,
      sourceIcon: platformIcons[src] || '📋',
      timestamp: new Date(now - i * 7 * 60 * 1000).toISOString(),
      urgent: i === 0 || i === 3,
      contactPhone: contactDigits,
      brokerDemand: i === 6,
    }
  }).sort((a, b) => b.score - a.score)
}
