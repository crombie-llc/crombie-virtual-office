import Phaser from 'phaser'
import type { DeveloperState } from '../types'

export class Avatar {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private thinkBubble!: Phaser.GameObjects.Container
  private celebContainer!: Phaser.GameObjects.Container
  private celebOriginY = -52
  private thinkTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, screenX: number, screenY: number, state: DeveloperState) {
    this.scene = scene
    const colorNum = parseInt(state.color.replace('#', ''), 16)

    // ── Desk: isometric parallelogram ──
    const deskG = scene.add.graphics()
    deskG.fillStyle(0xa07840, 1)
    deskG.fillPoints([{ x: 0, y: -10 }, { x: 36, y: 4 }, { x: 0, y: 18 }, { x: -36, y: 4 }], true)
    deskG.fillStyle(0x7a5828, 1)
    deskG.fillPoints([{ x: -36, y: 4 }, { x: 0, y: 18 }, { x: 0, y: 28 }, { x: -36, y: 14 }], true)
    deskG.fillStyle(0x8c6530, 1)
    deskG.fillPoints([{ x: 0, y: 18 }, { x: 36, y: 4 }, { x: 36, y: 14 }, { x: 0, y: 28 }], true)

    // ── Monitor ──
    const monG = scene.add.graphics()
    monG.fillStyle(0x222233, 1)
    monG.fillRect(-2, -32, 4, 6)
    monG.fillRect(-7, -28, 14, 3)
    monG.fillStyle(0x1a1a2e, 1)
    monG.fillRect(-10, -50, 20, 19)
    monG.fillStyle(0x4a9eff, 0.85)
    monG.fillRect(-8, -48, 16, 15)

    // ── Chair ──
    const chairG = scene.add.graphics()
    chairG.fillStyle(0x5535a0, 1)
    chairG.fillRect(-8, 12, 16, 16)
    chairG.fillStyle(0x4428880, 1)
    chairG.fillRect(-10, 10, 20, 4)

    // ── Character: body + head ──
    const body = scene.add.rectangle(0, -22, 14, 20, colorNum)
    const head = scene.add.arc(0, -39, 8, 0, 360, false, 0xf5c8a0)
    head.setFillStyle(0xf5c8a0)

    // ── Name label ──
    const nameText = scene.add.text(0, -60, state.name, {
      fontSize: '9px', color: state.color, fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5)
    const nameBg = scene.add.rectangle(0, -60, nameText.width + 12, 16, 0x0a0a18, 0.88)
    nameBg.setStrokeStyle(1, colorNum, 0.7)

    // ── Thinking bubble ──
    const bubBg = scene.add.rectangle(0, 0, 46, 15, 0xffffff, 0.92).setOrigin(0.5)
    const bubText = scene.add.text(0, 0, '• • •', { fontSize: '8px', color: '#222', fontFamily: 'monospace' }).setOrigin(0.5)
    this.thinkBubble = scene.add.container(0, -80, [bubBg, bubText])
    this.thinkBubble.setVisible(false)

    // ── Celebration ──
    const ce1 = scene.add.text(0, 0, '🎉', { fontSize: '18px' }).setOrigin(0.5)
    const ce2 = scene.add.text(-16, 8, '✨', { fontSize: '12px' }).setOrigin(0.5)
    const ce3 = scene.add.text(16, 8, '🎊', { fontSize: '12px' }).setOrigin(0.5)
    this.celebContainer = scene.add.container(0, this.celebOriginY, [ce1, ce2, ce3])
    this.celebContainer.setVisible(false)

    // ── Assemble (back items first for painter order) ──
    this.container = scene.add.container(screenX, screenY, [
      chairG, deskG, monG,
      body, head,
      nameBg, nameText,
      this.thinkBubble, this.celebContainer,
    ])

    this.applyState(state)
  }

  applyState(state: DeveloperState) {
    this.container.setAlpha(state.online ? 1 : 0.3)

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
        y: this.celebOriginY - 50,
        alpha: { from: 1, to: 0 },
        duration: 3000,
        onComplete: () => { this.celebContainer.setVisible(false) },
      })
    }
  }

  destroy() {
    this.thinkTween?.stop()
    this.container.destroy()
  }
}
