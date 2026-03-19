import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import type { OfficeState, DeveloperState, WsMessage } from '../types'

const WS_URL = (import.meta as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL ?? 'ws://localhost:4242'

// ── HUD Dock Components ──

function DevChip({ dev }: { dev: DeveloperState }) {
  const statusEmoji = !dev.online ? '⚫'
    : dev.thinking ? '🤔'
    : dev.activeAgent ? '💻'
    : '✅'
  const agentShort = dev.activeAgent?.replace(/^crombie[:-]/, '') ?? null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: dev.online ? 1 : 0.4 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', background: dev.color,
        boxShadow: dev.online ? `0 0 5px ${dev.color}` : 'none',
      }} />
      <span>{dev.name}</span>
      {agentShort && <span style={{ color: '#25B2E2', fontSize: '9px' }}>{agentShort}</span>}
      <span style={{ fontSize: '10px' }}>{statusEmoji}</span>
    </div>
  )
}

function HudDock({ state }: { state: OfficeState }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(13,13,26,0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(51,197,102,0.2)',
      borderRadius: 24, padding: '8px 20px',
      display: 'flex', gap: 16, alignItems: 'center',
      fontFamily: 'monospace', fontSize: '11px', color: '#aaa',
      pointerEvents: 'none',
    }}>
      {Object.values(state).map(d => <DevChip key={d.name} dev={d} />)}
    </div>
  )
}

// ── Zoom Controls ──

function ZoomControls({ sceneRef }: { sceneRef: React.RefObject<OfficeScene | null> }) {
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    const id = setInterval(() => {
      const z = sceneRef.current?.getZoom()
      if (z != null) setZoom(Math.round(z * 100))
    }, 200)
    return () => clearInterval(id)
  }, [sceneRef])

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      fontFamily: 'monospace', userSelect: 'none',
    }}>
      <button onClick={() => sceneRef.current?.zoomIn()} style={zoomBtnStyle} title="Zoom in (+)">＋</button>
      <span style={{
        fontSize: '10px', color: '#aaa', background: 'rgba(13,13,26,0.7)',
        borderRadius: 6, padding: '2px 6px', minWidth: 38, textAlign: 'center',
      }}>{zoom}%</span>
      <button onClick={() => sceneRef.current?.zoomOut()} style={zoomBtnStyle} title="Zoom out (-)">−</button>
      <button onClick={() => sceneRef.current?.resetZoom()} style={{ ...zoomBtnStyle, fontSize: '10px', marginTop: 2 }} title="Reset zoom (0)">⟳</button>
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: 'rgba(13,13,26,0.75)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(51,197,102,0.25)',
  color: '#ccc', fontSize: '16px', fontWeight: 'bold',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s, border-color 0.15s',
}

// ── Main Component ──

export default function OfficeGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const [officeState, setOfficeState] = useState<OfficeState>({})

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const scene = new OfficeScene()
    sceneRef.current = scene

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#181816',
      parent: containerRef.current,
      scene: [scene],
      pixelArt: true,
    })

    // WebSocket connection — handles full_state and incremental patch arrays
    let ws: WebSocket | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        // connection established
      }

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          if ('type' in msg && msg.type === 'full_state') {
            setOfficeState(msg.state)
            sceneRef.current?.updateState(msg.state)
          } else if (Array.isArray(msg)) {
            setOfficeState(prev => {
              const next = { ...prev }
              for (const { dev, patch } of msg) {
                if (next[dev]) next[dev] = { ...next[dev], ...patch }
              }
              sceneRef.current?.updateState(next)
              return next
            })
          }
        } catch (e) {
          console.error('[OfficeGame] WS parse error', e)
        }
      }

      ws.onerror = (e) => console.error('[OfficeGame] WS error:', e)

      ws.onclose = () => {
        if (!destroyed) setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      destroyed = true
      ws?.close()
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#181816', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'monospace', textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#33c566', letterSpacing: 3 }}>CROMBIE HQ</div>
        <div style={{ fontSize: '9px', color: '#25B2E2', letterSpacing: 2 }}>virtual office</div>
      </div>
      {Object.keys(officeState).length > 0 && <HudDock state={officeState} />}
      <ZoomControls sceneRef={sceneRef} />
      <div style={{
        position: 'absolute', bottom: 60, right: 16,
        fontFamily: 'monospace', fontSize: '8px', color: '#555',
        textAlign: 'right', lineHeight: 1.6, pointerEvents: 'none',
      }}>
        scroll: zoom · drag: pan<br />
        +/−: zoom · 0: reset<br />
        arrows: pan
      </div>
    </div>
  )
}
