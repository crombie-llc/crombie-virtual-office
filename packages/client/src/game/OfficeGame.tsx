import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import type { OfficeState } from '../types'
// Fallback is handled by App.tsx ErrorBoundary/Suspense — no PresenceBoard import needed here

interface Props {
  state: OfficeState
  connected: boolean
}

export default function OfficeGame({ state, connected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<OfficeScene | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new OfficeScene()
    sceneRef.current = scene

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0d0d1a',
      parent: containerRef.current,
      scene: scene,
      pixelArt: true,
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [])

  // Push state updates into the scene
  useEffect(() => {
    sceneRef.current?.updateState(state)
  }, [state])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Status bar overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 16,
        fontFamily: 'monospace', fontSize: '11px', color: '#555',
        pointerEvents: 'none'
      }}>
        {connected ? '🟢 live' : '🔴 connecting...'}
      </div>
    </div>
  )
}
