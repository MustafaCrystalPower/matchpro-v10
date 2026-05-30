/**
 * CRM Pipeline — match status workflow
 * Stages: new → contacted → viewing → offer → closed / lost
 */
import { useState, useEffect } from 'react'
import Card from '../components/Card'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

interface PipelineEntry {
  id: string
  matchId: string
  buyerName: string
  sellerName: string
  propertyDesc: string
  status: 'new' | 'contacted' | 'viewing' | 'offer' | 'closed' | 'lost'
  notes: string
  createdAt: string
  updatedAt: string
  history: Array<{ status: string; note: string; at: string }>
}

const STAGES: Array<{ key: PipelineEntry['status']; label: string; color: string; bg: string; icon: string }> = [
  { key: 'new',       label: 'New',       color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  icon: '🆕' },
  { key: 'contacted', label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '📞' },
  { key: 'viewing',   label: 'Viewing',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: '👁️' },
  { key: 'offer',     label: 'Offer',     color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: '📝' },
  { key: 'closed',    label: 'Closed',    color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '✅' },
  { key: 'lost',      label: 'Lost',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '❌' },
]

const MOCK_PIPELINE: PipelineEntry[] = [
  { id: 'pipe_1', matchId: 'm1', buyerName: 'Ahmed Hassan',  sellerName: 'Crystal Power', propertyDesc: '3BR Apartment in Madinaty — 5.5M EGP', status: 'viewing',   notes: 'Viewing scheduled for Saturday', createdAt: new Date(Date.now()-86400000*3).toISOString(), updatedAt: new Date(Date.now()-3600000).toISOString(), history: [{status:'new',note:'Created',at:new Date(Date.now()-86400000*3).toISOString()},{status:'contacted',note:'Called buyer',at:new Date(Date.now()-86400000*2).toISOString()},{status:'viewing',note:'Viewing set',at:new Date(Date.now()-3600000).toISOString()}] },
  { id: 'pipe_2', matchId: 'm2', buyerName: 'Sara Mohamed',  sellerName: 'Crystal Power', propertyDesc: '4BR Villa in New Cairo — 12M EGP',    status: 'offer',     notes: 'Offer submitted — awaiting response', createdAt: new Date(Date.now()-86400000*5).toISOString(), updatedAt: new Date(Date.now()-7200000).toISOString(), history: [{status:'new',note:'Created',at:new Date(Date.now()-86400000*5).toISOString()},{status:'contacted',note:'Emailed',at:new Date(Date.now()-86400000*4).toISOString()},{status:'viewing',note:'Visited property',at:new Date(Date.now()-86400000*2).toISOString()},{status:'offer',note:'Offer sent',at:new Date(Date.now()-7200000).toISOString()}] },
  { id: 'pipe_3', matchId: 'm3', buyerName: 'Khaled Ali',    sellerName: 'Crystal Power', propertyDesc: 'Studio in Sheikh Zayed — 18K/yr',     status: 'contacted', notes: 'Follow up needed', createdAt: new Date(Date.now()-86400000*1).toISOString(), updatedAt: new Date(Date.now()-1800000).toISOString(), history: [{status:'new',note:'Created',at:new Date(Date.now()-86400000).toISOString()},{status:'contacted',note:'WhatsApp sent',at:new Date(Date.now()-1800000).toISOString()}] },
  { id: 'pipe_4', matchId: 'm4', buyerName: 'Fatima Ibrahim', sellerName: 'Crystal Power', propertyDesc: '2BR Apartment in Zamalek — 6.2M EGP', status: 'closed',    notes: 'Deal closed successfully! Commission pending.', createdAt: new Date(Date.now()-86400000*10).toISOString(), updatedAt: new Date(Date.now()-86400000*1).toISOString(), history: [{status:'new',note:'Created',at:new Date(Date.now()-86400000*10).toISOString()},{status:'closed',note:'Signed contracts',at:new Date(Date.now()-86400000).toISOString()}] },
  { id: 'pipe_5', matchId: 'm5', buyerName: 'Omar Sayed',    sellerName: 'Crystal Power', propertyDesc: '3BR in Heliopolis — 3.5M EGP',        status: 'new',       notes: '', createdAt: new Date(Date.now()-3600000).toISOString(), updatedAt: new Date(Date.now()-3600000).toISOString(), history: [{status:'new',note:'Created',at:new Date(Date.now()-3600000).toISOString()}] },
]

export default function CRMPipeline({ }: Props) {
  const [entries, setEntries]   = useState<PipelineEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<PipelineEntry | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [newNote, setNewNote]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [view, setView]         = useState<'kanban'|'list'>('kanban')

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const res  = await fetch('/api/pipeline')
        const data = await res.json()
        setEntries(data.pipeline?.length > 0 ? data.pipeline : MOCK_PIPELINE)
      } catch {
        setEntries(MOCK_PIPELINE)
      } finally {
        setLoading(false)
      }
    }
    fetchPipeline()
    const t = setInterval(fetchPipeline, 15_000)
    return () => clearInterval(t)
  }, [])

  const updateStatus = async () => {
    if (!selected || !newStatus) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pipeline/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: newNote }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
        setSelected(updated)
      } else {
        // Local update
        const updated: PipelineEntry = {
          ...selected,
          status: newStatus as PipelineEntry['status'],
          notes:  newNote || selected.notes,
          updatedAt: new Date().toISOString(),
          history: [...selected.history, { status: newStatus, note: newNote, at: new Date().toISOString() }],
        }
        setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
        setSelected(updated)
      }
      setNewStatus('')
      setNewNote('')
    } catch {} finally {
      setSaving(false)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const stageOf = (k: string) => STAGES.find(s => s.key === k) || STAGES[0]

  const counts = STAGES.reduce((acc, s) => {
    acc[s.key] = entries.filter(e => e.status === s.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>📋 CRM Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Match status workflow — new → contacted → viewing → offer → closed</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', padding: '3px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          {(['kanban','list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem',
              background: view === v ? 'rgba(14,165,233,0.2)' : 'transparent',
              color: view === v ? 'var(--brand-teal)' : 'var(--text-muted)',
              fontWeight: view === v ? 700 : 400,
            }}>
              {v === 'kanban' ? '⊞ Kanban' : '☰ List'}
            </button>
          ))}
        </div>
      </div>

      {/* Stage counts */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {STAGES.map(s => (
          <div key={s.key} style={{ padding: '10px 16px', borderRadius: '10px', background: s.bg, border: `1px solid ${s.color}40`, minWidth: 90, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{counts[s.key] || 0}</div>
            <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600, marginTop: '2px' }}>{s.icon} {s.label}</div>
          </div>
        ))}
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', overflowX: 'auto' }}>
          {STAGES.map(stage => (
            <div key={stage.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', padding: '8px 10px', borderRadius: '7px', background: stage.bg, border: `1px solid ${stage.color}30` }}>
                <span style={{ fontSize: '1rem' }}>{stage.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: stage.color }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: stage.color }}>{counts[stage.key] || 0}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {entries.filter(e => e.status === stage.key).map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px',
                      background: selected?.id === entry.id ? stage.bg : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${selected?.id === entry.id ? stage.color + '60' : 'var(--border)'}`,
                      cursor: 'pointer', fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '0.82rem' }}>{entry.buyerName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>{entry.propertyDesc.slice(0, 60)}…</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px' }}>{fmtDate(entry.updatedAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <Card title="All Pipeline Entries" subtitle={`${entries.length} total`}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Property</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Updated</th>
                  <th>History</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const s = stageOf(entry.status)
                  return (
                    <tr key={entry.id} onClick={() => setSelected(entry)} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      <td><strong style={{ fontSize: '0.85rem' }}>{entry.buyerName}</strong></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 180 }}>{entry.propertyDesc}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', background: s.bg, color: s.color, fontSize: '0.72rem', fontWeight: 700 }}>
                          {s.icon} {s.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 140 }}>{entry.notes || '—'}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDate(entry.updatedAt)}</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.history.length} steps</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail / Update panel */}
      {selected && (
        <Card title={`📋 ${selected.buyerName} — Deal Detail`} subtitle={selected.propertyDesc}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left: history */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selected.history.map((h, i) => {
                  const s = stageOf(h.status)
                  return (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.bg, border: `1px solid ${s.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem' }}>{s.icon}</div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>{s.label}</div>
                        {h.note && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{h.note}</div>}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{fmtDate(h.at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: update status */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Update Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>New Stage</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    <option value="">Select stage…</option>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Notes</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a note…"
                    onKeyDown={e => { if (e.key === 'Enter') updateStatus() }}
                  />
                </div>
                <button
                  onClick={updateStatus}
                  disabled={!newStatus || saving}
                  className="btn btn-primary"
                  style={{ padding: '10px', fontSize: '0.85rem', opacity: !newStatus || saving ? 0.5 : 1, justifyContent: 'center' }}
                >
                  {saving ? '⟳ Saving…' : '✅ Update Status'}
                </button>
                <button onClick={() => setSelected(null)} className="btn" style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', justifyContent: 'center' }}>Close</button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
