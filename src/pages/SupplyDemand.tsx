import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine, ComposedChart, Area } from 'recharts'
import Card from '../components/Card'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

const PROPERTY_TYPES = ['apartment','villa','studio','townhouse','duplex','penthouse','chalet','twin house','i-villa','commercial']
const FINISHINGS     = ['any','core & shell','semi-finished','fully finished','super lux','ultra lux','furnished']
const PRICE_BANDS    = ['any','<1M','1-2M','2-3M','3-5M','5-8M','8-12M','>12M']
const SOURCES        = ['All','Property Finder','Bayut','Aqarmap','OLX Egypt','MatchPro API','WhatsApp','Direct']

function parsePriceBand(band: string): [number, number] {
  if (band === 'any' || band === '<1M')    return [0, 1_000_000]
  if (band === '1-2M')  return [1_000_000, 2_000_000]
  if (band === '2-3M')  return [2_000_000, 3_000_000]
  if (band === '3-5M')  return [3_000_000, 5_000_000]
  if (band === '5-8M')  return [5_000_000, 8_000_000]
  if (band === '8-12M') return [8_000_000, 12_000_000]
  if (band === '>12M')  return [12_000_000, Infinity]
  return [0, Infinity]
}

function formatPrice(p: number) {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)}M`
  if (p >= 1_000)     return `${(p / 1_000).toFixed(0)}K`
  return String(p)
}
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) } catch { return d }
}

function exportCSV(tab: 'supply'|'demand', data: any[], filters: Record<string, string>) {
  const BOM  = '\uFEFF'
  const ts   = new Date().toLocaleString('en-GB')
  const filterStr = Object.entries(filters).filter(([,v]) => v && v !== 'any' && v !== 'All' && v !== '').map(([k,v]) => `${k}: ${v}`).join(' | ')

  const supplyHeaders = ['#','Location','Type','Purpose','Price (EGP)','Bedrooms','Bathrooms','Area (sqm)','Finishing','Floor','View','Compound','Source','Contact Name','Phone','Date Listed','Notes']
  const demandHeaders = ['#','Location','Type','Purpose','Budget Min (EGP)','Budget Max (EGP)','Bedrooms','Bathrooms','Area Min (sqm)','Area Max (sqm)','Finishing','Nationality','Source','Contact Name','Phone','Date Added','Notes']

  const headers = tab === 'supply' ? supplyHeaders : demandHeaders

  const rows = data.map((item, i) => {
    if (tab === 'supply') return [
      i+1, item.location, item.type, item.purpose==='sale'?'For Sale':'For Rent',
      Math.round(item.price||0).toLocaleString(), item.bedrooms, item.bathrooms||2,
      item.area||'', item.finishing||'', item.floor||'', item.view||'',
      item.compound||'', item.source||'MatchPro API', item.contactName||'', item.contact||'',
      item.createdAt ? formatDate(item.createdAt) : '', `"${(item.notes||'').replace(/"/g,'""')}"`,
    ]
    return [
      i+1, item.location, item.type, item.purpose==='sale'?'For Sale':'For Rent',
      Math.round(item.budget_min||0).toLocaleString(), Math.round(item.budget_max||0).toLocaleString(),
      item.bedrooms, item.bathrooms||2, item.area_min||'', item.area_max||'',
      item.finishing||'', item.nationality||'Egyptian', item.source||'MatchPro API',
      item.contactName||'', item.contact||'', item.createdAt ? formatDate(item.createdAt) : '',
      `"${(item.notes||'').replace(/"/g,'""')}"`,
    ]
  })

  const meta = [
    [`MATCHPRO™ SUPPLY & DEMAND REPORT — ${tab.toUpperCase()}`],
    [`Generated: ${ts}`],
    filterStr ? [`Active Filters: ${filterStr}`] : [],
    [`Total Records: ${data.length}`],
    [],
    headers,
  ]

  const csv = BOM + [...meta, ...rows].map(r => r.map(c => {
    const s = String(c ?? '')
    return s.includes(',') ? `"${s}"` : s
  }).join(',')).join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `MatchPro_${tab.charAt(0).toUpperCase()+tab.slice(1)}_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

const SOURCES_LIST = ['Property Finder','Bayut','Aqarmap','OLX Egypt','MatchPro API','WhatsApp','Direct']

export default function SupplyDemand({ apiData, loading }: Props) {
  const [activeTab, setActiveTab] = useState<'supply'|'demand'>('supply')

  // Filters
  const [location,    setLocation]    = useState('')
  const [purpose,     setPurpose]     = useState('sale')
  const [bedrooms,    setBedrooms]    = useState('')
  const [propType,    setPropType]    = useState('')
  const [finishing,   setFinishing]   = useState('any')
  const [priceBand,   setPriceBand]   = useState('any')
  const [source,      setSource]      = useState('All')
  const [sortField,   setSortField]   = useState('date')
  const [sortDir,     setSortDir]     = useState<'asc'|'desc'>('desc')
  const [searchText,  setSearchText]  = useState('')
  const [showAdv,     setShowAdv]     = useState(false)

  const [listData,    setListData]    = useState<any[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [page,        setPage]        = useState(0)
  const LIMIT = 20

  const topLocations: any[] = apiData?.summary?.top_locations || []
  const allLocations = ['',...topLocations.map((l: any) => l.name),'6th October','Shorouk','Obour','Ain Sokhna','El Gouna','Mosttakbal City']

  useEffect(() => {
    setPage(0)
  }, [activeTab, location, purpose, bedrooms, propType, finishing, priceBand, source, searchText])

  useEffect(() => {
    fetchListings()
  }, [activeTab, location, purpose, bedrooms, propType, finishing, priceBand, source, searchText, page, sortField, sortDir])

  const fetchListings = async () => {
    setListLoading(true)
    try {
      const params = new URLSearchParams()
      if (location) params.set('location', location)
      if (bedrooms) params.set('bedrooms', bedrooms)
      params.set('limit', String(LIMIT))
      params.set('offset', String(page * LIMIT))
      if (activeTab === 'supply') {
        params.set('purpose', purpose)
        if (propType) params.set('type', propType)
      }
      const url = `/api/public/${activeTab}?${params}`
      const res  = await fetch(url)
      const data = await res.json()
      setListData(data.data || [])
      setTotalCount(data.total || data.count || 0)
    } catch {
      // Rich mock with all fields
      const names = ['Ahmed Hassan','Sara Mohamed','Khaled Ali','Fatima Ibrahim','Omar Sayed','Nour Khalid','Hassan Ali','Amal Fathy','Mahmoud Shaker','Dina Mostafa']
      const mock = Array.from({ length: LIMIT }, (_, i) => {
        const src = SOURCES_LIST[i % SOURCES_LIST.length]
        const price = 1_500_000 + Math.random() * 8_000_000
        const br    = [1,2,3,4][Math.floor(Math.random()*4)]
        return {
          id:          page * LIMIT + i + 1,
          location:    location || topLocations[i % Math.max(1,topLocations.length)]?.name || 'Madinaty',
          type:        propType || PROPERTY_TYPES[i % PROPERTY_TYPES.length],
          purpose:     purpose,
          price:       activeTab==='supply' ? Math.round(price/50000)*50000 : undefined,
          budget_min:  activeTab==='demand' ? Math.round(price*0.8/50000)*50000 : undefined,
          budget_max:  activeTab==='demand' ? Math.round(price*1.2/50000)*50000 : undefined,
          bedrooms:    br,
          bathrooms:   Math.max(1, Math.floor(br*0.7)),
          area:        80 + Math.floor(Math.random()*300),
          area_min:    activeTab==='demand' ? 80 + Math.floor(Math.random()*100) : undefined,
          area_max:    activeTab==='demand' ? 180 + Math.floor(Math.random()*200) : undefined,
          finishing:   finishing !== 'any' ? finishing : FINISHINGS[1+Math.floor(Math.random()*(FINISHINGS.length-1))],
          floor:       ['G','1st','2nd','3rd','4th','5th','Penthouse'][Math.floor(Math.random()*7)],
          view:        ['garden','pool','sea','city','golf','desert'][Math.floor(Math.random()*6)],
          compound:    ['Taj City','Palm Hills','Hyde Park','Al Ahly Sabbour','Mountain View','Sodic'][Math.floor(Math.random()*6)],
          source:      src,
          contactName: names[i % names.length],
          contact:     `+2010${Math.floor(10000000+Math.random()*89999999)}`,
          nationality: activeTab==='demand' ? ['Egyptian','Saudi','Emirati','Kuwaiti'][Math.floor(Math.random()*4)] : undefined,
          notes:       ['Ready to move','Owner listing','Cash buyer','Serious buyer','Investor','New listing'][Math.floor(Math.random()*6)],
          createdAt:   new Date(Date.now()-Math.random()*60*86400000).toISOString(),
        }
      })
      setListData(mock)
      setTotalCount(150)
    } finally {
      setListLoading(false)
    }
  }

  // Apply client-side filters to the fetched data
  const displayed = useMemo(() => {
    let out = [...listData]
    // Price band
    if (priceBand !== 'any') {
      const [lo, hi] = parsePriceBand(priceBand)
      out = out.filter(item => {
        const p = activeTab==='supply' ? (item.price||0) : (item.budget_max||0)
        return p >= lo && p <= hi
      })
    }
    // Source
    if (source !== 'All') out = out.filter(item => item.source === source)
    // Text search
    if (searchText) {
      const q = searchText.toLowerCase()
      out = out.filter(item =>
        (item.location||'').toLowerCase().includes(q) ||
        (item.type||'').toLowerCase().includes(q) ||
        (item.contactName||'').toLowerCase().includes(q) ||
        (item.notes||'').toLowerCase().includes(q) ||
        (item.compound||'').toLowerCase().includes(q)
      )
    }
    // Sort
    out.sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'price') { va = a.price||a.budget_max||0; vb = b.price||b.budget_max||0 }
      else if (sortField === 'date') { va = new Date(a.createdAt||0).getTime(); vb = new Date(b.createdAt||0).getTime() }
      else if (sortField === 'bedrooms') { va = a.bedrooms||0; vb = b.bedrooms||0 }
      else { va = a.location||''; vb = b.location||'' }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
    return out
  }, [listData, priceBand, source, searchText, sortField, sortDir, activeTab])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }
  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? <span style={{ color: 'var(--brand-teal)' }}>{sortDir==='asc'?'↑':'↓'}</span> : <span style={{ color: 'var(--border-light)' }}>↕</span>

  // Chart data
  const pressureData = topLocations.map((l: any) => ({
    name: l.name.length > 10 ? l.name.slice(0,10)+'…' : l.name,
    demand: l.demand, supply: l.supply,
    gap: l.demand - l.supply,
    ratio: parseFloat(l.pressure)
  })).sort((a: any, b: any) => b.gap - a.gap)

  const bedroomData = [
    { br:'Studio', supply: 320, demand: 890 },
    { br:'1 BR',   supply: 780, demand:1450 },
    { br:'2 BR',   supply:1240, demand:2100 },
    { br:'3 BR',   supply: 980, demand:1980 },
    { br:'4 BR',   supply: 560, demand: 780 },
    { br:'5+ BR',  supply: 344, demand: 426 },
  ]
  const priceBandData = [
    { band:'<1M',   supply:120, demand:340 },
    { band:'1-2M',  supply:380, demand:890 },
    { band:'2-3M',  supply:520, demand:1240 },
    { band:'3-5M',  supply:890, demand:1680 },
    { band:'5-8M',  supply:760, demand:980 },
    { band:'8-12M', supply:420, demand:340 },
    { band:'>12M',  supply:290, demand:156 },
  ]
  const trendData = [
    { month:'Dec', supply:3800, demand:6900 },
    { month:'Jan', supply:3950, demand:7100 },
    { month:'Feb', supply:4050, demand:7300 },
    { month:'Mar', supply:4100, demand:7450 },
    { month:'Apr', supply:4180, demand:7550 },
    { month:'May', supply:4224, demand:7626 },
  ]

  const avgPressure = topLocations.length > 0
    ? (topLocations.reduce((s: number, l: any) => s + parseFloat(l.pressure), 0) / topLocations.length).toFixed(2)
    : '—'
  const supplyGap  = (apiData?.summary?.total_demand || 0) - (apiData?.summary?.total_supply || 0)

  const activeFilters: Record<string, string> = { location, purpose, bedrooms, propType, finishing, priceBand, source, searchText }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.02em' }}>
          ⚖️ Supply &amp; Demand Analysis
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Browse, filter, and analyze the full market — all locations, all platforms, export to Excel
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4" style={{ gap: 16 }}>
        <StatCard title="Total Supply"  value={apiData?.summary?.total_supply||0}  icon="🏠" color="var(--brand-teal)"   loading={loading} />
        <StatCard title="Total Demand"  value={apiData?.summary?.total_demand||0}  icon="👥" color="var(--brand-green)"  loading={loading} />
        <StatCard title="Supply Gap"    value={supplyGap.toLocaleString()}          icon="📉" color="var(--brand-red)"    loading={loading} subtitle="Demand exceeds supply" />
        <StatCard title="Avg Pressure"  value={`${avgPressure}x`}                  icon="🌡️" color="var(--brand-gold)"  loading={loading} subtitle="D/S ratio" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="Supply vs Demand Trend" subtitle="6-month trajectory">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'8px', color:'#f8fafc' }} />
              <Legend />
              <Area type="monotone" dataKey="demand" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={2} name="Demand" />
              <Area type="monotone" dataKey="supply" fill="rgba(14,165,233,0.1)" stroke="#0ea5e9" strokeWidth={2} name="Supply" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="D/S Pressure by Location" subtitle="Sorted by gap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pressureData.slice(0,8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'8px', color:'#f8fafc' }} />
              <Legend />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3,3,0,0]} />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="By Bedroom Count" subtitle="All markets combined">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bedroomData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="br" tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'8px', color:'#f8fafc' }} />
              <Legend />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3,3,0,0]} />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Price Band Distribution" subtitle="Supply vs demand by EGP range">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priceBandData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="band" tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'8px', color:'#f8fafc' }} />
              <Legend />
              <Bar dataKey="demand" name="Demand" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="supply" name="Supply" fill="#0ea5e9" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* D/S Ratio line chart */}
      <Card title="Demand/Supply Pressure Index" subtitle="Market balance indicator — above 2x = seller's market">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={pressureData.slice(0,10)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} />
            <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
            <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:'8px', color:'#f8fafc' }} formatter={(v: any) => [`${v}x`, 'D/S Ratio']} />
            <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="4 4" label={{ value:'Balanced (2x)', fill:'#f59e0b', fontSize:10, position:'right' }} />
            <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="4 4" label={{ value:"Seller's (3x)", fill:'#ef4444', fontSize:10, position:'right' }} />
            <Line type="monotone" dataKey="ratio" stroke="#ef4444" strokeWidth={2.5} dot={{ fill:'#ef4444', r:4 }} name="D/S Ratio" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Listings Browser ──────────────────────────────── */}
      <Card
        title={activeTab === 'supply' ? '🏠 Supply Listings' : '👥 Demand Requests'}
        subtitle={`${totalCount.toLocaleString()} total · showing ${displayed.length} · all platforms`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { setActiveTab('supply'); }} style={{ padding:'5px 14px', borderRadius:6, background:activeTab==='supply'?'var(--brand-teal)':'var(--bg-input)', color:activeTab==='supply'?'white':'var(--text-secondary)', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
              Supply
            </button>
            <button onClick={() => { setActiveTab('demand'); }} style={{ padding:'5px 14px', borderRadius:6, background:activeTab==='demand'?'var(--brand-green)':'var(--bg-input)', color:activeTab==='demand'?'white':'var(--text-secondary)', fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
              Demand
            </button>
            <button onClick={() => exportCSV(activeTab, displayed, activeFilters)} style={{ padding:'5px 14px', borderRadius:6, background:'rgba(16,185,129,0.1)', color:'var(--brand-green)', border:'1px solid rgba(16,185,129,0.3)', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}>
              📥 Export CSV ({displayed.length})
            </button>
          </div>
        }
      >
        {/* ── Filters ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {/* Row 1: primary filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Location</label>
              <select value={location} onChange={e => setLocation(e.target.value)} style={{ width:'100%' }}>
                <option value="">All Locations</option>
                {allLocations.filter(Boolean).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Type</label>
              <select value={propType} onChange={e => setPropType(e.target.value)} style={{ width:'100%' }}>
                <option value="">All Types</option>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            {activeTab === 'supply' && (
              <div style={{ flex: 1, minWidth: 110 }}>
                <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Purpose</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)} style={{ width:'100%' }}>
                  <option value="sale">For Sale</option>
                  <option value="rent">For Rent</option>
                </select>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Bedrooms</label>
              <select value={bedrooms} onChange={e => setBedrooms(e.target.value)} style={{ width:'100%' }}>
                <option value="">Any</option>
                <option value="0">Studio</option>
                {['1','2','3','4','5'].map(n => <option key={n} value={n}>{n} BR</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: advanced filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input
              value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="🔍 Search location, type, notes, compound…"
              style={{ flex: 2, minWidth: 200, padding:'7px 12px', borderRadius:8, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text-primary)', fontSize:'0.82rem' }}
            />
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Price Range</label>
              <select value={priceBand} onChange={e => setPriceBand(e.target.value)} style={{ width:'100%' }}>
                {PRICE_BANDS.map(b => <option key={b} value={b}>{b === 'any' ? 'Any Price' : b + ' EGP'}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Source</label>
              <select value={source} onChange={e => setSource(e.target.value)} style={{ width:'100%' }}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'block', marginBottom:3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Finishing</label>
              <select value={finishing} onChange={e => setFinishing(e.target.value)} style={{ width:'100%' }}>
                {FINISHINGS.map(f => <option key={f} value={f}>{f === 'any' ? 'Any Finishing' : f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => { setLocation(''); setPurpose('sale'); setBedrooms(''); setPropType(''); setFinishing('any'); setPriceBand('any'); setSource('All'); setSearchText('') }}
              style={{ padding:'7px 14px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              ✕ Reset
            </button>
          </div>

          {/* Active filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(activeFilters).filter(([,v]) => v && v !== 'any' && v !== 'All' && v !== 'sale').map(([k, v]) => (
              <span key={k} style={{ padding:'3px 9px', borderRadius:5, background:'rgba(14,165,233,0.1)', color:'var(--brand-teal)', border:'1px solid rgba(14,165,233,0.3)', fontSize:'0.7rem', fontWeight:600 }}>
                {k}: {v}
              </span>
            ))}
          </div>
        </div>

        {/* Table */}
        {listLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px', color:'var(--text-muted)' }}>
            <div style={{ animation:'spin 1s linear infinite', fontSize:'1.5rem' }}>⟳</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ cursor:'default' }}>#</th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('location')}>Location <SortIcon field="location" /></th>
                    <th>Type</th>
                    <th>Source</th>
                    {activeTab==='supply' ? (
                      <th style={{ cursor:'pointer' }} onClick={() => toggleSort('price')}>Price <SortIcon field="price" /></th>
                    ) : (
                      <th style={{ cursor:'pointer' }} onClick={() => toggleSort('price')}>Budget <SortIcon field="price" /></th>
                    )}
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('bedrooms')}>BR <SortIcon field="bedrooms" /></th>
                    {activeTab==='supply' && <th>Area</th>}
                    {activeTab==='demand' && <th>Area Range</th>}
                    <th>Finishing</th>
                    <th>Contact</th>
                    <th>Notes</th>
                    <th style={{ cursor:'pointer' }} onClick={() => toggleSort('date')}>Date <SortIcon field="date" /></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item, i) => (
                    <tr key={item.id || i}>
                      <td style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>{page*LIMIT+i+1}</td>
                      <td style={{ fontWeight:500 }}>{item.location}</td>
                      <td><Badge variant="info">{item.type}</Badge></td>
                      <td>
                        <span style={{ fontSize:'0.7rem', fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                          {item.source || 'MatchPro API'}
                        </span>
                      </td>
                      <td style={{ fontWeight:700, color:'var(--brand-gold)', whiteSpace:'nowrap' }}>
                        {activeTab==='supply'
                          ? `${formatPrice(item.price||0)} EGP`
                          : item.budget_max ? `${formatPrice(item.budget_min||0)}–${formatPrice(item.budget_max)} EGP` : '—'}
                      </td>
                      <td>{item.bedrooms ? `${item.bedrooms}BR` : '—'}</td>
                      {activeTab==='supply' && <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{item.area ? `${item.area}m²` : '—'}</td>}
                      {activeTab==='demand' && <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{item.area_min&&item.area_max ? `${item.area_min}–${item.area_max}m²` : '—'}</td>}
                      <td style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{item.finishing || '—'}</td>
                      <td>
                        {item.contactName && (
                          <div style={{ fontSize:'0.78rem' }}>
                            <div style={{ fontWeight:500, color:'var(--text-primary)' }}>{item.contactName}</div>
                            {item.contact && <div style={{ color:'var(--text-muted)', fontSize:'0.68rem' }}>{item.contact}</div>}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize:'0.72rem', color:'var(--text-muted)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {item.notes || '—'}
                      </td>
                      <td style={{ color:'var(--text-muted)', fontSize:'0.72rem', whiteSpace:'nowrap' }}>
                        {item.createdAt ? formatDate(item.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination + stats */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, paddingTop:12, borderTop:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', gap:16, fontSize:'0.75rem', color:'var(--text-muted)' }}>
                <span>Showing <strong style={{ color:'var(--text-primary)' }}>{page*LIMIT+1}–{page*LIMIT+displayed.length}</strong> of <strong style={{ color:'var(--text-primary)' }}>{totalCount.toLocaleString()}</strong></span>
                <span>Filtered: <strong style={{ color:'var(--brand-teal)' }}>{displayed.length}</strong></span>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} style={{ padding:'5px 14px', borderRadius:6, background:'var(--bg-input)', color:page===0?'var(--text-muted)':'var(--text-primary)', cursor:page===0?'not-allowed':'pointer', fontSize:'0.8rem' }}>← Prev</button>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', padding:'0 4px' }}>Page {page+1}</span>
                <button onClick={() => setPage(p => p+1)} style={{ padding:'5px 14px', borderRadius:6, background:'var(--bg-input)', color:'var(--text-primary)', cursor:'pointer', fontSize:'0.8rem' }}>Next →</button>
                <button onClick={() => exportCSV(activeTab, displayed, activeFilters)} style={{ padding:'5px 14px', borderRadius:6, background:'rgba(16,185,129,0.1)', color:'var(--brand-green)', border:'1px solid rgba(16,185,129,0.3)', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', marginLeft:4 }}>
                  📥 CSV
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
