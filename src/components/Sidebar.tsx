import { type Page } from '../App'

interface NavItem {
  id: Page
  icon: string
  label: string
  badge?: string | number
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: '⊞', label: 'Overview' },
  { id: 'market-intelligence', icon: '🧠', label: 'Market Intel' },
  { id: 'supply-demand', icon: '⚖️', label: 'Supply & Demand' },
  { id: 'matches', icon: '🎯', label: 'Matches' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { id: 'heatmap', icon: '🗺️', label: 'Heat Map' },
  { id: 'api-explorer', icon: '🔌', label: 'API Explorer' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
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
  const ratio = totalSupply > 0 ? (totalDemand / totalSupply).toFixed(1) : '...'

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: isOpen ? 'var(--sidebar-width)' : '64px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      transition: 'width 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{
        padding: isOpen ? '20px 20px 16px' : '20px 14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '72px'
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          flexShrink: 0,
          fontWeight: 700,
          color: 'white',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
        }}>M</div>
        {isOpen && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              MatchPro™
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--brand-teal)', whiteSpace: 'nowrap', fontWeight: 500 }}>
              Intelligence Engine
            </div>
          </div>
        )}
      </div>

      {/* Market snapshot */}
      {isOpen && (
        <div style={{
          margin: '12px 12px 0',
          padding: '12px',
          background: 'rgba(14, 165, 233, 0.08)',
          borderRadius: '8px',
          border: '1px solid rgba(14, 165, 233, 0.2)'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--brand-teal)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Market Pulse
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <MiniStat label="Supply" value={totalSupply.toLocaleString()} color="var(--brand-teal)" />
            <MiniStat label="Demand" value={totalDemand.toLocaleString()} color="var(--brand-green)" />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Demand Ratio</span>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: parseFloat(ratio) > 2 ? 'var(--brand-red)' : parseFloat(ratio) > 1.5 ? 'var(--brand-gold)' : 'var(--brand-green)',
              background: 'rgba(0,0,0,0.2)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>{ratio}x</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <NavLink
            key={item.id}
            item={item}
            isActive={currentPage === item.id}
            isOpen={isOpen}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: isOpen ? '12px 16px' : '12px 8px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: 'white',
          flexShrink: 0
        }}>CPI</div>
        {isOpen && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Crystal Power
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Admin</div>
          </div>
        )}
      </div>
    </div>
  )
}

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
        padding: isOpen ? '10px 12px' : '10px',
        borderRadius: '8px',
        marginBottom: '2px',
        background: isActive
          ? 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(139,92,246,0.15))'
          : 'transparent',
        color: isActive ? 'var(--brand-teal)' : 'var(--text-secondary)',
        border: isActive ? '1px solid rgba(14,165,233,0.3)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
        justifyContent: isOpen ? 'flex-start' : 'center',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        position: 'relative'
      }}
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
        }
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {isOpen && (
        <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
      {isOpen && isActive && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-teal)', flexShrink: 0 }} />
      )}
    </button>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
