import { useState } from 'react'
import Card from '../components/Card'

interface Props { apiData: any; loading: boolean; refreshData: () => void; lastUpdated: Date }

export default function Settings({ apiData, loading, refreshData, lastUpdated }: Props) {
  const [settings, setSettings] = useState({
    apiBaseUrl: 'http://20.69.29.54:3070',
    refreshInterval: '60',
    defaultLocation: 'Madinaty',
    matchMinScore: '70',
    highConfidenceThreshold: '85',
    emailNotifications: false,
    pushNotifications: false,
    soundAlerts: true,
    darkMode: true,
    language: 'en',
    currency: 'EGP',
    timezone: 'Africa/Cairo'
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const summary = apiData?.summary
  const markets = apiData?.intelligence?.markets || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          ⚙️ Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Configure dashboard preferences, API settings, and notification options
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* API Configuration */}
        <Card title="🔌 API Configuration" subtitle="Market intelligence API connection settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Base URL" description="Market Intelligence API endpoint">
              <input
                value={settings.apiBaseUrl}
                onChange={e => handleChange('apiBaseUrl', e.target.value)}
                placeholder="http://..."
              />
            </SettingField>

            <SettingField label="Auto Refresh Interval" description="How often to refresh data (seconds)">
              <select value={settings.refreshInterval} onChange={e => handleChange('refreshInterval', e.target.value)}>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 60 seconds</option>
                <option value="120">Every 2 minutes</option>
                <option value="300">Every 5 minutes</option>
                <option value="0">Manual only</option>
              </select>
            </SettingField>

            <SettingField label="Default Location" description="Pre-selected location for filters">
              <select value={settings.defaultLocation} onChange={e => handleChange('defaultLocation', e.target.value)}>
                {(apiData?.summary?.top_locations || []).map((l: any) => (
                  <option key={l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            </SettingField>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 600, marginBottom: '8px' }}>
                🟢 API Status
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div>Last response: {lastUpdated.toLocaleTimeString()}</div>
                <div>Total supply: {(summary?.total_supply || 0).toLocaleString()} listings</div>
                <div>Total demand: {(summary?.total_demand || 0).toLocaleString()} requests</div>
                <div>Markets tracked: {markets.length}</div>
              </div>
              <button
                onClick={refreshData}
                disabled={loading}
                style={{
                  marginTop: '10px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: 'var(--brand-green)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >{loading ? '⟳ Refreshing...' : '↻ Test Connection'}</button>
            </div>
          </div>
        </Card>

        {/* Match Settings */}
        <Card title="🎯 Match Settings" subtitle="Configure matching algorithm thresholds">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Minimum Match Score (%)" description="Minimum score to show a match">
              <div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.matchMinScore}
                  onChange={e => handleChange('matchMinScore', e.target.value)}
                  style={{ width: '100%', marginBottom: '6px', accentColor: 'var(--brand-teal)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>50%</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-teal)' }}>{settings.matchMinScore}%</span>
                  <span>95%</span>
                </div>
              </div>
            </SettingField>

            <SettingField label="High Confidence Threshold (%)" description="Score for high-confidence match alerts">
              <div>
                <input
                  type="range"
                  min="70"
                  max="99"
                  step="1"
                  value={settings.highConfidenceThreshold}
                  onChange={e => handleChange('highConfidenceThreshold', e.target.value)}
                  style={{ width: '100%', marginBottom: '6px', accentColor: 'var(--brand-green)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>70%</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-green)' }}>{settings.highConfidenceThreshold}%</span>
                  <span>99%</span>
                </div>
              </div>
            </SettingField>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 600, marginBottom: '6px' }}>
                Score Breakdown Weights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                {[
                  { label: 'Location', weight: '40%', color: 'var(--brand-teal)' },
                  { label: 'Price', weight: '30%', color: 'var(--brand-green)' },
                  { label: 'Property Type', weight: '20%', color: 'var(--brand-purple)' },
                  { label: 'Bedrooms', weight: '10%', color: 'var(--brand-gold)' },
                ].map((w, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{w.label}</span>
                    <span style={{ fontWeight: 700, color: w.color }}>{w.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Display Settings */}
        <Card title="🎨 Display Settings" subtitle="Customize dashboard appearance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingField label="Currency" description="Display currency for prices">
              <select value={settings.currency} onChange={e => handleChange('currency', e.target.value)}>
                <option value="EGP">EGP — Egyptian Pound</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </SettingField>

            <SettingField label="Language" description="Interface language">
              <select value={settings.language} onChange={e => handleChange('language', e.target.value)}>
                <option value="en">English</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </SettingField>

            <SettingField label="Timezone" description="Data display timezone">
              <select value={settings.timezone} onChange={e => handleChange('timezone', e.target.value)}>
                <option value="Africa/Cairo">Cairo (UTC+2)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">London (UTC+0)</option>
              </select>
            </SettingField>

            <ToggleSetting
              label="Dark Mode"
              description="Use dark theme (recommended)"
              value={settings.darkMode}
              onChange={v => handleChange('darkMode', v)}
            />
          </div>
        </Card>

        {/* Notifications */}
        <Card title="🔔 Notifications" subtitle="Configure alert preferences">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ToggleSetting
              label="Sound Alerts"
              description="Play sound on high-confidence matches"
              value={settings.soundAlerts}
              onChange={v => handleChange('soundAlerts', v)}
            />
            <ToggleSetting
              label="Browser Push Notifications"
              description="Get notified even when the tab is in background"
              value={settings.pushNotifications}
              onChange={v => handleChange('pushNotifications', v)}
            />
            <ToggleSetting
              label="Email Notifications"
              description="Daily digest reports via email"
              value={settings.emailNotifications}
              onChange={v => handleChange('emailNotifications', v)}
            />

            {settings.emailNotifications && (
              <SettingField label="Report Email" description="Email to send daily reports">
                <input type="email" placeholder="maisaramoamen@gmail.com" />
              </SettingField>
            )}

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.06)', border: '1px solid rgba(14, 165, 233, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--brand-teal)' }}>ℹ️ Note:</strong> This dashboard uses read-only API endpoints. No outbound WhatsApp or SMS messaging is performed from this interface per the No-Outbound-Messaging policy.
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={() => {}}
        >Reset Defaults</button>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 28px',
            borderRadius: '8px',
            background: saved ? 'var(--brand-green)' : 'linear-gradient(135deg, var(--brand-teal), var(--brand-purple))',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {saved ? '✅ Saved!' : '💾 Save Settings'}
        </button>
      </div>

      {/* About Section */}
      <Card title="ℹ️ About MatchPro™ Intelligence Dashboard" subtitle="Version info and credits">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <AboutRow label="Dashboard Version" value="v2.0.0" />
            <AboutRow label="API Version" value="v10.0.0" />
            <AboutRow label="Markets Tracked" value={`${markets.length} locations`} />
            <AboutRow label="Data Source" value="MatchPro Intelligence Engine™" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <AboutRow label="Organization" value="Crystal Power Investments" />
            <AboutRow label="Contact" value="mmaisara@crystalpowerinvestment.com" />
            <AboutRow label="Region" value="Egypt — All Major Cities" />
            <AboutRow label="License" value="Proprietary — All Rights Reserved" />
          </div>
        </div>
      </Card>
    </div>
  )
}

function SettingField({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{description}</div>
      </div>
      {children}
    </div>
  )
}

function ToggleSetting({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: '12px',
          background: value ? 'var(--brand-teal)' : 'var(--bg-input)',
          border: `1px solid ${value ? 'var(--brand-teal)' : 'var(--border)'}`,
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '2px',
          left: value ? '22px' : '2px',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.8rem' }}>{value}</span>
    </div>
  )
}
