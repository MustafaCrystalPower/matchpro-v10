import { type ReactNode } from 'react'

type BadgeVariant = 'seller' | 'buyer' | 'balanced' | 'hot' | 'warm' | 'cool' | 'cold' | 'success' | 'warning' | 'danger' | 'info' | 'default'

const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  seller: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  buyer: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  balanced: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  hot: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  warm: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  cool: { bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
  cold: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
  success: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  danger: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  info: { bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
  default: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' }
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

export default function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const style = variantStyles[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: size === 'sm' ? '3px 8px' : '5px 12px',
      borderRadius: '12px',
      fontSize: size === 'sm' ? '0.7rem' : '0.8rem',
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em'
    }}>
      {children}
    </span>
  )
}

export function getMarketSignalVariant(signal: string): BadgeVariant {
  switch (signal?.toLowerCase()) {
    case 'seller': return 'seller'
    case 'buyer': return 'buyer'
    case 'balanced': return 'balanced'
    default: return 'default'
  }
}

export function getPressureVariant(pressure: number): BadgeVariant {
  if (pressure >= 3.5) return 'hot'
  if (pressure >= 2.5) return 'warm'
  if (pressure >= 1.5) return 'cool'
  return 'cold'
}

export function getTemperatureLabel(pressure: number): string {
  if (pressure >= 3.5) return '🔥 Very Hot'
  if (pressure >= 2.5) return '🌡️ Hot'
  if (pressure >= 1.5) return '🌤️ Warm'
  return '❄️ Cool'
}
