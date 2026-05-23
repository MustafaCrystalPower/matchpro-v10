interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  color?: string
  trend?: { value: string; up: boolean }
  loading?: boolean
  onClick?: () => void
}

export default function StatCard({ title, value, subtitle, icon, color = 'var(--brand-teal)', trend, loading, onClick }: StatCardProps) {
  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border)'
      }}>
        <div className="skeleton" style={{ height: '14px', width: '60%', marginBottom: '12px' }} />
        <div className="skeleton" style={{ height: '32px', width: '80%', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = color
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLElement).style.transform = 'none'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        }
      }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '80px',
        height: '80px',
        borderRadius: '0 12px 0 80px',
        background: color,
        opacity: 0.08
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {icon && (
          <span style={{
            fontSize: '1.4rem',
            width: 40,
            height: 40,
            borderRadius: '8px',
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>{icon}</span>
        )}
      </div>

      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>
          )}
          {trend && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: trend.up ? 'var(--brand-green)' : 'var(--brand-red)',
              background: trend.up ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
