import { type ReactNode } from 'react'
import type { CSSProperties } from 'react'

interface CardProps {
  title?:    string
  subtitle?: string
  children:  ReactNode
  actions?:  ReactNode
  style?:    CSSProperties
  padding?:  string
}

export default function Card({
  title, subtitle, children, actions,
  style, padding = '20px',
}: CardProps) {
  return (
    <div className="mp-card" style={{ overflow: 'hidden', ...style }}>
      {(title || actions) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {actions}
            </div>
          )}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  )
}

export function CardSection({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', ...style }}>
      {children}
    </div>
  )
}
