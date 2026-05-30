import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import Card from '../components/Card'

// Pre-seeded defaults — loaded into fields on first visit if localStorage is empty
// User must still click "Save Gateway Credentials" to activate them
const DEFAULT_WA = {
  idInstance: '',
  apiToken:   '',
  apiUrl:     '',
  mediaUrl:   '',
  phone:      '',
}

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

export default function Settings({ apiData, loading, refreshData, lastUpdated }: Props) {
  const [settings, setSettings] = useState({
    apiBaseUrl: 'http://20.69.29.54:3070',
    refreshInterval: '60',
    defaultLocation: 'Madinaty',
    matchMinScore: '70',
    highConfidenceThreshold: '85',
    emailNotifications: false,
    pushNotifications: false,
    soundAlerts: true,
    darkMode: true,
    language: 'en',
    currency: 'EGP',
    timezone: 'Africa/Cairo'
  })

  const [waCreds, setWaCreds] = useState<typeof DEFAULT_WA>(() => {
    try {
      const stored = localStorage.getItem('wa_gateway_creds')
      if (stored) return { ...DEFAULT_WA, ...JSON.parse(stored) }
      // Nothing saved yet — return empty defaults (user fills manually)
      return DEFAULT_WA
    } catch { return DEFAULT_WA }
  })
  const [waSaved,          setWaSaved]          = useState(false)
  const [waTesting,        setWaTesting]        = useState(false)
  const [waStatus,         setWaStatus]         = useState<'idle' | 'ok' | 'error'>('idle')
  const [waMsg,            setWaMsg]            = useState('')
  const [applyingToServer, setApplyingToServer] = useState(false)
  const [applyMsg,         setApplyMsg]         = useState('')
  const [backendHealth,    setBackendHealth]    = useState<any>(null)
  const [backendChecked,   setBackendChecked]   = useState(false)

  const [saved, setSaved] = useState(false)

  // ── Socket.IO connection status ──────────────────────────
  const [wsState,       setWsState]       = useState<'connecting'|'connected'|'disconnected'>('connecting')
  const [wsClients,     setWsClients]     = useState<number>(0)
  const [wsMessages,    setWsMessages]    = useState<number>(0)
  const [wsLastEvent,   setWsLastEvent]   = useState<string>('')
  const [wsTransport,   setWsTransport]   = useState<string>('')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const wsUrl = window.location.origin
    const socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setWsState('connected')
      setWsTransport(socket.io.engine.transport.name)
      setWsLastEvent('connect')
    })
    socket.on('disconnect', () => {
      setWsState('disconnected')
      setWsLastEvent('disconnect')
    })
    socket.on('connect_error', () => {
      setWsState('disconnected')
      setWsLastEvent('error')
    })
    socket.on('init', (data: any) => {
      setWsMessages(data.messages?.length || 0)
      setWsLastEvent('init')
    })
    socket.on('new_messages', (data: any) => {
      setWsMessages(prev => prev + (data.messages?.length || 0))
      setWsLastEvent('new_messages')
    })
    socket.on('stats_update', (data: any) => {
      setWsClients(data.clients || 0)
      setWsLastEvent('stats_update')
    })

    return () => { socket.disconnect() }
  }, [])

  const handleReconnect = () => {
    if (socketRef.current) {
      setWsState('connecting')
      socketRef.current.disconnect()
      socketRef.current.connect()
    }
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // Check backend health on mount
  useEffect(() => {
    fetch('/api/health', { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setBackendHealth(data); setBackendChecked(true) })
      .catch(() => { setBackendHealth(null); setBackendChecked(true) })
  }, [])

  const handleApplyToServer = async () => {
    setApplyingToServer(true)
    setApplyMsg('')
    try {
      if (!waCreds.idInstance || !waCreds.apiToken) {
        setApplyMsg('❌ Enter Instance ID and Token first')
        setApplyingToServer(false)
        return
      }
      // Save to localStorage first
      localStorage.setItem('wa_gateway_creds', JSON.stringify(waCreds))
      // Push to backend
      const res = await fetch('/api/wa/creds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ idInstance: waCreds.idInstance, apiToken: waCreds.apiToken }),
      })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('json')) throw new Error(`HTTP ${res.status} — backend may be offline`)
      const data = await res.json()
      if (res.ok) {
        setApplyMsg(`✅ Applied — WA state: ${data.state}${data.messages > 0 ? ` · ${data.messages} msgs loaded` : ' (loading history…)'}`)
        // Refresh health
        const h = await fetch('/api/health').then(r => r.json()).catch(() => null)
        if (h) setBackendHealth(h)
      } else {
        setApplyMsg(`❌ ${data.error || data.message || 'Server error'}`)
      }
    } catch (err: any) {
      setApplyMsg(`❌ ${err.message || 'Failed — is the backend running?'}`)
    } finally {
      setApplyingToServer(false)
      setTimeout(() => setApplyMsg(''), 8000)
    }
  }

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleWaChange = (key: keyof typeof DEFAULT_WA, value: string) => {
    setWaCreds(prev => ({ ...prev, [key]: value }))
  }

  const handleWaSave = () => {
    localStorage.setItem('wa_gateway_creds', JSON.stringify(waCreds))
    setWaSaved(true)
    setWaStatus('idle')
    setTimeout(() => setWaSaved(false), 2500)
  }

  const handleWaTest = async () => {
    setWaTesting(true)
    setWaStatus('idle')
    setWaMsg('')
    try {
      if (!waCreds.idInstance || !waCreds.apiToken) throw new Error('Enter Instance ID and Token first')
      const url = `/waproxy/waInstance${waCreds.idInstance}/getStateInstance/${waCreds.apiToken}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('json')) {
        throw new Error(`Non-JSON response (${res.status}) — check Instance ID and Token`)
      }
      const data = await res.json()
      if (data.stateInstance) {
        setWaStatus('ok')
        setWaMsg(`Connected · State: ${data.stateInstance}`)
      } else if (data.error) {
        setWaStatus('error')
        setWaMsg(data.message || data.error)
      } else {
        setWaStatus('error')
        setWaMsg(JSON.stringify(data).slice(0, 160))
      }
    } catch (err: any) {
      setWaStatus('error')
      setWaMsg(err.message || 'Connection failed')
    } finally {
      setWaTesting(false)
    }
  }

  const summary = apiData?.summary
  const markets = apiData?.intelligence?.markets || []

  const isMarketLive = apiData?.source === 'live'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          ⚙️ Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Configure dashboard preferences, API settings, and notification options
        </p>
      </div>

      {/* ── System Status Banner ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {/* Market API status */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: isMarketLive ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isMarketLive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>{isMarketLive ? '🟢' : '🟡'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isMarketLive ? '#10b981' : '#f59e0b' }}>
              Market API — {isMarketLive ? 'LIVE' : 'OFFLINE'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {isMarketLive ? 'Connected to 20.69.29.54:3070 — real data flowing' : 'Backend at 20.69.29.54:3070 unreachable — rich demo data shown instead'}
            </div>
          </div>
        </div>
        {/* WhatsApp status */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: waCreds.idInstance ? 'rgba(37,211,102,0.08)' : 'rgba(107,114,128,0.08)', border: `1px solid ${waCreds.idInstance ? 'rgba(37,211,102,0.3)' : 'rgba(107,114,128,0.2)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>{waCreds.idInstance ? '🟢' : '⚪'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: waCreds.idInstance ? '#25d366' : 'var(--text-muted)' }}>
              WhatsApp — {waCreds.idInstance ? 'CONFIGURED' : 'NOT SET'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {waCreds.idInstance ? `Instance ${waCreds.idInstance}` : 'Enter Instance ID + Token below and Save'}
            </div>
          </div>
        </div>
        {/* Backend status */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: backendHealth ? 'rgba(167,139,250,0.08)' : 'rgba(107,114,128,0.08)', border: `1px solid ${backendHealth ? 'rgba(167,139,250,0.3)' : 'rgba(107,114,128,0.2)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>{!backendChecked ? '⏳' : backendHealth ? '🟣' : '⚫'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: backendHealth ? '#a78bfa' : 'var(--text-muted)' }}>
              Backend — {!backendChecked ? 'CHECKING' : backendHealth ? 'RUNNING' : 'OFFLINE'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {backendHealth
                ? `WA: ${backendHealth.wa?.state || '?'} · ${backendHealth.stats?.total || 0} msgs · GPT: ${backendHealth.openai?.available ? 'on' : 'off'}`
                : backendChecked ? 'Start: cd server && node index.js' : 'Checking port 3001…'}
            </div>
          </div>
        </div>
        {/* Socket.IO WebSocket status */}
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: wsState === 'connected' ? 'rgba(14,165,233,0.08)' : wsState === 'connecting' ? 'rgba(245,158,11,0.08)' : 'rgba(107,114,128,0.08)',
          border: `1px solid ${wsState === 'connected' ? 'rgba(14,165,233,0.3)' : wsState === 'connecting' ? 'rgba(245,158,11,0.25)' : 'rgba(107,114,128,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.4rem' }}>
            {wsState === 'connected' ? '🔵' : wsState === 'connecting' ? '🟡' : '⚫'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: wsState === 'connected' ? '#0ea5e9' : wsState === 'connecting' ? '#f59e0b' : 'var(--text-muted)' }}>
              WebSocket — {wsState === 'connected' ? 'CONNECTED' : wsState === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {wsState === 'connected'
                ? `${wsTransport || 'websocket'} · ${wsMessages} msgs received · event: ${wsLastEvent || '—'}`
                : wsState === 'connecting' ? 'Connecting to Socket.IO server…'
                : 'Real-time feed offline — check backend'}
            </div>
          </div>
          {wsState === 'disconnected' && (
            <button onClick={handleReconnect} style={{
              padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
              background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)',
            }}>↺ Retry</button>
          )}
        </div>
      </div>

      {/* ── Socket.IO Detail Card ───────────────────────────────── */}
      <Card title="🔌 Real-Time WebSocket (Socket.IO)" subtitle="Live connection diagnostics and event log">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Status',    value: wsState.toUpperCase(), color: wsState === 'connected' ? '#0ea5e9' : wsState === 'connecting' ? '#f59e0b' : '#94a3b8' },
            { label: 'Transport', value: wsTransport || '—', color: 'var(--text-primary)' },
            { label: 'Messages Rx', value: wsMessages.toLocaleString(), color: '#10b981' },
            { label: 'Last Event', value: wsLastEvent || '—', color: '#f59e0b' },
          ].map(({ label, value, color }, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem',
          background: wsState === 'connected' ? 'rgba(14,165,233,0.06)' : 'rgba(107,114,128,0.06)',
          border: `1px solid ${wsState === 'connected' ? 'rgba(14,165,233,0.2)' : 'rgba(107,114,128,0.15)'}`,
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <strong style={{ color: wsState === 'connected' ? '#0ea5e9' : 'var(--text-muted)' }}>
            {wsState === 'connected' ? '✓ Live feed active' : wsState === 'connecting' ? '⟳ Connecting…' : '✗ Feed offline'}
          </strong>
          {wsState === 'connected' && (
            <span> — WhatsApp messages are pushed instantly. No polling required. Socket path: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, color: '#0ea5e9', fontSize: '0.75rem' }}>/socket.io</code></span>
          )}
          {wsState === 'disconnected' && (
            <span> — Start the backend: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4, color: '#f87171', fontSize: '0.75rem' }}>pm2 start server/ecosystem.config.cjs</code> then click Retry above.</span>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* API Configuration */}
        <Card title="🔌 API Configuration" subtitle="Market intelligence API connection settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Base URL" description="Market Intelligence API endpoint">
              <input
                value={settings.apiBaseUrl}
                onChange={e => handleChange('apiBaseUrl', e.target.value)}
                placeholder="http://..."
              />
            </SettingField>

            <SettingField label="Auto Refresh Interval" description="How often to refresh data (seconds)">
              <select value={settings.refreshInterval} onChange={e => handleChange('refreshInterval', e.target.value)}>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 60 seconds</option>
                <option value="120">Every 2 minutes</option>
                <option value="300">Every 5 minutes</option>
                <option value="0">Manual only</option>
              </select>
            </SettingField>

            <SettingField label="Default Location" description="Pre-selected location for filters">
              <select value={settings.defaultLocation} onChange={e => handleChange('defaultLocation', e.target.value)}>
                {(apiData?.summary?.top_locations || []).map((l: any) => (
                  <option key={l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            </SettingField>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 600, marginBottom: '8px' }}>
                🟢 API Status
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div>Last response: {lastUpdated.toLocaleTimeString()}</div>
                <div>Total supply: {(summary?.total_supply || 0).toLocaleString()} listings</div>
                <div>Total demand: {(summary?.total_demand || 0).toLocaleString()} requests</div>
                <div>Markets tracked: {markets.length}</div>
              </div>
              <button
                onClick={refreshData}
                disabled={loading}
                style={{
                  marginTop: '10px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: 'var(--brand-green)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >{loading ? '⟳ Refreshing...' : '↻ Test Connection'}</button>
            </div>
          </div>
        </Card>

        {/* Match Settings */}
        <Card title="🎯 Match Settings" subtitle="Configure matching algorithm thresholds">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Minimum Match Score (%)" description="Minimum score to show a match">
              <div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.matchMinScore}
                  onChange={e => handleChange('matchMinScore', e.target.value)}
                  style={{ width: '100%', marginBottom: '6px', accentColor: 'var(--brand-teal)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>50%</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-teal)' }}>{settings.matchMinScore}%</span>
                  <span>95%</span>
                </div>
              </div>
            </SettingField>

            <SettingField label="High Confidence Threshold (%)" description="Score for high-confidence match alerts">
              <div>
                <input
                  type="range"
                  min="70"
                  max="99"
                  step="1"
                  value={settings.highConfidenceThreshold}
                  onChange={e => handleChange('highConfidenceThreshold', e.target.value)}
                  style={{ width: '100%', marginBottom: '6px', accentColor: 'var(--brand-green)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>70%</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-green)' }}>{settings.highConfidenceThreshold}%</span>
                  <span>99%</span>
                </div>
              </div>
            </SettingField>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 600, marginBottom: '6px' }}>
                Score Breakdown Weights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                {[
                  { label: 'Location', weight: '40%', color: 'var(--brand-teal)' },
                  { label: 'Price', weight: '30%', color: 'var(--brand-green)' },
                  { label: 'Property Type', weight: '20%', color: 'var(--brand-purple)' },
                  { label: 'Bedrooms', weight: '10%', color: 'var(--brand-gold)' },
                ].map((w, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{w.label}</span>
                    <span style={{ fontWeight: 700, color: w.color }}>{w.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Display Settings */}
        <Card title="🎨 Display Settings" subtitle="Customize dashboard appearance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Currency" description="Display currency for prices">
              <select value={settings.currency} onChange={e => handleChange('currency', e.target.value)}>
                <option value="EGP">EGP — Egyptian Pound</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </SettingField>

            <SettingField label="Language" description="Interface language">
              <select value={settings.language} onChange={e => handleChange('language', e.target.value)}>
                <option value="en">English</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </SettingField>

            <SettingField label="Timezone" description="Data display timezone">
              <select value={settings.timezone} onChange={e => handleChange('timezone', e.target.value)}>
                <option value="Africa/Cairo">Cairo (UTC+2)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">London (UTC+0)</option>
              </select>
            </SettingField>

            <ToggleSetting
              label="Dark Mode"
              description="Use dark theme (recommended)"
              value={settings.darkMode}
              onChange={v => handleChange('darkMode', v)}
            />
          </div>
        </Card>

        {/* Notifications */}
        <Card title="🔔 Notifications" subtitle="Configure alert preferences">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ToggleSetting
              label="Sound Alerts"
              description="Play sound on high-confidence matches"
              value={settings.soundAlerts}
              onChange={v => handleChange('soundAlerts', v)}
            />
            <ToggleSetting
              label="Browser Push Notifications"
              description="Get notified even when the tab is in background"
              value={settings.pushNotifications}
              onChange={v => handleChange('pushNotifications', v)}
            />
            <ToggleSetting
              label="Email Notifications"
              description="Daily digest reports via email"
              value={settings.emailNotifications}
              onChange={v => handleChange('emailNotifications', v)}
            />

            {settings.emailNotifications && (
              <SettingField label="Report Email" description="Email to send daily reports">
                <input type="email" placeholder="maisaramoamen@gmail.com" />
              </SettingField>
            )}

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.06)', border: '1px solid rgba(14, 165, 233, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--brand-teal)' }}>ℹ️ Note:</strong> This dashboard uses read-only API endpoints. No outbound WhatsApp or SMS messaging is performed from this interface per the No-Outbound-Messaging policy.
            </div>
          </div>
        </Card>
      </div>

      {/* ── WhatsApp Gateway Configuration ───────────────── */}
      <Card title="💬 WhatsApp Gateway" subtitle="Configure your WhatsApp messaging gateway credentials">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left col: credentials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SettingField label="Instance ID" description="Your gateway instance ID">
              <input
                value={waCreds.idInstance}
                onChange={e => handleWaChange('idInstance', e.target.value)}
                placeholder="Enter instance ID"
              />
            </SettingField>
            <SettingField label="API Token" description="apiTokenInstance (keep secret)">
              <input
                type="password"
                value={waCreds.apiToken}
                onChange={e => handleWaChange('apiToken', e.target.value)}
                placeholder="c678c910..."
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.05em' }}
              />
            </SettingField>
            <SettingField label="API URL" description="Gateway API base URL">
              <input
                value={waCreds.apiUrl}
                onChange={e => handleWaChange('apiUrl', e.target.value)}
                placeholder="https://api.example.com"
              />
            </SettingField>
            <SettingField label="Media URL" description="Gateway media base URL">
              <input
                value={waCreds.mediaUrl}
                onChange={e => handleWaChange('mediaUrl', e.target.value)}
                placeholder="https://media.example.com"
              />
            </SettingField>
            <SettingField label="Phone Number" description="WhatsApp number (with country code)">
              <input
                value={waCreds.phone}
                onChange={e => handleWaChange('phone', e.target.value)}
                placeholder="Country code + number"
              />
            </SettingField>
          </div>

          {/* Right col: status + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Plan info */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.25)' }}>
              <div style={{ fontSize: '0.72rem', color: '#25d366', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ✅ Instance Status
              </div>
              {[
                { label: 'Instance',  value: waCreds.idInstance },
                { label: 'Phone',     value: `+${waCreds.phone}` },
                { label: 'Status',    value: waCreds.idInstance ? 'Configured' : 'Not configured' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(37,211,102,0.12)', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Connection test result */}
            {waStatus !== 'idle' && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem',
                background: waStatus === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${waStatus === 'ok' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
                color: waStatus === 'ok' ? 'var(--brand-green)' : '#f87171',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>{waStatus === 'ok' ? '✓' : '✗'}</span>
                <span>{waMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
              <button
                onClick={handleWaTest}
                disabled={waTesting}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem',
                  background: 'rgba(37,211,102,0.1)', color: '#25d366',
                  border: '1px solid rgba(37,211,102,0.3)', cursor: waTesting ? 'not-allowed' : 'pointer',
                  opacity: waTesting ? 0.7 : 1, transition: 'all 0.15s',
                }}
              >
                {waTesting ? '⟳ Testing…' : '🔌 Test Connection'}
              </button>
              <button
                onClick={handleWaSave}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem',
                  background: waSaved ? 'rgba(16,185,129,0.2)' : 'rgba(37,211,102,0.15)',
                  color: waSaved ? 'var(--brand-green)' : '#25d366',
                  border: `1px solid ${waSaved ? 'rgba(16,185,129,0.4)' : 'rgba(37,211,102,0.3)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {waSaved ? '✅ Saved to Browser!' : '💾 Save to Browser'}
              </button>
              {/* Apply to persistent backend server */}
              <button
                onClick={handleApplyToServer}
                disabled={applyingToServer}
                style={{
                  padding: '10px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem',
                  background: applyingToServer ? 'rgba(167,139,250,0.1)' : 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(14,165,233,0.2))',
                  color: '#a78bfa',
                  border: '1px solid rgba(167,139,250,0.4)',
                  cursor: applyingToServer ? 'not-allowed' : 'pointer',
                  opacity: applyingToServer ? 0.7 : 1,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <span style={{ animation: applyingToServer ? 'spin 0.8s linear infinite' : 'none', display: 'inline-block' }}>
                  {applyingToServer ? '⟳' : '⚡'}
                </span>
                {applyingToServer ? 'Applying to Backend…' : 'Apply to Live Backend Server'}
              </button>
              {applyMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 7, fontSize: '0.78rem',
                  background: applyMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${applyMsg.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: applyMsg.startsWith('✅') ? '#10b981' : '#f87171',
                  lineHeight: 1.5,
                }}>
                  {applyMsg}
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, padding: '6px 0' }}>
                <strong style={{ color: 'var(--brand-teal)' }}>⚡ Apply to Server</strong> — sends credentials directly to the persistent Express backend (port 3001). The backend immediately connects to WhatsApp, loads message history, and starts GPT classification. No page reload needed.
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={() => {}}
        >Reset Defaults</button>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 28px',
            borderRadius: '8px',
            background: saved ? 'var(--brand-green)' : 'linear-gradient(135deg, var(--brand-teal), var(--brand-purple))',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {saved ? '✅ Saved!' : '💾 Save Settings'}
        </button>
      </div>

      {/* About Section */}
      <Card title="ℹ️ About MatchPro™ Intelligence Dashboard" subtitle="Version info and credits">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <AboutRow label="Dashboard Version" value="v2.0.0" />
            <AboutRow label="API Version" value="v10.0.0" />
            <AboutRow label="Markets Tracked" value={`${markets.length} locations`} />
            <AboutRow label="Data Source" value="MatchPro Intelligence Engine™" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <AboutRow label="Organization" value="Crystal Power Investments" />
            <AboutRow label="Contact" value="mmaisara@crystalpowerinvestment.com" />
            <AboutRow label="Region" value="Egypt — All Major Cities" />
            <AboutRow label="License" value="Proprietary — All Rights Reserved" />
          </div>
        </div>
      </Card>
    </div>
  )
}

function SettingField({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{description}</div>
      </div>
      {children}
    </div>
  )
}

function ToggleSetting({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: '12px',
          background: value ? 'var(--brand-teal)' : 'var(--bg-input)',
          border: `1px solid ${value ? 'var(--brand-teal)' : 'var(--border)'}`,
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '2px',
          left: value ? '22px' : '2px',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.8rem' }}>{value}</span>
    </div>
  )
}
