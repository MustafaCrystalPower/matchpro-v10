import { useState } from 'react'

const VERSION_DATA = [
  { v: 1,  icon: "⚡", name: "Core Engine",         tagline: "The foundation",              color: "#10b981", features: ["WhatsApp ingestion", "Arabic NLP parser", "Supply/Demand extraction", "AI matching engine", "Live dashboard"] },
  { v: 2,  icon: "🏠", name: "My Assets",           tagline: "See who wants your property", color: "#0ea5e9", features: ["Add your properties", "Find matching buyers/renters", "Contact management", "Follow-up tracking"] },
  { v: 3,  icon: "🔍", name: "My Search",           tagline: "Find exactly what you need",  color: "#8b5cf6", features: ["Search for any property", "Ranked supply results", "Save searches", "New match alerts"] },
  { v: 4,  icon: "🌐", name: "Platform Connectors", tagline: "Property Finder + Dubizzle",  color: "#f59e0b", features: ["Property Finder Egypt", "Dubizzle Egypt", "Multi-source matching", "Auto-sync every 6h"] },
  { v: 5,  icon: "📱", name: "Facebook Groups",     tagline: "Social intelligence layer",   color: "#3b82f6", features: ["FB real estate groups", "Post classification", "Buyer/seller detection", "Arabic + English"] },
  { v: 6,  icon: "🗺️", name: "More Platforms",     tagline: "Aqarmap + OLX Egypt",         color: "#06b6d4", features: ["Aqarmap.com", "OLX Egypt", "Full market coverage", "Unified feed"] },
  { v: 7,  icon: "🌍", name: "Cross-Market",        tagline: "Any market, any vertical",    color: "#eab308", features: ["Export/Import market", "Logistics", "Jobs market", "Wholesale", "Custom verticals"] },
  { v: 8,  icon: "🏢", name: "Enterprise",          tagline: "Scale your team",             color: "#64748b", features: ["Multi-tenant orgs", "White-labeling", "Data isolation", "Team management"] },
  { v: 9,  icon: "👁️", name: "AI Eye",             tagline: "The Eye of the Market",       color: "#a855f7", features: ["Price prediction", "Investment scoring", "Heat maps", "Trend alerts"] },
  { v: 10, icon: "🚀", name: "Full SaaS",           tagline: "The platform others build on",color: "#f43f5e", features: ["Payment processing", "Subscriptions", "Public REST API", "Developer portal"] },
]

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

export default function VersionManager(_props: Props) {
  const [activeVersion, setActiveVersion] = useState(3)
  const [unlocking, setUnlocking] = useState<number | null>(null)

  const handleActivate = (v: number) => {
    setUnlocking(v)
    setTimeout(() => {
      setActiveVersion(v)
      setUnlocking(null)
    }, 1200)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          🔒 Version Manager
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.9rem' }}>
          MatchPro™ iPhone Strategy — Ship the 5S first. Unlock versions progressively.
        </p>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
            ✅ Active: v{activeVersion} — {VERSION_DATA[activeVersion - 1]?.name}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {activeVersion}/10 tiers unlocked
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '32px', padding: '16px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Platform Progress</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeVersion * 10}% unlocked</span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${activeVersion * 10}%`,
            background: 'var(--gradient-brand)',
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          {VERSION_DATA.map(v => (
            <div key={v.v} style={{
              width: '10%',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: v.v <= activeVersion ? 'var(--brand-teal)' : 'var(--text-muted)',
              fontWeight: v.v === activeVersion ? 800 : 400,
            }}>
              v{v.v}
            </div>
          ))}
        </div>
      </div>

      {/* Version Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {VERSION_DATA.map(version => {
          const isActive = version.v <= activeVersion
          const isCurrent = version.v === activeVersion
          const canActivate = version.v === activeVersion + 1
          const isLoading = unlocking === version.v

          return (
            <div key={version.v} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${isCurrent ? version.color : isActive ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
              borderRadius: '14px',
              padding: '20px',
              opacity: isActive ? 1 : 0.65,
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Active glow */}
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: '120px', height: '120px',
                  background: `radial-gradient(circle at top right, ${version.color}20, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px',
                    background: isActive ? `${version.color}20` : 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}>
                    {version.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      v{version.v} — {version.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{version.tagline}</div>
                  </div>
                </div>
                {isActive ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800,
                    background: isCurrent ? `${version.color}20` : 'rgba(16,185,129,0.12)',
                    color: isCurrent ? version.color : '#10b981',
                    border: `1px solid ${isCurrent ? `${version.color}40` : 'rgba(16,185,129,0.25)'}`,
                    flexShrink: 0,
                  }}>
                    {isCurrent ? '● ACTIVE' : '✓ DONE'}
                  </span>
                ) : (
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', flexShrink: 0,
                  }}>
                    🔒 LOCKED
                  </span>
                )}
              </div>

              {/* Features */}
              <ul style={{ margin: '0 0 16px 0', padding: 0, listStyle: 'none' }}>
                {version.features.map(f => (
                  <li key={f} style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    fontSize: '0.8rem', color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)',
                    marginBottom: '4px',
                  }}>
                    <span style={{ color: isActive ? version.color : 'var(--border)', fontSize: '0.7rem' }}>
                      {isActive ? '✓' : '○'}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Action button */}
              {canActivate && (
                <button
                  onClick={() => handleActivate(version.v)}
                  disabled={isLoading}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    background: `${version.color}`,
                    color: 'white', fontWeight: 700, fontSize: '0.85rem',
                    border: 'none', cursor: 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? '⏳ Activating...' : `🔓 Activate v${version.v} — ${version.name}`}
                </button>
              )}
              {isActive && !isCurrent && (
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textAlign: 'center' }}>
                  ✅ Fully operational
                </div>
              )}
              {!isActive && !canActivate && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Unlock v{version.v - 1} first
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(14,165,233,0.05)', borderRadius: '12px', border: '1px dashed rgba(14,165,233,0.2)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
          🎯 The iPhone Strategy
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          Steve Jobs built the iPhone 5S first, then released 1→2→3→4→5 to the market as sequential upgrades.
          We are doing the same. The full platform (v10 "Eye of the Market") is already architected.
          We ship as 10 versioned tiers that progressively unlock, capturing value at each stage.
        </p>
      </div>
    </div>
  )
}
