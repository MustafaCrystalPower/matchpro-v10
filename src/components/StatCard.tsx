interface StatCardProps {
  title:    string
  value:    string | number
  subtitle?: string
  icon?:    string
  color?:   string
  trend?:   { value: string; up: boolean }
  loading?: boolean
  onClick?: () => void
}

export default function StatCard({
  title, value, subtitle, icon, color = 'var(--brand-teal)',
  trend, loading, onClick,
}: StatCardProps) {

  if (loading) {
    return (
      <div className="mp-card stat-card" style={{ padding: '20px' }}>
        <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 34, width: '75%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 11, width: '42%' }} />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="mp-card stat-card"
      style={{
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${color}55`
        el.style.boxShadow   = `0 0 0 1px ${color}22, var(--shadow-md)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow   = ''
      }}
    >
      {/* Accent blob top-right */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0,
        width: 88, height: 88,
        borderRadius: '0 12px 0 100%',
        background: color,
        opacity: 0.07,
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1.3,
        }}>
          {title}
        </span>
        {icon && (
          <div style={{
            width: 38, height: 38,
            borderRadius: '9px',
            background: `${color}18`,
            border: `1px solid ${color}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: '2rem',
        fontWeight: 800,
        color: 'var(--text-primary)',
        marginBottom: 8,
        lineHeight: 1,
        letterSpacing: '-0.03em',
        animation: 'countUp 0.4s ease-out',
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {/* Footer */}
      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>
          )}
          {trend && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: trend.up ? 'var(--brand-green)' : 'var(--brand-red)',
              background: trend.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              padding: '2px 8px',
              borderRadius: '20px',
              border: `1px solid ${trend.up ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {trend.up ? '▲' : '▼'} {trend.value}
            </span>
          )}
        </div>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: color,
        opacity: 0.3,
        borderRadius: '0 0 12px 12px',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
