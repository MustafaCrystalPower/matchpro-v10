import { useState, useEffect, useRef, useCallback } from 'react'
import Card from '../components/Card'

/* ─── Messaging gateway credentials (loaded from Settings) ─── */
const DEFAULT_CREDS = {
  idInstance: '',
  apiToken:   '',
}

const POLL_INTERVAL_MS = 3_000   // poll every 3s while active

/* ─── Message classification ──────────────────────────────── */
type MsgClass = 'supply' | 'demand' | 'match' | 'inquiry' | 'other'

interface ClassifyResult {
  label: MsgClass
  confidence: number
  tags: string[]
}

const SUPPLY_PATTERNS  = [/\b(sell|selling|للبيع|عندي|عندنا|متاح|available|offer|listing|شقة للبيع|فيلا للبيع|unit for sale|بيع|selling price)\b/i]
const DEMAND_PATTERNS  = [/\b(buy|buying|looking for|search|want|need|wanted|طالب|أبحث|محتاج|أريد|دور على|عايز|اشتري|buyer|client wants)\b/i]
const MATCH_PATTERNS   = [/\b(match|matched|suitable|مناسب|مطابق|perfect fit|found|وجدنا|ideal for|fits budget)\b/i]
const INQUIRY_PATTERNS = [/\b(price|how much|السعر|كام|cost|details|tafaseel|info|تفاصيل|مواصفات|specs|square|متر|area|floor|دور)\b/i]

function classifyMessage(text: string): ClassifyResult {
  const lower = text.toLowerCase()
  const tags: string[] = []
  let label: MsgClass = 'other'
  let confidence = 50

  const locationHints = ['madinaty','new capital','fifth settlement','شيخ زايد','rehab','sixth october','nasr city','heliopolis','zamalek','maadi','north coast','مدينتي','العاصمة','التجمع','الشيخ','أكتوبر','مدينة نصر','المعادي','الزمالك']
  const foundLocations = locationHints.filter(l => lower.includes(l))
  if (foundLocations.length) tags.push(...foundLocations.map(l => `📍 ${l}`))

  const priceMatch = lower.match(/(\d[\d,\.]+)\s*(egp|جنيه|million|مليون|k|ألف|م\.ج)?/i)
  if (priceMatch) tags.push(`💰 ${priceMatch[0]}`)

  const typeHints = ['apartment','villa','شقة','فيلا','studio','penthouse','townhouse','duplex','chalet','شاليه','وحدة']
  const foundTypes = typeHints.filter(t => lower.includes(t))
  if (foundTypes.length) tags.push(...foundTypes.map(t => `🏠 ${t}`))

  const bedroomMatch = lower.match(/(\d)\s*(bed|غرف|room|غرفة)/i)
  if (bedroomMatch) tags.push(`🛏 ${bedroomMatch[0]}`)

  if (MATCH_PATTERNS.some(p => p.test(text)))        { label = 'match';   confidence = 90 }
  else if (DEMAND_PATTERNS.some(p => p.test(text)))  { label = 'demand';  confidence = 82 }
  else if (SUPPLY_PATTERNS.some(p => p.test(text)))  { label = 'supply';  confidence = 82 }
  else if (INQUIRY_PATTERNS.some(p => p.test(text))) { label = 'inquiry'; confidence = 70 }
  else                                                { label = 'other';   confidence = 45 }

  if (tags.length >= 3) confidence = Math.min(confidence + 8, 98)

  return { label, confidence, tags }
}

const CLASS_META: Record<MsgClass, { color: string; bg: string; icon: string; label: string }> = {
  supply:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '🏗️', label: 'SUPPLY'  },
  demand:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: '🔍', label: 'DEMAND'  },
  match:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🎯', label: 'MATCH'   },
  inquiry: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '❓', label: 'INQUIRY' },
  other:   { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  icon: '💬', label: 'OTHER'   },
}

/* ─── Types ────────────────────────────────────────────────── */
interface WaMessage {
  id: string
  receiptId: number
  sender: string
  senderName: string
  body: string
  timestamp: number
  type: string
  webhookType: string
  classification: ClassifyResult
  raw: any
}

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

/* ─── Helpers ──────────────────────────────────────────────── */
function formatSender(chatId: string): string {
  return chatId.replace('@c.us', '').replace('@g.us', ' (Group)')
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return new Date(ts * 1000).toLocaleDateString()
}

function initials(name: string): string {
  return name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() || '').join('') || '??'
}

const AVATAR_COLORS = ['#0ea5e9','#10b981','#a78bfa','#f59e0b','#f43f5e','#06b6d4','#84cc16']
function avatarColor(sender: string) {
  let h = 0; for (const c of sender) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

/** Safe JSON fetch — never throws on HTML error pages */
async function safeJsonFetch(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any; errorText: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), ...options })
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      const data = await res.json()
      return { ok: res.ok, status: res.status, data, errorText: '' }
    }
    // Got HTML or non-JSON — read as text and extract meaningful error
    const txt = await res.text()
    const msg = txt.includes('<!DOCTYPE') || txt.includes('<html')
      ? `Server returned HTML (status ${res.status}) — check proxy config`
      : txt.slice(0, 160)
    return { ok: false, status: res.status, data: null, errorText: msg }
  } catch (err: any) {
    return { ok: false, status: 0, data: null, errorText: err.message || 'Network error' }
  }
}

/** Extract text content from any known webhook payload shape */
function extractText(webhookBody: any): string {
  const md = webhookBody?.messageData || {}
  return (
    md.textMessageData?.textMessage ||
    md.extendedTextMessageData?.text ||
    md.extendedTextMessageData?.description ||
    webhookBody?.textMessage ||
    md.imageMessage?.caption ||
    md.videoMessage?.caption ||
    md.documentMessage?.fileName ||
    md.stickerMessage?.id ||
    ''
  ) || '[non-text media]'
}

/* ─── Component ─────────────────────────────────────────────── */
export default function WhatsApp(_props: Props) {
  const [messages,      setMessages]      = useState<WaMessage[]>([])
  const [polling,       setPolling]       = useState(false)
  const [pollingActive, setPollingActive] = useState(false)
  const [pollCount,     setPollCount]     = useState(0)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [filter,        setFilter]        = useState<MsgClass | 'all'>('all')
  const [selected,      setSelected]      = useState<WaMessage | null>(null)
  const [stats,         setStats]         = useState({ supply: 0, demand: 0, match: 0, inquiry: 0, other: 0 })
  const [connState,     setConnState]     = useState<string>('')
  const [showWebhook,   setShowWebhook]   = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  // Load credentials from localStorage (set via Settings page)
  const [creds] = useState(() => {
    try {
      const stored = localStorage.getItem('wa_gateway_creds')
      return stored ? JSON.parse(stored) : DEFAULT_CREDS
    } catch { return DEFAULT_CREDS }
  })

  const pollingRef = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedRef    = useRef<HTMLDivElement | null>(null)

  /* ── Webhook URL helper ─────────────────────────────────── */
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/waproxy/waInstance${creds.idInstance}/setSettings/${creds.apiToken}`
    : ''

  const copyWebhook = () => {
    if (!creds.idInstance || !creds.apiToken) return
    // The actual webhook URL to configure in the gateway dashboard
    const url = `${window.location.origin}/waproxy/waInstance${creds.idInstance}/setWebhook/${creds.apiToken}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2500)
  }

  /* ── Test connection state ──────────────────────────────── */
  const testConnection = useCallback(async () => {
    if (!creds.idInstance || !creds.apiToken) return
    const url = `/waproxy/waInstance${creds.idInstance}/getStateInstance/${creds.apiToken}`
    const r = await safeJsonFetch(url)
    if (r.ok && r.data?.stateInstance) {
      setConnState(r.data.stateInstance)
    } else if (r.errorText) {
      setConnState('error')
    }
  }, [creds])

  useEffect(() => { testConnection() }, [testConnection])

  /* ── Core polling loop ──────────────────────────────────── */
  const pollOnce = useCallback(async () => {
    if (!pollingRef.current) return
    setPolling(true)
    setErrorMsg(null)

    const getUrl = `/waproxy/waInstance${creds.idInstance}/getNotification/${creds.apiToken}`
    const r = await safeJsonFetch(getUrl)

    if (!r.ok) {
      // 502 = proxy error JSON — show friendly message
      if (r.status === 502 && r.data?.error) {
        setErrorMsg(`Gateway: ${r.data.message || r.data.error}`)
      } else if (r.errorText) {
        setErrorMsg(r.errorText)
      } else {
        setErrorMsg(`HTTP ${r.status}`)
      }
    } else {
      setPollCount(c => c + 1)
      const data = r.data

      // null = queue is empty (normal)
      if (data && data.receiptId != null) {
        const body       = data.body || {}
        const webhookType = body.typeWebhook || ''
        const sender     = body.senderData?.chatId || body.senderData?.sender || 'unknown'
        const senderName = body.senderData?.senderName || formatSender(sender)
        const textBody   = extractText(body)

        // Accept all incoming message types (not just text)
        const isMessage = webhookType === 'incomingMessageReceived' || webhookType === 'outgoingMessageReceived'
        const isStatus  = webhookType === 'stateInstanceChanged' || webhookType === 'statusInstanceChanged'
        const isReceipt = webhookType === 'outgoingMessageStatus'

        if (isMessage) {
          const msg: WaMessage = {
            id:             `${data.receiptId}`,
            receiptId:      data.receiptId,
            sender,
            senderName,
            body:           textBody,
            timestamp:      body.timestamp || Math.floor(Date.now() / 1000),
            type:           webhookType === 'incomingMessageReceived' ? 'inbound' : 'outbound',
            webhookType,
            classification: classifyMessage(textBody),
            raw:            data,
          }
          setMessages(prev => {
            const next = [msg, ...prev].slice(0, 200)
            const s = { supply: 0, demand: 0, match: 0, inquiry: 0, other: 0 }
            next.forEach(m => { s[m.classification.label]++ })
            setStats(s)
            return next
          })
        } else if (isStatus) {
          // Update connection state badge
          const newState = body.stateInstance || body.status || ''
          if (newState) setConnState(newState)
        } else if (isReceipt) {
          // Delivery receipt — silently consume
        }
        // Always delete to advance the queue
        const delUrl = `/waproxy/waInstance${creds.idInstance}/deleteNotification/${creds.apiToken}/${data.receiptId}`
        await safeJsonFetch(delUrl, { method: 'DELETE' })
      }
    }

    setPolling(false)
    if (pollingRef.current) {
      timerRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS)
    }
  }, [creds])

  const startPolling = useCallback(() => {
    if (!creds.idInstance || !creds.apiToken) {
      setErrorMsg('Credentials not configured. Go to ⚙️ Settings → WhatsApp Gateway, enter Instance ID + API Token, then Save.')
      return
    }
    pollingRef.current = true
    setPollingActive(true)
    setErrorMsg(null)
    pollOnce()
  }, [pollOnce, creds])

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    setPollingActive(false)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setPolling(false)
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [messages.length])

  const filtered = filter === 'all' ? messages : messages.filter(m => m.classification.label === filter)
  const totalMsgs = messages.length

  const statItems: { key: MsgClass | 'all'; label: string; count: number; color: string }[] = [
    { key: 'all',     label: 'All',     count: totalMsgs,     color: 'var(--brand-teal)' },
    { key: 'demand',  label: 'Demand',  count: stats.demand,  color: '#0ea5e9' },
    { key: 'supply',  label: 'Supply',  count: stats.supply,  color: '#10b981' },
    { key: 'match',   label: 'Matches', count: stats.match,   color: '#a78bfa' },
    { key: 'inquiry', label: 'Inquiry', count: stats.inquiry, color: '#f59e0b' },
  ]

  const connColor = connState === 'authorized' ? '#10b981' : connState === 'error' ? '#ef4444' : connState ? '#f59e0b' : '#6b7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="page-container">

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg,#25d366,#128c7e)',
              fontSize: '1.1rem', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(37,211,102,0.35)',
            }}>💬</span>
            WhatsApp Intelligence
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              {creds.idInstance
                ? <><code style={{ color: 'var(--brand-teal)', fontSize: '0.75rem' }}>{creds.idInstance}</code></>
                : <span style={{ color: 'var(--brand-gold)' }}>⚠ Configure in Settings first</span>}
            </p>
            {connState && connState !== 'error' && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: connColor, background: `${connColor}18`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${connColor}44` }}>
                ● {connState.toUpperCase()}
              </span>
            )}
            <button
              onClick={() => setShowWebhook(v => !v)}
              style={{ fontSize: '0.72rem', color: 'var(--brand-teal)', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}
            >
              {showWebhook ? '▲' : '▼'} Webhook Setup
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ConnectionBadge connected={pollingActive} polling={polling} />
          {pollingActive ? (
            <button onClick={stopPolling} style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer' }}>
              ⏹ Stop
            </button>
          ) : (
            <button onClick={startPolling} className="btn btn-primary" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: '1rem' }}>▶</span> Start Polling
            </button>
          )}
        </div>
      </div>

      {/* ── Webhook Setup Panel ──────────────────────────────── */}
      {showWebhook && (
        <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.25)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-teal)', marginBottom: 10 }}>📡 Webhook Configuration</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
            In your messaging gateway account, set the <strong>Webhook URL</strong> to the URL below.
            When set, incoming WhatsApp messages will be pushed in real time — no polling needed.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', wordBreak: 'break-all' }}>
              {creds.idInstance
                ? `${window.location.origin}/waproxy/waInstance${creds.idInstance}/webhook/${creds.apiToken}`
                : '⚠ Configure Instance ID and Token in Settings first'}
            </div>
            <button
              onClick={copyWebhook}
              disabled={!creds.idInstance}
              style={{ padding: '8px 14px', borderRadius: 6, background: webhookCopied ? 'rgba(16,185,129,0.2)' : 'rgba(14,165,233,0.15)', color: webhookCopied ? '#10b981' : 'var(--brand-teal)', border: `1px solid ${webhookCopied ? 'rgba(16,185,129,0.4)' : 'rgba(14,165,233,0.35)'}`, cursor: creds.idInstance ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              {webhookCopied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
            {[
              { step: '1', text: 'Save credentials in ⚙️ Settings → WhatsApp Gateway' },
              { step: '2', text: 'In your gateway dashboard → Notifications → set Webhook URL above' },
              { step: '3', text: 'Enable: Incoming messages, Outgoing messages, Status changes' },
              { step: '4', text: 'Click ▶ Start Polling here — messages will appear live' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-teal)', color: 'white', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            💡 <strong>Polling mode</strong> (current): Dashboard pulls notifications every {POLL_INTERVAL_MS/1000}s via GET /getNotification → DELETE /deleteNotification.
            This works without any webhook setup — ideal for testing. Webhook push is faster for production use.
          </div>
        </div>
      )}

      {/* ── Stat strip ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {statItems.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: filter === s.key ? s.color + '22' : 'var(--bg-card)',
              border: `1px solid ${filter === s.key ? s.color + '55' : 'var(--border)'}`,
              color: filter === s.key ? s.color : 'var(--text-secondary)',
              fontWeight: filter === s.key ? 700 : 500,
              fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontWeight: 800, color: s.color }}>{s.count}</span>
            {s.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Polls: <strong style={{ color: 'var(--text-secondary)' }}>{pollCount}</strong></span>
          <span style={{ color: 'var(--border-light)' }}>·</span>
          <span>Every <strong style={{ color: 'var(--text-secondary)' }}>{POLL_INTERVAL_MS/1000}s</strong></span>
        </div>
      </div>

      {/* ── Error / status banner ────────────────────────────── */}
      {errorMsg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', fontSize: '0.82rem', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>⚠️</span>
          <span style={{ flex: 1 }}><strong>Error:</strong> {errorMsg}</span>
          {pollingActive && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Retrying in {POLL_INTERVAL_MS/1000}s…</span>}
        </div>
      )}

      {/* ── Main layout ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
        <Card
          title={`📨 Message Feed${filter !== 'all' ? ` · ${CLASS_META[filter as MsgClass]?.label}` : ''}`}
          subtitle={`${filtered.length} message${filtered.length !== 1 ? 's' : ''}${pollingActive ? ' · polling live' : ' · stopped'}`}
        >
          {!pollingActive && messages.length === 0 ? (
            <EmptyState onStart={startPolling} hasCreds={!!(creds.idInstance && creds.apiToken)} />
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No {filter !== 'all' ? CLASS_META[filter as MsgClass]?.label.toLowerCase() : ''} messages yet
            </div>
          ) : (
            <div ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 580, overflowY: 'auto', paddingRight: 4 }}>
              {filtered.map(msg => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  isSelected={selected?.id === msg.id}
                  onClick={() => setSelected(prev => prev?.id === msg.id ? null : msg)}
                />
              ))}
            </div>
          )}
        </Card>

        {selected && (
          <Card title="🔍 Message Detail" subtitle="Classification + raw metadata">
            <MessageDetail msg={selected} onClose={() => setSelected(null)} />
          </Card>
        )}
      </div>

      {/* ── How it works ────────────────────────────────────── */}
      <HowItWorks pollInterval={POLL_INTERVAL_MS} />
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */

function ConnectionBadge({ connected, polling }: { connected: boolean; polling: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 12px', borderRadius: 20,
      background: connected ? 'rgba(37,211,102,0.1)' : 'rgba(107,114,128,0.1)',
      border: `1px solid ${connected ? 'rgba(37,211,102,0.35)' : 'rgba(107,114,128,0.25)'}`,
      fontSize: '0.75rem', fontWeight: 700,
      color: connected ? '#25d366' : 'var(--text-muted)',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#25d366' : 'var(--text-muted)',
        boxShadow: connected ? '0 0 6px #25d366' : 'none',
        opacity: polling ? 0.6 : 1, transition: 'opacity 0.4s',
      }} />
      {polling ? 'POLLING…' : connected ? 'CONNECTED' : 'IDLE'}
    </div>
  )
}

function MessageRow({ msg, isSelected, onClick }: { msg: WaMessage; isSelected: boolean; onClick: () => void }) {
  const meta    = CLASS_META[msg.classification.label]
  const color   = avatarColor(msg.sender)
  const inbound = msg.type === 'inbound'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: isSelected ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? 'rgba(14,165,233,0.35)' : 'var(--border)'}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: `0 2px 8px ${color}55` }}>
        {initials(msg.senderName)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msg.senderName}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {inbound ? '⬇️' : '⬆️'} {timeAgo(msg.timestamp)}
          </span>
          <span style={{ marginLeft: 'auto', padding: '2px 7px', borderRadius: 4, background: meta.bg, color: meta.color, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, border: `1px solid ${meta.color}44` }}>
            {meta.icon} {meta.label}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {msg.body}
        </div>
        {msg.classification.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {msg.classification.tags.slice(0, 4).map((t, i) => (
              <span key={i} style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(14,165,233,0.08)', color: 'var(--brand-teal)', fontSize: '0.65rem', border: '1px solid rgba(14,165,233,0.2)' }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageDetail({ msg, onClose }: { msg: WaMessage; onClose: () => void }) {
  const meta  = CLASS_META[msg.classification.label]
  const color = avatarColor(msg.sender)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1rem', padding: '0 4px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'white', boxShadow: `0 2px 10px ${color}55` }}>
          {initials(msg.senderName)}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{msg.senderName}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatSender(msg.sender)}</div>
        </div>
      </div>

      <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
        {msg.body}
      </div>

      <div style={{ padding: '12px', borderRadius: 8, background: meta.bg, border: `1px solid ${meta.color}44` }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>NLP Classification</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
          <div>
            <div style={{ fontWeight: 800, color: meta.color, fontSize: '1rem' }}>{meta.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confidence: {msg.classification.confidence}%</div>
          </div>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginLeft: 4 }}>
            <div style={{ height: '100%', width: `${msg.classification.confidence}%`, background: meta.color, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        </div>
        {msg.classification.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {msg.classification.tags.map((t, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(14,165,233,0.1)', color: 'var(--brand-teal)', fontSize: '0.72rem', border: '1px solid rgba(14,165,233,0.25)' }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Time',         value: new Date(msg.timestamp * 1000).toLocaleString() },
          { label: 'Direction',    value: msg.type },
          { label: 'Webhook Type', value: msg.webhookType },
          { label: 'Receipt ID',   value: String(msg.receiptId) },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>

      <details>
        <summary style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 4 }}>Raw JSON payload</summary>
        <pre style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 180, border: '1px solid var(--border)' }}>
          {JSON.stringify(msg.raw, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function EmptyState({ onStart, hasCreds }: { onStart: () => void; hasCreds: boolean }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(37,211,102,0.15),rgba(18,140,126,0.15))', border: '2px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>💬</div>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          {hasCreds ? 'Ready to Poll' : 'Setup Required'}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 320, lineHeight: 1.6 }}>
          {hasCreds
            ? `Click Start Polling to receive WhatsApp messages. Polls every 3s, auto-classified by NLP (Arabic + English).`
            : `Go to ⚙️ Settings → WhatsApp Gateway, enter your Instance ID and API Token, then click Save. Return here and click Start Polling.`}
        </div>
      </div>
      {hasCreds ? (
        <button onClick={onStart} className="btn btn-primary" style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>▶</span> Start Polling
        </button>
      ) : (
        <div style={{ fontSize: '0.78rem', color: 'var(--brand-gold)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 16px', borderRadius: 8 }}>
          ⚙️ Configure credentials in Settings first
        </div>
      )}
    </div>
  )
}

function HowItWorks({ pollInterval }: { pollInterval: number }) {
  return (
    <Card title="ℹ️ How It Works" subtitle="Polling-based WhatsApp message extraction & NLP classification">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {[
          { icon: '📥', title: 'Message Queue', desc: 'Incoming WhatsApp messages accumulate in a FIFO notification queue for your configured instance.', color: '#0ea5e9' },
          { icon: '🔄', title: `Poll Every ${pollInterval/1000}s`, desc: 'Dashboard fetches one notification per cycle via GET /getNotification, then removes it via DELETE /deleteNotification.', color: '#10b981' },
          { icon: '🧠', title: 'NLP Classification', desc: 'Each message is classified as Supply, Demand, Match, Inquiry, or Other using bilingual (Arabic + English) regex patterns.', color: '#a78bfa' },
          { icon: '📊', title: 'Live Intelligence', desc: 'Classified messages feed market stats in real time — WhatsApp conversations become structured CRM data.', color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 8, background: `${s.color}0d`, border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, color: s.color, fontSize: '0.85rem', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
