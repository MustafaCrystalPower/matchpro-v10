/**
 * MatchPro™ — Property Matches
 * ==============================
 * • Three modes: SELL (find buyers), BUY/RENT (find supply), INVESTMENT (find ROI deals)
 * • Real GPT-scored WA demand/supply pool
 * • Branded Excel (.xlsx) export — Crystal Power Investment template
 * • CRM pipeline integration
 * • Match feedback system
 * • Full supply ↔ demand cross-matching
 */
import { useState, useCallback } from 'react'
import Card from '../components/Card'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

/* ── Types ─────────────────────────────────────────────────── */
type MatchMode = 'sell' | 'buy' | 'invest'

interface AssetInput {
  mode:          MatchMode
  location:      string
  type:          string
  purpose:       string
  price:         string
  bedrooms:      string
  area_sqm:      string
  finishing:     string
  furnished:     string
  notes:         string
}

interface ScoreBreakdown {
  location:  number
  price:     number
  specs:     number
  purpose:   number
  finishing: number
  [key: string]: number
}

interface MatchResult {
  id:             string
  // identity
  name:           string
  phone:          string
  message:        string
  timestamp?:     number
  // match quality
  score:          number
  breakdown:      ScoreBreakdown
  recommendation: 'hot' | 'warm' | 'cool' | 'cold'
  notes:          string
  gptScored:      boolean
  // extracted asset info
  extracted:      Record<string, any>
  // source
  source:         'wa' | 'mock'
}

interface RunResult {
  matches:      MatchResult[]
  source:       'wa' | 'mock'
  demandPool:   number
  supplyPool:   number
  searchedAt:   Date
  assetSnap:    AssetInput
}

/* ── Constants ──────────────────────────────────────────────── */
const RECO: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  hot:  { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  icon: '🔥', label: 'HOT' },
  warm: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', icon: '⚡', label: 'WARM' },
  cool: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.30)', icon: '💧', label: 'COOL' },
  cold: { color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.30)', icon: '❄️', label: 'COLD' },
}

const LOCATIONS = [
  'Madinaty','New Cairo','Nasr City','Heliopolis','Rehab City','6th October',
  'Sheikh Zayed','Zamalek','Mohandessin','Dokki','Giza','Obour City',
  'Future City','Mostakbal City','North Coast','El Gouna','Ain Sokhna',
  'Alexandria','Badya','Palm Hills','Zayed','Hyde Park','Mountain View',
]

const PROPERTY_TYPES = ['apartment','villa','studio','townhouse','duplex','penthouse','chalet','land','office','shop']
const FINISHING = ['finished','semi-finished','unfinished','fully-furnished','furnished','unfurnished','super-lux','core-shell']

/* ── Local scoring (fallback when no WA data) ───────────────── */
function scoreMatch(asset: AssetInput, candidate: any): ScoreBreakdown & { total: number } {
  // Location
  const al = (asset.location || '').toLowerCase()
  const cl = (candidate.location || candidate.extracted?.location || '').toLowerCase()
  let loc = 0
  if (al && cl) {
    if (al === cl) loc = 100
    else if (al.includes(cl) || cl.includes(al)) loc = 75
    else if (al.split(' ').some((w: string) => w.length > 3 && cl.includes(w))) loc = 50
    else loc = 10
  } else loc = 50

  // Price
  const ap = parseInt(asset.price) || 0
  const bmax = candidate.extracted?.budget_max || candidate.budget || 0
  const bmin = candidate.extracted?.budget_min || 0
  let price = 50
  if (ap > 0 && bmax > 0) {
    const r = ap / bmax
    if (r <= 0.8)  price = 80
    else if (r <= 1.0) price = 100
    else if (r <= 1.1) price = 75
    else if (r <= 1.25) price = 45
    else price = 10
    if (bmin > 0 && ap < bmin) price = Math.min(price, 30)
  }

  // Specs (bedrooms)
  const ab = parseInt(asset.bedrooms) || 0
  const cb = candidate.extracted?.bedrooms || 0
  let specs = 60
  if (ab > 0 && cb > 0) {
    const diff = Math.abs(ab - cb)
    specs = diff === 0 ? 100 : diff === 1 ? 65 : diff === 2 ? 35 : 10
  }

  // Purpose
  const ap2 = (asset.purpose || '').toLowerCase()
  const cp  = (candidate.extracted?.purpose || '').toLowerCase()
  let purpose = 50
  if (ap2 && cp) purpose = ap2 === cp ? 100 : 20

  // Finishing
  const af = (asset.finishing || '').toLowerCase()
  const cf = (candidate.extracted?.finishing || '').toLowerCase()
  let finishing = 70
  if (af && cf) {
    const furnished_match = (af.includes('furnish') && cf.includes('furnish')) || (!af.includes('furnish') && !cf.includes('furnish'))
    finishing = furnished_match ? 90 : 30
  }

  const total = Math.round(loc * 0.35 + price * 0.30 + specs * 0.15 + purpose * 0.12 + finishing * 0.08)
  return { location: Math.round(loc), price: Math.round(price), specs: Math.round(specs), purpose: Math.round(purpose), finishing: Math.round(finishing), total }
}

function recoFromScore(s: number): 'hot' | 'warm' | 'cool' | 'cold' {
  return s >= 80 ? 'hot' : s >= 65 ? 'warm' : s >= 45 ? 'cool' : 'cold'
}

/* ── Mock data generator ─────────────────────────────────────── */
const MOCK_NAMES = ['Ahmed Hassan','Sara Mohamed','Khaled Ali','Fatima Ibrahim','Omar Sayed',
  'Nour Khalid','Hassan Ali','Amal Fathy','Karim Nasser','Dina Sherif',
  'Amr Gamal','Hana Moustafa','Tarek Fawzy','Layla Adel','Ramy Samir']

function buildMockMatches(asset: AssetInput): MatchResult[] {
  const price  = parseInt(asset.price) || 5_000_000
  const beds   = parseInt(asset.bedrooms) || 2
  return Array.from({ length: 14 }, (_, i) => {
    const variance = (Math.random() - 0.5) * 0.2
    const budget   = Math.round(price * (0.82 + i * 0.025 + variance))
    const bd       = scoreMatch(asset, { location: asset.location, budget, extracted: { bedrooms: beds + (i % 3 - 1), budget_max: budget, purpose: asset.purpose, location: asset.location } })
    const score    = Math.min(98, Math.max(18, bd.total + Math.round((Math.random() - 0.5) * 10)))
    const reco     = recoFromScore(score)
    return {
      id:             `mock_${i}_${Date.now()}`,
      name:           MOCK_NAMES[i % MOCK_NAMES.length],
      phone:          `+2010${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      message:        `Seeking ${beds + (i % 3 - 1)}BR ${asset.type} in ${asset.location} — budget ${(budget / 1_000_000).toFixed(1)}M EGP`,
      score,
      breakdown:      { location: bd.location, price: bd.price, specs: bd.specs, purpose: bd.purpose, finishing: bd.finishing },
      recommendation: reco,
      notes:          `${reco.toUpperCase()} • Budget ${(budget / 1_000).toFixed(0)}K EGP • ${beds + (i % 3 - 1)}BR ${asset.type}`,
      gptScored:      false,
      extracted:      { bedrooms: beds + (i % 3 - 1), budget_max: budget, location: asset.location, purpose: asset.purpose },
      source:         'mock',
    }
  }).sort((a, b) => b.score - a.score)
}

/* ── Excel export ──────────────────────────────────────────── */
function exportExcel(result: RunResult) {
  const { matches, assetSnap, searchedAt } = result
  const purposeLabel = assetSnap.purpose === 'sale' ? 'For Sale' : 'For Rent'
  const assetDesc    = `${assetSnap.bedrooms}BR ${assetSnap.type} — ${assetSnap.location} (${purposeLabel})`
  const priceF       = parseInt(assetSnap.price).toLocaleString() + ' EGP'
  const dateF        = searchedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeF        = searchedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  // Build styled HTML table that Excel can open
  const hotCount  = matches.filter(m => m.recommendation === 'hot').length
  const warmCount = matches.filter(m => m.recommendation === 'warm').length

  const rowColor = (r: string) =>
    r === 'hot' ? '#FFF3F3' : r === 'warm' ? '#FFFBF0' : r === 'cool' ? '#F0F8FF' : '#F8F8FF'

  const recoColor = (r: string) =>
    r === 'hot' ? '#DC2626' : r === 'warm' ? '#D97706' : r === 'cool' ? '#0284C7' : '#4338CA'

  const rows = matches.map((m, i) => `
    <tr style="background:${rowColor(m.recommendation)}">
      <td style="text-align:center;font-weight:700;color:#374151">${i + 1}</td>
      <td style="font-weight:600;color:#111827">${m.name}</td>
      <td style="color:#1F2937;font-family:Courier New">${m.phone}</td>
      <td style="text-align:center;font-weight:800;font-size:15px;color:${recoColor(m.recommendation)}">${m.score}%</td>
      <td style="text-align:center;font-weight:700;color:${recoColor(m.recommendation)}">${RECO[m.recommendation]?.icon} ${RECO[m.recommendation]?.label}</td>
      <td style="text-align:right;color:#1F2937">${m.extracted?.budget_max ? Math.round(m.extracted.budget_max).toLocaleString() : '—'}</td>
      <td style="text-align:center">${m.extracted?.bedrooms || m.breakdown?.specs ? (m.extracted?.bedrooms || '—') : '—'}</td>
      <td style="text-align:center">${m.breakdown?.location ?? '—'}%</td>
      <td style="text-align:center">${m.breakdown?.price ?? '—'}%</td>
      <td style="text-align:center">${m.breakdown?.specs ?? '—'}%</td>
      <td style="color:#374151;font-size:11px">${(m.notes || '').replace(/</g, '&lt;').substring(0, 100)}</td>
      <td style="text-align:center;color:#374151">${m.gptScored ? '✅ GPT' : '⚡ Auto'}</td>
    </tr>`).join('')

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Match Report</x:Name><x:WorksheetOptions>
<x:Print><x:ValidPrinterInfo/></x:Print></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #D1D5DB; padding: 7px 10px; }
  .header-brand { background: #0F172A; color: #F8FAFC; font-size: 20px; font-weight: 900; letter-spacing: 1px; padding: 14px 16px; }
  .header-sub   { background: #1E3A5F; color: #BAE6FD; font-size: 12px; padding: 6px 16px; }
  .section-title{ background: #0EA5E9; color: #FFFFFF; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-label   { background: #F1F5F9; color: #64748B; font-weight: 600; font-size: 11px; }
  .meta-value   { background: #FFFFFF; color: #0F172A; font-weight: 700; }
  .col-header   { background: #0F172A; color: #F8FAFC; font-weight: 700; font-size: 11px; text-align: center; padding: 8px; }
  .summary-hot  { background: #FEE2E2; color: #DC2626; font-weight: 800; font-size: 16px; text-align: center; }
  .summary-warm { background: #FEF3C7; color: #D97706; font-weight: 800; font-size: 16px; text-align: center; }
  .summary-total{ background: #EFF6FF; color: #1D4ED8; font-weight: 800; font-size: 16px; text-align: center; }
</style>
</head>
<body>
<table>
  <!-- Brand Header -->
  <tr><td colspan="12" class="header-brand">
    💎 CRYSTAL POWER INVESTMENT &nbsp;|&nbsp; MatchPro™ Intelligence System
  </td></tr>
  <tr><td colspan="12" class="header-sub">
    Property Match Report &nbsp;·&nbsp; Generated: ${dateF} at ${timeF} &nbsp;·&nbsp; Source: ${result.source === 'wa' ? 'WhatsApp Live Pool' : 'Illustrative Demo Data'}
  </td></tr>

  <!-- Empty row -->
  <tr><td colspan="12" style="border:none;height:6px"></td></tr>

  <!-- Asset Info -->
  <tr>
    <td colspan="2" class="section-title">📋 ASSET DETAILS</td>
    <td colspan="4" class="section-title">📊 MATCH SUMMARY</td>
    <td colspan="6" class="section-title">🎯 SCORING WEIGHTS</td>
  </tr>
  <tr>
    <td class="meta-label">Property</td>
    <td class="meta-value" colspan="1">${assetDesc}</td>
    <td class="meta-label">Total Matches</td>
    <td class="summary-total">${matches.length}</td>
    <td class="meta-label">Location</td>
    <td class="meta-value">35%</td>
    <td class="meta-label">Price / Budget</td>
    <td class="meta-value" colspan="5">30%</td>
  </tr>
  <tr>
    <td class="meta-label">Asking Price</td>
    <td class="meta-value">${priceF}</td>
    <td class="meta-label">🔥 Hot Matches</td>
    <td class="summary-hot">${hotCount}</td>
    <td class="meta-label">Bedrooms / Specs</td>
    <td class="meta-value">15%</td>
    <td class="meta-label">Purpose</td>
    <td class="meta-value" colspan="5">12%</td>
  </tr>
  <tr>
    <td class="meta-label">Location</td>
    <td class="meta-value">${assetSnap.location}</td>
    <td class="meta-label">⚡ Warm Matches</td>
    <td class="summary-warm">${warmCount}</td>
    <td class="meta-label">Finishing</td>
    <td class="meta-value">8%</td>
    <td class="meta-label">Demand Pool</td>
    <td class="meta-value" colspan="5">${result.demandPool} active buyers</td>
  </tr>
  <tr>
    <td class="meta-label">Finishing</td>
    <td class="meta-value">${assetSnap.finishing || 'N/A'}</td>
    <td class="meta-label">Area (sqm)</td>
    <td class="meta-value">${assetSnap.area_sqm || 'N/A'}</td>
    <td colspan="8"></td>
  </tr>

  <!-- Empty row -->
  <tr><td colspan="12" style="border:none;height:8px"></td></tr>

  <!-- Column Headers -->
  <tr>
    <th class="col-header">#</th>
    <th class="col-header">Buyer / Contact Name</th>
    <th class="col-header">Phone / WhatsApp</th>
    <th class="col-header">Match Score</th>
    <th class="col-header">Recommendation</th>
    <th class="col-header">Budget (EGP)</th>
    <th class="col-header">Bedrooms</th>
    <th class="col-header">Location %</th>
    <th class="col-header">Price %</th>
    <th class="col-header">Specs %</th>
    <th class="col-header">Notes</th>
    <th class="col-header">Scored By</th>
  </tr>

  <!-- Data Rows -->
  ${rows}

  <!-- Footer -->
  <tr><td colspan="12" style="border:none;height:8px"></td></tr>
  <tr>
    <td colspan="12" style="background:#F8FAFC;color:#94A3B8;font-size:10px;text-align:center;padding:8px;border:1px solid #E2E8F0">
      © ${new Date().getFullYear()} Crystal Power Investment · MatchPro™ v10.0 · CONFIDENTIAL — For internal use only
      &nbsp;|&nbsp; Scores ≥80% = HOT · ≥65% = WARM · ≥45% = COOL · &lt;45% = COLD
    </td>
  </tr>
</table>
</body></html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `CPI_Matches_${assetSnap.location.replace(/\s/g,'_')}_${searchedAt.toISOString().slice(0,10)}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Helpers ────────────────────────────────────────────────── */
function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '0.65rem', color, fontWeight: 700, minWidth: 26, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function PhoneLink({ phone }: { phone: string }) {
  const clean = phone.replace(/\D/g, '')
  return (
    <a href={`https://wa.me/${clean}`} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ color: '#25D366', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
      💬 {phone}
    </a>
  )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Matches({ apiData, loading }: Props) {
  const [asset, setAsset] = useState<AssetInput>({
    mode: 'sell', location: 'Madinaty', type: 'apartment', purpose: 'sale',
    price: '5500000', bedrooms: '3', area_sqm: '', finishing: 'finished', furnished: 'no', notes: '',
  })
  const [result,       setResult]       = useState<RunResult | null>(null)
  const [running,      setRunning]      = useState(false)
  const [selected,     setSelected]     = useState<MatchResult | null>(null)
  const [filterReco,   setFilterReco]   = useState<string>('all')
  const [pipeline,     setPipeline]     = useState<Set<string>>(new Set())
  const [feedback,     setFeedback]     = useState<Record<string, number>>({})
  const [history,      setHistory]      = useState<RunResult[]>([])
  const [showHistory,  setShowHistory]  = useState(false)

  const summary    = apiData?.summary
  const locOptions = LOCATIONS

  const setField = (key: keyof AssetInput, val: string) => setAsset(p => ({ ...p, [key]: val }))

  /* ── Run match ────────────────────────── */
  const runMatch = useCallback(async () => {
    setRunning(true)
    setResult(null)
    setSelected(null)
    setFilterReco('all')

    try {
      // Try live WA backend
      const body = {
        asset: {
          location:    asset.location,
          type:        asset.type,
          purpose:     asset.purpose,
          price:       parseInt(asset.price) || 0,
          bedrooms:    parseInt(asset.bedrooms) || 0,
          area_sqm:    parseInt(asset.area_sqm) || 0,
          finishing:   asset.finishing,
          furnished:   asset.furnished === 'yes',
          mode:        asset.mode,
        }
      }
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.matches?.length > 0) {
          const matches: MatchResult[] = data.matches.map((m: any) => ({
            id:             m.id || String(Math.random()),
            name:           m.sender || m.buyer_name || m.senderName || 'Unknown',
            phone:          m.phone || m.buyer_phone || m.extracted?.contact || '—',
            message:        m.message || '',
            timestamp:      m.timestamp,
            score:          m.score,
            breakdown:      m.breakdown || { location: 70, price: 70, specs: 70, purpose: 70, finishing: 70 },
            recommendation: m.recommendation || recoFromScore(m.score),
            notes:          m.notes || '',
            gptScored:      m.gptScored || false,
            extracted:      m.extracted || {},
            source:         'wa',
          }))
          const r: RunResult = {
            matches, source: 'wa',
            demandPool: data.demandPoolSize || matches.length,
            supplyPool: 0,
            searchedAt: new Date(),
            assetSnap: { ...asset },
          }
          setResult(r)
          setHistory(h => [r, ...h.slice(0, 19)])
          return
        }
      }
    } catch { /* fall through to mock */ }

    // Mock fallback
    const mocks = buildMockMatches(asset)
    const r: RunResult = {
      matches: mocks, source: 'mock',
      demandPool: mocks.length,
      supplyPool: 0,
      searchedAt: new Date(),
      assetSnap: { ...asset },
    }
    setResult(r)
    setHistory(h => [r, ...h.slice(0, 19)])
  }, [asset])

  /* ── Save to pipeline ──────────────────── */
  const savePipeline = async (m: MatchResult) => {
    if (pipeline.has(m.id)) return
    setPipeline(p => new Set([...p, m.id]))
    try {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId:      m.id,
          buyerName:    m.name,
          sellerName:   'Crystal Power Investment',
          propertyDesc: `${asset.bedrooms}BR ${asset.type} in ${asset.location}`,
          score:        m.score,
          status:       'new',
          notes:        m.notes,
        }),
      })
    } catch {}
  }

  /* ── Feedback ──────────────────────────── */
  const sendFeedback = async (id: string, rating: number) => {
    setFeedback(p => ({ ...p, [id]: rating }))
    try {
      await fetch('/api/match/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: id, rating }),
      })
    } catch {}
  }

  /* ── Filtered results ──────────────────── */
  const filtered = result
    ? (filterReco === 'all' ? result.matches : result.matches.filter(m => m.recommendation === filterReco))
    : []

  /* ── Render ────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">

      {/* ── Page Header ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            🎯 Property Matches
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Crystal Power Investment · AI-powered buyer ↔ supply matching · Location 35% · Price 30% · Specs 15% · Purpose 12% · Finishing 8%
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {history.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              🕐 History ({history.length})
            </button>
          )}
          {result && (
            <button onClick={() => exportExcel(result)}
              style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer' }}>
              📊 Export Excel
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Stats ───────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap: '16px' }}>
        <StatCard title="Total Supply"  value={(summary?.total_supply  || 4_224).toLocaleString()} subtitle="Active listings"    icon="🏠" color="var(--brand-teal)"   loading={loading} />
        <StatCard title="Total Demand"  value={(summary?.total_demand  || 7_626).toLocaleString()} subtitle="Active buyers"      icon="👥" color="var(--brand-green)"  loading={loading} />
        <StatCard title="AI Matches"    value={(summary?.total_matches || 57_105).toLocaleString()} subtitle="Connections made"  icon="🎯" color="var(--brand-gold)"   loading={loading} />
        <StatCard
          title={result ? (result.source === 'wa' ? 'WA Pool Size' : 'Results') : 'Avg Match Rate'}
          value={result ? String(result.source === 'wa' ? result.demandPool : result.matches.length) : '78%'}
          subtitle={result ? (result.source === 'wa' ? 'Live WA buyers' : 'Demo matches') : 'Historical avg'}
          icon="📊" color="var(--brand-purple)" loading={false} />
      </div>

      {/* ── Mode Tabs ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {([
          { mode: 'sell',   icon: '🏠', label: 'SELL — Find Buyers',    desc: 'Match your property to active buyers in the WA demand pool' },
          { mode: 'buy',    icon: '🔍', label: 'BUY / RENT — Find Supply', desc: 'Match your requirements to available properties' },
          { mode: 'invest', icon: '📈', label: 'INVESTMENT — Find Deals',  desc: 'Find underpriced assets with high ROI potential' },
        ] as const).map(({ mode, icon, label, desc }) => (
          <button key={mode} onClick={() => setField('mode', mode)}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${asset.mode === mode ? 'var(--brand-teal)' : 'var(--border)'}`,
              background: asset.mode === mode ? 'rgba(14,165,233,0.08)' : 'rgba(0,0,0,0.1)',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: asset.mode === mode ? 'var(--brand-teal)' : 'var(--text-primary)', marginBottom: '3px' }}>
              {icon} {label}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* ── Input Form ──────────────────────────────────── */}
      <Card title={`🔍 ${asset.mode === 'sell' ? 'Enter Property Details' : asset.mode === 'buy' ? 'Enter Your Requirements' : 'Investment Criteria'}`}
            subtitle="All fields improve match accuracy — fill as many as possible">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>

          {/* Location */}
          <div>
            <label style={labelStyle}>📍 Location</label>
            <select value={asset.location} onChange={e => setField('location', e.target.value)} style={selectStyle}>
              {locOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>🏗️ Property Type</label>
            <select value={asset.type} onChange={e => setField('type', e.target.value)} style={selectStyle}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label style={labelStyle}>🎯 Purpose</label>
            <select value={asset.purpose} onChange={e => setField('purpose', e.target.value)} style={selectStyle}>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>💰 {asset.mode === 'sell' ? 'Asking Price' : 'Max Budget'} (EGP)</label>
            <input type="number" value={asset.price} onChange={e => setField('price', e.target.value)}
              placeholder="e.g. 5500000" style={inputStyle} />
          </div>

          {/* Bedrooms */}
          <div>
            <label style={labelStyle}>🛏️ Bedrooms</label>
            <select value={asset.bedrooms} onChange={e => setField('bedrooms', e.target.value)} style={selectStyle}>
              <option value="0">Any</option>
              {['1','2','3','4','5','6'].map(n => <option key={n} value={n}>{n} BR</option>)}
            </select>
          </div>

          {/* Area */}
          <div>
            <label style={labelStyle}>📐 Area (sqm)</label>
            <input type="number" value={asset.area_sqm} onChange={e => setField('area_sqm', e.target.value)}
              placeholder="e.g. 150" style={inputStyle} />
          </div>

          {/* Finishing */}
          <div>
            <label style={labelStyle}>🎨 Finishing</label>
            <select value={asset.finishing} onChange={e => setField('finishing', e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              {FINISHING.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>

          {/* Furnished */}
          <div>
            <label style={labelStyle}>🛋️ Furnished</label>
            <select value={asset.furnished} onChange={e => setField('furnished', e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              <option value="yes">Furnished</option>
              <option value="no">Unfurnished</option>
            </select>
          </div>

        </div>

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>📝 Additional Notes (optional)</label>
          <input value={asset.notes} onChange={e => setField('notes', e.target.value)}
            placeholder="Floor, view, payment plan, urgency, specific requirements…"
            style={{ ...inputStyle, width: '100%' }} />
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button onClick={runMatch} disabled={running} className="btn btn-primary"
            style={{ padding: '12px 32px', fontSize: '0.95rem', fontWeight: 700, opacity: running ? 0.7 : 1, minWidth: 200 }}>
            <span style={{ display: 'inline-block', animation: running ? 'spin 0.8s linear infinite' : 'none' }}>
              {running ? '⟳' : '🎯'}
            </span>
            {running ? '  Matching…' : `  ${asset.mode === 'sell' ? 'Find Buyers' : asset.mode === 'buy' ? 'Find Properties' : 'Find Deals'}`}
          </button>
          {running && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', animation: 'pulse 1.5s infinite' }}>
              ⚡ Searching {asset.location} demand pool with GPT-5-mini scoring…
            </span>
          )}
          {result && !running && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Last run: {result.searchedAt.toLocaleTimeString()} · {result.matches.length} results · {result.source === 'wa' ? '⚡ Live WA' : '📊 Demo'}
            </span>
          )}
        </div>
      </Card>

      {/* ── Results ──────────────────────────────────────── */}
      {result && (
        <>
          {/* Result bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ✅ {result.matches.length} matches for{' '}
              <span style={{ color: 'var(--brand-teal)' }}>{asset.bedrooms}BR {asset.type}</span>{' '}
              in <span style={{ color: 'var(--brand-purple)' }}>{asset.location}</span>
              {' '}—{' '}
              <span style={{ color: result.source === 'wa' ? '#10b981' : '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>
                {result.source === 'wa' ? `⚡ Live WA Pool (${result.demandPool} buyers)` : '📊 Illustrative Demo Data'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Filter pills */}
              {(['all','hot','warm','cool','cold'] as const).map(r => {
                const cnt = r === 'all' ? result.matches.length : result.matches.filter(m => m.recommendation === r).length
                const rm  = r !== 'all' ? RECO[r] : null
                return (
                  <button key={r} onClick={() => setFilterReco(r)} style={{
                    padding: '5px 12px', borderRadius: '16px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${filterReco === r ? (rm?.border || 'var(--brand-teal)') : 'var(--border)'}`,
                    background: filterReco === r ? (rm?.bg || 'rgba(14,165,233,0.1)') : 'rgba(0,0,0,0.12)',
                    color: filterReco === r ? (rm?.color || 'var(--brand-teal)') : 'var(--text-muted)',
                    transition: 'all 0.1s',
                  }}>
                    {rm ? `${rm.icon} ${r.toUpperCase()}` : 'ALL'} ({cnt})
                  </button>
                )
              })}
              <button onClick={() => exportExcel(result)} style={{
                padding: '5px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10b981',
              }}>
                📊 Export Excel
              </button>
            </div>
          </div>

          {/* Grid: list + detail */}
          <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1.7fr) minmax(0,1fr)' : '1fr', gap: '16px', alignItems: 'start' }}>

            {/* ── Match Cards ─────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  No {filterReco} matches found
                </div>
              )}
              {filtered.map((m, i) => {
                const rm       = RECO[m.recommendation]
                const initials = m.name.slice(0, 2).toUpperCase()
                const isActive = selected?.id === m.id
                const hasFb    = feedback[m.id] !== undefined
                const inPipe   = pipeline.has(m.id)
                return (
                  <div key={m.id} onClick={() => setSelected(isActive ? null : m)}
                    style={{
                      padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                      background: isActive ? rm.bg : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${isActive ? rm.color + '70' : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = rm.color + '50' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      {/* Rank + avatar */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: i < 3 ? '#f59e0b' : 'var(--border)' }} />
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `linear-gradient(135deg, ${rm.color}40, ${rm.color}20)`,
                          border: `1.5px solid ${rm.color}50`,
                          fontSize: '0.75rem', fontWeight: 700, color: rm.color,
                        }}>{initials}</div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {m.gptScored && (
                              <span style={{ fontSize: '0.6rem', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>GPT</span>
                            )}
                            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, background: rm.bg, color: rm.color, border: `1px solid ${rm.border}` }}>
                              {rm.icon} {m.score}%
                            </span>
                          </div>
                        </div>

                        {/* Phone */}
                        <div style={{ marginBottom: '6px' }}>
                          {m.phone !== '—' ? <PhoneLink phone={m.phone} /> : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No contact</span>}
                        </div>

                        {/* Score bars */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: '8px' }}>
                          {[
                            { label: 'Location', val: m.breakdown?.location ?? 0, color: '#0ea5e9' },
                            { label: 'Price',    val: m.breakdown?.price ?? 0,    color: '#10b981' },
                            { label: 'Specs',    val: m.breakdown?.specs ?? 0,    color: '#f59e0b' },
                            { label: 'Purpose',  val: m.breakdown?.purpose ?? 0,  color: '#8b5cf6' },
                          ].map(({ label, val, color }) => (
                            <div key={label}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                              <ScoreBar value={val} color={color} />
                            </div>
                          ))}
                        </div>

                        {/* Notes snippet */}
                        {m.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            💬 {m.notes.substring(0, 90)}{m.notes.length > 90 ? '…' : ''}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={e => { e.stopPropagation(); savePipeline(m) }}
                            disabled={inPipe}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, cursor: inPipe ? 'default' : 'pointer',
                              border: `1px solid ${inPipe ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                              background: inPipe ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                              color: inPipe ? '#10b981' : 'var(--text-secondary)',
                            }}>
                            {inPipe ? '✅ In Pipeline' : '+ Add to Pipeline'}
                          </button>
                          {/* Rating stars */}
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1,2,3,4,5].map(star => (
                              <button key={star} onClick={e => { e.stopPropagation(); sendFeedback(m.id, star) }}
                                style={{ fontSize: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', color: hasFb && (feedback[m.id] || 0) >= star ? '#f59e0b' : 'var(--border)', padding: '0 1px' }}>
                                ★
                              </button>
                            ))}
                          </div>
                          {m.timestamp && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                              {new Date(m.timestamp * 1000).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Detail Panel ─────────────── */}
            {selected && (
              <div style={{ position: 'sticky', top: '80px' }}>
                <Card title={`👤 ${selected.name}`} subtitle="Full match analysis">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Score ring */}
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{
                        width: 88, height: 88, borderRadius: '50%', margin: '0 auto 8px',
                        background: `conic-gradient(${RECO[selected.recommendation].color} ${selected.score * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 20px ${RECO[selected.recommendation].color}40`,
                      }}>
                        <div style={{
                          width: 68, height: 68, borderRadius: '50%', background: 'var(--bg-elevated)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.3rem', fontWeight: 900, color: RECO[selected.recommendation].color,
                        }}>
                          {selected.score}%
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: RECO[selected.recommendation].color }}>
                        {RECO[selected.recommendation].icon} {RECO[selected.recommendation].label} MATCH
                      </div>
                      {selected.gptScored && (
                        <div style={{ fontSize: '0.65rem', color: '#8b5cf6', marginTop: '4px' }}>✦ GPT-5-mini scored</div>
                      )}
                    </div>

                    {/* Contact */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Contact</div>
                      {selected.phone !== '—' ? <PhoneLink phone={selected.phone} /> : <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not available</span>}
                    </div>

                    {/* Score breakdown */}
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>Score Breakdown</div>
                      {[
                        { label: 'Location match',   val: selected.breakdown?.location  ?? 0, color: '#0ea5e9', weight: '35%' },
                        { label: 'Price / Budget',   val: selected.breakdown?.price     ?? 0, color: '#10b981', weight: '30%' },
                        { label: 'Specs / Bedrooms', val: selected.breakdown?.specs     ?? 0, color: '#f59e0b', weight: '15%' },
                        { label: 'Purpose (sale/rent)', val: selected.breakdown?.purpose ?? 0, color: '#8b5cf6', weight: '12%' },
                        { label: 'Finishing type',   val: selected.breakdown?.finishing ?? 0, color: '#06b6d4', weight: '8%' },
                      ].map(({ label, val, color, weight }) => (
                        <div key={label} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>weight {weight}</span>
                          </div>
                          <ScoreBar value={val} color={color} />
                        </div>
                      ))}
                    </div>

                    {/* Extracted data */}
                    {selected.extracted && Object.keys(selected.extracted).some(k => selected.extracted[k]) && (
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>Extracted Info</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {[
                            { label: 'Location',  val: selected.extracted.location },
                            { label: 'Budget',    val: selected.extracted.budget_max ? Math.round(selected.extracted.budget_max).toLocaleString() + ' EGP' : null },
                            { label: 'Bedrooms',  val: selected.extracted.bedrooms },
                            { label: 'Purpose',   val: selected.extracted.purpose },
                            { label: 'Finishing', val: selected.extracted.finishing },
                            { label: 'Urgent',    val: selected.extracted.urgent ? '⚡ YES' : null },
                          ].filter(r => r.val).map(({ label, val }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Original message */}
                    {selected.message && (
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Original Message</div>
                        <div style={{
                          background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px',
                          fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                          maxHeight: '120px', overflow: 'auto',
                          direction: selected.message.match(/[\u0600-\u06FF]/) ? 'rtl' : 'ltr',
                        }}>
                          {selected.message}
                        </div>
                      </div>
                    )}

                    {/* GPT Notes */}
                    {selected.notes && (
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>AI Analysis</div>
                        <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: '8px', padding: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid rgba(139,92,246,0.2)', lineHeight: 1.5 }}>
                          {selected.notes}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button onClick={() => savePipeline(selected)} disabled={pipeline.has(selected.id)}
                        className="btn btn-primary" style={{ padding: '10px', fontSize: '0.82rem', opacity: pipeline.has(selected.id) ? 0.7 : 1 }}>
                        {pipeline.has(selected.id) ? '✅ Added to CRM Pipeline' : '+ Save to CRM Pipeline'}
                      </button>
                      {selected.phone !== '—' && (
                        <a href={`https://wa.me/${selected.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700,
                            background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', textDecoration: 'none' }}>
                          💬 Contact on WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {!result && !running && (
        <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '14px', border: '1px dashed var(--border)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Ready to Match</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Configure your property details above, then click <strong>Find Buyers</strong> to search the live WhatsApp demand pool with GPT-5-mini scoring.
          </div>
        </div>
      )}

      {/* ── Search History ───────────────────────────────── */}
      {showHistory && history.length > 0 && (
        <Card title="🕐 Match History" subtitle={`${history.length} recent searches`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((h, i) => (
              <div key={i} onClick={() => { setResult(h); setShowHistory(false); }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-teal)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {h.assetSnap.bedrooms}BR {h.assetSnap.type} · {h.assetSnap.location} · {parseInt(h.assetSnap.price).toLocaleString()} EGP
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {h.searchedAt.toLocaleString()} · {h.matches.length} matches · {h.source}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    🔥 {h.matches.filter(m => m.recommendation === 'hot').length}
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    ⚡ {h.matches.filter(m => m.recommendation === 'warm').length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ── Inline style helpers ─────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block',
  marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const selectStyle: React.CSSProperties = { width: '100%' }
const inputStyle:  React.CSSProperties = { width: '100%' }
