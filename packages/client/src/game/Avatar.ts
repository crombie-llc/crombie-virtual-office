import Phaser from 'phaser'
import type { DeveloperState } from '../types'

const ISO_X_OFFSET = 64
const ISO_Y_OFFSET = 32

// Convert grid position to isometric screen position
function isoToScreen(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * ISO_X_OFFSET,
    y: (gridX + gridY) * ISO_Y_OFFSET,
  }
}

export class Avatar {
  private scene: Phaser.Scene
  private name: string
  private color: number

  private deskSprite!: Phaser.GameObjects.Image
  private characterSprite!: Phaser.GameObjects.Rectangle // placeholder until real sprite
  private nameText!: Phaser.GameObjects.Text
  private thinkBubble!: Phaser.GameObjects.Container
  private celebContainer!: Phaser.GameObjects.Container

  private thinkTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, state: DeveloperState) {
    this.scene = scene
    this.name = state.name
    this.color = parseInt(state.color.replace('#', ''), 16)

    const { x, y } = isoToScreen(gridX, gridY)
    const cx = scene.scale.width / 2 + x
    const cy = scene.scale.height / 2 + y

    // Desk — use sprite if loaded, otherwise colored rectangle placeholder
    if (scene.textures.exists('desk')) {
      this.deskSprite = scene.add.image(cx, cy, 'desk').setOrigin(0.5, 0.5)
    } else {
      const g = scene.add.graphics()
      g.fillStyle(0x5a3a10, 1)
      g.fillRect(cx - 32, cy - 8, 64, 16)
      // Cast as Image for unified cleanup — graphics and image both extend GameObject
      this.deskSprite = g as unknown as Phaser.GameObjects.Image
    }

    // Character — colored rectangle
    this.characterSprite = scene.add.rectangle(cx, cy - 24, 20, 28, this.color)
    this.characterSprite.setAlpha(state.online ? 1 : 0.3)

    // Name label
    this.nameText = scene.add.text(cx, cy - 44, state.name, {
      fontSize: '9px',
      color: state.color,
      fontFamily: 'monospace',
    }).setOrigin(0.5, 1)

    // Thinking bubble (hidden by default)
    const bubbleBg = scene.add.rectangle(0, 0, 50, 18, 0xffffff, 0.9).setOrigin(0.5)
    const bubbleText = scene.add.text(0, 0, '• • •', {
      fontSize: '9px', color: '#333', fontFamily: 'monospace'
    }).setOrigin(0.5)
    this.thinkBubble = scene.add.container(cx, cy - 60, [bubbleBg, bubbleText])
    this.thinkBubble.setVisible(false)

    // Celebrate container (hidden by default)
    const emoji1 = scene.add.text(0, 0, '🎉', { fontSize: '20px' }).setOrigin(0.5)
    const emoji2 = scene.add.text(-16, 8, '✨', { fontSize: '14px' }).setOrigin(0.5)
    const emoji3 = scene.add.text(16, 8, '🎊', { fontSize: '14px' }).setOrigin(0.5)
    this.celebContainer = scene.add.container(cx, cy - 50, [emoji1, emoji2, emoji3])
    this.celebContainer.setVisible(false)

    this.applyState(state)
  }

  applyState(state: DeveloperState) {
    const alpha = state.online ? 1 : 0.3
    this.characterSprite.setAlpha(alpha)
    this.nameText.setAlpha(alpha)

    // Thinking bubble
    if (state.thinking) {
      this.thinkBubble.setVisible(true)
      if (!this.thinkTween) {
        this.thinkTween = this.scene.tweens.add({
          targets: this.thinkBubble,
          alpha: { from: 0.5, to: 1 },
          yoyo: true,
          repeat: -1,
          duration: 600,
        })
      }
    } else {
      this.thinkBubble.setVisible(false)
      this.thinkTween?.stop()
      this.thinkTween = undefined
    }

    // Celebration
    if (state.celebrating) {
      this.celebContainer.setVisible(true)
      // Reset y and alpha before animating (in case of rapid re-trigger)
      this.celebContainer.setAlpha(1)
      this.scene.tweens.add({
        targets: this.celebContainer,
        y: this.celebContainer.y - 50,
        alpha: { from: 1, to: 0 },
        duration: 3000,
        onComplete: () => { this.celebContainer.setVisible(false) }
      })
    }
  }

  destroy() {
    this.deskSprite.destroy()
    this.characterSprite.destroy()
    this.nameText.destroy()
    this.thinkBubble.destroy()
    this.celebContainer.destroy()
    this.thinkTween?.stop()
  }
}
