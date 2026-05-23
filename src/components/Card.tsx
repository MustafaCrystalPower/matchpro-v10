import { type ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  style?: React.CSSProperties
  padding?: string
}

export default function Card({ title, subtitle, children, actions, style, padding = '20px' }: CardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      ...style
    }}>
      {(title || actions) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div>
            {title && <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  )
}

export function CardSection({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', ...style }}>
      {children}
    </div>
  )
}
