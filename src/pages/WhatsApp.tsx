/**
 * WhatsApp Intelligence — LIVE feed via Socket.IO
 * ================================================
 * • Connects to backend Socket.IO (ws://localhost:3001/socket.io)
 * • Receives real-time push of new messages
 * • Falls back to HTTP polling every 5s if WebSocket fails
 * • Shows GPT classification badges, extracted data chips
 * • Shows backend health panel
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import Card from '../components/Card'

type MsgLabel = 'supply' | 'demand' | 'match' | 'inquiry' | 'other'

interface ExtractedData {
  price?: string | null
  property_type?: string | null
  area_sqm?: number | null
  location?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  finishing?: string | null
  purpose?: string | null
  furnished?: boolean | null
  contact?: string | null
  budget_min?: number | null
  budget_max?: number | null
  urgent?: boolean
}

interface Classification {
  label: MsgLabel
  confidence: number
  reason: string
  extracted: ExtractedData
}

interface BackendMessage {
  id: string
  sender: string
  senderName: string
  isGroup: boolean
  body: string
  timestamp: number
  direction: 'inbound' | 'outbound'
  typeMessage: string
  classification: Classification
  gptUpgraded: boolean
}

interface BackendHealth {
  ok: boolean
  version: string
  wa: {
    connected: boolean
    state: string
    messages: number
    lastPoll: string | null
    pollCount: number
    errorCount: number
    lastError: string | null
    credsMissing: boolean
  }
  stats: { supply: number; demand: number; match: number; inquiry: number; other: number; total: number }
  openai: { available: boolean }
  socketio?: { clients: number }
}

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

const FRONTEND_POLL_MS = 5_000
const BACKEND_API      = '/api'

const CLASS_META: Record<MsgLabel, { color: string; bg: string; icon: string; label: string }> = {
  supply:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: '🏠', label: 'Supply'  },
  demand:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '👥', label: 'Demand'  },
  match:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '🎯', label: 'Match'   },
  inquiry: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: '❓', label: 'Inquiry' },
  other:   { color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: '💬', label: 'Other'   },
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(BACKEND_API + path, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WhatsApp({ }: Props) {
  const [messages, setMessages]       = useState<BackendMessage[]>([])
  const [health, setHealth]           = useState<BackendHealth | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [stats, setStats]             = useState({ supply: 0, demand: 0, match: 0, inquiry: 0, other: 0, total: 0 })
  const [filter, setFilter]           = useState<MsgLabel | 'all'>('all')
  const [selectedMsg, setSelectedMsg] = useState<BackendMessage | null>(null)
  const [connected, setConnected]     = useState(false)
  const [reloading, setReloading]     = useState(false)
  const [newCount, setNewCount]       = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const seenIds   = useRef<Set<string>>(new Set())
  const listRef   = useRef<HTMLDivElement>(null)

  // ── HTTP fallback poll ────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const data = await apiFetch('/messages?limit=200')
      setBackendOnline(true)
      setStats(data.stats || {})
      if (data.messages?.length) {
        setMessages(prev => {
          const incoming = (data.messages as BackendMessage[]).filter(m => !seenIds.current.has(m.id))
          incoming.forEach(m => seenIds.current.add(m.id))
          if (incoming.length === 0) return prev
          return [...incoming, ...prev]
            .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 500)
        })
      }
    } catch {
      setBackendOnline(false)
    }
  }, [])

  const fetchHealth = useCallback(async () => {
    try {
      const h = await apiFetch('/health')
      setHealth(h)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }
  }, [])

  // ── Socket.IO connection ─────────────────────────────────────────
  useEffect(() => {
    const wsUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : window.location.origin

    const socket: Socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected')
      setConnected(true)
      setBackendOnline(true)
      // Stop HTTP fallback polling when WS is active
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected — falling back to HTTP polling')
      setConnected(false)
      // Start HTTP fallback
      if (!pollRef.current) {
        pollRef.current = setInterval(() => { fetchMessages(); fetchHealth() }, FRONTEND_POLL_MS)
      }
    })

    socket.on('connect_error', () => {
      setConnected(false)
      // Ensure fallback polling is running
      if (!pollRef.current) {
        pollRef.current = setInterval(() => { fetchMessages(); fetchHealth() }, FRONTEND_POLL_MS)
      }
    })

    socket.on('init', (data: any) => {
      setStats(data.stats || {})
      if (data.messages?.length) {
        data.messages.forEach((m: BackendMessage) => seenIds.current.add(m.id))
        setMessages(data.messages)
      }
    })

    socket.on('new_messages', (data: any) => {
      setStats(data.stats || {})
      if (data.messages?.length) {
        const incoming = (data.messages as BackendMessage[]).filter(m => !seenIds.current.has(m.id))
        incoming.forEach(m => seenIds.current.add(m.id))
        if (incoming.length > 0) {
          setNewCount(prev => prev + incoming.length)
          setMessages(prev => {
            const merged = [...incoming, ...prev]
              .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 500)
            return merged
          })
          // Auto-scroll to top
          if (listRef.current) listRef.current.scrollTop = 0
        }
      }
    })

    socket.on('stats_update', (data: any) => {
      setStats(data.stats || {})
    })

    // Initial load via HTTP (before WS is ready)
    fetchMessages()
    fetchHealth()

    return () => {
      socket.disconnect()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMessages, fetchHealth])

  // Periodic health check
  useEffect(() => {
    const t = setInterval(fetchHealth, 15_000)
    return () => clearInterval(t)
  }, [fetchHealth])

  const handleReload = async () => {
    setReloading(true)
    try {
      await apiFetch('/wa/reload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: 120 }) })
      await fetchMessages()
      setNewCount(0)
    } catch {} finally {
      setReloading(false)
    }
  }

  const filtered = filter === 'all' ? messages : messages.filter(m => m.classification.label === filter)
  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

  // Backend offline view
  if (backendOnline === false) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Card title="⚠️ Backend Offline" subtitle="The Express backend is not running">
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔌</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              The WhatsApp backend server is not responding. Start it with:
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--brand-teal)', textAlign: 'left', display: 'inline-block' }}>
              cd /home/user/webapp/server{'\n'}
              pm2 start ecosystem.config.cjs
            </pre>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            💬 WhatsApp Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {connected ? '🟢 Socket.IO connected — real-time push active' : '🟡 HTTP polling fallback (5s)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {newCount > 0 && (
            <button
              onClick={() => { setNewCount(0); if (listRef.current) listRef.current.scrollTop = 0 }}
              className="btn"
              style={{ padding: '7px 14px', fontSize: '0.78rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--brand-green)', borderRadius: '8px' }}
            >
              ↑ {newCount} new messages
            </button>
          )}
          <button
            onClick={handleReload}
            disabled={reloading}
            className="btn btn-primary"
            style={{ padding: '7px 14px', fontSize: '0.82rem', opacity: reloading ? 0.7 : 1 }}
          >
            {reloading ? '⟳ Loading…' : '🔄 Reload 2h History'}
          </button>
        </div>
      </div>

      {/* ── Health Cards ──────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ gap: '14px' }}>
        {[
          {
            title: 'Backend',
            value: backendOnline ? 'ONLINE' : 'OFFLINE',
            detail: `v${health?.version || '3.0'} · ${health?.socketio?.clients || 0} WS clients`,
            color: backendOnline ? 'var(--brand-green)' : 'var(--brand-red)',
            icon: '🖥️',
          },
          {
            title: 'WhatsApp',
            value: health?.wa?.connected ? 'CONNECTED' : (health?.wa?.credsMissing ? 'NO CREDS' : health?.wa?.state?.toUpperCase() || 'UNKNOWN'),
            detail: `Polls: ${health?.wa?.pollCount || 0} · Errors: ${health?.wa?.errorCount || 0}`,
            color: health?.wa?.connected ? 'var(--brand-green)' : 'var(--brand-red)',
            icon: '📱',
          },
          {
            title: 'GPT Engine',
            value: health?.openai?.available ? 'ACTIVE' : 'OFFLINE',
            detail: `${stats.total} classified`,
            color: health?.openai?.available ? 'var(--brand-teal)' : 'var(--brand-red)',
            icon: '🤖',
          },
          {
            title: 'Messages',
            value: String(messages.length),
            detail: `Supply: ${stats.supply} · Demand: ${stats.demand}`,
            color: 'var(--brand-purple)',
            icon: '📬',
          },
        ].map((card) => (
          <div key={card.title} style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{card.icon}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {card.title}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: card.color, marginBottom: '3px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{card.detail}</div>
          </div>
        ))}
      </div>

      {/* ── Stats Row ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {(['all', 'supply', 'demand', 'match', 'inquiry', 'other'] as const).map(f => {
          const count = f === 'all' ? stats.total : stats[f] || 0
          const meta  = f === 'all' ? null : CLASS_META[f]
          const isActive = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px',
                borderRadius: '20px',
                border:      `1px solid ${isActive ? (meta?.color || 'var(--brand-teal)') : 'var(--border)'}`,
                background:  isActive ? (meta?.bg || 'rgba(14,165,233,0.12)') : 'rgba(0,0,0,0.15)',
                color:       isActive ? (meta?.color || 'var(--brand-teal)') : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {meta ? `${meta.icon} ${meta.label}` : '📬 All'}
              <span style={{
                padding: '1px 7px', borderRadius: '10px',
                background: isActive ? (meta?.color || 'var(--brand-teal)') : 'rgba(255,255,255,0.08)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: 700,
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Message List + Detail ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedMsg ? '1fr 1fr' : '1fr', gap: '16px' }}>

        {/* List */}
        <div ref={listRef} style={{ maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px',
              color: 'var(--text-muted)', fontSize: '0.9rem',
              background: 'rgba(0,0,0,0.1)', borderRadius: '12px',
            }}>
              {health?.wa?.credsMissing
                ? '⚠️ Configure WhatsApp credentials in Settings to start receiving messages'
                : messages.length === 0
                  ? '📭 No messages yet — click "Reload 2h History" or wait for incoming messages'
                  : `No ${filter} messages in feed`
              }
            </div>
          ) : (
            filtered.map((msg) => {
              const meta = CLASS_META[msg.classification.label]
              const isSelected = selectedMsg?.id === msg.id
              const ext = msg.classification.extracted || {}
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMsg(isSelected ? null : msg)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background:  isSelected ? meta.bg : 'rgba(0,0,0,0.15)',
                    border:      `1px solid ${isSelected ? meta.color + '60' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.15)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: name + badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {msg.isGroup ? '👥 ' : ''}{msg.senderName || msg.sender.replace('@c.us', '')}
                        </span>
                        <span style={{
                          padding: '1px 8px', borderRadius: '10px',
                          background: meta.bg, color: meta.color,
                          fontSize: '0.68rem', fontWeight: 700,
                          border: `1px solid ${meta.color}40`,
                        }}>
                          {meta.icon} {meta.label}
                        </span>
                        {msg.gptUpgraded && (
                          <span style={{ padding: '1px 7px', borderRadius: '10px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: '0.65rem', fontWeight: 700 }}>
                            ⚡GPT
                          </span>
                        )}
                        {msg.direction === 'outbound' && (
                          <span style={{ padding: '1px 7px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', color: 'var(--brand-gold)', fontSize: '0.65rem', fontWeight: 600 }}>
                            ↑ Sent
                          </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {msg.classification.confidence}%
                        </span>
                      </div>

                      {/* Row 2: message body */}
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '6px', wordBreak: 'break-word' }}>
                        {msg.body.slice(0, 140)}{msg.body.length > 140 ? '…' : ''}
                      </div>

                      {/* Row 3: extracted chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {ext.location && <Chip icon="📍" val={ext.location} />}
                        {ext.bedrooms != null && <Chip icon="🛏" val={`${ext.bedrooms}BR`} />}
                        {ext.area_sqm != null && <Chip icon="📐" val={`${ext.area_sqm}m²`} />}
                        {ext.price && <Chip icon="💰" val={String(ext.price)} />}
                        {ext.budget_max && <Chip icon="💳" val={`Max ${Number(ext.budget_max).toLocaleString()}`} />}
                        {ext.purpose && <Chip icon={ext.purpose === 'rent' ? '🔑' : '🏷️'} val={ext.purpose} />}
                        {ext.property_type && <Chip icon="🏠" val={ext.property_type} />}
                        {ext.urgent && <Chip icon="⚡" val="Urgent" color="#ef4444" />}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{fmt(msg.timestamp)}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Detail Panel */}
        {selectedMsg && (
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
            position: 'sticky',
            top: '80px',
            maxHeight: '65vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Message Detail
              </div>
              <button
                onClick={() => setSelectedMsg(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <DetailRow label="From"     value={selectedMsg.senderName || selectedMsg.sender.replace('@c.us', '')} />
              <DetailRow label="Time"     value={fmt(selectedMsg.timestamp)} />
              <DetailRow label="Type"     value={selectedMsg.typeMessage} />
              <DetailRow label="Label"    value={`${CLASS_META[selectedMsg.classification.label].icon} ${CLASS_META[selectedMsg.classification.label].label}`} />
              <DetailRow label="Confidence" value={`${selectedMsg.classification.confidence}%`} />
              <DetailRow label="Reason"   value={selectedMsg.classification.reason || '—'} />
              <DetailRow label="GPT"      value={selectedMsg.gptUpgraded ? '✅ GPT-5-mini' : '🔢 Regex Fallback'} />

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Message
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                  {selectedMsg.body || '[No text content]'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Extracted Data
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(selectedMsg.classification.extracted || {}).map(([key, val]) => {
                    if (val === null || val === undefined) return null
                    return (
                      <div key={key} style={{ padding: '7px 10px', borderRadius: '7px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>{key}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ icon, val, color }: { icon: string; val: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 8px', borderRadius: '10px',
      background: 'rgba(14,165,233,0.08)',
      border: '1px solid rgba(14,165,233,0.18)',
      fontSize: '0.68rem', color: color || 'var(--brand-teal)', fontWeight: 600,
    }}>
      {icon} {val}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
