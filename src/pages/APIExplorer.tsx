import { useState } from 'react'
import Card from '../components/Card'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface Endpoint {
<<<<<<< HEAD
  group: string
  method: 'GET' | 'POST' | 'PATCH'
=======
  method: 'GET' | 'POST'
>>>>>>> origin/main
  path: string
  description: string
  params?: { name: string; type: string; description: string; required: boolean; default?: string }[]
  body?: { name: string; type: string; description: string; required: boolean; default?: string }[]
  example?: string
  response?: any
}

<<<<<<< HEAD
const DISPLAY_URL = window.location.origin
const BASE_URL = DISPLAY_URL

const GROUP_COLORS: Record<string, string> = {
  'Market API':     '#0ea5e9',
  'Local Backend':  '#8b5cf6',
  'WhatsApp':       '#25d366',
}

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET:   { bg: 'rgba(14,165,233,0.18)',   text: '#0ea5e9' },
  POST:  { bg: 'rgba(16,185,129,0.18)',   text: '#10b981' },
  PATCH: { bg: 'rgba(245,158,11,0.18)',   text: '#f59e0b' },
}

const endpoints: Endpoint[] = [
  // ── Market API (proxied via /proxy) ──
  {
    group: 'Market API', method: 'GET', path: '/api/public/market-summary',
    description: 'Top locations with supply/demand/pressure metrics',
    response: { total_supply: 4224, total_demand: 7626, total_matches: 56566, top_locations: [{ name: 'Madinaty', demand: 1931, supply: 478, pressure: '4.04' }] }
  },
  {
    group: 'Market API', method: 'GET', path: '/api/public/market-intelligence',
    description: 'Full intelligence feed with all markets and signals',
    response: { version: '10.0.0', summary: { total_supply: 4224, total_demand: 7626 }, markets: [{ location: 'Madinaty', pressure_index: 4.04, market_signal: 'seller' }] }
  },
  {
    group: 'Market API', method: 'GET', path: '/api/public/supply',
    description: 'Filter supply listings by location, purpose, and more',
    params: [
      { name: 'location', type: 'string', description: 'Egyptian area name', required: true,  default: 'Madinaty' },
      { name: 'purpose',  type: 'string', description: 'sale or rent',        required: false, default: 'sale' },
      { name: 'limit',    type: 'number', description: 'Results per page',    required: false, default: '20' },
      { name: 'offset',   type: 'number', description: 'Pagination offset',   required: false, default: '0' },
    ],
  },
  {
    group: 'Market API', method: 'GET', path: '/api/public/demand',
    description: 'Filter demand requests by location, bedrooms, and more',
    params: [
      { name: 'location', type: 'string', description: 'Egyptian area name', required: true,  default: 'Madinaty' },
      { name: 'bedrooms', type: 'number', description: 'Number of bedrooms', required: false, default: '3' },
      { name: 'limit',    type: 'number', description: 'Results per page',   required: false, default: '20' },
    ],
  },
  {
    group: 'Market API', method: 'POST', path: '/api/public/match',
    description: 'Match an asset against the demand database to find qualified buyers',
    body: [
      { name: 'asset_location', type: 'string', description: 'Property location', required: true,  default: 'Madinaty' },
      { name: 'asset_type',     type: 'string', description: 'apartment, villa, studio, etc.', required: true, default: 'apartment' },
      { name: 'asset_purpose',  type: 'string', description: 'sale or rent',       required: true,  default: 'sale' },
      { name: 'asset_price',    type: 'number', description: 'Price in EGP',       required: true,  default: '5500000' },
      { name: 'asset_bedrooms', type: 'number', description: 'Bedroom count',      required: false, default: '3' },
    ],
    response: { matches: [], demandPoolSize: 0, source: 'market_api' }
  },
  {
    group: 'Market API', method: 'GET', path: '/api/public/embed/:location',
    description: 'Embeddable widget data for any location',
    params: [
      { name: ':location', type: 'string', description: 'Location name in URL path', required: true, default: 'Madinaty' }
    ],
    response: { location: 'Madinaty', demand_count: 1931, avg_price: 4800000 }
  },

  // ── Local Backend ──
  {
    group: 'Local Backend', method: 'GET', path: '/api/health',
    description: 'Backend health check — version, WA state, OpenAI status, Socket.IO clients',
    response: { version: '3.0.0', status: 'ok', openai: { available: true }, wa: { state: 'connected' }, socketio_clients: 1 }
  },
  {
    group: 'Local Backend', method: 'GET', path: '/api/market-data',
    description: 'Rich mock market data with 12 Egyptian markets, temperature, investment scores',
    response: { source: 'mock', markets: 12, summary: { total_supply: 4048, total_demand: 9541 } }
  },
  {
    group: 'Local Backend', method: 'POST', path: '/api/match',
    description: 'Three-tier matching: WA pool → Market API → local scoring (location 40%, price 35%, specs 25%)',
    body: [
      { name: 'asset.location',  type: 'string', description: 'Property location', required: true,  default: 'Madinaty' },
      { name: 'asset.type',      type: 'string', description: 'apartment, villa, etc.', required: true, default: 'apartment' },
      { name: 'asset.purpose',   type: 'string', description: 'sale or rent',      required: true,  default: 'sale' },
      { name: 'asset.price',     type: 'number', description: 'Price in EGP',      required: true,  default: '5500000' },
      { name: 'asset.bedrooms',  type: 'number', description: 'Bedroom count',     required: false, default: '3' },
    ],
    response: { matches: [], demandPoolSize: 0, source: 'local', tier: 3 }
  },
  {
    group: 'Local Backend', method: 'GET', path: '/api/brokers',
    description: 'Broker analytics — per-phone supply/demand/match counts',
    response: { brokers: [{ phone: '+201066505665', supply_count: 12, demand_count: 38, match_count: 7, total: 50 }], count: 1 }
  },
  {
    group: 'Local Backend', method: 'POST', path: '/api/pipeline',
    description: 'Create a CRM pipeline entry (lead contact record)',
    body: [
      { name: 'contact_name',  type: 'string', description: 'Lead full name',    required: true,  default: 'Ahmed Hassan' },
      { name: 'phone',         type: 'string', description: 'Phone number',      required: true,  default: '+201012345678' },
      { name: 'location',      type: 'string', description: 'Interested area',   required: false, default: 'Madinaty' },
      { name: 'budget',        type: 'number', description: 'Budget in EGP',     required: false, default: '5000000' },
      { name: 'property_type', type: 'string', description: 'Property type',     required: false, default: 'apartment' },
    ],
    response: { id: 'pipe_1234abcd', status: 'new', contact_name: 'Ahmed Hassan' }
  },
  {
    group: 'Local Backend', method: 'PATCH', path: '/api/pipeline/:id',
    description: 'Update pipeline entry status: new → contacted → viewing → offer → closed/lost',
    params: [
      { name: ':id', type: 'string', description: 'Pipeline entry ID', required: true, default: 'pipe_abc123' }
    ],
    body: [
      { name: 'status', type: 'string', description: 'new | contacted | viewing | offer | closed | lost', required: true, default: 'contacted' },
      { name: 'notes',  type: 'string', description: 'Stage notes', required: false, default: 'Called — interested' },
    ],
    response: { id: 'pipe_abc123', status: 'contacted' }
  },
  {
    group: 'Local Backend', method: 'POST', path: '/api/match/feedback',
    description: 'Submit match quality feedback (star rating 1–5) to improve scoring',
    body: [
      { name: 'matchId',  type: 'string', description: 'Match identifier', required: true,  default: 'match_abc' },
      { name: 'rating',   type: 'number', description: 'Star rating 1–5',  required: true,  default: '4' },
      { name: 'comments', type: 'string', description: 'Optional feedback', required: false, default: 'Good match' },
    ],
    response: { id: 'fb_xyz', matchId: 'match_abc', rating: 4 }
  },
  {
    group: 'Local Backend', method: 'GET', path: '/api/match/feedback',
    description: 'Get all recorded match feedback for analytics',
    response: { feedback: [], count: 0 }
  },

  // ── WhatsApp ──
  {
    group: 'WhatsApp', method: 'GET', path: '/api/messages',
    description: 'Get classified WhatsApp messages from the backend store',
    params: [
      { name: 'limit', type: 'number', description: 'Max messages to return', required: false, default: '100' }
    ],
    response: { messages: [], total: 0, connState: 'disconnected' }
  },
  {
    group: 'WhatsApp', method: 'POST', path: '/api/classify',
    description: 'Classify a message as supply or demand using NLP + GPT-5-mini',
    body: [
      { name: 'message', type: 'string', description: 'Raw WhatsApp message text', required: true, default: 'عندي شقة 3 غرف للبيع في مدينتي' }
    ],
    response: { label: 'supply', confidence: 95, location: 'Madinaty', bedrooms: 3 }
  },
=======
// Use the Vite dev proxy — works in both dev and preview
const PROXY_BASE = '/api'
const DISPLAY_URL = window.location.origin

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/public/market-summary',
    description: 'Top locations with supply/demand/pressure metrics',
    example: `curl ${DISPLAY_URL}/api/public/market-summary`,
    response: { total_supply: 4224, total_demand: 7626, total_matches: 56566, top_locations: [{ name: 'Madinaty', demand: 1931, supply: 478, pressure: '4.04' }] }
  },
  {
    method: 'GET',
    path: '/api/public/market-intelligence',
    description: 'Full intelligence feed with all markets and signals',
    example: `curl ${DISPLAY_URL}/api/public/market-intelligence`,
    response: { version: '10.0.0', summary: { total_supply: 4224, total_demand: 7626 }, markets: [{ location: 'Madinaty', pressure_index: 4.04, market_signal: 'seller' }] }
  },
  {
    method: 'GET',
    path: '/api/public/supply',
    description: 'Filter supply listings by location, purpose, and more',
    params: [
      { name: 'location', type: 'string', description: 'Egyptian area name', required: true, default: 'Madinaty' },
      { name: 'purpose', type: 'string', description: 'sale or rent', required: false, default: 'sale' },
      { name: 'limit', type: 'number', description: 'Results per page (max 100)', required: false, default: '20' },
      { name: 'offset', type: 'number', description: 'Pagination offset', required: false, default: '0' }
    ],
    example: `curl "${DISPLAY_URL}/api/public/supply?location=Madinaty&purpose=sale&limit=20"`
  },
  {
    method: 'GET',
    path: '/api/public/demand',
    description: 'Filter demand requests by location, bedrooms, and more',
    params: [
      { name: 'location', type: 'string', description: 'Egyptian area name', required: true, default: 'Madinaty' },
      { name: 'bedrooms', type: 'number', description: 'Number of bedrooms', required: false, default: '3' },
      { name: 'limit', type: 'number', description: 'Results per page (max 100)', required: false, default: '20' }
    ],
    example: `curl "${DISPLAY_URL}/api/public/demand?location=Madinaty&bedrooms=3&limit=20"`
  },
  {
    method: 'POST',
    path: '/api/public/match',
    description: 'Match an asset against the demand database to find qualified buyers',
    body: [
      { name: 'asset_location', type: 'string', description: 'Property location', required: true, default: 'Madinaty' },
      { name: 'asset_type', type: 'string', description: 'apartment, villa, studio, etc.', required: true, default: 'apartment' },
      { name: 'asset_purpose', type: 'string', description: 'sale or rent', required: true, default: 'sale' },
      { name: 'asset_price', type: 'number', description: 'Price in EGP', required: true, default: '5500000' },
      { name: 'asset_bedrooms', type: 'number', description: 'Number of bedrooms', required: false, default: '3' }
    ],
    example: `curl -X POST ${DISPLAY_URL}/api/public/match \\
  -H 'Content-Type: application/json' \\
  -d '{"asset_location":"Madinaty","asset_type":"apartment","asset_purpose":"sale","asset_price":5500000,"asset_bedrooms":3}'`
  },
  {
    method: 'GET',
    path: '/api/public/embed/:location',
    description: 'Get embeddable widget data for any location (demand count, avg price)',
    params: [
      { name: ':location', type: 'string', description: 'Location name in URL path', required: true, default: 'Madinaty' }
    ],
    example: `curl ${DISPLAY_URL}/api/public/embed/Madinaty`,
    response: { location: 'Madinaty', demand_count: 1931, avg_price: 4800000 }
  }
>>>>>>> origin/main
]

export default function APIExplorer({ apiData }: Props) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0])
<<<<<<< HEAD
  const [params,           setParams]           = useState<Record<string, string>>({})
  const [bodyFields,       setBodyFields]       = useState<Record<string, string>>({})
  const [response,         setResponse]         = useState<any>(null)
  const [responseLoading,  setResponseLoading]  = useState(false)
  const [responseTime,     setResponseTime]     = useState<number | null>(null)
  const [copiedCode,       setCopiedCode]       = useState('')
  const [activeGroup,      setActiveGroup]      = useState<string>('all')

  const groups = ['all', ...Array.from(new Set(endpoints.map(e => e.group)))]
  const filtered = activeGroup === 'all' ? endpoints : endpoints.filter(e => e.group === activeGroup)
=======
  const [params, setParams] = useState<Record<string, string>>({})
  const [bodyFields, setBodyFields] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<any>(null)
  const [responseLoading, setResponseLoading] = useState(false)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState('')
>>>>>>> origin/main

  const handleEndpointSelect = (ep: Endpoint) => {
    setSelectedEndpoint(ep)
    setResponse(null)
    setResponseTime(null)
<<<<<<< HEAD
=======
    // Set defaults
>>>>>>> origin/main
    const defaultParams: Record<string, string> = {}
    ep.params?.forEach(p => { if (p.default) defaultParams[p.name] = p.default })
    setParams(defaultParams)
    const defaultBody: Record<string, string> = {}
    ep.body?.forEach(b => { if (b.default) defaultBody[b.name] = b.default })
    setBodyFields(defaultBody)
  }

  const buildUrl = () => {
<<<<<<< HEAD
    // Local backend paths stay as-is; market API paths get /proxy prefix
    const isMarket = selectedEndpoint.path.startsWith('/api/public/')
    const proxyPath = isMarket
      ? selectedEndpoint.path.replace('/api/', '/proxy/api/')
      : selectedEndpoint.path
    let url = proxyPath
    Object.entries(params).forEach(([k, v]) => {
      if (k.startsWith(':')) url = url.replace(k, encodeURIComponent(v))
    })
=======
    // Use proxy path so requests work via Vite proxy (avoids CORS + direct IP exposure)
    const proxyPath = selectedEndpoint.path.replace('/api/', '/api/')
    let url = proxyPath
    // Replace path params
    Object.entries(params).forEach(([k, v]) => {
      if (k.startsWith(':')) {
        url = url.replace(k, encodeURIComponent(v))
      }
    })
    // Add query params
>>>>>>> origin/main
    const queryParams = Object.entries(params)
      .filter(([k]) => !k.startsWith(':'))
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    if (queryParams.length > 0) url += '?' + queryParams.join('&')
    return url
  }

  const handleTest = async () => {
    setResponseLoading(true)
    const start = Date.now()
    try {
      const url = buildUrl()
      const options: RequestInit = { method: selectedEndpoint.method }
<<<<<<< HEAD
      if (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PATCH') {
        options.headers = { 'Content-Type': 'application/json' }
        const body: Record<string, any> = {}
        selectedEndpoint.body?.forEach(f => {
          if (bodyFields[f.name] !== undefined && bodyFields[f.name] !== '') {
=======
      if (selectedEndpoint.method === 'POST') {
        options.headers = { 'Content-Type': 'application/json' }
        const body: Record<string, any> = {}
        selectedEndpoint.body?.forEach(f => {
          if (bodyFields[f.name] !== undefined) {
>>>>>>> origin/main
            body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
          }
        })
        options.body = JSON.stringify(body)
      }
<<<<<<< HEAD
      const res  = await fetch(url, options)
=======
      const res = await fetch(url, options)
>>>>>>> origin/main
      const data = await res.json()
      setResponse({ data, status: res.status, ok: res.ok })
    } catch (err: any) {
      setResponse({ error: err.message, status: 0, ok: false })
    } finally {
      setResponseTime(Date.now() - start)
      setResponseLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(''), 2000)
    })
  }

  const generateCurlCommand = () => {
    const url = buildUrl()
<<<<<<< HEAD
    const fullUrl = window.location.origin + url
    if (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PATCH') {
=======
    if (selectedEndpoint.method === 'POST') {
>>>>>>> origin/main
      const body: Record<string, any> = {}
      selectedEndpoint.body?.forEach(f => {
        if (bodyFields[f.name]) body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
      })
<<<<<<< HEAD
      return `curl -X ${selectedEndpoint.method} "${fullUrl}" \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`
    }
    return `curl "${fullUrl}"`
  }

  const generateJsSnippet = () => {
    const url = buildUrl()
    if (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PATCH') {
=======
      return `curl -X POST "${url}" \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`
    }
    return `curl "${url}"`
  }

  const generateJsSnippet = () => {
    if (selectedEndpoint.method === 'POST') {
>>>>>>> origin/main
      const body: Record<string, any> = {}
      selectedEndpoint.body?.forEach(f => {
        if (bodyFields[f.name]) body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
      })
<<<<<<< HEAD
      return `const response = await fetch('${url}', {
  method: '${selectedEndpoint.method}',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(body, null, 2)})
})
const data = await response.json()
console.log(data)`
    }
    return `const response = await fetch('${url}')
=======
      return `const response = await fetch('${buildUrl()}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(body, null, 2)})
})
const data = await response.json()`
    }
    return `const response = await fetch('${buildUrl()}')
>>>>>>> origin/main
const data = await response.json()
console.log(data)`
  }

<<<<<<< HEAD
  const mc = METHOD_COLORS[selectedEndpoint.method] || METHOD_COLORS.GET

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="page-container">

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          🔌 API Explorer
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Interactive documentation for MatchPro™ v3.0 — {endpoints.length} endpoints across 3 API groups
        </p>
      </div>

      {/* ── Info Banner ─────────────────────────────────── */}
      <div style={{
        padding: 16, borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(139,92,246,0.08))',
        border: '1px solid rgba(14,165,233,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            🌐 MatchPro™ API v3.0 — Market Intelligence + WhatsApp + CRM
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Base URL: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: 'var(--brand-teal)' }}>{BASE_URL}</code>
            &nbsp;·&nbsp; Socket.IO: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#8b5cf6' }}>/socket.io</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(GROUP_COLORS).map(([g, c]) => (
            <div key={g} style={{ padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
              background: `${c}18`, border: `1px solid ${c}44`, color: c }}>
              {g === 'Market API' ? '📊' : g === 'Local Backend' ? '🖥️' : '💬'} {g}
            </div>
          ))}
        </div>
      </div>

      {/* ── Group filter tabs ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {groups.map(g => {
          const col = g === 'all' ? '#94a3b8' : GROUP_COLORS[g]
          return (
            <button key={g} onClick={() => setActiveGroup(g)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              background: activeGroup === g ? `${col}22` : 'transparent',
              color:      activeGroup === g ? col : 'var(--text-muted)',
              border:     activeGroup === g ? `1px solid ${col}55` : '1px solid var(--border)',
              transition: 'all 0.2s',
            }}>
              {g === 'all' ? `All (${endpoints.length})` : `${g} (${endpoints.filter(e => e.group === g).length})`}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>

        {/* ── Endpoint List ──────────────────────────────── */}
        <Card title="Endpoints" subtitle={`${filtered.length} shown`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map((ep, i) => {
              const mc2 = METHOD_COLORS[ep.method] || METHOD_COLORS.GET
              const gc  = GROUP_COLORS[ep.group] || '#94a3b8'
              const isSelected = selectedEndpoint === ep
              return (
                <button key={i} onClick={() => handleEndpointSelect(ep)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px',
                  borderRadius: 8, background: isSelected ? `${gc}12` : 'rgba(0,0,0,0.18)',
                  border: isSelected ? `1px solid ${gc}44` : '1px solid var(--border)',
                  textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                    background: mc2.bg, color: mc2.text, flexShrink: 0, marginTop: 2, minWidth: 38, textAlign: 'center',
                  }}>{ep.method}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: isSelected ? gc : 'var(--text-primary)',
                      fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ep.path}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.3 }}>
                      {ep.description.slice(0, 55)}{ep.description.length > 55 ? '…' : ''}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* ── Detail Panel ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Endpoint info + form */}
          <Card>
            {/* Method + Path */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                background: mc.bg, color: mc.text }}>{selectedEndpoint.method}</span>
              <code style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                {selectedEndpoint.path}
              </code>
              <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700,
                background: `${GROUP_COLORS[selectedEndpoint.group] || '#94a3b8'}18`,
                color: GROUP_COLORS[selectedEndpoint.group] || '#94a3b8',
                border: `1px solid ${GROUP_COLORS[selectedEndpoint.group] || '#94a3b8'}33`,
              }}>{selectedEndpoint.group}</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {selectedEndpoint.description}
            </p>

            {/* Path / Query Parameters */}
            {(selectedEndpoint.params || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 8 }}>
                  {selectedEndpoint.params!.some(p => p.name.startsWith(':')) ? 'Path + Query Parameters' : 'Query Parameters'}
                </div>
                {selectedEndpoint.params?.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--brand-teal)', minWidth: 120, fontWeight: 600 }}>{p.name}</code>
                    <span style={{ fontSize: '0.68rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>{p.type}</span>
                    {p.required && <span style={{ fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>required</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{p.description}</span>
                    {!p.name.startsWith(':') && (
                      <input value={params[p.name] || ''} placeholder={p.default || ''}
                        onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                        style={{ width: 130, padding: '4px 8px', fontSize: '0.75rem' }} />
=======
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          🔌 API Explorer
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Interactive documentation for the MatchPro™ Market Intelligence Open API
        </p>
      </div>

      {/* API Info Banner */}
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.1))',
        border: '1px solid rgba(14,165,233,0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>🌐 Open API — Free for All Platforms</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            No authentication required for public endpoints · Base URL: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: 'var(--brand-teal)' }}>{BASE_URL}</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.8rem', color: 'var(--brand-green)', fontWeight: 600 }}>
            ✅ No Auth Required
          </div>
          <div style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', fontSize: '0.8rem', color: 'var(--brand-teal)', fontWeight: 600 }}>
            v10.0.0
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Endpoint List */}
        <Card title="Endpoints" subtitle={`${endpoints.length} available`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {endpoints.map((ep, i) => (
              <button
                key={i}
                onClick={() => handleEndpointSelect(ep)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: selectedEndpoint === ep ? 'rgba(14,165,233,0.1)' : 'rgba(0,0,0,0.2)',
                  border: selectedEndpoint === ep ? '1px solid rgba(14,165,233,0.3)' : '1px solid var(--border)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: ep.method === 'GET' ? 'rgba(14,165,233,0.2)' : 'rgba(16,185,129,0.2)',
                  color: ep.method === 'GET' ? 'var(--brand-teal)' : 'var(--brand-green)',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>{ep.method}</span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {ep.path}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{ep.description}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Endpoint Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: selectedEndpoint.method === 'GET' ? 'rgba(14,165,233,0.2)' : 'rgba(16,185,129,0.2)',
                color: selectedEndpoint.method === 'GET' ? 'var(--brand-teal)' : 'var(--brand-green)'
              }}>{selectedEndpoint.method}</span>
              <code style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {selectedEndpoint.path}
              </code>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {selectedEndpoint.description}
            </p>

            {/* Parameters */}
            {((selectedEndpoint.params || []).length > 0) && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {selectedEndpoint.method === 'GET' ? 'Query Parameters' : 'Path Parameters'}
                </div>
                {selectedEndpoint.params?.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--brand-teal)', minWidth: '120px', fontWeight: 600 }}>{p.name}</code>
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-purple)', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{p.type}</span>
                    {p.required && <span style={{ fontSize: '0.65rem', color: 'var(--brand-red)', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>required</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{p.description}</span>
                    {!p.name.startsWith(':') && (
                      <input
                        value={params[p.name] || ''}
                        onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                        placeholder={p.default || ''}
                        style={{ width: '120px', padding: '4px 8px', fontSize: '0.75rem' }}
                      />
>>>>>>> origin/main
                    )}
                  </div>
                ))}
              </div>
            )}

<<<<<<< HEAD
            {/* Request Body */}
            {(selectedEndpoint.body || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 8 }}>Request Body (JSON)</div>
                {selectedEndpoint.body?.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--brand-teal)', minWidth: 130, fontWeight: 600 }}>{f.name}</code>
                    <span style={{ fontSize: '0.68rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>{f.type}</span>
                    {f.required && <span style={{ fontSize: '0.62rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>required</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{f.description}</span>
                    <input value={bodyFields[f.name] || ''} placeholder={f.default || ''}
                      onChange={e => setBodyFields(prev => ({ ...prev, [f.name]: e.target.value }))}
                      style={{ width: 130, padding: '4px 8px', fontSize: '0.75rem' }} />
=======
            {/* Body */}
            {(selectedEndpoint.body || []).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Request Body (JSON)
                </div>
                {selectedEndpoint.body?.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--brand-teal)', minWidth: '140px', fontWeight: 600 }}>{f.name}</code>
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-purple)', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{f.type}</span>
                    {f.required && <span style={{ fontSize: '0.65rem', color: 'var(--brand-red)', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>required</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>{f.description}</span>
                    <input
                      value={bodyFields[f.name] || ''}
                      onChange={e => setBodyFields(prev => ({ ...prev, [f.name]: e.target.value }))}
                      placeholder={f.default || ''}
                      style={{ width: '120px', padding: '4px 8px', fontSize: '0.75rem' }}
                    />
>>>>>>> origin/main
                  </div>
                ))}
              </div>
            )}

<<<<<<< HEAD
            {/* Try it */}
            <button onClick={handleTest} disabled={responseLoading} style={{
              width: '100%', padding: 10, borderRadius: 8, fontWeight: 700, fontSize: '0.875rem',
              background: responseLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, var(--brand-teal), var(--brand-purple))',
              color: 'white', cursor: responseLoading ? 'not-allowed' : 'pointer',
            }}>
              {responseLoading ? '⏳ Sending…' : `▶ Try ${selectedEndpoint.method} Request`}
=======
            {/* Try it button */}
            <button
              onClick={handleTest}
              disabled={responseLoading}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: responseLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, var(--brand-teal), var(--brand-purple))',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: responseLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {responseLoading ? '⏳ Sending...' : `▶ Try ${selectedEndpoint.method} Request`}
>>>>>>> origin/main
            </button>
          </Card>

          {/* Code Snippets */}
          <Card title="Code Snippets">
<<<<<<< HEAD
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CodeBlock label="cURL" code={generateCurlCommand()} id="curl"
                copied={copiedCode === 'curl'} onCopy={() => copyToClipboard(generateCurlCommand(), 'curl')} />
              <CodeBlock label="JavaScript / fetch" code={generateJsSnippet()} id="js"
                copied={copiedCode === 'js'} onCopy={() => copyToClipboard(generateJsSnippet(), 'js')} />
=======
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <CodeBlock
                label="cURL"
                code={generateCurlCommand()}
                id="curl"
                copied={copiedCode === 'curl'}
                onCopy={() => copyToClipboard(generateCurlCommand(), 'curl')}
              />
              <CodeBlock
                label="JavaScript / fetch"
                code={generateJsSnippet()}
                id="js"
                copied={copiedCode === 'js'}
                onCopy={() => copyToClipboard(generateJsSnippet(), 'js')}
              />
>>>>>>> origin/main
            </div>
          </Card>

          {/* Response */}
          {(response !== null || selectedEndpoint.response) && (
            <Card
              title="Response"
<<<<<<< HEAD
              subtitle={response !== null ? `HTTP ${response.status} · ${responseTime}ms` : 'Example response'}
              actions={
                response !== null ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                    background: response.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: response.ok ? 'var(--brand-green)' : 'var(--brand-red)',
                    border: `1px solid ${response.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {response.ok ? '✓ Success' : '✗ Error'}
                  </span>
                ) : undefined
              }
            >
              <pre style={{
                background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 14, fontSize: '0.75rem',
                color: '#a5f3fc', overflow: 'auto', maxHeight: 300, lineHeight: 1.6, fontFamily: 'monospace',
              }}>
                {JSON.stringify(response?.data ?? response?.error ?? selectedEndpoint.response, null, 2)}
=======
              subtitle={response !== null ? `${response.status} · ${responseTime}ms` : 'Example response'}
              actions={
                response !== null && (
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: response.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: response.ok ? 'var(--brand-green)' : 'var(--brand-red)',
                    border: `1px solid ${response.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                  }}>
                    {response.ok ? '✓ Success' : '✗ Error'}
                  </span>
                )
              }
            >
              <pre style={{
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '0.75rem',
                color: '#a5f3fc',
                overflow: 'auto',
                maxHeight: '300px',
                lineHeight: 1.6,
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(response?.data || response?.error || selectedEndpoint.response, null, 2)}
>>>>>>> origin/main
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

<<<<<<< HEAD
function CodeBlock({ label, code, id, copied, onCopy }: {
  label: string; code: string; id: string; copied: boolean; onCopy: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
        <button onClick={onCopy} style={{
          padding: '4px 10px', borderRadius: 4, fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s',
          background: copied ? 'rgba(16,185,129,0.2)' : 'var(--bg-input)',
          color:      copied ? 'var(--brand-green)' : 'var(--text-muted)',
          border:     `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        }}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
      </div>
      <pre style={{
        background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 12, fontSize: '0.75rem',
        color: '#a5f3fc', overflow: 'auto', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
=======
function CodeBlock({ label, code, id, copied, onCopy }: { label: string; code: string; id: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
        <button
          onClick={onCopy}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            background: copied ? 'rgba(16,185,129,0.2)' : 'var(--bg-input)',
            color: copied ? 'var(--brand-green)' : 'var(--text-muted)',
            fontSize: '0.7rem',
            cursor: 'pointer',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
            transition: 'all 0.2s'
          }}
        >{copied ? '✓ Copied!' : '📋 Copy'}</button>
      </div>
      <pre style={{
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '0.75rem',
        color: '#a5f3fc',
        overflow: 'auto',
        lineHeight: 1.6,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
>>>>>>> origin/main
      }}>{code}</pre>
    </div>
  )
}
