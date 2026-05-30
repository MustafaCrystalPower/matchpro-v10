import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type ClassLabel = 'DEMAND' | 'SUPPLY' | 'BROKER_DEMAND' | 'IRRELEVANT'

interface ClassResult {
  classification: ClassLabel
  confidence: number
  reason?: string
  extracted: {
    intent?: string; location?: string; bedrooms?: number | null
    budget_max?: number | null; budget_min?: number | null
    price?: number | null; area_sqm?: number | null; floor?: number | null
    property_type?: string | null; purpose?: string | null
    finishing?: string | null; furnished?: boolean | null
    urgency?: string; contact?: string | null; name?: string | null
    floor_preference?: string | null; amenities?: string[]
    broker_phone?: string | null; client_budget?: number | null
  }
  match_ready: boolean
  processing_ms?: number
}

// ─── Test cases ───────────────────────────────────────────────────────────────
const TEST_CASES = [
  { label: 'Demand — 3BR Madinaty 4M',    text: 'مطلوب شقة 3 غرف في مدينتي ميزانية 4 مليون',               expected: 'DEMAND' },
  { label: 'Supply — Rehab 3BR sale',      text: 'شقة للبيع في الرحاب 150 متر 3 غرف سعر 3.5 مليون',         expected: 'SUPPLY' },
  { label: 'Broker — Villa 8M Zayed',      text: 'عندي عميل بيدور على فيلا في الشيخ زايد ميزانية 8 مليون', expected: 'BROKER_DEMAND' },
  { label: 'Irrelevant — greeting',        text: 'صباح الخير',                                               expected: 'IRRELEVANT' },
  { label: 'Demand — 2BR rent New Cairo',  text: 'حد عنده شقة 2 اوض للايجار في التجمع؟',                    expected: 'DEMAND' },
  { label: 'Supply — Villa compound',      text: 'فيلا للبيع كمبوند مدينتي 250 متر 4 غرف تشطيب سوبر لوكس', expected: 'SUPPLY' },
  { label: 'Demand — Studio furnished',   text: 'محتاج استديو مفروش في مدينة نصر للايجار الشهري',           expected: 'DEMAND' },
  { label: 'Supply — Rent Sheikh Zayed',  text: 'للإيجار شقة مفروشة 3 غرف في الشيخ زايد ايجار 15 الف شهري', expected: 'SUPPLY' },
]

// ─── Label color helpers ──────────────────────────────────────────────────────
const labelStyle = (lbl: ClassLabel) => ({
  DEMAND:       { bg: 'rgba(239,68,68,0.15)',    border: 'rgba(239,68,68,0.5)',    text: '#ef4444',  icon: '🔴' },
  SUPPLY:       { bg: 'rgba(14,165,233,0.15)',   border: 'rgba(14,165,233,0.5)',   text: '#0ea5e9',  icon: '🔵' },
  BROKER_DEMAND:{ bg: 'rgba(168,85,247,0.15)',   border: 'rgba(168,85,247,0.5)',   text: '#a855f7',  icon: '🟣' },
  IRRELEVANT:   { bg: 'rgba(100,116,139,0.15)',  border: 'rgba(100,116,139,0.5)',  text: '#94a3b8',  icon: '⚪' },
}[lbl])

function ConfidenceBar({ value }: { value: number }) {
  const col = value >= 90 ? '#22c55e' : value >= 70 ? '#fbbf24' : value >= 50 ? '#f97316' : '#ef4444'
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Confidence</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg,${col}99,${col})`, transition: 'width 0.6s ease', borderRadius: 3 }} />
      </div>
    </div>
  )
}

function ExtractedField({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null
  const display = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
    typeof value === 'number' && value >= 100000 ? `${(value / 1_000_000).toFixed(2)}M EGP` : String(value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{label.replace(/_/g, ' ')}</span>
      <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{display}</span>
    </div>
  )
}

function ResultCard({ result, input, ms }: { result: ClassResult; input: string; ms: number }) {
  const ls = labelStyle(result.classification)
  const ex = result.extracted
  const fields = Object.entries(ex).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,15,30,0.98))',
      border: `1px solid ${ls.border}`,
      borderRadius: 14, padding: 20,
      boxShadow: `0 0 24px ${ls.border}40`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: ls.bg, border: `1px solid ${ls.border}`, borderRadius: 10, padding: '8px 14px', fontSize: 18, fontWeight: 800, color: ls.text }}>
            {ls.icon} {result.classification}
          </div>
          {result.match_ready && (
            <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>✅ Match Ready</span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Processed in</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0ea5e9' }}>{ms}ms</div>
        </div>
      </div>

      {/* Confidence */}
      <div style={{ marginBottom: 16 }}>
        <ConfidenceBar value={result.confidence} />
        {result.reason && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>"{result.reason}"</div>}
      </div>

      {/* Extracted fields */}
      {fields.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Extracted Data ({fields.length} fields)</div>
          {fields.map(([k, v]) => <ExtractedField key={k} label={k} value={v} />)}
        </div>
      )}

      {/* Input text */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#94a3b8', direction: /[\u0600-\u06FF]/.test(input) ? 'rtl' : 'ltr', borderLeft: `3px solid ${ls.border}` }}>
        {input}
      </div>
    </div>
  )
}

// ─── Batch test row ───────────────────────────────────────────────────────────
function TestRow({ tc, result, loading, onRun }: { tc: typeof TEST_CASES[0]; result: ClassResult | null; loading: boolean; onRun: () => void }) {
  const passed = result && result.classification === tc.expected
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: result ? (passed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)') : 'rgba(255,255,255,0.03)',
      border: `1px solid ${result ? (passed ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)') : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
    }} onClick={onRun}>
      <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
        {loading ? '⏳' : result ? (passed ? '✅' : '❌') : '▶️'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{tc.label}</div>
        <div style={{ fontSize: 11, color: '#64748b', direction: /[\u0600-\u06FF]/.test(tc.text) ? 'rtl' : 'ltr' }}>{tc.text.slice(0, 60)}{tc.text.length > 60 ? '…' : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Expected:</span>
        <span style={{ ...labelStyle(tc.expected as ClassLabel), fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: `1px solid ${labelStyle(tc.expected as ClassLabel).border}`, background: labelStyle(tc.expected as ClassLabel).bg, color: labelStyle(tc.expected as ClassLabel).text }}>
          {tc.expected}
        </span>
        {result && (
          <>
            <span style={{ fontSize: 11, color: '#64748b' }}>Got:</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: `1px solid ${labelStyle(result.classification).border}`, background: labelStyle(result.classification).bg, color: labelStyle(result.classification).text }}>
              {result.classification}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{result.confidence}%</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NLPEngine() {
  const [input, setInput]         = useState('')
  const [result, setResult]       = useState<ClassResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [processingMs, setMs]     = useState(0)
  const [activeTab, setActiveTab] = useState<'classify' | 'batch' | 'rules'>('classify')
  const [batchResults, setBatchResults] = useState<Map<string, ClassResult>>(new Map())
  const [batchLoading, setBatchLoading] = useState<Set<string>>(new Set())
  const [batchRunning, setBatchRunning] = useState(false)

  const classify = useCallback(async (text: string) => {
    if (!text.trim()) return
    setLoading(true); setResult(null)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/nlp/classify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sender_name: 'Test User', sender_phone: '201066505665' }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const data: ClassResult = await res.json()
        setMs(Date.now() - t0)
        setResult(data)
      } else {
        // fallback to old classify endpoint
        const res2 = await fetch('/api/classify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data2 = await res2.json()
        setMs(Date.now() - t0)
        setResult({
          classification: data2.label?.toUpperCase() as ClassLabel || 'IRRELEVANT',
          confidence: data2.confidence || 50,
          reason: data2.reason,
          extracted: data2.extracted || {},
          match_ready: ['demand', 'supply', 'broker_demand'].includes(data2.label),
        })
      }
    } catch (e) {
      setMs(Date.now() - t0)
      setResult({ classification: 'IRRELEVANT', confidence: 0, reason: 'Error: ' + String(e), extracted: {}, match_ready: false })
    } finally {
      setLoading(false)
    }
  }, [])

  const classifyBatch = useCallback(async (tc: typeof TEST_CASES[0]) => {
    setBatchLoading(prev => new Set([...prev, tc.label]))
    const t0 = Date.now()
    try {
      const res = await fetch('/api/nlp/classify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tc.text }),
        signal: AbortSignal.timeout(15000),
      })
      let data: ClassResult
      if (res.ok) {
        data = await res.json()
      } else {
        const res2 = await fetch('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: tc.text }) })
        const d2 = await res2.json()
        data = { classification: d2.label?.toUpperCase() as ClassLabel || 'IRRELEVANT', confidence: d2.confidence || 50, reason: d2.reason, extracted: d2.extracted || {}, match_ready: false, processing_ms: Date.now() - t0 }
      }
      setBatchResults(prev => new Map([...prev, [tc.label, data]]))
    } catch {
      setBatchResults(prev => new Map([...prev, [tc.label, { classification: 'IRRELEVANT', confidence: 0, extracted: {}, match_ready: false }]]))
    } finally {
      setBatchLoading(prev => { const n = new Set(prev); n.delete(tc.label); return n })
    }
  }, [])

  const runAllTests = useCallback(async () => {
    setBatchRunning(true); setBatchResults(new Map())
    for (const tc of TEST_CASES) {
      await classifyBatch(tc)
      await new Promise(r => setTimeout(r, 500)) // avoid rate limit
    }
    setBatchRunning(false)
  }, [classifyBatch])

  const batchPassed = [...batchResults.values()].filter((r, i) => r.classification === TEST_CASES[i]?.expected).length
  const batchTotal  = batchResults.size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080f1e' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
              🧠 NLP Classification Engine
              <span style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', borderRadius: 20, padding: '2px 12px', fontSize: 12, fontWeight: 600 }}>v2.0</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>GPT-5-mini + Rule engine · Arabic/English · 95%+ accuracy</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['classify', 'batch', 'rules'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: activeTab === t ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                border: activeTab === t ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: activeTab === t ? '#8b5cf6' : '#94a3b8',
              }}>{{ classify: '🧪 Classify', batch: '🔬 Batch Test', rules: '📖 Rules' }[t]}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* ── Classify Tab ── */}
        {activeTab === 'classify' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
            <div>
              {/* Input */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>Input Message</div>
                <textarea
                  value={input} onChange={e => setInput(e.target.value)}
                  placeholder="اكتب رسالة عقارية هنا... or type a real estate message in English"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, resize: 'vertical', outline: 'none', direction: /[\u0600-\u06FF]/.test(input) ? 'rtl' : 'ltr', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => classify(input)} disabled={loading || !input.trim()} style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
                    background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#0ea5e9)',
                    color: '#fff', transition: 'opacity 0.2s',
                  }}>{loading ? '⏳ Classifying…' : '🧠 Classify Message'}</button>
                  <button onClick={() => { setInput(''); setResult(null) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              </div>

              {/* Quick test buttons */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 }}>Quick Test Samples</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TEST_CASES.slice(0, 5).map(tc => (
                    <button key={tc.label} onClick={() => { setInput(tc.text); classify(tc.text) }} style={{
                      padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#94a3b8', fontSize: 12, direction: /[\u0600-\u06FF]/.test(tc.text) ? 'rtl' : 'ltr',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                      <span style={{ color: '#64748b', fontSize: 11, marginRight: 8 }}>{labelStyle(tc.expected as ClassLabel).icon}</span>
                      {tc.text.length > 55 ? tc.text.slice(0, 55) + '…' : tc.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result */}
            <div>
              {result ? (
                <ResultCard result={result} input={input} ms={processingMs} />
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>NLP Engine Ready</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    Type a message or select a sample on the left.<br />
                    Supports Arabic & English. Powered by GPT-5-mini + rule engine.
                  </div>
                  <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {(['DEMAND', 'SUPPLY', 'BROKER_DEMAND', 'IRRELEVANT'] as ClassLabel[]).map(l => {
                      const ls = labelStyle(l)
                      return (
                        <div key={l} style={{ background: ls.bg, border: `1px solid ${ls.border}`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{ls.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ls.text }}>{l}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Batch Test Tab ── */}
        {activeTab === 'batch' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Validation Test Suite</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{TEST_CASES.length} test cases · Click any row to run individually</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {batchTotal > 0 && (
                  <div style={{ background: batchPassed === batchTotal ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)', border: `1px solid ${batchPassed === batchTotal ? 'rgba(34,197,94,0.4)' : 'rgba(251,191,36,0.4)'}`, borderRadius: 10, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: batchPassed === batchTotal ? '#22c55e' : '#fbbf24' }}>
                    {batchPassed}/{batchTotal} Passed · {Math.round(batchPassed/batchTotal*100)}%
                  </div>
                )}
                <button onClick={runAllTests} disabled={batchRunning} style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', cursor: batchRunning ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                  background: batchRunning ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8b5cf6,#0ea5e9)',
                  color: '#fff',
                }}>{batchRunning ? '⏳ Running…' : '▶ Run All Tests'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEST_CASES.map(tc => (
                <TestRow key={tc.label} tc={tc} result={batchResults.get(tc.label) || null}
                  loading={batchLoading.has(tc.label)} onRun={() => classifyBatch(tc)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Rules Tab ── */}
        {activeTab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: '🔴 DEMAND Keywords', color: '#ef4444', items: ['مطلوب — "wanted" (start of message)', 'عايز / عاوز — "I want"', 'محتاج — "I need"', 'بدور على — "I\'m looking for"', 'حد عنده — "does anyone have"', 'ممكن حد يرشحلي — "can anyone recommend"', 'looking for / need / searching', 'buyer / renter / tenant'] },
              { label: '🔵 SUPPLY Keywords', color: '#0ea5e9', items: ['للبيع — "for sale"', 'للإيجار / للايجار — "for rent"', 'متاح — "available"', 'عندي شقة — "I have an apartment"', 'for sale / for rent / available', 'price + location + bedrooms → SUPPLY', 'عرض / معروض — "offered"', 'تأجير / بيع — "renting/selling"'] },
              { label: '🟣 BROKER_DEMAND', color: '#a855f7', items: ['عميل جاهز — "ready client"', 'بيدور على عمولة — "looking for commission"', 'وسيط / سمسار — "broker/agent"', 'معاه عميل — "has a client"', 'كوميشن / عمولة — "commission"', 'مشتري جاهز — "ready buyer"', 'Still useful — has a real buyer!'] },
              { label: '⚪ IRRELEVANT', color: '#94a3b8', items: ['No RE keywords', 'Greeting messages', 'Off-topic content', '< 10 words with low confidence', 'Emoji-only messages', 'Administrative messages', 'Group management posts'] },
            ].map(({ label, color, items }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 12 }}>{label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                      <span style={{ color, marginTop: 1, flexShrink: 0 }}>→</span>
                      <span style={{ direction: /[\u0600-\u06FF]/.test(item) ? 'rtl' : 'ltr' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* Scoring table */}
            <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24', marginBottom: 12 }}>📊 Match Scoring Algorithm</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {[
                  { factor: 'Location Match (exact)',   pts: 30, col: '#0ea5e9' },
                  { factor: 'Location Match (district)',pts: 15, col: '#0ea5e9' },
                  { factor: 'Budget Match',             pts: 25, col: '#22c55e' },
                  { factor: 'Bedroom Match (exact)',    pts: 20, col: '#8b5cf6' },
                  { factor: 'Bedroom Match (±1)',       pts: 10, col: '#8b5cf6' },
                  { factor: 'Property Type Match',      pts: 10, col: '#f97316' },
                  { factor: 'Intent Match (buy/sell)',  pts: 10, col: '#fbbf24' },
                  { factor: 'Urgency Bonus',            pts:  5, col: '#ef4444' },
                  { factor: 'Posted Today Bonus',       pts:  5, col: '#22c55e' },
                  { factor: 'Broker Penalty',           pts: -10, col: '#94a3b8' },
                ].map(({ factor, pts, col }) => (
                  <div key={factor} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{factor}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: pts > 0 ? col : '#64748b' }}>{pts > 0 ? '+' : ''}{pts}pts</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, fontSize: 12, color: '#fbbf24' }}>
                ⚡ Minimum score threshold: <strong>60 points</strong> — matches below this are hidden
              </div>
            </div>
            {/* Number normalization */}
            <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>🔢 Arabic Number Normalization</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {[
                  ['مليون', '1,000,000'], ['مليونين', '2,000,000'], ['تلاتة مليون', '3,000,000'],
                  ['مليون ونص', '1,500,000'], ['500 ألف / الف', '500,000'], ['ربع مليون', '250,000'],
                  ['k / K', '× 1,000'], ['M / m', '× 1,000,000'], ['نص مليون', '500,000'],
                ].map(([ar, en]) => (
                  <div key={ar} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#f1f5f9', direction: 'rtl' }}>{ar}</span>
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>→ {en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
