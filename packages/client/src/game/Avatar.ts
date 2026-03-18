import Phaser from 'phaser'
import { toScreen } from './IsoCube'
import type { DeveloperState } from '../types'

/**
 * Avatar workstation: Kenney desk + monitor + chair + character sprite.
 * Characters are 256x512 with figure occupying ~bottom 55%.
 * We use alternating Human_ and Male_ sprites for variety.
 */

const FLOOR_H = 0.12

const IDLE_WAYPOINTS = [
  { tx: 3, ty: 5 }, { tx: 6, ty: 3 }, { tx: 4, ty: 8 },
  { tx: 7, ty: 7 }, { tx: 2, ty: 11 }, { tx: 5, ty: 10 },
  { tx: 8, ty: 9 }, { tx: 18, ty: 10 }, { tx: 20, ty: 12 },
  { tx: 22, ty: 11 }, { tx: 19, ty: 14 }, { tx: 21, ty: 9 },
  { tx: 6, ty: 13 }, { tx: 9, ty: 12 }, { tx: 3, ty: 14 },
]

export class Avatar {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private thinkBubble!: Phaser.GameObjects.Container
  private celebContainer!: Phaser.GameObjects.Container
  private celebOriginY = -80
  private thinkTween?: Phaser.Tweens.Tween
  private statusDot!: Phaser.GameObjects.Arc
  private activityLabel!: Phaser.GameObjects.Text
  private deskX: number
  private deskY: number
  private ox: number
  private oy: number
  private wanderTween: Phaser.Tweens.Tween | null = null
  private wanderTimer: Phaser.Time.TimerEvent | null = null
  private isWandering = false

  constructor(scene: Phaser.Scene, screenX: number, screenY: number, ox: number, oy: number, index: number, state: DeveloperState) {
    this.scene = scene
    this.deskX = screenX
    this.deskY = screenY
    this.ox = ox
    this.oy = oy
    const color = parseInt(state.color.replace('#', ''), 16)
    const items: Phaser.GameObjects.GameObject[] = []

    // ── Desk ──
    const desk = scene.add.image(0, 10, 'desk_SE').setScale(0.48).setOrigin(0.5, 1)
    items.push(desk)

    // ── Monitor on desk ──
    const monitor = scene.add.image(2, -12, 'computerScreen_SE').setScale(0.48).setOrigin(0.5, 1)
    items.push(monitor)

    // ── Chair (behind the character) ──
    const chair = scene.add.image(-2, 28, 'chairDesk_SE').setScale(0.36).setOrigin(0.5, 1)
    items.push(chair)

    // ── Character sprite ──
    // Alternate between Human (prototype) and Male (dungeon) for visual variety
    const spriteSet = index % 2 === 0 ? 'human' : 'male'
    const variant = index % 8
    const charKey = `${spriteSet}_${variant}`
    const character = scene.add.image(4, 10, charKey)
      .setScale(0.425)       // 0.5 * 0.85 = 0.425
      .setOrigin(0.5, 0.92)  // anchor near feet (figure is in bottom portion)
    items.push(character)

    // ── Name label ──
    const nameText = scene.add.text(0, -42, state.name, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5)
    const pill = scene.add.rectangle(0, -42, nameText.width + 16, 17, 0x1a1a2e, 0.9)
    pill.setStrokeStyle(1.5, color, 0.85)
    this.statusDot = scene.add.circle(nameText.width / 2 + 11, -42, 3,
      state.online ? 0x3fb950 : 0x666666)
    items.push(pill, nameText, this.statusDot)

    // ── Activity label (floating above name pill) ──
    const activityText = scene.add.text(0, -72, '', {
      fontSize: '8px', color: '#25B2E2', fontFamily: 'monospace',
      backgroundColor: '#0d0d1a', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0.5).setAlpha(0.85)
    this.activityLabel = activityText
    items.push(activityText)

    // ── Thinking bubble ──
    const bubBg = scene.add.rectangle(0, 0, 46, 16, 0xffffff, 0.95)
      .setStrokeStyle(1, 0xcccccc)
    const dots = scene.add.text(0, 0, '• • •', {
      fontSize: '9px', color: '#555', fontFamily: 'monospace',
    }).setOrigin(0.5)
    const tail = scene.add.triangle(0, 10, -3, 0, 3, 0, 0, 5, 0xffffff)
    this.thinkBubble = scene.add.container(0, -56, [bubBg, dots, tail])
    this.thinkBubble.setVisible(false)
    items.push(this.thinkBubble)

    // ── Celebration ──
    const ce1 = scene.add.text(0, 0, '🎉', { fontSize: '20px' }).setOrigin(0.5)
    const ce2 = scene.add.text(-16, 8, '✨', { fontSize: '14px' }).setOrigin(0.5)
    const ce3 = scene.add.text(16, 8, '🎊', { fontSize: '14px' }).setOrigin(0.5)
    this.celebContainer = scene.add.container(0, this.celebOriginY, [ce1, ce2, ce3])
    this.celebContainer.setVisible(false)
    items.push(this.celebContainer)

    // ── Assemble ──
    this.container = scene.add.container(screenX, screenY, items)
    this.container.setDepth(screenY)

    this.applyState(state)
  }

  applyState(state: DeveloperState) {
    if (state.online && !state.thinking && !state.activeAgent && !state.celebrating) {
      if (!this.isWandering) this.startWander()
    } else {
      if (this.isWandering) this.returnToDesk()
    }

    this.container.setAlpha(state.online ? 1 : 0.3)
    this.statusDot.setFillStyle(state.online ? 0x3fb950 : 0x666666)

    // ── Activity label ──
    if (!state.online) {
      this.activityLabel.setText('')
    } else if (state.celebrating) {
      this.activityLabel.setText('🎉 pushed!')
    } else if (state.thinking && state.activeAgent) {
      const agentShort = state.activeAgent.replace(/^crombie[:-]/, '')
      this.activityLabel.setText(`🤖 ${agentShort} thinking`)
    } else if (state.thinking) {
      this.activityLabel.setText('🤔 thinking...')
    } else if (state.online) {
      this.activityLabel.setText('💻 ready')
    }

    if (state.thinking) {
      this.thinkBubble.setVisible(true)
      if (!this.thinkTween) {
        this.thinkTween = this.scene.tweens.add({
          targets: this.thinkBubble, alpha: { from: 0.4, to: 1 },
          yoyo: true, repeat: -1, duration: 600,
        })
      }
    } else {
      this.thinkBubble.setVisible(false)
      this.thinkTween?.stop()
      this.thinkTween = undefined
    }

    if (state.celebrating) {
      this.scene.tweens.killTweensOf(this.celebContainer)
      this.celebContainer.setVisible(true)
      this.celebContainer.setAlpha(1)
      this.celebContainer.y = this.celebOriginY
      this.scene.tweens.add({
        targets: this.celebContainer,
        y: this.celebOriginY - 60,
        alpha: { from: 1, to: 0 },
        duration: 3000,
        onComplete: () => { this.celebContainer.setVisible(false) },
      })
    }
  }

  startWander() {
    this.isWandering = true
    this.pickNextWaypoint()
  }

  private pickNextWaypoint() {
    if (!this.isWandering) return
    const wp = IDLE_WAYPOINTS[Math.floor(Math.random() * IDLE_WAYPOINTS.length)]
    const pos = toScreen(wp.tx, wp.ty, FLOOR_H)
    const targetX = this.ox + pos.x
    const targetY = this.oy + pos.y
    const dist = Math.hypot(targetX - this.container.x, targetY - this.container.y)
    this.wanderTween = this.scene.tweens.add({
      targets: this.container,
      x: targetX, y: targetY,
      duration: Math.max(600, dist * 1.8),
      ease: 'Linear',
      onComplete: () => {
        this.container.setDepth(this.container.y)
        this.wanderTimer = this.scene.time.delayedCall(
          2000 + Math.random() * 2000, () => this.pickNextWaypoint()
        )
      },
    })
  }

  returnToDesk() {
    this.isWandering = false
    this.wanderTimer?.remove()
    this.wanderTimer = null
    this.scene.tweens.killTweensOf(this.container)
    this.wanderTween = null
    this.scene.tweens.add({
      targets: this.container, x: this.deskX, y: this.deskY,
      duration: 600, ease: 'Sine.easeInOut',
      onComplete: () => this.container.setDepth(this.deskY),
    })
  }

  destroy() {
    this.isWandering = false
    this.wanderTimer?.remove()
    this.scene.tweens.killTweensOf(this.container)
    this.thinkTween?.stop()
    this.container.destroy()
  }
}
