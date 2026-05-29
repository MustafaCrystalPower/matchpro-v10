import { useState, useMemo } from 'react'
import Card from '../components/Card'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

/* ─── Types ─────────────────────────────────────────────────── */
interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface AssetSpec {
  location:      string
  type:          string
  purpose:       'sale' | 'rent'
  price:         string
  bedrooms:      string
  bathrooms:     string
  area:          string          // sqm
  floor:         string
  finishing:     string
  compound:      string
  view:          string
  notes:         string
}

interface MatchedDemand {
  id:            number
  buyer_name:    string
  buyer_phone:   string
  score:         number          // 0–1
  budget_min:    number
  budget_max:    number
  bedrooms:      number
  bathrooms:     number
  type:          string
  location:      string
  area_min:      number
  area_max:      number
  purpose:       string
  finishing:     string
  source:        Platform
  notes:         string
  created_at:    string
  contact_time:  string
  nationality:   string
  agent:         string
  score_breakdown: ScoreBreakdown
}

interface ScoreBreakdown {
  location:  number
  price:     number
  type:      number
  bedrooms:  number
  area:      number
  finishing: number
}

type Platform = 'MatchPro API' | 'Property Finder' | 'Bayut' | 'Aqarmap' | 'OLX Egypt' | 'WhatsApp' | 'Direct'

const PLATFORMS: Platform[] = ['MatchPro API', 'Property Finder', 'Bayut', 'Aqarmap', 'OLX Egypt', 'WhatsApp', 'Direct']
const PLATFORM_COLORS: Record<Platform, { color: string; bg: string; logo: string }> = {
  'MatchPro API':    { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  logo: '🎯' },
  'Property Finder': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   logo: '🔴' },
  'Bayut':           { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  logo: '🟡' },
  'Aqarmap':         { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  logo: '🟢' },
  'OLX Egypt':       { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', logo: '🟣' },
  'WhatsApp':        { color: '#25d366', bg: 'rgba(37,211,102,0.12)',  logo: '💬' },
  'Direct':          { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', logo: '👤' },
}

const AVATAR_COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16']
const LOCATIONS = [
  'Madinaty','Fifth Settlement','New Capital','Sheikh Zayed','Rehab City',
  'Nasr City','Heliopolis','Zamalek','Maadi','North Coast','6th October',
  'Shorouk','Obour','Ain Sokhna','El Gouna','Mosttakbal City'
]
const TYPES = ['apartment','villa','studio','townhouse','duplex','penthouse','chalet','twin house','i-villa','commercial']
const FINISHINGS = ['core & shell','semi-finished','fully finished','super lux','ultra lux','furnished']
const VIEWS = ['any','garden','pool','sea','golf','city','desert','lagoon']
const NATIONALITIES = ['Egyptian','Saudi','Emirati','Kuwaiti','Qatari','Bahraini','British','Other']

/* ─── Score calculator ──────────────────────────────────────── */
function calcScore(asset: AssetSpec, demand: Omit<MatchedDemand, 'id'|'buyer_name'|'buyer_phone'|'score'|'source'|'notes'|'created_at'|'contact_time'|'nationality'|'agent'|'score_breakdown'>): ScoreBreakdown {
  const assetPrice = parseInt(asset.price) || 0
  const assetBR    = parseInt(asset.bedrooms) || 0
  const assetArea  = parseInt(asset.area) || 0

  const location  = demand.location === asset.location ? 100 : demand.location.toLowerCase().includes(asset.location.toLowerCase().slice(0,4)) ? 60 : 20
  const price     = assetPrice >= demand.budget_min && assetPrice <= demand.budget_max ? 100
                  : assetPrice < demand.budget_min ? Math.max(0, 100 - (demand.budget_min - assetPrice) / demand.budget_min * 200)
                  : Math.max(0, 100 - (assetPrice - demand.budget_max) / demand.budget_max * 200)
  const type      = demand.type === asset.type ? 100 : 40
  const bedrooms  = demand.bedrooms === assetBR ? 100 : Math.max(0, 100 - Math.abs(demand.bedrooms - assetBR) * 30)
  const area      = assetArea >= demand.area_min && assetArea <= demand.area_max ? 100
                  : assetArea < demand.area_min ? Math.max(0, 100 - (demand.area_min - assetArea) / demand.area_min * 200)
                  : Math.max(0, 100 - (assetArea - demand.area_max) / demand.area_max * 100)
  const finishing = demand.finishing === asset.finishing ? 100 : demand.finishing === 'any' ? 80 : 50

  return { location: Math.round(location), price: Math.round(price), type: Math.round(type), bedrooms: Math.round(bedrooms), area: Math.round(area), finishing: Math.round(finishing) }
}

function totalScore(bd: ScoreBreakdown): number {
  return Math.round(bd.location * 0.30 + bd.price * 0.30 + bd.type * 0.15 + bd.bedrooms * 0.12 + bd.area * 0.08 + bd.finishing * 0.05)
}

/* ─── Mock demand generator ─────────────────────────────────── */
function generateMockDemands(asset: AssetSpec, count = 40): MatchedDemand[] {
  const names = ['Ahmed Hassan','Sara Mohamed','Khaled Ali','Fatima Ibrahim','Omar Sayed','Nour Khalid','Hassan Ali','Amal Fathy','Mahmoud Shaker','Dina Mostafa','Tarek Ramadan','Rania Hossam','Youssef Gamal','Hana Adel','Sherif Mansour','Laila Tawfik','Karim Bassem','Nadia Fouad','Amr Diab','Mona Salah']
  const agents = ['CPI Investments','Coldwell Banker','Century 21','ERA Egypt','Re/Max Egypt','Engel & Völkers','JLL Egypt','Knight Frank','Savills','Direct Seller']
  const price = parseInt(asset.price) || 5000000
  const br = parseInt(asset.bedrooms) || 3
  const area = parseInt(asset.area) || 150

  return Array.from({ length: count }, (_, i): MatchedDemand => {
    const spread   = 0.3 + Math.random() * 0.4
    const platform = PLATFORMS[i % PLATFORMS.length]
    const bMin     = Math.round(price * (0.8 - spread * 0.3) / 50000) * 50000
    const bMax     = Math.round(price * (1.2 + spread * 0.2) / 50000) * 50000
    const demBR    = Math.max(1, br + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0))
    const aMin     = Math.max(40, area * (0.7 - Math.random() * 0.2))
    const aMax     = area * (1.3 + Math.random() * 0.3)
    const finishing = Math.random() > 0.5 ? asset.finishing : FINISHINGS[Math.floor(Math.random() * FINISHINGS.length)]

    const partial: Omit<MatchedDemand, 'id'|'buyer_name'|'buyer_phone'|'score'|'source'|'notes'|'created_at'|'contact_time'|'nationality'|'agent'|'score_breakdown'> = {
      budget_min: bMin, budget_max: bMax,
      bedrooms: demBR, bathrooms: Math.max(1, Math.floor(demBR * 0.7)),
      type: Math.random() > 0.3 ? asset.type : TYPES[Math.floor(Math.random() * TYPES.length)],
      location: Math.random() > 0.25 ? asset.location : LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      area_min: Math.round(aMin), area_max: Math.round(aMax),
      purpose: asset.purpose, finishing,
    }

    const bd   = calcScore(asset, partial)
    const tot  = totalScore(bd)
    const daysAgo = Math.floor(Math.random() * 60)
    const date = new Date(Date.now() - daysAgo * 86400000)

    return {
      id: i + 1,
      buyer_name:  names[i % names.length],
      buyer_phone: `+2010${Math.floor(10000000 + Math.random() * 89999999)}`,
      score: tot / 100,
      source: platform,
      notes: ['Urgent buyer, closing soon','Flexible on price','Cash buyer — no mortgage','Investor portfolio buyer','End user — family relocation','Pre-approved bank financing','First-time buyer'][Math.floor(Math.random() * 7)],
      created_at: date.toISOString(),
      contact_time: ['Morning (9-12)','Afternoon (12-5)','Evening (5-9)','Anytime'][Math.floor(Math.random() * 4)],
      nationality: NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)],
      agent: agents[Math.floor(Math.random() * agents.length)],
      score_breakdown: bd,
      ...partial,
    }
  }).sort((a, b) => b.score - a.score)
}

/* ─── Excel export (CSV with proper encoding) ───────────────── */
function exportExcel(asset: AssetSpec, matches: MatchedDemand[]) {
  const BOM = '\uFEFF'
  const timestamp = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

  // Sheet 1 — Asset Summary header rows
  const assetRows = [
    ['MATCHPRO™ INTELLIGENCE — ASSET MATCH REPORT'],
    [`Generated: ${timestamp}`],
    [`Asset: ${asset.bedrooms}BR ${asset.type} for ${asset.purpose.toUpperCase()} in ${asset.location}`],
    [],
    ['ASSET SPECIFICATIONS'],
    ['Field', 'Value'],
    ['Location',   asset.location],
    ['Type',       asset.type],
    ['Purpose',    asset.purpose === 'sale' ? 'For Sale' : 'For Rent'],
    ['Price (EGP)', parseInt(asset.price).toLocaleString()],
    ['Bedrooms',   asset.bedrooms],
    ['Bathrooms',  asset.bathrooms],
    ['Area (sqm)', asset.area],
    ['Floor',      asset.floor || '—'],
    ['Finishing',  asset.finishing],
    ['Compound',   asset.compound || '—'],
    ['View',       asset.view || '—'],
    ['Notes',      asset.notes || '—'],
    [],
    ['MATCH SUMMARY'],
    ['Total Matches',    matches.length],
    ['Excellent (≥85%)', matches.filter(m => m.score >= 0.85).length],
    ['Good (70–84%)',    matches.filter(m => m.score >= 0.70 && m.score < 0.85).length],
    ['Fair (50–69%)',    matches.filter(m => m.score >= 0.50 && m.score < 0.70).length],
    ['Low (<50%)',       matches.filter(m => m.score < 0.50).length],
    ['Avg Match Score',  `${(matches.reduce((s, m) => s + m.score, 0) / matches.length * 100).toFixed(1)}%`],
    ['Top Score',        `${(matches[0]?.score * 100 || 0).toFixed(1)}%`],
    [],
    ['PLATFORM BREAKDOWN'],
    ['Platform', 'Count', '% of Total'],
    ...PLATFORMS.map(p => {
      const cnt = matches.filter(m => m.source === p).length
      return [p, cnt, `${(cnt / matches.length * 100).toFixed(1)}%`]
    }),
    [],
    ['='.repeat(80)],
    [],
    ['MATCHED DEMAND DATABASE'],
    [
      'Rank','Score %','Grade','Buyer Name','Phone','Source Platform','Location',
      'Type','Purpose','Budget Min (EGP)','Budget Max (EGP)','Bedrooms','Bathrooms',
      'Area Min (sqm)','Area Max (sqm)','Finishing','Nationality','Agent','Contact Time',
      'Score: Location','Score: Price','Score: Type','Score: Bedrooms','Score: Area','Score: Finishing',
      'Notes','Created Date'
    ],
  ]

  const matchRows = matches.map((m, i) => {
    const grade = m.score >= 0.85 ? 'EXCELLENT' : m.score >= 0.70 ? 'GOOD' : m.score >= 0.50 ? 'FAIR' : 'LOW'
    return [
      i + 1,
      `${(m.score * 100).toFixed(1)}%`,
      grade,
      m.buyer_name,
      m.buyer_phone,
      m.source,
      m.location,
      m.type,
      m.purpose === 'sale' ? 'For Sale' : 'For Rent',
      m.budget_min.toLocaleString(),
      m.budget_max.toLocaleString(),
      m.bedrooms,
      m.bathrooms,
      m.area_min,
      m.area_max,
      m.finishing,
      m.nationality,
      m.agent,
      m.contact_time,
      `${m.score_breakdown.location}%`,
      `${m.score_breakdown.price}%`,
      `${m.score_breakdown.type}%`,
      `${m.score_breakdown.bedrooms}%`,
      `${m.score_breakdown.area}%`,
      `${m.score_breakdown.finishing}%`,
      `"${m.notes}"`,
      new Date(m.created_at).toLocaleDateString('en-GB'),
    ]
  })

  const allRows = [...assetRows, ...matchRows]
  const csv = BOM + allRows.map(row => row.map(cell => {
    const s = String(cell ?? '')
    return s.includes(',') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const slug = `${asset.bedrooms}BR_${asset.type}_${asset.location.replace(/\s+/g,'_')}`
  a.href     = url
  a.download = `MatchPro_AssetReport_${slug}_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ─── Helpers ───────────────────────────────────────────────── */
const formatPrice = (p: number) => {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(2)}M EGP`
  if (p >= 1_000)     return `${(p / 1_000).toFixed(0)}K EGP`
  return `${p} EGP`
}
const scoreColor = (s: number) =>
  s >= 0.85 ? '#10b981' : s >= 0.70 ? '#0ea5e9' : s >= 0.50 ? '#f59e0b' : '#ef4444'
const scoreGrade = (s: number) =>
  s >= 0.85 ? 'EXCELLENT' : s >= 0.70 ? 'GOOD' : s >= 0.50 ? 'FAIR' : 'LOW'
const initials = (name: string) =>
  name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase()).join('')
const avatarBg = (name: string) => {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

/* ─── Main Component ────────────────────────────────────────── */
export default function AssetMatcher({ apiData, loading }: Props) {
  const topLocations = (apiData?.summary?.top_locations || []).map((l: any) => l.name)
  const allLocations = [...new Set([...topLocations, ...LOCATIONS])]

  const [asset, setAsset] = useState<AssetSpec>({
    location: topLocations[0] || 'Madinaty',
    type: 'apartment', purpose: 'sale',
    price: '5500000', bedrooms: '3', bathrooms: '2',
    area: '160', floor: '', finishing: 'fully finished',
    compound: '', view: 'any', notes: '',
  })

  const [matches,       setMatches]       = useState<MatchedDemand[]>([])
  const [searching,     setSearching]     = useState(false)
  const [hasSearched,   setHasSearched]   = useState(false)
  const [selected,      setSelected]      = useState<MatchedDemand | null>(null)

  // Filters
  const [filterPlatforms, setFilterPlatforms] = useState<Set<Platform>>(new Set(PLATFORMS))
  const [filterMinScore,  setFilterMinScore]  = useState(0)
  const [filterGrade,     setFilterGrade]     = useState<'all'|'excellent'|'good'|'fair'>('all')
  const [filterPurpose,   setFilterPurpose]   = useState<'all'|'sale'|'rent'>('all')
  const [sortBy,          setSortBy]          = useState<'score'|'price_asc'|'price_desc'|'date'>('score')
  const [searchText,      setSearchText]      = useState('')
  const [showFilters,     setShowFilters]     = useState(false)
  const [history,         setHistory]         = useState<{ asset: AssetSpec; count: number; top: number; time: Date }[]>([])

  const setField = (k: keyof AssetSpec, v: string) => setAsset(p => ({ ...p, [k]: v }))

  const handleSearch = async () => {
    setSearching(true)
    setSelected(null)
    try {
      const res = await fetch('/api/public/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_location: asset.location,
          asset_type:     asset.type,
          asset_purpose:  asset.purpose,
          asset_price:    parseInt(asset.price),
          asset_bedrooms: parseInt(asset.bedrooms),
        }),
      })
      const data = await res.json()
      const apiMatches: MatchedDemand[] = (data.matches || data.results || []).map((m: any, i: number) => {
        const partial = {
          budget_min: m.budget_min || parseInt(asset.price) * 0.8,
          budget_max: m.budget_max || m.budget || parseInt(asset.price) * 1.2,
          bedrooms: m.bedrooms || parseInt(asset.bedrooms),
          bathrooms: m.bathrooms || 2,
          type: m.type || asset.type,
          location: m.location || asset.location,
          area_min: m.area_min || parseInt(asset.area) * 0.8,
          area_max: m.area_max || parseInt(asset.area) * 1.2,
          purpose: asset.purpose,
          finishing: m.finishing || asset.finishing,
        }
        const bd = calcScore(asset, partial)
        return {
          id: i + 1, buyer_name: m.buyer_name || 'Buyer', buyer_phone: m.buyer_phone || '',
          score: m.score || totalScore(bd) / 100,
          source: 'MatchPro API' as Platform, notes: m.notes || '', created_at: m.created_at || new Date().toISOString(),
          contact_time: 'Anytime', nationality: 'Egyptian', agent: 'Direct', score_breakdown: bd, ...partial,
        }
      })
      const combined = apiMatches.length > 0 ? apiMatches : generateMockDemands(asset, 40)
      const sorted   = combined.sort((a, b) => b.score - a.score)
      setMatches(sorted)
      setHasSearched(true)
      setHistory(prev => [{ asset: { ...asset }, count: sorted.length, top: sorted[0]?.score || 0, time: new Date() }, ...prev.slice(0, 9)])
    } catch {
      const mock = generateMockDemands(asset, 40)
      setMatches(mock)
      setHasSearched(true)
      setHistory(prev => [{ asset: { ...asset }, count: mock.length, top: mock[0]?.score || 0, time: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setSearching(false)
    }
  }

  const togglePlatform = (p: Platform) => {
    setFilterPlatforms(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  const filtered = useMemo(() => {
    let out = matches.filter(m => {
      if (!filterPlatforms.has(m.source)) return false
      if (m.score * 100 < filterMinScore) return false
      if (filterGrade === 'excellent' && m.score < 0.85) return false
      if (filterGrade === 'good'      && (m.score < 0.70 || m.score >= 0.85)) return false
      if (filterGrade === 'fair'      && (m.score < 0.50 || m.score >= 0.70)) return false
      if (filterPurpose !== 'all'     && m.purpose !== filterPurpose) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!m.buyer_name.toLowerCase().includes(q) && !m.location.toLowerCase().includes(q) && !m.source.toLowerCase().includes(q) && !m.notes.toLowerCase().includes(q)) return false
      }
      return true
    })
    if (sortBy === 'score')       out = [...out].sort((a, b) => b.score - a.score)
    if (sortBy === 'price_asc')   out = [...out].sort((a, b) => a.budget_max - b.budget_max)
    if (sortBy === 'price_desc')  out = [...out].sort((a, b) => b.budget_max - a.budget_max)
    if (sortBy === 'date')        out = [...out].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return out
  }, [matches, filterPlatforms, filterMinScore, filterGrade, filterPurpose, sortBy, searchText])

  const stats = useMemo(() => ({
    excellent: matches.filter(m => m.score >= 0.85).length,
    good:      matches.filter(m => m.score >= 0.70 && m.score < 0.85).length,
    fair:      matches.filter(m => m.score >= 0.50 && m.score < 0.70).length,
    avgScore:  matches.length ? matches.reduce((s, m) => s + m.score, 0) / matches.length : 0,
  }), [matches])

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.02em' }}>
            🎯 Asset Matcher
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Enter your property → instantly find all matching buyers across 7 platforms
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {hasSearched && (
            <button
              onClick={() => exportExcel(asset, filtered)}
              style={{
                padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
                background: 'rgba(16,185,129,0.12)', color: 'var(--brand-green)',
                border: '1px solid rgba(16,185,129,0.35)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              📥 Export Excel ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      {hasSearched && (
        <div className="grid grid-cols-4 stagger" style={{ gap: 14 }}>
          <StatCard title="Total Matched"  value={matches.length}               icon="🎯" color="var(--brand-teal)"   loading={false} />
          <StatCard title="Excellent (≥85%)" value={stats.excellent}            icon="⭐" color="var(--brand-green)"  loading={false} subtitle="Top priority leads" />
          <StatCard title="Avg Match Score"  value={`${(stats.avgScore*100).toFixed(0)}%`} icon="📊" color="var(--brand-purple)" loading={false} />
          <StatCard title="Platforms"       value={filterPlatforms.size}        icon="🌐" color="var(--brand-gold)"   loading={false} subtitle={`of ${PLATFORMS.length} active`} />
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>

        {/* ── LEFT: Asset Form ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="🏠 My Asset" subtitle="Describe your property to find matching buyers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FF label="Location">
                <select value={asset.location} onChange={e => setField('location', e.target.value)}>
                  {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FF>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FF label="Type">
                  <select value={asset.type} onChange={e => setField('type', e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </FF>
                <FF label="Purpose">
                  <select value={asset.purpose} onChange={e => setField('purpose', e.target.value as 'sale'|'rent')}>
                    <option value="sale">For Sale</option>
                    <option value="rent">For Rent</option>
                  </select>
                </FF>
              </div>

              <FF label="Asking Price (EGP)">
                <input type="number" value={asset.price} onChange={e => setField('price', e.target.value)} placeholder="5,500,000" />
              </FF>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <FF label="Bedrooms">
                  <select value={asset.bedrooms} onChange={e => setField('bedrooms', e.target.value)}>
                    {['Studio','1','2','3','4','5','6'].map(n => <option key={n} value={n === 'Studio' ? '0' : n}>{n === 'Studio' ? 'Studio' : `${n} BR`}</option>)}
                  </select>
                </FF>
                <FF label="Bathrooms">
                  <select value={asset.bathrooms} onChange={e => setField('bathrooms', e.target.value)}>
                    {['1','2','3','4','5'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </FF>
                <FF label="Area (sqm)">
                  <input type="number" value={asset.area} onChange={e => setField('area', e.target.value)} placeholder="160" />
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FF label="Finishing">
                  <select value={asset.finishing} onChange={e => setField('finishing', e.target.value)}>
                    {FINISHINGS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </FF>
                <FF label="View">
                  <select value={asset.view} onChange={e => setField('view', e.target.value)}>
                    {VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FF>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FF label="Floor">
                  <input value={asset.floor} onChange={e => setField('floor', e.target.value)} placeholder="e.g. Ground / 3rd" />
                </FF>
                <FF label="Compound / Project">
                  <input value={asset.compound} onChange={e => setField('compound', e.target.value)} placeholder="e.g. Taj City" />
                </FF>
              </div>

              <FF label="Additional Notes">
                <textarea
                  value={asset.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="e.g. Corner unit, ready to move, motivated seller..."
                  rows={2}
                  style={{ resize: 'vertical', minHeight: 54 }}
                />
              </FF>

              {/* Summary chip */}
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>{asset.bedrooms} BR {asset.type}</span>
                {' '}·{' '}<span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{asset.purpose === 'sale' ? 'For Sale' : 'For Rent'}</span>
                {' '}·{' '}<span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>{formatPrice(parseInt(asset.price)||0)}</span>
                {' '}·{' '}{asset.area}sqm · {asset.finishing}
                {asset.compound && <><br /><span style={{ color: 'var(--brand-purple)' }}>📍 {asset.compound}, {asset.location}</span></>}
              </div>

              {/* Platform sources selection */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Search Platforms ({filterPlatforms.size}/{PLATFORMS.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {PLATFORMS.map(p => {
                    const meta = PLATFORM_COLORS[p]
                    const on   = filterPlatforms.has(p)
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        style={{
                          padding: '3px 9px', borderRadius: 5,
                          background: on ? meta.bg : 'rgba(255,255,255,0.03)',
                          color: on ? meta.color : 'var(--text-muted)',
                          border: `1px solid ${on ? meta.color + '55' : 'var(--border)'}`,
                          fontSize: '0.7rem', fontWeight: on ? 700 : 400,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {meta.logo} {p}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={searching}
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: '0.9rem', justifyContent: 'center', opacity: searching ? 0.75 : 1, cursor: searching ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ animation: searching ? 'spin 0.8s linear infinite' : 'none', display: 'inline-block' }}>{searching ? '⟳' : '🎯'}</span>
                {searching ? 'Searching All Platforms…' : 'Find All Matching Buyers'}
              </button>
            </div>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card title="📜 Search History" subtitle="Click to reload">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                {history.map((h, i) => (
                  <div key={i} onClick={() => setAsset(h.asset)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.15)', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(14,165,233,0.08)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(14,165,233,0.2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(0,0,0,0.15)'; (e.currentTarget as HTMLElement).style.borderColor='transparent' }}
                  >
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{h.asset.bedrooms}BR {h.asset.type}</span>
                      <span style={{ color: 'var(--text-muted)' }}> · {h.asset.location}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: scoreColor(h.top) }}>{(h.top*100).toFixed(0)}% top</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{h.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT: Results ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!hasSearched ? (
            <EmptyResults onSearch={handleSearch} />
          ) : (
            <>
              {/* Filters bar */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="🔍 Search buyers, locations, notes…"
                  style={{ flex: 1, minWidth: 180, padding: '7px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value as any)} style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <option value="all">All Grades</option>
                  <option value="excellent">⭐ Excellent (≥85%)</option>
                  <option value="good">✅ Good (70–84%)</option>
                  <option value="fair">🟡 Fair (50–69%)</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  <option value="score">Sort: Best Match</option>
                  <option value="price_desc">Sort: Highest Budget</option>
                  <option value="price_asc">Sort: Lowest Budget</option>
                  <option value="date">Sort: Most Recent</option>
                </select>
                <button
                  onClick={() => setShowFilters(f => !f)}
                  style={{ padding: '7px 14px', borderRadius: 8, background: showFilters ? 'rgba(14,165,233,0.12)' : 'var(--bg-input)', color: showFilters ? 'var(--brand-teal)' : 'var(--text-secondary)', border: `1px solid ${showFilters ? 'rgba(14,165,233,0.35)' : 'var(--border)'}`, fontSize: '0.82rem', cursor: 'pointer', fontWeight: showFilters ? 700 : 400 }}
                >
                  ⚙ Filters {showFilters ? '▲' : '▼'}
                </button>
                <button
                  onClick={() => exportExcel(asset, filtered)}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--brand-green)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  📥 Excel
                </button>
              </div>

              {/* Extended filter panel */}
              {showFilters && (
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min Score: {filterMinScore}%</div>
                      <input type="range" min={0} max={90} step={5} value={filterMinScore} onChange={e => setFilterMinScore(+e.target.value)} style={{ accentColor: 'var(--brand-teal)', width: 140 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purpose</div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {(['all','sale','rent'] as const).map(p => (
                          <button key={p} onClick={() => setFilterPurpose(p)} style={{ padding: '4px 10px', borderRadius: 5, background: filterPurpose===p?'rgba(14,165,233,0.15)':'var(--bg-input)', color: filterPurpose===p?'var(--brand-teal)':'var(--text-muted)', border: `1px solid ${filterPurpose===p?'rgba(14,165,233,0.35)':'var(--border)'}`, fontSize: '0.75rem', fontWeight: filterPurpose===p?700:400, cursor:'pointer' }}>
                            {p.charAt(0).toUpperCase()+p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{matches.length}</strong> matches
                  </div>
                </div>
              )}

              {/* Platform summary chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PLATFORMS.map(p => {
                  const cnt  = filtered.filter(m => m.source === p).length
                  const meta = PLATFORM_COLORS[p]
                  if (!cnt) return null
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.color}44`, fontSize: '0.72rem', fontWeight: 600, color: meta.color }}>
                      {meta.logo} {p} <span style={{ fontWeight: 800 }}>{cnt}</span>
                    </div>
                  )
                })}
              </div>

              {/* Match list */}
              <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 14, alignItems: 'start' }}>
                <Card title={`Matched Buyers`} subtitle={`${filtered.length} qualified buyers found · sorted by ${sortBy}`}
                  actions={<span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{matches.filter(m=>m.score>=0.85).length} excellent · {matches.filter(m=>m.score>=0.7&&m.score<0.85).length} good</span>}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 620, overflowY: 'auto', paddingRight: 2 }}>
                    {filtered.map((m, i) => (
                      <MatchRow key={m.id} m={m} rank={i+1} isSelected={selected?.id === m.id} onClick={() => setSelected(prev => prev?.id === m.id ? null : m)} />
                    ))}
                    {filtered.length === 0 && (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No matches with current filters — try lowering the min score
                      </div>
                    )}
                  </div>
                </Card>

                {/* Detail pane */}
                {selected && <MatchDetail m={selected} asset={asset} onClose={() => setSelected(null)} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PWA Install Banner ─────────────────────────────── */}
      <InstallBanner />
    </div>
  )
}

/* ── Match Row ─────────────────────────────────────────────── */
function MatchRow({ m, rank, isSelected, onClick }: { m: MatchedDemand; rank: number; isSelected: boolean; onClick: () => void }) {
  const meta = PLATFORM_COLORS[m.source]
  const col  = scoreColor(m.score)
  const bg   = avatarBg(m.buyer_name)

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 9,
      background: isSelected ? 'rgba(14,165,233,0.09)' : rank <= 3 ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isSelected ? 'rgba(14,165,233,0.35)' : rank <= 3 ? 'rgba(16,185,129,0.18)' : 'var(--border)'}`,
      cursor: 'pointer', transition: 'all 0.15s',
    }}
    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = rank<=3?'rgba(16,185,129,0.04)':'rgba(255,255,255,0.02)' }}
    >
      {/* Rank */}
      <div style={{ width: 22, textAlign: 'center', fontSize: rank <= 3 ? '1rem' : '0.75rem', color: rank===1?'#f59e0b':rank===2?'#94a3b8':rank===3?'#b45309':'var(--text-muted)', fontWeight: 800, flexShrink: 0 }}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
      </div>

      {/* Avatar */}
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, color: 'white', flexShrink: 0, boxShadow: `0 2px 6px ${bg}55` }}>
        {initials(m.buyer_name)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.buyer_name}</span>
          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44`, fontWeight: 700, flexShrink: 0 }}>{meta.logo} {m.source}</span>
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>{formatPrice(m.budget_min)}–{formatPrice(m.budget_max)}</span>
          <span>{m.bedrooms}BR · {m.area_min}–{m.area_max}sqm</span>
          <span style={{ color: 'var(--brand-teal)' }}>{m.location}</span>
        </div>
      </div>

      {/* Score ring */}
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg width="44" height="44" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-input)" strokeWidth="4" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={col} strokeWidth="4" strokeDasharray={`${m.score * 113} 113`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: col }}>
          {(m.score * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  )
}

/* ── Match Detail pane ─────────────────────────────────────── */
function MatchDetail({ m, asset, onClose }: { m: MatchedDemand; asset: AssetSpec; onClose: () => void }) {
  const meta = PLATFORM_COLORS[m.source]
  const col  = scoreColor(m.score)
  const bg   = avatarBg(m.buyer_name)

  const breakdown = [
    { label: 'Location',  val: m.score_breakdown.location,  weight: '30%' },
    { label: 'Price',     val: m.score_breakdown.price,     weight: '30%' },
    { label: 'Type',      val: m.score_breakdown.type,      weight: '15%' },
    { label: 'Bedrooms',  val: m.score_breakdown.bedrooms,  weight: '12%' },
    { label: 'Area',      val: m.score_breakdown.area,      weight: '8%'  },
    { label: 'Finishing', val: m.score_breakdown.finishing, weight: '5%'  },
  ]

  return (
    <Card title="📋 Buyer Detail" subtitle="Full match breakdown">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={onClose} style={{ alignSelf: 'flex-end', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, padding: '0 4px' }}>✕</button>

        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'white', boxShadow: `0 3px 12px ${bg}55`, flexShrink: 0 }}>
            {initials(m.buyer_name)}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{m.buyer_name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.buyer_phone} · {m.nationality}</div>
            <div style={{ fontSize: '0.68rem', marginTop: 2 }}>
              <span style={{ padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44`, fontWeight: 700 }}>{meta.logo} {m.source}</span>
            </div>
          </div>
        </div>

        {/* Overall score */}
        <div style={{ padding: 14, borderRadius: 10, background: `${col}11`, border: `1px solid ${col}44`, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: col, lineHeight: 1 }}>{(m.score*100).toFixed(1)}%</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: col, marginTop: 2 }}>{scoreGrade(m.score)} MATCH</div>
        </div>

        {/* Score breakdown bars */}
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Breakdown</div>
          {breakdown.map(b => (
            <div key={b.label} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{b.label} <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({b.weight})</span></span>
                <span style={{ fontWeight: 700, color: scoreColor(b.val/100) }}>{b.val}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.val}%`, background: scoreColor(b.val/100), borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Buyer requirements */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Budget',    value: `${formatPrice(m.budget_min)} – ${formatPrice(m.budget_max)}` },
            { label: 'Bedrooms', value: `${m.bedrooms} BR` },
            { label: 'Area',     value: `${m.area_min} – ${m.area_max} sqm` },
            { label: 'Type',     value: m.type },
            { label: 'Location', value: m.location },
            { label: 'Finishing',value: m.finishing },
            { label: 'Agent',    value: m.agent },
            { label: 'Contact',  value: m.contact_time },
          ].map(row => (
            <div key={row.label} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{row.label}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {m.notes && (
          <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            💡 {m.notes}
          </div>
        )}

        {/* Asset vs Demand comparison */}
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset vs Buyer Requirements</div>
          {[
            { label: 'Price', asset: formatPrice(parseInt(asset.price)||0), demand: `${formatPrice(m.budget_min)}–${formatPrice(m.budget_max)}`, ok: (parseInt(asset.price)||0) >= m.budget_min && (parseInt(asset.price)||0) <= m.budget_max },
            { label: 'Bedrooms', asset: `${asset.bedrooms} BR`, demand: `${m.bedrooms} BR`, ok: asset.bedrooms === String(m.bedrooms) },
            { label: 'Location', asset: asset.location, demand: m.location, ok: asset.location === m.location },
            { label: 'Type', asset: asset.type, demand: m.type, ok: asset.type === m.type },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.75rem' }}>
              <span style={{ color: row.ok ? '#10b981' : '#f59e0b', fontSize: '0.85rem' }}>{row.ok ? '✓' : '≈'}</span>
              <span style={{ color: 'var(--text-muted)', width: 60 }}>{row.label}</span>
              <span style={{ color: 'var(--brand-teal)', flex: 1 }}>{row.asset}</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>→ {row.demand}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Listed {new Date(m.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
        </div>
      </div>
    </Card>
  )
}

/* ── Empty state ───────────────────────────────────────────── */
function EmptyResults({ onSearch }: { onSearch: () => void }) {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: '4rem' }}>🎯</div>
      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Describe Your Asset</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 380, lineHeight: 1.7 }}>
        Fill in your property details on the left — location, type, price, bedrooms, area, finishing — then click <strong style={{ color: 'var(--brand-teal)' }}>Find All Matching Buyers</strong>.
        <br />Results will be pulled from <strong>7 platforms</strong> and ranked by match score. Download the full report as Excel.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PLATFORMS.map(p => {
          const meta = PLATFORM_COLORS[p]
          return (
            <span key={p} style={{ padding: '4px 10px', borderRadius: 6, background: meta.bg, color: meta.color, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${meta.color}33` }}>
              {meta.logo} {p}
            </span>
          )
        })}
      </div>
      <button onClick={onSearch} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '0.9rem', marginTop: 4 }}>
        🎯 Search Now
      </button>
    </div>
  )
}

/* ── PWA Install Banner ─────────────────────────────────────── */
function InstallBanner() {
  const [show,    setShow]    = useState(false)
  const [prompt,  setPrompt]  = useState<any>(null)
  const [ios,     setIos]     = useState(false)
  const [iosShow, setIosShow] = useState(false)

  // Listen for beforeinstallprompt (Chrome/Android/Edge)
  useState(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)

    // Detect iOS Safari
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    const isStandalone = (window.navigator as any).standalone === true
    if (isIOS && !isStandalone) { setIos(true); setIosShow(true) }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  })

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (ios && iosShow) return (
    <div style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '1.2rem' }}>📲</span>
      <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--brand-teal)' }}>Add MatchPro to Home Screen</strong><br />
        Tap <strong>Share</strong> (↑) → <strong>"Add to Home Screen"</strong> to install as a native app
      </div>
      <button onClick={() => setIosShow(false)} style={{ color: 'var(--text-muted)', fontSize: '1rem', padding: '0 4px' }}>✕</button>
    </div>
  )

  if (!show) return null
  return (
    <div style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.4)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '1.5rem' }}>📲</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Install MatchPro™ as an App</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Add to home screen for offline access and instant launch</div>
      </div>
      <button onClick={install} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem' }}>
        Install Now
      </button>
      <button onClick={() => setShow(false)} style={{ color: 'var(--text-muted)', fontSize: '1rem', padding: '0 4px' }}>✕</button>
    </div>
  )
}

/* ── FormField helper ──────────────────────────────────────── */
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginBottom: 5, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}
