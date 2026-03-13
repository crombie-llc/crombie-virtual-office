import Phaser from 'phaser'

export class AgentBot {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private tween: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, x: number, y: number, agentName: string) {
    this.scene = scene

    const body = scene.add.rectangle(0, 0, 18, 18, 0x1a3a5e)
      .setStrokeStyle(1, 0x4a9eff)

    const label = scene.add.text(0, 14, agentName.replace('crombie:', ''), {
      fontSize: '7px',
      color: '#4a9eff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0)

    const icon = scene.add.text(0, 0, '🤖', { fontSize: '10px' }).setOrigin(0.5)

    this.container = scene.add.container(x, y, [body, label, icon])

    this.tween = scene.tweens.add({
      targets: this.container,
      y: y - 6,
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
    })
  }

  destroy() {
    this.tween.stop()
    this.container.destroy()
  }
}
