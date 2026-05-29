import { useState } from 'react'

const EGYPT_LOCATIONS = [
  "Madinaty", "New Cairo", "Rehab", "Sheikh Zayed", "6th of October",
  "New Cairo 5th Settlement", "Madinaty B6", "Madinaty B11", "Madinaty B12",
  "Mostakbal City", "Beverly Hills", "Maadi", "Heliopolis", "North Coast",
  "مدينتي", "الرحاب", "الشيخ زايد", "التجمع الخامس", "القاهرة الجديدة",
]

interface SearchResult {
  id: number
  type: string
  purpose: string
  location: string
  price: number
  bedrooms: number
  area?: number
  contact: string
  name: string
  group: string
  source: string
}

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

export default function MySearch(_props: Props) {
  const [filters, setFilters] = useState({
    location: '',
    purpose: 'sale',
    type: '',
    min_price: '',
    max_price: '',
    bedrooms: '',
  })
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (filters.location) params.set('location', filters.location)
      if (filters.purpose) params.set('purpose', filters.purpose)
      if (filters.type) params.set('type', filters.type)
      if (filters.min_price) params.set('min_price', filters.min_price)
      if (filters.max_price) params.set('max_price', filters.max_price)
      if (filters.bedrooms) params.set('bedrooms', filters.bedrooms)
      params.set('limit', '50')

      const res = await fetch(`/api/public/supply?${params}`)
      const data = await res.json()
      setResults(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number, purpose: string) => {
    if (!price) return 'Price not listed'
    if (purpose === 'rent') return `${price.toLocaleString()} EGP/mo`
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M EGP`
    return `${price.toLocaleString()} EGP`
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          🔍 My Search
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.9rem' }}>
          Search all available supply across WhatsApp groups, Property Finder, Dubizzle & OLX
        </p>
      </div>

      {/* Filter Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          {/* Location */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📍 Location
            </label>
            <input
              list="locations-list"
              value={filters.location}
              onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
              placeholder="Any location..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
            <datalist id="locations-list">
              {EGYPT_LOCATIONS.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>

          {/* Purpose */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏷 Purpose
            </label>
            <select
              value={filters.purpose}
              onChange={e => setFilters(f => ({ ...f, purpose: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            >
              <option value="">Any</option>
              <option value="sale">For Sale</option>
              <option value="rent">For Rent</option>
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏠 Type
            </label>
            <select
              value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            >
              <option value="">Any type</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="duplex">Duplex</option>
              <option value="studio">Studio</option>
            </select>
          </div>

          {/* Bedrooms */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🛏 Bedrooms
            </label>
            <select
              value={filters.bedrooms}
              onChange={e => setFilters(f => ({ ...f, bedrooms: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} BR</option>)}
            </select>
          </div>

          {/* Min Price */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💰 Min Price
            </label>
            <input
              type="number"
              value={filters.min_price}
              onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}
              placeholder="0"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Max Price */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💰 Max Price
            </label>
            <input
              type="number"
              value={filters.max_price}
              onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))}
              placeholder="No limit"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '11px 32px',
            borderRadius: '10px',
            background: 'var(--gradient-brand)',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            letterSpacing: '0.02em',
          }}
        >
          {loading ? '⏳ Searching...' : '🔍 Search Properties'}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {loading ? 'Searching...' : `${total.toLocaleString()} properties found`}
            </h2>
            {results.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Showing {results.length} of {total}</span>
            )}
          </div>

          {!loading && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No properties found with these filters. Try broadening your search.</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {results.map(r => (
              <div key={r.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                    background: r.purpose === 'sale' ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)',
                    color: r.purpose === 'sale' ? 'var(--brand-green)' : '#818cf8',
                    textTransform: 'uppercase',
                  }}>
                    {r.purpose === 'sale' ? '🏷 For Sale' : '🔑 For Rent'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '6px' }}>
                    {r.source}
                  </span>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-teal)', marginBottom: '6px' }}>
                  {formatPrice(r.price, r.purpose)}
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  📍 {r.location} &nbsp;|&nbsp; 🏠 {r.type} &nbsp;{r.bedrooms > 0 ? `| 🛏 ${r.bedrooms}BR` : ''} {r.area ? `| 📐 ${r.area}m²` : ''}
                </div>

                {r.group && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    💬 {r.group}
                  </div>
                )}

                {r.contact && (
                  <a
                    href={`https://wa.me/${r.contact.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحبا، أنا مهتم بالعقار المعروض في ${r.location}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px',
                      background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                      color: '#25d366', fontSize: '0.8rem', fontWeight: 600,
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                  >
                    <span>💬</span> Contact on WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Scrape fresh data */}
          {searched && (
            <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(14,165,233,0.05)', borderRadius: '12px', border: '1px dashed rgba(14,165,233,0.2)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                🌐 Want fresh listings from Property Finder, Dubizzle & OLX?
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/scrape/all')
                  const data = await res.json()
                  alert(`✅ Scraped ${data.total_new || 0} new listings! Run search again to see them.`)
                }}
                style={{
                  padding: '9px 24px', borderRadius: '8px',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                🔄 Scrape Live Data Now
              </button>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Search the entire market</div>
          <div style={{ fontSize: '0.875rem' }}>Set your filters above and press Search to find matching properties from all sources.</div>
        </div>
      )}
    </div>
  )
}
