import Phaser from 'phaser'
import { toScreen } from './IsoCube'

const FLOOR_H = 0.12

/**
 * Draw a small isometric cube centered at origin.
 * W = half-width of top diamond, H = vertical half of top diamond, D = side depth.
 */
function drawIsoCube(
  g: Phaser.GameObjects.Graphics,
  topColor: number,
  leftColor: number,
  rightColor: number,
) {
  const W = 9, H = 5, D = 10

  // Top face (rhombus)
  g.fillStyle(topColor, 1)
  g.fillPoints([
    { x: 0,  y: -H - D },
    { x: W,  y: -D },
    { x: 0,  y:  H - D },
    { x: -W, y: -D },
  ], true)

  // Left face
  g.fillStyle(leftColor, 1)
  g.fillPoints([
    { x: -W, y: -D },
    { x: 0,  y:  H - D },
    { x: 0,  y:  H },
    { x: -W, y:  0 },
  ], true)

  // Right face
  g.fillStyle(rightColor, 1)
  g.fillPoints([
    { x: 0, y:  H - D },
    { x: W, y: -D },
    { x: W, y:  0 },
    { x: 0, y:  H },
  ], true)
}

interface CubeConfig {
  top: number
  left: number
  right: number
  label: string
  bounceHeight: number
}

function getMascotConfig(agentName: string): CubeConfig {
  const name = agentName.toLowerCase()
  if (name.includes('explore')) {
    return { top: 0x00bcd4, left: 0x007a8a, right: 0x009aad, label: 'explore', bounceHeight: 10 }
  }
  if (name.includes('architect')) {
    return { top: 0x3f51b5, left: 0x283380, right: 0x3344a0, label: 'architect', bounceHeight: 8 }
  }
  if (name.includes('reviewer') || name.includes('review')) {
    return { top: 0xff9800, left: 0xbf7200, right: 0xe08500, label: 'reviewer', bounceHeight: 9 }
  }
  if (name.includes('worker')) {
    return { top: 0x4caf50, left: 0x307a35, right: 0x3d9642, label: 'worker', bounceHeight: 11 }
  }
  if (name.includes('security')) {
    return { top: 0xf44336, left: 0xb52820, right: 0xd8382c, label: 'security', bounceHeight: 8 }
  }
  return { top: 0x607d8b, left: 0x3d5260, right: 0x506878, label: 'agent', bounceHeight: 8 }
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

    // Glow halo
    const glow = scene.add.circle(0, 0, 16, config.top, 0.18)
    glow.setBlendMode(Phaser.BlendModes.ADD)

    // Isometric cube body
    const g = scene.add.graphics()
    drawIsoCube(g, config.top, config.left, config.right)

    // Label — small, below the cube
    const label = scene.add.text(0, 14, config.label, {
      fontSize: '7px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#00000099',
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
