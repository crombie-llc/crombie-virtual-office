import Phaser from 'phaser'
import { Avatar } from './Avatar'
import { AgentBot } from './AgentBot'
import type { OfficeState, DeveloperState } from '../types'

// Grid layout: place desks in a diagonal open-space pattern
function getGridPosition(index: number): { gridX: number; gridY: number } {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { gridX: col * 2, gridY: row * 2 }
}

function isoToScreen(gridX: number, gridY: number, cx: number, cy: number) {
  return {
    x: cx + (gridX - gridY) * 64,
    y: cy + (gridX + gridY) * 32,
  }
}

export class OfficeScene extends Phaser.Scene {
  private avatars = new Map<string, Avatar>()
  private bots = new Map<string, AgentBot>()
  private devIndex = new Map<string, number>()
  private pendingState?: OfficeState

  constructor() {
    super({ key: 'OfficeScene' })
  }

  preload() {
    // Uncomment these lines once Kenney assets are placed in assets/:
    // this.load.image('desk', '/src/game/assets/tile_desk.png')
    // this.load.image('floor', '/src/game/assets/tile_floor.png')
    // Until then, Avatar.ts renders colored rectangles as placeholders automatically.
  }

  create() {
    this.drawFloor()
    if (this.pendingState) {
      this.applyFullState(this.pendingState)
      this.pendingState = undefined
    }
  }

  private drawFloor() {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2 - 60
    const g = this.add.graphics()

    for (let gx = -4; gx <= 8; gx++) {
      for (let gy = -4; gy <= 8; gy++) {
        const { x, y } = isoToScreen(gx, gy, cx, cy)
        const col = (gx + gy) % 2 === 0 ? 0x1e3a28 : 0x172e20
        g.fillStyle(col, 1)
        g.fillPoints([
          { x, y: y - 16 },
          { x: x + 64, y },
          { x, y: y + 16 },
          { x: x - 64, y },
        ], true)
      }
    }
  }

  updateState(state: OfficeState) {
    if (!this.scene.isActive('OfficeScene')) {
      this.pendingState = state
      return
    }
    this.applyFullState(state)
  }

  private applyFullState(state: OfficeState) {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2 - 60

    for (const [devName, devState] of Object.entries(state)) {
      if (!this.devIndex.has(devName)) {
        this.devIndex.set(devName, this.devIndex.size)
      }
      const idx = this.devIndex.get(devName)!
      const { gridX, gridY } = getGridPosition(idx)
      const { x, y } = isoToScreen(gridX, gridY, cx, cy)

      if (!this.avatars.has(devName)) {
        this.avatars.set(devName, new Avatar(this, gridX, gridY, devState))
      } else {
        this.avatars.get(devName)!.applyState(devState)
      }

      this.updateBot(devName, devState, x, y)
    }
  }

  private updateBot(devName: string, state: DeveloperState, x: number, y: number) {
    if (state.activeAgent) {
      if (!this.bots.has(devName)) {
        this.bots.set(devName, new AgentBot(this, x + 36, y - 20, state.activeAgent))
      }
    } else {
      this.bots.get(devName)?.destroy()
      this.bots.delete(devName)
    }
  }

  // Called by Phaser when the game is destroyed — clean up all game objects
  shutdown() {
    this.avatars.forEach(a => a.destroy())
    this.bots.forEach(b => b.destroy())
    this.avatars.clear()
    this.bots.clear()
  }
}
