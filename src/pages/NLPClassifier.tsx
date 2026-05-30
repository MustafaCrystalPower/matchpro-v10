import { useState } from 'react'

/* ─── Types ─────────────────────────────────────────────────── */
type Classification = 'DEMAND' | 'SUPPLY' | 'BROKER_DEMAND' | 'IRRELEVANT'

interface NLPResult {
  classification: Classification
  confidence: number
  extracted: {
    intent?: string
    location?: string
    bedrooms?: number | null
    budget_max?: number | null
    price?: number | null
    property_type?: string
    area_sqm?: number | null
    urgency?: string
    finishing?: string
    amenities?: string[]
    floor?: number | null
    contact?: string
    name?: string
  }
  match_ready: boolean
  processing_time_ms?: number
}

const TEST_CASES = [
  {
    label: '🏢 Demand — Arabic',
    message: 'مطلوب شقة 3 غرف في مدينتي ميزانية 4 مليون',
    expected: 'DEMAND',
    expectedConf: 98,
  },
  {
    label: '🏠 Supply — Arabic',
    message: 'شقة للبيع في الرحاب 150 متر 3 غرف سعر 3.5 مليون',
    expected: 'SUPPLY',
    expectedConf: 97,
  },
  {
    label: '🤝 Broker Demand',
    message: 'عندي عميل بيدور على فيلا في الشيخ زايد ميزانية 8 مليون',
    expected: 'BROKER_DEMAND',
    expectedConf: 90,
  },
  {
    label: '🚫 Irrelevant',
    message: 'صباح الخير',
    expected: 'IRRELEVANT',
    expectedConf: 99,
  },
  {
    label: '🔍 Rent Demand',
    message: 'حد عنده شقة 2 اوض للايجار في التجمع؟',
    expected: 'DEMAND',
    expectedConf: 95,
  },
  {
    label: '🏡 Supply — Villa',
    message: 'فيلا للبيع في الشيخ زايد 4 غرف مع حديقة ومسبح سعر 12 مليون',
    expected: 'SUPPLY',
    expectedConf: 96,
  },
  {
    label: '🏙️ Demand — English',
    message: 'Looking for 2BR apartment in New Cairo budget 3.5M EGP',
    expected: 'DEMAND',
    expectedConf: 93,
  },
  {
    label: '📊 Urgent Buy',
    message: 'محتاج بسرعة شقة 3 غرف في التجمع الخامس ميزانية 5 مليون ونص',
    expected: 'DEMAND',
    expectedConf: 97,
  },
]

const CLASSIFICATION_COLORS: Record<Classification, { bg: string; border: string; text: string; dot: string }> = {
  DEMAND:        { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981', dot: '#10b981' },
  SUPPLY:        { bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.35)',  text: '#0ea5e9', dot: '#0ea5e9' },
  BROKER_DEMAND: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b', dot: '#f59e0b' },
  IRRELEVANT:    { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.35)', text: '#6b7280', dot: '#6b7280' },
}

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  DEMAND:        '🟢 DEMAND — Buyer / Renter',
  SUPPLY:        '🔵 SUPPLY — Seller / Landlord',
  BROKER_DEMAND: '🟡 BROKER DEMAND — Agent with Client',
  IRRELEVANT:    '⚫ IRRELEVANT — No RE Content',
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M EGP'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K EGP'
  return n.toString() + ' EGP'
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function NLPClassifier({ apiData }: { apiData?: any }) {
  const [message, setMessage] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [result, setResult] = useState<NLPResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [batchResults, setBatchResults] = useState<Array<{ test: typeof TEST_CASES[0]; result: NLPResult | null; loading: boolean }>>([])
  const [showBatch, setShowBatch] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)

  const classify = async (msg: string = message, name = senderName, phone = senderPhone) => {
    if (!msg.trim()) return
    setLoading(true)
    setError('')
    const start = Date.now()
    try {
      const res = await fetch('/api/nlp/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sender_name: name, sender_phone: phone }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult({ ...data, processing_time_ms: Date.now() - start })
    } catch (e: any) {
      setError('API error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const runBatch = async () => {
    setShowBatch(true)
    setBatchRunning(true)
    const initial = TEST_CASES.map(t => ({ test: t, result: null, loading: true }))
    setBatchResults(initial)
    for (let i = 0; i < TEST_CASES.map.length; i++) { void i }

    const updated = [...initial]
    await Promise.all(
      TEST_CASES.map(async (tc, i) => {
        const start = Date.now()
        try {
          const res = await fetch('/api/nlp/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: tc.message, sender_name: '', sender_phone: '' }),
          })
          const data = await res.json()
          updated[i] = { test: tc, result: { ...data, processing_time_ms: Date.now() - start }, loading: false }
        } catch {
          updated[i] = { test: tc, result: null, loading: false }
        }
        setBatchResults([...updated])
      })
    )
    setBatchRunning(false)
  }

  const col = result ? CLASSIFICATION_COLORS[result.classification] : null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
          }}>🧬</div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              NLP Classifier
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Arabic / English real estate message classification engine — 95%+ accuracy
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <StatBadge label="Arabic" value="✓" color="#10b981" />
            <StatBadge label="English" value="✓" color="#0ea5e9" />
            <StatBadge label="NLP v2" value="LIVE" color="#7c3aed" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* ─── Input Panel ─── */}
        <div>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📝</span> Message Input
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Message (Arabic or English)
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="مثال: مطلوب شقة 3 غرف في مدينتي ميزانية 4 مليون..."
                rows={5}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  direction: message && /[\u0600-\u06FF]/.test(message[0]) ? 'rtl' : 'ltr',
                  outline: 'none',
                  transition: 'border 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand-teal)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {message.length} chars
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sender Name</label>
                <input
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Ahmed Mohamed"
                  style={{
                    width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: '0.82rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                <input
                  value={senderPhone}
                  onChange={e => setSenderPhone(e.target.value)}
                  placeholder="+201234567890"
                  style={{
                    width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontSize: '0.82rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => classify()}
                disabled={loading || !message.trim()}
                className="btn btn-primary"
                style={{ flex: 1, opacity: loading || !message.trim() ? 0.6 : 1, cursor: loading || !message.trim() ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
              >
                {loading ? '⏳ Classifying...' : '🧬 Classify Message'}
              </button>
              <button
                onClick={() => { setMessage(''); setResult(null); setError('') }}
                style={{
                  padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer',
                }}
              >Clear</button>
            </div>

            {error && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: '0.78rem' }}>
                ❌ {error}
              </div>
            )}
          </div>

          {/* Quick Test Cases */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚡ Quick Test Cases
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEST_CASES.slice(0, 5).map((tc, i) => (
                <button
                  key={i}
                  onClick={() => { setMessage(tc.message); setTimeout(() => classify(tc.message), 100) }}
                  style={{
                    textAlign: 'left', padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)', borderRadius: 7,
                    color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{tc.label}</div>
                  <div style={{ direction: /[\u0600-\u06FF]/.test(tc.message[0]) ? 'rtl' : 'ltr', color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tc.message}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Result Panel ─── */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: '3rem', opacity: 0.3 }}>🧬</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Paste a message and click<br /><strong>Classify</strong> to see results
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ padding: 40, textAlign: 'center', minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Analyzing message...</div>
            </div>
          )}

          {result && col && (
            <div className="card fade-in" style={{ padding: 20 }}>
              {/* Classification badge */}
              <div style={{
                padding: '14px 16px',
                background: col.bg,
                border: `1px solid ${col.border}`,
                borderRadius: 10,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: col.text }}>
                    {CLASSIFICATION_LABELS[result.classification]}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {result.processing_time_ms}ms processing · {result.match_ready ? '✅ Match Ready' : '❌ Not Match Ready'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: col.text, lineHeight: 1 }}>
                    {result.confidence}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>confidence</div>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Confidence Score</span>
                  <span style={{ color: col.text, fontWeight: 700 }}>{result.confidence}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${result.confidence}%`,
                    background: `linear-gradient(90deg, ${col.dot}, ${col.dot}88)`,
                    borderRadius: 3, transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>

              {/* Extracted fields */}
              {result.classification !== 'IRRELEVANT' && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Extracted Data
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {result.extracted.intent && <ExtractedField label="Intent" value={result.extracted.intent.toUpperCase()} color={col.text} />}
                    {result.extracted.location && <ExtractedField label="Location" value={result.extracted.location} color="var(--text-primary)" />}
                    {result.extracted.bedrooms != null && <ExtractedField label="Bedrooms" value={`${result.extracted.bedrooms} BR`} color="var(--text-primary)" />}
                    {result.extracted.budget_max != null && <ExtractedField label="Max Budget" value={fmt(result.extracted.budget_max)} color="#10b981" />}
                    {result.extracted.price != null && <ExtractedField label="Price" value={fmt(result.extracted.price)} color="#0ea5e9" />}
                    {result.extracted.area_sqm != null && <ExtractedField label="Area" value={`${result.extracted.area_sqm} m²`} color="var(--text-primary)" />}
                    {result.extracted.property_type && <ExtractedField label="Type" value={result.extracted.property_type} color="var(--text-primary)" />}
                    {result.extracted.urgency && <ExtractedField label="Urgency" value={result.extracted.urgency.toUpperCase()} color={result.extracted.urgency === 'urgent' ? '#ef4444' : 'var(--text-muted)'} />}
                    {result.extracted.finishing && <ExtractedField label="Finishing" value={result.extracted.finishing} color="var(--text-primary)" />}
                    {result.extracted.floor != null && <ExtractedField label="Floor" value={`Floor ${result.extracted.floor}`} color="var(--text-primary)" />}
                    {result.extracted.contact && <ExtractedField label="Contact" value={result.extracted.contact} color="#f59e0b" />}
                    {result.extracted.name && <ExtractedField label="Name" value={result.extracted.name} color="var(--text-primary)" />}
                  </div>

                  {result.extracted.amenities && result.extracted.amenities.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Amenities</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.extracted.amenities.map((a, i) => (
                          <span key={i} style={{
                            padding: '3px 8px', background: 'rgba(124,58,237,0.1)',
                            border: '1px solid rgba(124,58,237,0.3)', borderRadius: 4,
                            fontSize: '0.72rem', color: '#a855f7',
                          }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.classification === 'IRRELEVANT' && (
                <div style={{ padding: '14px', background: 'rgba(107,114,128,0.08)', borderRadius: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No real estate content detected — message skipped from matching queue
                </div>
              )}
            </div>
          )}

          {/* Classification Legend */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Classification Types</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(CLASSIFICATION_LABELS) as [Classification, string][]).map(([key, label]) => {
                const c = CLASSIFICATION_COLORS[key]
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, boxShadow: `0 0 6px ${c.dot}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Batch Test Suite ─── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🧪 Full Test Suite — {TEST_CASES.length} Cases
          </h3>
          <button
            onClick={runBatch}
            disabled={batchRunning}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', opacity: batchRunning ? 0.7 : 1, cursor: batchRunning ? 'not-allowed' : 'pointer' }}
          >
            {batchRunning ? '⏳ Running...' : '▶ Run All Tests'}
          </button>
        </div>

        {showBatch && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 12 }}>
            {batchResults.map((br, i) => {
              const passed = br.result ? br.result.classification === br.test.expected : null
              const c = br.result ? CLASSIFICATION_COLORS[br.result.classification] : null
              return (
                <div key={i} className="card fade-in" style={{
                  padding: 14,
                  borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{br.test.label}</div>
                      <div style={{
                        fontSize: '0.78rem', color: 'var(--text-secondary)',
                        direction: /[\u0600-\u06FF]/.test(br.test.message[0]) ? 'rtl' : 'ltr',
                      }}>{br.test.message}</div>
                    </div>
                    {br.loading && <div style={{ width: 18, height: 18, border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
                    {!br.loading && br.result && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.7rem', marginBottom: 2 }}>{passed ? '✅ PASS' : '❌ FAIL'}</div>
                        <div style={{ fontSize: '0.7rem', color: c?.text, fontWeight: 700 }}>{br.result.confidence}%</div>
                      </div>
                    )}
                  </div>
                  {br.result && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
                        background: c?.bg, border: `1px solid ${c?.border}`, color: c?.text,
                      }}>{br.result.classification}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        Expected: {br.test.expected}
                      </span>
                      {br.result.extracted.location && (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0ea5e9' }}>
                          📍 {br.result.extracted.location}
                        </span>
                      )}
                      {(br.result.extracted.budget_max ?? br.result.extracted.price) && (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                          💰 {fmt(br.result.extracted.budget_max ?? br.result.extracted.price ?? 0)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showBatch && !batchRunning && batchResults.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            {(() => {
              const done = batchResults.filter(r => r.result)
              const passed = done.filter(r => r.result?.classification === r.test.expected)
              const accuracy = done.length > 0 ? Math.round(passed.length / done.length * 100) : 0
              return (
                <>
                  <StatCard label="Total Tests" value={TEST_CASES.length.toString()} color="var(--text-primary)" />
                  <StatCard label="Passed" value={passed.length.toString()} color="#10b981" />
                  <StatCard label="Failed" value={(done.length - passed.length).toString()} color="#ef4444" />
                  <StatCard label="Accuracy" value={`${accuracy}%`} color={accuracy >= 95 ? '#10b981' : accuracy >= 80 ? '#f59e0b' : '#ef4444'} />
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Helper Components ─────────────────────────────────────── */
function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 6,
      background: `${color}18`, border: `1px solid ${color}40`,
      fontSize: '0.68rem', fontWeight: 700, color,
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span>{value}</span>
      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{label}</span>
    </div>
  )
}

function ExtractedField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7,
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px', flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}
