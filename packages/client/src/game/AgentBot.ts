import Phaser from 'phaser'
import type { MascotConfig } from '../types'
import { toScreen } from './IsoCube'

const FLOOR_H = 0.12

function drawRobot(g: Phaser.GameObjects.Graphics, config: MascotConfig) {
  // Body (main cube face — front)
  g.fillStyle(config.color, 1)
  g.fillRect(-10, -10, 20, 18)

  // Body shading (right face)
  g.fillStyle(config.accentColor, 1)
  g.fillRect(10, -7, 5, 15)

  // Body shading (top face)
  g.fillStyle(config.accentColor, 1)
  g.fillRect(-7, -14, 20, 5)

  // Eyes
  g.fillStyle(0x4ac8ff, 1)
  g.fillRect(-6, -6, 4, 4)
  g.fillRect(3, -6, 4, 4)

  // Mouth
  g.fillStyle(0x4ac8ff, 1)
  g.fillRect(-4, 2, 9, 2)

  // Antenna base
  g.fillStyle(config.color, 1)
  g.fillRect(-2, -14, 4, 4)

  // Antenna tip
  g.fillStyle(0x4ac8ff, 1)
  g.fillCircle(0, -17, 3)
}

function getMascotConfig(agentName: string): MascotConfig {
  const name = agentName.toLowerCase()
  if (name.includes('explore')) {
    return { color: 0x00bcd4, accentColor: 0x4dd0e1, label: '🤖 explore', bounceHeight: 10 }
  }
  if (name.includes('architect')) {
    return { color: 0x3f51b5, accentColor: 0x5c6bc0, label: '🤖 architect', bounceHeight: 8 }
  }
  if (name.includes('reviewer') || name.includes('review')) {
    return { color: 0xff9800, accentColor: 0xffb74d, label: '🤖 reviewer', bounceHeight: 9 }
  }
  if (name.includes('worker')) {
    return { color: 0x4caf50, accentColor: 0x81c784, label: '🤖 worker', bounceHeight: 11 }
  }
  if (name.includes('security')) {
    return { color: 0xf44336, accentColor: 0xe57373, label: '🤖 security', bounceHeight: 8 }
  }
  // Default / general-purpose
  return { color: 0x607d8b, accentColor: 0x90a4ae, label: '🤖 agent', bounceHeight: 8 }
}

export class AgentBot {
  private container: Phaser.GameObjects.Container
  private bounceTween: Phaser.Tweens.Tween | null = null

  constructor(
    scene: Phaser.Scene,
    tx: number,
    ty: number,
    ox: number,
    oy: number,
    agentName: string,
  ) {
    const config = getMascotConfig(agentName)
    // Place bot floating beside the desk — offset diagonally to avoid overlap
    // with other desks and avatars. Use a small random jitter for variety.
    const jitterX = (Math.random() - 0.5) * 0.6
    const jitterY = (Math.random() - 0.5) * 0.4
    const pos = toScreen(tx + 1.2 + jitterX, ty - 1.0 + jitterY, FLOOR_H + 1.5)
    const x = ox + pos.x
    const y = oy + pos.y

    // Glow halo (smaller)
    const glow = scene.add.circle(0, 2, 18, config.color, 0.15)
    glow.setBlendMode(Phaser.BlendModes.ADD)

    // Robot body (slightly smaller)
    const g = scene.add.graphics()
    g.setScale(0.85)
    drawRobot(g, config)

    // Label
    const label = scene.add.text(0, 20, config.label, {
      fontSize: '7px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0)

    this.container = scene.add.container(x, y, [glow, g, label])
    this.container.setDepth(y + 50) // render above furniture at same Y

    // Bounce animation
    this.bounceTween = scene.tweens.add({
      targets: this.container,
      y: y - config.bounceHeight,
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  destroy() {
    this.bounceTween?.stop()
    this.container.destroy()
  }
}
