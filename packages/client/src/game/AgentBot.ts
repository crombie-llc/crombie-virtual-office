import Phaser from 'phaser'
import type { MascotConfig, MascotShape } from '../types'

// ── Mascot registry ──
// Maps normalized agent name → visual personality config.
// Pattern: strip 'crombie:' / 'crombie-' prefix, then match on the remainder.

function getMascotConfig(agentName: string): MascotConfig {
  const name = agentName.toLowerCase().replace(/^crombie[:-]/, '')

  if (name === 'explore' || name === 'explorer') {
    return { color: 0x00bcd4, accentColor: 0x4dd0e1, label: '🦉 explore', bounceHeight: 14, shape: 'owl' }
  }
  if (name === 'architect') {
    return { color: 0x3f51b5, accentColor: 0x7986cb, label: '🐦 architect', bounceHeight: 10, shape: 'raven' }
  }
  if (name === 'reviewer') {
    return { color: 0xe65100, accentColor: 0xff8a65, label: '🐕 reviewer', bounceHeight: 11, shape: 'dog' }
  }
  if (name === 'worker') {
    return { color: 0x2e7d32, accentColor: 0x81c784, label: '🦫 worker', bounceHeight: 12, shape: 'beaver' }
  }
  if (name === 'security') {
    return { color: 0xb71c1c, accentColor: 0xef9a9a, label: '🐺 security', bounceHeight: 13, shape: 'wolf' }
  }
  // Fallback: generic robot
  return { color: 0x607d8b, accentColor: 0x90a4ae, label: `🤖 ${name}`, bounceHeight: 12, shape: 'robot' }
}

// ── Shape drawing ──
// Each mascot is drawn entirely with Phaser Graphics primitives (no external assets).
// Origin is at (0, 0) — the mascot floats above the avatar.

function drawShape(g: Phaser.GameObjects.Graphics, config: MascotConfig): void {
  const { color, accentColor, shape } = config

  switch (shape) {
    case 'owl': {
      // Body
      g.fillStyle(color, 1)
      g.fillCircle(0, 4, 12)
      // Head
      g.fillCircle(0, -6, 10)
      // Ear tufts
      g.fillTriangle(-7, -14, -3, -14, -5, -21)
      g.fillTriangle(3, -14, 7, -14, 5, -21)
      // Eyes
      g.fillStyle(0xffffff, 1)
      g.fillCircle(-4, -7, 4)
      g.fillCircle(4, -7, 4)
      g.fillStyle(accentColor, 1)
      g.fillCircle(-4, -7, 2)
      g.fillCircle(4, -7, 2)
      // Beak
      g.fillStyle(0xf0c040, 1)
      g.fillTriangle(-2, -3, 2, -3, 0, 1)
      break
    }

    case 'raven': {
      // Elongated body
      g.fillStyle(color, 1)
      g.fillEllipse(0, 4, 18, 22)
      // Head
      g.fillCircle(0, -8, 9)
      // Beak (pointing right/forward)
      g.fillStyle(accentColor, 1)
      g.fillTriangle(-1, -9, -1, -6, 7, -8)
      // Eye
      g.fillStyle(0xffffff, 1)
      g.fillCircle(-2, -10, 3)
      g.fillStyle(accentColor, 1)
      g.fillCircle(-2, -10, 1.5)
      // Wing hint (left side darker)
      g.fillStyle(color - 0x202020, 1)
      g.fillEllipse(-8, 2, 8, 14)
      break
    }

    case 'dog': {
      // Body
      g.fillStyle(color, 1)
      g.fillRoundedRect(-9, -2, 18, 16, 4)
      // Head
      g.fillCircle(0, -8, 9)
      // Floppy ears
      g.fillStyle(accentColor, 1)
      g.fillEllipse(-11, -9, 8, 14)
      g.fillEllipse(11, -9, 8, 14)
      // Eyes
      g.fillStyle(0x222222, 1)
      g.fillCircle(-3, -10, 2.5)
      g.fillCircle(3, -10, 2.5)
      // Nose
      g.fillEllipse(0, -4, 5, 3)
      break
    }

    case 'beaver': {
      // Wide body
      g.fillStyle(color, 1)
      g.fillEllipse(0, 6, 22, 16)
      // Head
      g.fillCircle(0, -6, 9)
      // Prominent buck teeth
      g.fillStyle(0xffffff, 1)
      g.fillRect(-5, -1, 4, 7)
      g.fillRect(1, -1, 4, 7)
      // Eyes
      g.fillStyle(0x222222, 1)
      g.fillCircle(-3, -9, 2)
      g.fillCircle(3, -9, 2)
      // Flat paddle tail
      g.fillStyle(accentColor, 1)
      g.fillEllipse(0, 18, 16, 6)
      break
    }

    case 'wolf': {
      // Body
      g.fillStyle(color, 1)
      g.fillRoundedRect(-9, -2, 18, 16, 3)
      // Head
      g.fillCircle(0, -8, 9)
      // Pointy ears
      g.fillTriangle(-10, -12, -5, -12, -7, -23)
      g.fillTriangle(5, -12, 10, -12, 7, -23)
      // Inner ear highlight
      g.fillStyle(accentColor, 1)
      g.fillTriangle(-9, -13, -5, -13, -7, -20)
      g.fillTriangle(5, -13, 9, -13, 7, -20)
      // Eyes
      g.fillStyle(accentColor, 1)
      g.fillCircle(-3, -9, 2.5)
      g.fillCircle(3, -9, 2.5)
      // Snout
      g.fillStyle(0xdddddd, 1)
      g.fillEllipse(0, -3, 8, 5)
      g.fillStyle(0x111111, 1)
      g.fillEllipse(0, -3, 4, 2.5)
      break
    }

    case 'robot':
    default: {
      const s = 10
      // Isometric cube (original robot)
      g.fillStyle(color, 1)
      g.fillPoints([
        { x: 0, y: -s / 2 }, { x: s, y: 0 },
        { x: 0, y: s / 2 }, { x: -s, y: 0 },
      ], true)
      g.fillStyle(color - 0x101010, 1)
      g.fillPoints([
        { x: -s, y: 0 }, { x: 0, y: s / 2 },
        { x: 0, y: s / 2 + s }, { x: -s, y: s },
      ], true)
      g.fillStyle(accentColor, 1)
      g.fillPoints([
        { x: 0, y: s / 2 }, { x: s, y: 0 },
        { x: s, y: s }, { x: 0, y: s / 2 + s },
      ], true)
      break
    }
  }
}

// ── AgentBot ──

export class AgentBot {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private tween: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, x: number, y: number, agentName: string) {
    this.scene = scene

    const config = getMascotConfig(agentName)

    const g = scene.add.graphics()
    drawShape(g, config)
    g.setScale(1.6)

    // Glow halo behind the mascot (ADD blend for soft glow effect)
    const glow = scene.add.circle(0, 0, 40, config.color, 0.18)
    glow.setBlendMode(Phaser.BlendModes.ADD)

    // Robot shape also gets an antenna; other mascots skip it
    const showAntenna = config.shape === 'robot'
    const antennaY = config.shape === 'robot' ? -14 : 0
    const antenna = scene.add.circle(0, antennaY, showAntenna ? 4 : 0, accentColorForAntenna(config))
    if (showAntenna) antenna.setStrokeStyle(1, 0x2a8adf)

    const label = scene.add.text(0, 42, config.label, {
      fontSize: '7px',
      color: '#' + config.accentColor.toString(16).padStart(6, '0'),
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0)

    // Order: glow first (behind), then mascot graphics, then antenna, then label
    this.container = scene.add.container(x, y, [glow, g, antenna, label])
    this.container.setDepth(y + 100)

    this.tween = scene.tweens.add({
      targets: this.container,
      y: y - config.bounceHeight,
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: 'Sine.easeInOut',
    })
  }

  destroy() {
    this.tween.stop()
    this.container.destroy()
  }
}

function accentColorForAntenna(config: MascotConfig): number {
  return config.shape === 'robot' ? 0x4ac8ff : config.accentColor
}
