import { useState } from 'react'
import Card from '../components/Card'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface AssetInput {
  location: string
  type: string
  purpose: string
  price: string
  bedrooms: string
  bathrooms?: string
  area?: string
}

interface MatchResult {
  matches_found: number
  top_match_score: number
  location: string
  match_details?: any[]
  message?: string
  avg_match_score?: number
}

export default function Matches({ apiData, loading }: Props) {
  const [asset, setAsset] = useState<AssetInput>({
    location: 'Madinaty',
    type: 'apartment',
    purpose: 'sale',
    price: '5500000',
    bedrooms: '3'
  })
  const [result, setResult] = useState<MatchResult | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchHistory, setMatchHistory] = useState<Array<{ asset: AssetInput; result: MatchResult; time: Date }>>([])

  const topLocations = apiData?.summary?.top_locations || []
  const summary = apiData?.summary

  const handleMatch = async () => {
    setMatchLoading(true)
    try {
      const res = await fetch('/proxy/api/public/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_location: asset.location,
          asset_type: asset.type,
          asset_purpose: asset.purpose,
          asset_price: parseInt(asset.price),
          asset_bedrooms: parseInt(asset.bedrooms)
        })
      })
      const data = await res.json()
      const matchResult: MatchResult = {
        matches_found: data.matches_found || data.count || 0,
        top_match_score: data.top_match_score || data.best_score || 0,
        location: asset.location,
        match_details: data.matches || data.results || [],
        avg_match_score: data.avg_score || 0,
        message: data.message
      }
      setResult(matchResult)
      setMatchHistory(prev => [{ asset: { ...asset }, result: matchResult, time: new Date() }, ...prev.slice(0, 9)])
    } catch (err) {
      // Mock
      const mockResult: MatchResult = {
        matches_found: Math.floor(Math.random() * 60) + 15,
        top_match_score: 0.78 + Math.random() * 0.2,
        location: asset.location,
        avg_match_score: 0.65 + Math.random() * 0.2,
        match_details: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          buyer_name: ['Ahmed Hassan', 'Sara Mohamed', 'Khaled Ali', 'Fatima Ibrahim'][i % 4],
          buyer_phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
          score: (0.65 + (7 - i) * 0.04).toFixed(2),
          location: asset.location,
          budget: parseInt(asset.price) * (0.85 + i * 0.05),
          bedrooms: parseInt(asset.bedrooms),
          type: asset.type
        })),
        message: 'Demo results — connect to live API for real data'
      }
      setResult(mockResult)
      setMatchHistory(prev => [{ asset: { ...asset }, result: mockResult, time: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setMatchLoading(false)
    }
  }

  const formatPrice = (p: number) => {
    if (p >= 1000000) return `${(p / 1000000).toFixed(1)}M EGP`
    if (p >= 1000) return `${(p / 1000).toFixed(0)}K EGP`
    return `${p.toFixed(0)} EGP`
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return 'var(--brand-green)'
    if (score >= 0.7) return 'var(--brand-gold)'
    return 'var(--brand-red)'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 0.85) return <Badge variant="success">Excellent</Badge>
    if (score >= 0.7) return <Badge variant="warning">Good</Badge>
    return <Badge variant="danger">Moderate</Badge>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          🎯 Property Matches
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Match your property against the demand database to find qualified buyers
        </p>
      </div>

      <div className="grid grid-cols-3" style={{ gap: '16px' }}>
        <StatCard title="Total Matches" value={summary?.total_matches || 0} icon="🎯" color="var(--brand-teal)" loading={loading} />
        <StatCard title="Avg Match Rate" value="78%" subtitle="Across all assets" icon="📊" color="var(--brand-green)" loading={loading} />
        <StatCard title="My Searches" value={matchHistory.length} subtitle="This session" icon="🔍" color="var(--brand-purple)" loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        {/* Match Form */}
        <Card title="Asset Matcher" subtitle="Enter your property details to find matching buyers">
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
                  <option value="1">1 Bedroom</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4 Bedrooms</option>
                  <option value="5">5+ Bedrooms</option>
                </select>
              </FormField>

              <FormField label="Price (EGP)">
                <input
                  type="number"
                  value={asset.price}
                  onChange={e => setAsset(p => ({ ...p, price: e.target.value }))}
                  placeholder="5500000"
                />
              </FormField>
            </div>

            <button
              onClick={handleMatch}
              disabled={matchLoading}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: matchLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #0ea5e9, #10b981)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: matchLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {matchLoading ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Matching...</> : '🎯 Find Buyers'}
            </button>

            {/* Summary box */}
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontSize: '0.7rem', textTransform: 'uppercase' }}>Searching for</div>
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--brand-teal)' }}>{asset.bedrooms} BR {asset.type}</span>
                {' '}for{' '}
                <span style={{ color: asset.purpose === 'sale' ? 'var(--brand-green)' : 'var(--brand-gold)' }}>{asset.purpose}</span>
                {' '}in{' '}
                <span style={{ color: 'var(--brand-purple)' }}>{asset.location}</span>
                {' '}at{' '}
                <span style={{ color: 'var(--brand-gold)', fontWeight: 600 }}>{formatPrice(parseInt(asset.price) || 0)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {result ? (
            <>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <ResultStat label="Matches Found" value={result.matches_found} color="var(--brand-teal)" />
                <ResultStat label="Top Score" value={`${(result.top_match_score * 100).toFixed(0)}%`} color={getScoreColor(result.top_match_score)} />
                <ResultStat label="Avg Score" value={result.avg_match_score ? `${(result.avg_match_score * 100).toFixed(0)}%` : '—'} color="var(--brand-purple)" />
              </div>

              {/* Matches List */}
              <Card title="Matched Buyers" subtitle={`${result.matches_found} qualified buyers found`}>
                {result.message && (
                  <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--brand-gold)', marginBottom: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                    ℹ️ {result.message}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                  {(result.match_details || []).map((match: any, i: number) => (
                    <MatchCard key={i} match={match} rank={i + 1} formatPrice={formatPrice} getScoreBadge={getScoreBadge} getScoreColor={getScoreColor} />
                  ))}
                  {(result.match_details || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No detailed match data available. {result.matches_found} matches found.
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
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Ready to Match
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Fill in your property details and click "Find Buyers" to see matching demand
              </div>
            </div>
          )}

          {/* Search History */}
          {matchHistory.length > 0 && (
            <Card title="Recent Searches" subtitle="Your match history this session">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {matchHistory.map((h, i) => (
                  <div key={i}
                    onClick={() => { setAsset(h.asset); setResult(h.result) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.2)'}
                  >
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{h.asset.bedrooms}BR {h.asset.type}</span>
                      {' · '}
                      <span style={{ color: 'var(--text-muted)' }}>{h.asset.location}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-teal)' }}>{h.result.matches_found} matches</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function ResultStat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function MatchCard({ match, rank, formatPrice, getScoreBadge, getScoreColor }: any) {
  const score = parseFloat(match.score) || 0
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.2)',
      border: rank === 1 ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
      transition: 'all 0.2s'
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: rank === 1 ? 'var(--brand-green)' : rank <= 3 ? 'var(--brand-gold)' : 'var(--bg-input)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 700,
        flexShrink: 0
      }}>#{rank}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {match.buyer_name || 'Anonymous Buyer'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {match.buyer_phone || ''} · Budget: {match.budget ? formatPrice(match.budget) : '—'}
          {match.bedrooms ? ` · ${match.bedrooms}BR` : ''} {match.type || ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(score) }}>
          {(score * 100).toFixed(0)}%
        </div>
        {getScoreBadge(score)}
      </div>
    </div>
  )
}
