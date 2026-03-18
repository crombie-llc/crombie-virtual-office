import Phaser from 'phaser'
import { Avatar } from './Avatar'
import { AgentBot } from './AgentBot'
import { drawCube, drawFloorLine, toScreen, Z } from './IsoCube'
import type { OfficeState, DeveloperState } from '../types'

// ── Layout: 3 connected zones in one large floor ──
// Total floor: 16 wide × 12 deep
// Left: Work area (cols 0-10, rows 0-12)
// Right-top: Meeting room (cols 10-16, rows 0-6)
// Right-bottom: Lounge (cols 10-16, rows 6-12)
// Internal divider wall at col 10, with doorway gaps
// Horizontal divider at row 6 (right half only)

const TOTAL_W = 16
const TOTAL_H = 12
const DIVIDER_X = 10      // vertical divider at x=10
const DIVIDER_Y = 6       // horizontal divider at y=6 (right side)

const WALL_H = 3.2
const WALL_THICK = 0.3
const RIM_H = 0.5
const RIM_THICK = 0.3
const FLOOR_H = 0.12
const DIVIDER_H = 2.0     // internal walls shorter than external

// ── Colors ── (Crombie brand palette)
// Verde: #33c566, Cyan: #25B2E2, Negro: #181816, Amarillo: #fecc33, Púrpura: #923392
const FLOOR      = { top: 0xede3d0, left: 0xd5cab5, right: 0xc8bda9 }
const FLOOR_ALT  = { top: 0xe4dac6, left: 0xcdc2ae, right: 0xc0b5a1 }
const WALL_NW    = { top: 0x8a9db5, left: 0xdde3ec, right: 0xc8d0de }
const WALL_NE    = { top: 0x8a9db5, left: 0xc8d0de, right: 0xdde3ec }
const RIM_C      = { top: 0x6a6c76, left: 0x9a9daa, right: 0x888b98 }
const DIV_C      = { top: 0x70727c, left: 0xb0b3c0, right: 0x9598a5 }
const GRID_COLOR = 0xbcaa90

// ── Desk positions (work zone, left half) ──
const DESK_POSITIONS = [
  // Row 1
  { tx: 2, ty: 1.5 },  { tx: 5, ty: 1.5 },  { tx: 8, ty: 1.5 },
  // Row 2
  { tx: 2, ty: 4.5 },  { tx: 5, ty: 4.5 },  { tx: 8, ty: 4.5 },
  // Row 3
  { tx: 2, ty: 7.5 },  { tx: 5, ty: 7.5 },  { tx: 8, ty: 7.5 },
  // Row 4
  { tx: 2, ty: 10.5 }, { tx: 5, ty: 10.5 }, { tx: 8, ty: 10.5 },
]

// ── Static furniture placements ──
interface FurnitureDef { key: string; tx: number; ty: number; scale: number; depth?: number }

const STATIC_FURNITURE: FurnitureDef[] = [
  // ── Meeting room (right-top: x=10-16, y=0-6) ──
  { key: 'tableRound_SE',   tx: 13,   ty: 2.8,  scale: 0.5 },
  { key: 'chairDesk_SE',    tx: 11.8, ty: 2.2,  scale: 0.4 },
  { key: 'chairDesk_SW',    tx: 14.2, ty: 2.2,  scale: 0.4 },
  { key: 'chairDesk_SE',    tx: 12,   ty: 4,    scale: 0.4 },
  { key: 'chairDesk_SW',    tx: 14,   ty: 4,    scale: 0.4 },

  // ── Lounge (right-bottom: x=10-16, y=6-12) ──
  { key: 'loungeSofa_SE',        tx: 11.5, ty: 8.5,  scale: 0.42 }, //rojo dos cuerpos
  { key: 'loungeDesignSofa_SW',  tx: 14.5, ty: 8.5,  scale: 0.42 }, //azul
  { key: 'loungeChair_SE',       tx: 11.5, ty: 10.5,  scale: 0.42 }, //rojo un cuerpo
  { key: 'tableCoffeeGlassSquare_SE', tx: 13, ty: 8.8, scale: 0.45 }, 

  // ── Decorative plants ──
  { key: 'pottedPlant_SE', tx: 0.5,  ty: 0.5,  scale: 0.9 },
  { key: 'pottedPlant_SE', tx: 9.3,  ty: 0.5,  scale: 0.9 },
  { key: 'pottedPlant_SE', tx: 0.5,  ty: 11.2, scale: 0.9 },
  { key: 'plantSmall2_SE', tx: 15.3, ty: 0.5,  scale: 1.0 },
  { key: 'plantSmall3_SE', tx: 15.3, ty: 11.2, scale: 1.0 },
  { key: 'plantSmall1_SE', tx: 10.5, ty: 6.5,  scale: 0.9 },

  // ── Bookshelves along NW wall (work area) ──
  { key: 'bookcaseOpen_SE',      tx: 0.4, ty: 3,    scale: 0.45 },
  { key: 'bookcaseClosed_SE',    tx: 0.4, ty: 5,    scale: 0.45 },
  { key: 'bookcaseClosedWide_SE', tx: 0.4, ty: 7,   scale: 0.4 },
  { key: 'bookcaseOpen_SE',      tx: 0.4, ty: 9,    scale: 0.45 },

  // ── Side table / cabinet along NE wall ──
  { key: 'sideTableDrawers_SE',  tx: 3,   ty: 0.4,  scale: 0.45 },
  { key: 'sideTable_SE',         tx: 6,   ty: 0.4,  scale: 0.45 },

  // ── Lamps ──
  { key: 'lampRoundFloor_SE',    tx: 10.5, ty: 10.5, scale: 0.5 },
  { key: 'lampSquareFloor_SE',   tx: 15.3, ty: 5.5, scale: 0.5 },
]

export class OfficeScene extends Phaser.Scene {
  private avatars = new Map<string, Avatar>()
  private bots = new Map<string, AgentBot>()
  private devIndex = new Map<string, number>()
  private botAgentName = new Map<string, string>()
  private pendingState?: OfficeState
  private ox = 0
  private oy = 0

  constructor() { super({ key: 'OfficeScene' }) }

  preload() {
    const fb = '/assets/furniture/'
    // Collect all unique keys from furniture + desk workstation sprites
    const keys = new Set<string>()
    STATIC_FURNITURE.forEach(f => keys.add(f.key))
    keys.add('desk_SE'); keys.add('computerScreen_SE'); keys.add('chairDesk_SE'); keys.add('chairDesk_SW')
    for (const key of keys) {
      this.load.image(key, `${fb}${key}.png`)
    }
    // Characters — 2 sprite sets for variety
    for (let i = 0; i < 8; i++) {
      this.load.image(`human_${i}`, `/assets/characters/Human_${i}_Idle0.png`)
      this.load.image(`male_${i}`, `/assets/characters/Male_${i}_Idle0.png`)
    }
  }

  create() {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)

    const center = toScreen(TOTAL_W / 2, TOTAL_H / 2)
    this.ox = this.scale.width / 2 - center.x
    this.oy = this.scale.height / 2 - center.y + WALL_H * 10

    this.drawFloorAndWalls()
    this.drawInternalDividers()
    this.drawWallDecorations()
    this.placeStaticFurniture()
    this.drawPingPongTable()
    this.drawZoneLabels()

    if (this.pendingState) {
      this.applyFullState(this.pendingState)
      this.pendingState = undefined
    }

    // Signal to Playwright (and other tooling) that the scene is fully ready
    ;(window as Window & { __officeReady?: boolean }).__officeReady = true
  }

  // ── Rendering ──

  private drawFloorAndWalls() {
    const { ox, oy } = this
    const g = this.add.graphics()

    // Back walls
    drawCube(g, ox, oy, -WALL_THICK, 0, FLOOR_H, WALL_THICK, TOTAL_H, WALL_H,
      WALL_NW.top, WALL_NW.left, WALL_NW.right)
    drawCube(g, ox, oy, 0, -WALL_THICK, FLOOR_H, TOTAL_W, WALL_THICK, WALL_H,
      WALL_NE.top, WALL_NE.left, WALL_NE.right)
    drawCube(g, ox, oy, -WALL_THICK, -WALL_THICK, FLOOR_H, WALL_THICK, WALL_THICK, WALL_H,
      WALL_NW.top, WALL_NW.left, WALL_NE.right)

    // Checkerboard floor
    for (let x = 0; x < TOTAL_W; x++) {
      for (let y = 0; y < TOTAL_H; y++) {
        const c = (x + y) % 2 === 0 ? FLOOR : FLOOR_ALT
        drawCube(g, ox, oy, x, y, 0, 1, 1, FLOOR_H, c.top, c.left, c.right)
      }
    }

    // Grid lines
    const gridG = this.add.graphics()
    for (let x = 0; x <= TOTAL_W; x++) {
      drawFloorLine(gridG, ox, oy, x, 0, x, TOTAL_H, GRID_COLOR, 0.12)
    }
    for (let y = 0; y <= TOTAL_H; y++) {
      drawFloorLine(gridG, ox, oy, 0, y, TOTAL_W, y, GRID_COLOR, 0.12)
    }

    // Crombie green accent strip at base of NE wall
    drawCube(g, ox, oy, 0, -WALL_THICK, 0, TOTAL_W, WALL_THICK, 0.15,
      0x267a40, 0x1d5c30, 0x225236)

    // Front rim walls
    drawCube(g, ox, oy, 0, TOTAL_H, 0, TOTAL_W, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(g, ox, oy, TOTAL_W, 0, 0, RIM_THICK, TOTAL_H, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(g, ox, oy, TOTAL_W, TOTAL_H, 0, RIM_THICK, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
  }

  private drawInternalDividers() {
    const { ox, oy } = this
    const g = this.add.graphics()

    // Vertical divider at x=10 (with doorway gap at y=3-5 and y=8-10)
    // Segment 1: y=0 to y=3
    drawCube(g, ox, oy, DIVIDER_X, 0, FLOOR_H, WALL_THICK, 3, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    // Segment 2: y=5 to y=8 (gap at 3-5 for meeting room door, gap at 8-10 for lounge door)
    drawCube(g, ox, oy, DIVIDER_X, 5, FLOOR_H, WALL_THICK, 3, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    // Segment 3: y=10 to y=12
    drawCube(g, ox, oy, DIVIDER_X, 10, FLOOR_H, WALL_THICK, 2, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)

    // Horizontal divider at y=6 (right side only, x=10 to x=16, doorway at x=12-14)
    drawCube(g, ox, oy, DIVIDER_X, DIVIDER_Y, FLOOR_H, 2, WALL_THICK, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    drawCube(g, ox, oy, 14, DIVIDER_Y, FLOOR_H, 2, WALL_THICK, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
  }

  private drawWallDecorations() {
    const { ox, oy } = this
    const g = this.add.graphics()
    const artZ = FLOOR_H + WALL_H * 0.35

    // Whiteboard on NE wall (above work area)
    drawCube(g, ox, oy, 3, -WALL_THICK + 0.01, artZ, 3, 0.05, 1.3,
      0xffffff, 0xe8e8e8, 0xf0f0f0)
    // Frame
    const wbCorners = [
      toScreen(3, -WALL_THICK + 0.01, artZ + 1.3),
      toScreen(6, -WALL_THICK + 0.01, artZ + 1.3),
      toScreen(6, -WALL_THICK + 0.01, artZ),
      toScreen(3, -WALL_THICK + 0.01, artZ),
    ]
    g.lineStyle(2, 0x555566, 0.8)
    g.strokePoints(wbCorners.map(c => ({ x: ox + c.x, y: oy + c.y })), true)

    // TV screen on NE wall (above meeting room)
    drawCube(g, ox, oy, 12, -WALL_THICK + 0.01, artZ, 2.5, 0.05, 1.1,
      0x222233, 0x1a1a2e, 0x1e1e30)
    drawCube(g, ox, oy, 12.15, -WALL_THICK + 0.02, artZ + 0.1, 2.2, 0.03, 0.9,
      0x3366aa, 0x2255aa, 0x2860aa)

    // Windows on NW wall
    for (const wy of [1.5, 4, 6.5, 9]) {
      drawCube(g, ox, oy, -WALL_THICK + 0.01, wy, artZ, 0.05, 1.8, 1.2,
        0x88bbdd, 0x6699bb, 0x77aacc)
    }

    // Clock on NE wall
    const cp = toScreen(9, -WALL_THICK + 0.02, FLOOR_H + WALL_H * 0.65)
    this.add.circle(ox + cp.x, oy + cp.y, 8, 0xffffff).setStrokeStyle(1.5, 0x444455)
    this.add.circle(ox + cp.x, oy + cp.y, 1.5, 0x333344)

    // Room name signs on walls
    const meetSign = toScreen(13, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + meetSign.x, oy + meetSign.y, '📋 SALA 1', {
      fontSize: '7px', color: '#ccc', fontFamily: 'monospace',
    }).setOrigin(0.5)

    const workSign = toScreen(5, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + workSign.x, oy + workSign.y, '💻 DEV FLOOR', {
      fontSize: '7px', color: '#33c566', fontFamily: 'monospace',
    }).setOrigin(0.5)
  }

  private placeStaticFurniture() {
    const { ox, oy } = this

    for (const item of STATIC_FURNITURE) {
      const pos = toScreen(item.tx, item.ty, FLOOR_H)
      const sx = ox + pos.x
      const sy = oy + pos.y

      try {
        const sprite = this.add.image(sx, sy, item.key)
        sprite.setScale(item.scale)
        sprite.setOrigin(0.5, 1)
        sprite.setDepth(item.depth ?? sy)
      } catch {
        // Skip if texture not found
      }
    }
  }

  private drawPingPongTable() {
    const { ox, oy } = this
    const g = this.add.graphics()
    // Ping pong table in the lounge: green top, dark legs
    const ptx = 13, pty = 10, ptz = FLOOR_H
    const tw = 2.2, td = 1.2, tHeight = 0.6

    // Table legs (4 dark cubes)
    const legS = 0.15, legH = tHeight
    for (const [lx, ly] of [[0, 0], [tw - legS, 0], [0, td - legS], [tw - legS, td - legS]]) {
      drawCube(g, ox, oy, ptx + lx, pty + ly, ptz, legS, legS, legH,
        0x333344, 0x222233, 0x2a2a3a)
    }
    // Green tabletop
    drawCube(g, ox, oy, ptx, pty, ptz + tHeight, tw, td, 0.08,
      0x2a8a4a, 0x1e6e38, 0x227a40)
    // White center line
    const midY = pty + td / 2
    const lineStart = toScreen(ptx + 0.05, midY, ptz + tHeight + 0.09)
    const lineEnd = toScreen(ptx + tw - 0.05, midY, ptz + tHeight + 0.09)
    g.lineStyle(1.5, 0xffffff, 0.9)
    g.beginPath()
    g.moveTo(ox + lineStart.x, oy + lineStart.y)
    g.lineTo(ox + lineEnd.x, oy + lineEnd.y)
    g.strokePath()
    // Net (thin vertical strip at center)
    drawCube(g, ox, oy, ptx + tw / 2 - 0.03, pty, ptz + tHeight, 0.06, td, 0.2,
      0xdddddd, 0xcccccc, 0xbbbbbb, 0.7)

    // Depth
    const depthPos = toScreen(ptx + tw / 2, pty + td / 2, ptz)
    g.setDepth(oy + depthPos.y)
  }

  private drawZoneLabels() {
    const { ox, oy } = this
    const labels: Array<{ text: string; tx: number; ty: number; color?: string }> = [
      { text: '☕ LOUNGE', tx: 13, ty: 8 },
      { text: '🏓 GAME', tx: 13, ty: 11 },
      { text: '📋 SALA 2', tx: 13, ty: 10.5, color: '#25B2E2' },
    ]
    for (const l of labels) {
      const p = toScreen(l.tx, l.ty, FLOOR_H)
      this.add.text(ox + p.x, oy + p.y, l.text, {
        fontSize: '7px', color: l.color ?? '#999', fontFamily: 'monospace',
      }).setOrigin(0.5).setAlpha(0.5)
    }
  }

  // ── State management ──

  updateState(state: OfficeState) {
    if (!this.scene || !this.scene.isActive('OfficeScene')) {
      this.pendingState = state
      return
    }
    this.applyFullState(state)
  }

  private applyFullState(state: OfficeState) {
    const { ox, oy } = this

    for (const [devName, devState] of Object.entries(state)) {
      if (!this.devIndex.has(devName)) {
        this.devIndex.set(devName, this.devIndex.size)
      }
      const idx = this.devIndex.get(devName)!
      const desk = DESK_POSITIONS[idx % DESK_POSITIONS.length]
      const pos = toScreen(desk.tx, desk.ty, FLOOR_H)
      const screenX = ox + pos.x
      const screenY = oy + pos.y

      if (!this.avatars.has(devName)) {
        this.avatars.set(devName, new Avatar(this, screenX, screenY, this.ox, this.oy, idx, devState))
      } else {
        this.avatars.get(devName)!.applyState(devState)
      }
      this.updateBot(devName, devState, desk.tx, desk.ty, ox, oy)
    }
  }

  private updateBot(devName: string, state: DeveloperState, tx: number, ty: number, ox: number, oy: number) {
    if (state.activeAgent) {
      const currentName = this.botAgentName.get(devName)
      if (!this.bots.has(devName) || currentName !== state.activeAgent) {
        this.bots.get(devName)?.destroy()
        this.bots.set(devName, new AgentBot(this, tx, ty, ox, oy, state.activeAgent))
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
