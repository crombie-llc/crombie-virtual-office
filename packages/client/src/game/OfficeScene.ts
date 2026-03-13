import Phaser from 'phaser'
import { Avatar } from './Avatar'
import { AgentBot } from './AgentBot'
import type { OfficeState, DeveloperState } from '../types'

const ROOM_W = 8
const ROOM_H = 6
const WALL_H = 48

function getGridPosition(index: number) {
  const col = index % 3
  const row = Math.floor(index / 3)
  return { gridX: col * 2 + 1, gridY: row * 2 + 1 }
}

export class OfficeScene extends Phaser.Scene {
  private avatars = new Map<string, Avatar>()
  private bots = new Map<string, AgentBot>()
  // devIndex is intentionally never pruned — indices must be stable across the session
  // so desks don't jump positions when a developer goes offline.
  private devIndex = new Map<string, number>()
  private botAgentName = new Map<string, string>()
  private pendingState?: OfficeState
  private ox = 0
  private oy = 0

  constructor() { super({ key: 'OfficeScene' }) }

  preload() {
    // Kenney assets disabled for MVP — Avatar uses colored shapes as fallback
  }

  create() {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    // Center room: we want the floor center tile to be near screen center
    this.ox = this.scale.width / 2 - (ROOM_W / 2 - ROOM_H / 2) * 64
    this.oy = this.scale.height / 2 - (ROOM_W / 2 + ROOM_H / 2) * 32 - 10
    this.drawRoom()
    if (this.pendingState) {
      this.applyFullState(this.pendingState)
      this.pendingState = undefined
    }
  }

  private drawRoom() {
    const ox = this.ox
    const oy = this.oy
    const g = this.add.graphics()

    // ── Back wall (gy=0, visible upper-right) ──
    for (let gx = 0; gx < ROOM_W; gx++) {
      const x = ox + gx * 64
      const y = oy + gx * 32
      g.fillStyle(gx % 2 === 0 ? 0x4e4e66 : 0x585870, 1)
      g.fillPoints([
        { x,        y: y - 16 },
        { x: x + 64, y },
        { x: x + 64, y: y - WALL_H },
        { x,        y: y - 16 - WALL_H },
      ], true)
      g.lineStyle(1, 0x707088, 0.8)
      g.beginPath(); g.moveTo(x, y - 16 - WALL_H); g.lineTo(x + 64, y - WALL_H); g.strokePath()
    }

    // ── Left wall (gx=0, visible upper-left) ──
    for (let gy = 0; gy < ROOM_H; gy++) {
      const x = ox - gy * 64
      const y = oy + gy * 32
      g.fillStyle(gy % 2 === 0 ? 0x424258 : 0x4a4a62, 1)
      g.fillPoints([
        { x: x - 64, y },
        { x,         y: y + 16 },
        { x,         y: y + 16 - WALL_H },
        { x: x - 64, y: y - WALL_H },
      ], true)
      g.lineStyle(1, 0x62627a, 0.8)
      g.beginPath(); g.moveTo(x - 64, y - WALL_H); g.lineTo(x, y + 16 - WALL_H); g.strokePath()
    }

    // ── Back corner line ──
    g.lineStyle(2, 0x8888a0, 1)
    g.beginPath(); g.moveTo(ox, oy - 16); g.lineTo(ox, oy - 16 - WALL_H); g.strokePath()

    // ── Floor tiles (beige/cream) ──
    for (let gx = 0; gx < ROOM_W; gx++) {
      for (let gy = 0; gy < ROOM_H; gy++) {
        const x = ox + (gx - gy) * 64
        const y = oy + (gx + gy) * 32
        const col = (gx + gy) % 2 === 0 ? 0xe8dcc8 : 0xddd0ba
        g.fillStyle(col, 1)
        g.lineStyle(1, 0xbcaa90, 0.5)
        const pts = [{ x, y: y - 16 }, { x: x + 64, y }, { x, y: y + 16 }, { x: x - 64, y }]
        g.fillPoints(pts, true)
        g.strokePoints(pts, true)
      }
    }

    // ── Room title ──
    const titleX = ox + (ROOM_W / 2 - ROOM_H / 2) * 64
    const titleY = oy - 16 - WALL_H - 28
    this.add.text(titleX, titleY, '🏢  CROMBIE HQ', {
      fontSize: '13px',
      color: '#7ee8a2',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5)
  }

  updateState(state: OfficeState) {
    if (!this.scene || !this.scene.isActive('OfficeScene')) {
      this.pendingState = state
      return
    }
    this.applyFullState(state)
  }

  private applyFullState(state: OfficeState) {
    const ox = this.ox
    const oy = this.oy
    for (const [devName, devState] of Object.entries(state)) {
      if (!this.devIndex.has(devName)) {
        this.devIndex.set(devName, this.devIndex.size)
      }
      const idx = this.devIndex.get(devName)!
      const { gridX, gridY } = getGridPosition(idx)
      const screenX = ox + (gridX - gridY) * 64
      const screenY = oy + (gridX + gridY) * 32

      if (!this.avatars.has(devName)) {
        this.avatars.set(devName, new Avatar(this, screenX, screenY, devState))
      } else {
        this.avatars.get(devName)!.applyState(devState)
      }
      this.updateBot(devName, devState, screenX, screenY)
    }
  }

  private updateBot(devName: string, state: DeveloperState, x: number, y: number) {
    if (state.activeAgent) {
      const currentName = this.botAgentName.get(devName)
      if (!this.bots.has(devName) || currentName !== state.activeAgent) {
        this.bots.get(devName)?.destroy()
        this.bots.set(devName, new AgentBot(this, x + 44, y - 28, state.activeAgent))
        this.botAgentName.set(devName, state.activeAgent)
      }
    } else {
      this.bots.get(devName)?.destroy()
      this.bots.delete(devName)
      this.botAgentName.delete(devName)
    }
  }

  shutdown() {
    this.avatars.forEach(a => a.destroy())
    this.bots.forEach(b => b.destroy())
    this.avatars.clear()
    this.bots.clear()
    this.botAgentName.clear()
  }
}
