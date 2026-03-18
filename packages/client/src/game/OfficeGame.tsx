import { useEffect, useRef, useMemo, useState } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import { GroundFloorScene } from './GroundFloorScene'
import type { OfficeState } from '../types'

interface Props {
  state: OfficeState
  connected: boolean
}

export default function OfficeGame({ state, connected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const [floor, setFloor] = useState<1 | 2>(2)

  useEffect(() => {
    if (!containerRef.current) return

    const officeScene = new OfficeScene()
    const groundScene = new GroundFloorScene()
    sceneRef.current = officeScene

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0d0d1a',
      parent: containerRef.current,
      scene: [officeScene, groundScene],
      pixelArt: true,
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.updateState(state)
  }, [state])

  const toggleFloor = () => {
    const game = gameRef.current
    if (!game) return
    if (floor === 2) {
      game.scene.stop('OfficeScene')
      game.scene.start('GroundFloorScene')
      setFloor(1)
    } else {
      game.scene.stop('GroundFloorScene')
      game.scene.start('OfficeScene')
      setFloor(2)
      // Re-apply state when switching back to office floor
      setTimeout(() => sceneRef.current?.updateState(state), 100)
    }
  }

  // ── Stats computation ──
  const stats = useMemo(() => {
    const devs = Object.values(state)
    const online = devs.filter(d => d.online).length
    const working = devs.filter(d => d.online && d.activeAgent).length
    const thinking = devs.filter(d => d.online && d.thinking).length
    const idle = online - working - thinking
    return { total: devs.length, online, working, thinking, idle: Math.max(0, idle) }
  }, [state])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Top-left: connection status ── */}
      <div style={{
        position: 'absolute', top: 12, left: 16,
        fontFamily: 'monospace', fontSize: '11px', color: '#666',
        pointerEvents: 'none',
      }}>
        {connected ? '🟢 live' : '🔴 connecting...'}
      </div>

      {/* ── Top-center: floor toggle ── */}
      <button onClick={toggleFloor} style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(13,13,26,0.85)', border: '1px solid #33c566',
        color: '#33c566', fontFamily: 'monospace', fontSize: '11px',
        padding: '6px 16px', cursor: 'pointer', borderRadius: 4,
      }}>
        {floor === 2 ? '☕ Ir a Planta Baja' : '💻 Ir al Piso 2'}
      </button>

      {/* ── Top-right: title ── */}
      <div style={{
        position: 'absolute', top: 14, right: 20,
        fontFamily: 'monospace', pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: '20px', color: '#33c566', fontWeight: 'bold', letterSpacing: '3px' }}>
          CROMBIE HQ
        </span>
        <span style={{ fontSize: '11px', color: '#25B2E2' }}>virtual office</span>
      </div>

      {/* ── Bottom stats bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(10,10,26,0.95))',
        padding: '16px 24px 12px',
        display: 'flex', alignItems: 'center', gap: 24,
        fontFamily: 'monospace', fontSize: '12px', color: '#aaa',
        pointerEvents: 'none',
      }}>
        <Stat label="working" value={stats.working} color="#4ac8ff" />
        <Stat label="thinking" value={stats.thinking} color="#f0c040" />
        <Stat label="idle" value={stats.idle} color="#3fb950" />
        <Stat label="offline" value={stats.total - stats.online} color="#555" />
        <div style={{ flex: 1 }} />
        <DevList state={state} />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color, fontWeight: 'bold', fontSize: '16px' }}>{value}</span>
      <span>{label}</span>
    </div>
  )
}

function DevList({ state }: { state: OfficeState }) {
  const devs = Object.values(state)
  if (devs.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {devs.map(d => (
        <div key={d.name} style={{
          display: 'flex', alignItems: 'center', gap: 5, opacity: d.online ? 1 : 0.4,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: d.color,
            boxShadow: d.online ? `0 0 6px ${d.color}` : 'none',
          }} />
          <span style={{ fontSize: '11px' }}>{d.name}</span>
          {d.activeAgent && (
            <span style={{ fontSize: '9px', color: '#4ac8ff' }}>
              🤖 {d.activeAgent.replace('crombie:', '').replace('crombie-', '')}
            </span>
          )}
          {d.thinking && <span style={{ fontSize: '9px', color: '#f0c040' }}>💭</span>}
          {d.celebrating && <span style={{ fontSize: '9px' }}>🎉</span>}
        </div>
      ))}
    </div>
  )
}
