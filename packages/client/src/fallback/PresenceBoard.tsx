import type { OfficeState } from '../types'

interface Props {
  state: OfficeState
  connected: boolean
}

export function PresenceBoard({ state, connected }: Props) {
  const devs = Object.values(state).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))

  return (
    <div style={{ padding: '24px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#7ee8a2', marginBottom: '8px', fontSize: '16px', letterSpacing: '2px' }}>
        🏢 CROMBIE VIRTUAL OFFICE
      </h1>
      {!connected && (
        <p style={{ color: '#e3b341', marginBottom: '16px', fontSize: '12px' }}>
          ⚠ Connecting to server...
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {devs.map(dev => (
          <div key={dev.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: dev.online ? 1 : 0.4 }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dev.online ? '#3fb950' : '#555', display: 'inline-block' }} />
            <span style={{ color: dev.color, fontWeight: 'bold' }}>{dev.name}</span>
            {!dev.online && <span style={{ color: '#555', fontSize: '11px' }}>offline</span>}
            {dev.activeAgent && <span title={dev.activeAgent}>🤖 {dev.activeAgent}</span>}
            {dev.thinking && <span>💭</span>}
            {dev.celebrating && <span>🎉</span>}
          </div>
        ))}
        {devs.length === 0 && <p style={{ color: '#555' }}>No developers registered yet.</p>}
      </div>
    </div>
  )
}
