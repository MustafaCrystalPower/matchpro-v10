import { useState } from 'react'
import Card from '../components/Card'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface AssetInput {
  location: string
  type:     string
  purpose:  string
  price:    string
  bedrooms: string
}

interface MatchResult {
  matches_found:   number
  top_match_score: number
  location:        string
  match_details?:  any[]
  message?:        string
  avg_match_score?: number
}

const AVATAR_COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

export default function Matches({ apiData, loading }: Props) {
  const [asset, setAsset] = useState<AssetInput>({
    location: 'Madinaty',
    type:     'apartment',
    purpose:  'sale',
    price:    '5500000',
    bedrooms: '3',
  })
  const [result, setResult]           = useState<MatchResult | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchHistory, setMatchHistory] = useState<Array<{ asset: AssetInput; result: MatchResult; time: Date }>>([])

  const topLocations = apiData?.summary?.top_locations || []
  const summary      = apiData?.summary

  const handleMatch = async () => {
    setMatchLoading(true)
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
      const mr: MatchResult = {
        matches_found:   data.matches_found || data.count || 0,
        top_match_score: data.top_match_score || data.best_score || 0,
        location:        asset.location,
        match_details:   data.matches || data.results || [],
        avg_match_score: data.avg_score || 0,
        message:         data.message,
      }
      setResult(mr)
      setMatchHistory(prev => [{ asset: { ...asset }, result: mr, time: new Date() }, ...prev.slice(0, 9)])
    } catch {
      const names = ['Ahmed Hassan','Sara Mohamed','Khaled Ali','Fatima Ibrahim','Omar Sayed','Nour Khalid','Hassan Ali','Amal Fathy']
      const mockResult: MatchResult = {
        matches_found:   Math.floor(Math.random() * 60) + 15,
        top_match_score: 0.78 + Math.random() * 0.2,
        location:        asset.location,
        avg_match_score: 0.65 + Math.random() * 0.2,
        match_details:   Array.from({ length: 8 }, (_, i) => ({
          id:          i + 1,
          buyer_name:  names[i % names.length],
          buyer_phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
          score:       (0.95 - i * 0.04).toFixed(2),
          location:    asset.location,
          budget:      parseInt(asset.price) * (0.88 + i * 0.04),
          bedrooms:    parseInt(asset.bedrooms),
          type:        asset.type,
        })),
        message: 'Demo results — connect to live API for real buyer data',
      }
      setResult(mockResult)
      setMatchHistory(prev => [{ asset: { ...asset }, result: mockResult, time: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setMatchLoading(false)
    }
  }

  const exportCSV = () => {
    if (!result?.match_details?.length) return
    const headers = ['Rank','Name','Phone','Score','Budget (EGP)','Bedrooms','Type']
    const rows = result.match_details.map((m: any, i: number) => [
      i + 1,
      m.buyer_name || 'Anonymous',
      m.buyer_phone || '',
      `${(parseFloat(m.score || 0) * 100).toFixed(0)}%`,
      m.budget ? Math.round(m.budget).toLocaleString() : '',
      m.bedrooms || '',
      m.type || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `match_results_${asset.location.replace(/\s+/g,'_')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const formatPrice = (p: number) => {
    if (p >= 1000000) return `${(p / 1000000).toFixed(1)}M EGP`
    if (p >= 1000)    return `${(p / 1000).toFixed(0)}K EGP`
    return `${p.toFixed(0)} EGP`
  }

  const getScoreColor = (score: number) =>
    score >= 0.85 ? 'var(--brand-green)' : score >= 0.70 ? 'var(--brand-gold)' : 'var(--brand-red)'

  const getScoreBadge = (score: number) =>
    score >= 0.85
      ? <Badge variant="success">Excellent</Badge>
      : score >= 0.70
      ? <Badge variant="warning">Good</Badge>
      : <Badge variant="danger">Moderate</Badge>

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          Property Matches
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Match your property against the demand database to find qualified buyers
        </p>
      </div>

      <div className="grid grid-cols-3 stagger" style={{ gap: '16px' }}>
        <StatCard title="Total Matches" value={summary?.total_matches || 0}   icon="🎯" color="var(--brand-teal)"   loading={loading} />
        <StatCard title="Match Rate"    value="78%"  subtitle="Across all assets"     icon="📊" color="var(--brand-green)"  loading={loading} />
        <StatCard title="My Searches"   value={matchHistory.length} subtitle="This session" icon="🔍" color="var(--brand-purple)" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px' }}>

        {/* ── Match Form ──────────────────────────────────── */}
        <Card title="Asset Matcher" subtitle="Enter property details to find buyers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField label="Location">
              <select value={asset.location} onChange={e => setAsset(p => ({ ...p, location: e.target.value }))}>
                {topLocations.map((l: any) => <option key={l.name} value={l.name}>{l.name}</option>)}
                <option value="Zamalek">Zamalek</option>
                <option value="Maadi">Maadi</option>
                <option value="Nasr City">Nasr City</option>
              </select>
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Property Type">
                <select value={asset.type} onChange={e => setAsset(p => ({ ...p, type: e.target.value }))}>
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="studio">Studio</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="duplex">Duplex</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="chalet">Chalet</option>
                </select>
              </FormField>
              <FormField label="Purpose">
                <select value={asset.purpose} onChange={e => setAsset(p => ({ ...p, purpose: e.target.value }))}>
                  <option value="sale">For Sale</option>
                  <option value="rent">For Rent</option>
                </select>
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Bedrooms">
                <select value={asset.bedrooms} onChange={e => setAsset(p => ({ ...p, bedrooms: e.target.value }))}>
                  {['1','2','3','4','5'].map(n => <option key={n} value={n}>{n} Bedroom{n !== '1' ? 's' : ''}</option>)}
                </select>
              </FormField>
              <FormField label="Price (EGP)">
                <input
                  type="number"
                  value={asset.price}
                  onChange={e => setAsset(p => ({ ...p, price: e.target.value }))}
                  placeholder="5,500,000"
                />
              </FormField>
            </div>

            {/* Summary preview */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}>
              Looking for buyers of a{' '}
              <strong style={{ color: 'var(--brand-teal)' }}>{asset.bedrooms}BR {asset.type}</strong>
              {' '}for{' '}
              <strong style={{ color: asset.purpose === 'sale' ? 'var(--brand-green)' : 'var(--brand-gold)' }}>{asset.purpose}</strong>
              {' '}in{' '}
              <strong style={{ color: 'var(--brand-purple)' }}>{asset.location}</strong>
              {' '}at{' '}
              <strong style={{ color: 'var(--brand-gold)' }}>{formatPrice(parseInt(asset.price) || 0)}</strong>
            </div>

            <button
              onClick={handleMatch}
              disabled={matchLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.9rem',
                justifyContent: 'center',
                opacity: matchLoading ? 0.7 : 1,
                cursor: matchLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ animation: matchLoading ? 'spin 0.8s linear infinite' : 'none', display: 'inline-block' }}>
                {matchLoading ? '⟳' : '🎯'}
              </span>
              {matchLoading ? 'Matching buyers…' : 'Find Matching Buyers'}
            </button>
          </div>
        </Card>

        {/* ── Results panel ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {result ? (
            <>
              {/* Score summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <ScoreStat label="Matches Found"   value={result.matches_found}  color="var(--brand-teal)" />
                <ScoreStat label="Top Score"        value={`${(result.top_match_score * 100).toFixed(0)}%`}                    color={getScoreColor(result.top_match_score)} />
                <ScoreStat label="Avg Score"        value={result.avg_match_score ? `${(result.avg_match_score * 100).toFixed(0)}%` : '—'} color="var(--brand-purple)" />
              </div>

              {/* Buyers list */}
              <Card
                title="Matched Buyers"
                subtitle={`${result.matches_found} qualified buyers found`}
                actions={
                  result.match_details?.length
                    ? <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
                        ⬇ Export CSV
                      </button>
                    : undefined
                }
              >
                {result.message && (
                  <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--brand-gold)', marginBottom: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                    ℹ️ {result.message}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 360, overflowY: 'auto' }}>
                  {(result.match_details || []).map((match: any, i: number) => {
                    const score   = parseFloat(match.score || 0)
                    const bgColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                    const name    = match.buyer_name || 'Anonymous Buyer'
                    return (
                      <div key={i} className="fade-in" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: i === 0 ? 'rgba(16,185,129,0.07)' : 'rgba(0,0,0,0.2)',
                        border: i === 0 ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border)',
                        animationDelay: `${i * 40}ms`,
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          background: bgColor,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          flexShrink: 0,
                          letterSpacing: '-0.02em',
                        }}>{initials(name)}</div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                            {i === 0 && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--brand-green)', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>BEST</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {match.buyer_phone && <span>{match.buyer_phone} · </span>}
                            {match.budget ? formatPrice(match.budget) : '—'}
                            {match.bedrooms && ` · ${match.bedrooms}BR`}
                            {match.type && ` · ${match.type}`}
                          </div>
                        </div>

                        {/* Score */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: `conic-gradient(${getScoreColor(score)} 0% ${(score * 100).toFixed(0)}%, var(--bg-input) 0%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: getScoreColor(score),
                            position: 'relative',
                          }}>
                            <div style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                              {(score * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {(result.match_details || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {result.matches_found} matches found — no detailed data available.
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              textAlign: 'center',
              minHeight: 250,
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Ready to Match</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: 240 }}>
                Fill in your property details and click "Find Matching Buyers"
              </div>
            </div>
          )}

          {/* Search History */}
          {matchHistory.length > 0 && (
            <Card title="Recent Searches" subtitle="Click to reload previous results">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 200, overflowY: 'auto' }}>
                {matchHistory.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => { setAsset(h.asset); setResult(h.result) }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.2)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  >
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{h.asset.bedrooms}BR {h.asset.type}</span>
                      <span style={{ color: 'var(--text-muted)' }}> · {h.asset.location}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-teal)' }}>
                        {h.result.matches_found} matches
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '5px', display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ScoreStat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
    </div>
  )
}
