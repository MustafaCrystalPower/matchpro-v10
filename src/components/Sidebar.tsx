import { type Page } from '../App'

interface NavItem {
  id: Page
  icon: string
  label: string
  section?: string
}

const NAV_SECTIONS = [
  {
    label: 'INTELLIGENCE',
    items: [
      { id: 'dashboard'           as Page, icon: '⊞', label: 'Overview' },
      { id: 'market-intelligence' as Page, icon: '🧠', label: 'Market Intel' },
      { id: 'supply-demand'       as Page, icon: '⚖️', label: 'Supply & Demand' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { id: 'asset-matcher'   as Page, icon: '🏆', label: 'Asset Matcher' },
      { id: 'matches'         as Page, icon: '🎯', label: 'Matches' },
      { id: 'analytics'       as Page, icon: '📊', label: 'Analytics' },
      { id: 'heatmap'         as Page, icon: '🗺️', label: 'Heat Map' },
      { id: 'market-map'      as Page, icon: '🗺️', label: 'Market Map' },
      { id: 'whatsapp'        as Page, icon: '💬', label: 'WhatsApp' },
    ],
  },
  {
    label: 'AI ENGINE',
    items: [
      { id: 'live-search'     as Page, icon: '🔭', label: 'Live Scraper' },
      { id: 'nlp-classifier'  as Page, icon: '🧬', label: 'NLP Classifier' },
    ],
  },
  {
    label: 'MY TOOLS',
    items: [
      { id: 'my-search'       as Page, icon: '🔍', label: 'My Search' },
      { id: 'version-manager' as Page, icon: '🔒', label: 'Version Manager' },
    ],
  },
  {
    label: 'DEVELOPER',
    items: [
      { id: 'api-explorer' as Page, icon: '🔌', label: 'API Explorer' },
      { id: 'settings'     as Page, icon: '⚙️', label: 'Settings' },
    ],
  },
]

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  isOpen: boolean
  onToggle: () => void
  apiData: any
}

export default function Sidebar({ currentPage, onNavigate, isOpen, apiData }: SidebarProps) {
  const totalSupply = apiData?.summary?.total_supply ?? 0
  const totalDemand = apiData?.summary?.total_demand ?? 0
  const ratio = totalSupply > 0 ? (totalDemand / totalSupply).toFixed(2) : '...'
  const ratioNum = parseFloat(ratio)
  const ratioColor = ratioNum >= 3 ? 'var(--brand-red)' : ratioNum >= 2 ? 'var(--brand-gold)' : 'var(--brand-green)'
  const isLoaded = totalSupply > 0

  return (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: isOpen ? 'var(--sidebar-width)' : '64px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {/* ─── Logo ───────────────────────────────────────── */}
      <div style={{
        padding: isOpen ? '18px 20px' : '18px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '64px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          background: 'var(--gradient-brand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1rem',
          flexShrink: 0,
          fontWeight: 800,
          color: 'white',
          boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
          letterSpacing: '-0.05em',
        }}>M</div>
        {isOpen && (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
              MatchPro™
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--brand-teal)', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Intelligence Engine
            </div>
          </div>
        )}
        {isOpen && (
          <div style={{
            padding: '2px 7px',
            borderRadius: '4px',
            background: 'rgba(14,165,233,0.12)',
            border: '1px solid rgba(14,165,233,0.25)',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: 'var(--brand-teal)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}>v2.0</div>
        )}
      </div>

      {/* ─── Market Pulse ────────────────────────────────── */}
      {isOpen && (
        <div style={{
          margin: '12px 10px',
          padding: '12px',
          background: 'rgba(14,165,233,0.06)',
          borderRadius: '10px',
          border: '1px solid rgba(14,165,233,0.18)',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: '0.6rem',
            color: 'var(--brand-teal)',
            fontWeight: 700,
            marginBottom: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLoaded ? 'var(--brand-green)' : 'var(--text-muted)', display: 'inline-block', boxShadow: isLoaded ? '0 0 5px var(--brand-green)' : 'none' }} />
            Market Pulse
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <PulseStat
              label="Supply"
              value={isLoaded ? totalSupply.toLocaleString() : '—'}
              color="var(--brand-teal)"
              loading={!isLoaded}
            />
            <PulseStat
              label="Demand"
              value={isLoaded ? totalDemand.toLocaleString() : '—'}
              color="var(--brand-green)"
              loading={!isLoaded}
            />
          </div>

          {/* Ratio bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Demand/Supply</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ratioColor }}>{ratio}x</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: isLoaded ? `${Math.min(ratioNum / 5 * 100, 100)}%` : '0%',
                background: ratioColor,
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation ──────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: '4px' }}>
            {isOpen && (
              <div style={{
                padding: '10px 10px 4px',
                fontSize: '0.58rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => (
              <NavLink
                key={item.id}
                item={item}
                isActive={currentPage === item.id}
                isOpen={isOpen}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ─── User Footer ─────────────────────────────────── */}
      <div style={{
        padding: isOpen ? '12px 14px' : '12px 8px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          background: 'var(--gradient-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'white',
          flexShrink: 0,
          letterSpacing: '-0.02em',
        }}>CPI</div>
        {isOpen && (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Crystal Power
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Administrator</div>
          </div>
        )}
      </div>
    </aside>
  )
}

/* ─── Sub-components ─────────────────────────────────────── */

function NavLink({ item, isActive, isOpen, onClick }: { item: NavItem; isActive: boolean; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={!isOpen ? item.label : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: isOpen ? '9px 10px' : '9px',
        borderRadius: '8px',
        marginBottom: '2px',
        background: isActive ? 'rgba(14,165,233,0.12)' : 'transparent',
        color: isActive ? 'var(--brand-teal)' : 'var(--text-secondary)',
        border: `1px solid ${isActive ? 'rgba(14,165,233,0.28)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        justifyContent: isOpen ? 'flex-start' : 'center',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.05)'
          el.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'transparent'
          el.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {/* Active indicator strip */}
      {isActive && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: 3,
          borderRadius: '0 3px 3px 0',
          background: 'var(--gradient-teal)',
          boxShadow: '0 0 8px rgba(14,165,233,0.6)',
        }} />
      )}
      <span style={{ fontSize: '1.05rem', flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {isOpen && (
        <span style={{
          fontSize: '0.85rem',
          fontWeight: isActive ? 600 : 400,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.label}
        </span>
      )}
      {/* Asset Matcher highlighted badge */}
      {item.id === 'asset-matcher' && isOpen && !isActive && (
        <div style={{ padding:'1px 6px', borderRadius:4, background:'rgba(245,158,11,0.15)', color:'var(--brand-gold)', fontSize:'0.58rem', fontWeight:800, border:'1px solid rgba(245,158,11,0.3)', flexShrink:0 }}>NEW</div>
      )}
      {/* New pages badge */}
      {(item.id === 'market-map' || item.id === 'live-search' || item.id === 'nlp-classifier') && isOpen && !isActive && (
        <div style={{ padding:'1px 6px', borderRadius:4, background:'rgba(124,58,237,0.15)', color:'#a855f7', fontSize:'0.58rem', fontWeight:800, border:'1px solid rgba(124,58,237,0.3)', flexShrink:0 }}>NEW</div>
      )}
      {/* WhatsApp live indicator badge */}
      {item.id === 'whatsapp' && isOpen && !isActive && (
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#25d366',
          boxShadow: '0 0 5px #25d366',
          flexShrink: 0,
          animation: 'none',
        }} />
      )}
    </button>
  )
}

function PulseStat({ label, value, color, loading }: { label: string; value: string; color: string; loading: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className={loading ? 'skeleton' : ''} style={{ fontSize: '0.95rem', fontWeight: 700, color, minHeight: '1.2rem' }}>{value}</div>
    </div>
  )
}
