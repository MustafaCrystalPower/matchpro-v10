import { useState } from 'react'
import Card from '../components/Card'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface Endpoint {
  method: 'GET' | 'POST'
  path: string
  description: string
  params?: { name: string; type: string; description: string; required: boolean; default?: string }[]
  body?: { name: string; type: string; description: string; required: boolean; default?: string }[]
  example?: string
  response?: any
}

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
]

export default function APIExplorer({ apiData }: Props) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0])
  const [params, setParams] = useState<Record<string, string>>({})
  const [bodyFields, setBodyFields] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<any>(null)
  const [responseLoading, setResponseLoading] = useState(false)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState('')

  const handleEndpointSelect = (ep: Endpoint) => {
    setSelectedEndpoint(ep)
    setResponse(null)
    setResponseTime(null)
    // Set defaults
    const defaultParams: Record<string, string> = {}
    ep.params?.forEach(p => { if (p.default) defaultParams[p.name] = p.default })
    setParams(defaultParams)
    const defaultBody: Record<string, string> = {}
    ep.body?.forEach(b => { if (b.default) defaultBody[b.name] = b.default })
    setBodyFields(defaultBody)
  }

  const buildUrl = () => {
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
      if (selectedEndpoint.method === 'POST') {
        options.headers = { 'Content-Type': 'application/json' }
        const body: Record<string, any> = {}
        selectedEndpoint.body?.forEach(f => {
          if (bodyFields[f.name] !== undefined) {
            body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
          }
        })
        options.body = JSON.stringify(body)
      }
      const res = await fetch(url, options)
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
    if (selectedEndpoint.method === 'POST') {
      const body: Record<string, any> = {}
      selectedEndpoint.body?.forEach(f => {
        if (bodyFields[f.name]) body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
      })
      return `curl -X POST "${url}" \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`
    }
    return `curl "${url}"`
  }

  const generateJsSnippet = () => {
    if (selectedEndpoint.method === 'POST') {
      const body: Record<string, any> = {}
      selectedEndpoint.body?.forEach(f => {
        if (bodyFields[f.name]) body[f.name] = f.type === 'number' ? parseFloat(bodyFields[f.name]) : bodyFields[f.name]
      })
      return `const response = await fetch('${buildUrl()}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(body, null, 2)})
})
const data = await response.json()`
    }
    return `const response = await fetch('${buildUrl()}')
const data = await response.json()
console.log(data)`
  }

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
                    )}
                  </div>
                ))}
              </div>
            )}

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
                  </div>
                ))}
              </div>
            )}

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
            </button>
          </Card>

          {/* Code Snippets */}
          <Card title="Code Snippets">
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
            </div>
          </Card>

          {/* Response */}
          {(response !== null || selectedEndpoint.response) && (
            <Card
              title="Response"
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
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

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
      }}>{code}</pre>
    </div>
  )
}
