import Phaser from 'phaser'
import { drawCube, drawFloorLine, toScreen, Z } from './IsoCube'

// ── Ground Floor (Planta Baja) Layout: 12 wide × 10 deep ──
// Left (cols 0-6): Kitchen area — counter, fridge, tables, microwave
// Right (cols 6-12): Lounge area — sofas, coffee table, TV wall, plants

const TOTAL_W = 12
const TOTAL_H = 10
const WALL_H = 3.2
const WALL_THICK = 0.3
const RIM_H = 0.5
const RIM_THICK = 0.3
const FLOOR_H = 0.12

// ── Colors ── (Crombie brand palette — warmer tones for social floor)
const FLOOR     = { top: 0xf0e8d8, left: 0xddd0bb, right: 0xd0c4ac }
const FLOOR_ALT = { top: 0xe8dfc8, left: 0xd6c9b4, right: 0xc9bca5 }
const WALL_NW   = { top: 0x8a9db5, left: 0xdde3ec, right: 0xc8d0de }
const WALL_NE   = { top: 0x8a9db5, left: 0xc8d0de, right: 0xdde3ec }
const RIM_C     = { top: 0x6a6c76, left: 0x9a9daa, right: 0x888b98 }
const GRID_COLOR = 0xc8b890

// ── Static furniture for ground floor ──
interface FurnitureDef { key: string; tx: number; ty: number; scale: number; depth?: number }

const GROUND_FURNITURE: FurnitureDef[] = [
  // ── Lounge area (right: cols 6-12) ──
  { key: 'loungeSofa_SE',             tx: 7.5,  ty: 5.5,  scale: 0.42 },
  { key: 'loungeDesignSofa_SW',       tx: 10.5, ty: 5.5,  scale: 0.42 },
  { key: 'loungeChair_SE',            tx: 7.5,  ty: 7.5,  scale: 0.42 },
  { key: 'tableCoffeeGlassSquare_SE', tx: 9,    ty: 6.2,  scale: 0.45 },

  // ── Kitchen side tables/counters ──
  { key: 'sideTableDrawers_SE', tx: 0.5, ty: 0.5, scale: 0.45 },
  { key: 'sideTable_SE',        tx: 2,   ty: 0.5, scale: 0.45 },
  { key: 'sideTableDrawers_SE', tx: 3.5, ty: 0.5, scale: 0.45 },

  // ── Bistro table + chairs ──
  { key: 'tableRound_SE',  tx: 2.5, ty: 4.5, scale: 0.45 },
  { key: 'chairDesk_SE',   tx: 1.5, ty: 4,   scale: 0.38 },
  { key: 'chairDesk_SW',   tx: 3.5, ty: 4,   scale: 0.38 },
  { key: 'chairDesk_SE',   tx: 1.5, ty: 5.5, scale: 0.38 },
  { key: 'chairDesk_SW',   tx: 3.5, ty: 5.5, scale: 0.38 },

  // ── Decorative plants ──
  { key: 'pottedPlant_SE', tx: 0.4,  ty: 9.3,  scale: 0.9 },
  { key: 'pottedPlant_SE', tx: 5.5,  ty: 0.4,  scale: 0.9 },
  { key: 'plantSmall2_SE', tx: 11.3, ty: 0.4,  scale: 1.0 },
  { key: 'plantSmall3_SE', tx: 11.3, ty: 9.3,  scale: 1.0 },
  { key: 'plantSmall1_SE', tx: 6.3,  ty: 5.0,  scale: 0.9 },

  // ── Floor lamp ──
  { key: 'lampRoundFloor_SE',  tx: 11.3, ty: 4.5, scale: 0.5 },
  { key: 'lampSquareFloor_SE', tx: 5.8,  ty: 9.3, scale: 0.5 },
]

export class GroundFloorScene extends Phaser.Scene {
  private ox = 0
  private oy = 0

  constructor() { super({ key: 'GroundFloorScene' }) }

  preload() {
    const fb = '/assets/furniture/'
    const keys = new Set<string>()
    GROUND_FURNITURE.forEach(f => keys.add(f.key))
    for (const key of keys) {
      this.load.image(key, `${fb}${key}.png`)
    }
  }

  create() {
    const center = toScreen(TOTAL_W / 2, TOTAL_H / 2)
    this.ox = this.scale.width / 2 - center.x
    this.oy = this.scale.height / 2 - center.y + WALL_H * 10

    this.drawFloorAndWalls()
    this.drawKitchenElements()
    this.drawTVWall()
    this.placeStaticFurniture()
    this.drawZoneLabels()

    ;(window as Window & { __groundReady?: boolean }).__groundReady = true
  }

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

    // Crombie green accent strip at base of NE wall
    drawCube(g, ox, oy, 0, -WALL_THICK, 0, TOTAL_W, WALL_THICK, 0.15,
      0x267a40, 0x1d5c30, 0x225236)

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

    // Front rim walls
    drawCube(g, ox, oy, 0, TOTAL_H, 0, TOTAL_W, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(g, ox, oy, TOTAL_W, 0, 0, RIM_THICK, TOTAL_H, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(g, ox, oy, TOTAL_W, TOTAL_H, 0, RIM_THICK, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)

    // Zone divider between kitchen and lounge (light partition wall)
    drawCube(g, ox, oy, 6, 0, FLOOR_H, WALL_THICK * 0.5, 3.5, 1.5,
      0xd0d8e8, 0xb8c2d5, 0xc4cede)
    drawCube(g, ox, oy, 6, 6, FLOOR_H, WALL_THICK * 0.5, 4, 1.5,
      0xd0d8e8, 0xb8c2d5, 0xc4cede)
    // Doorway gap between y=3.5 and y=6 (open passage)
  }

  private drawKitchenElements() {
    const { ox, oy } = this
    const g = this.add.graphics()

    // Kitchen counter (L-shaped) along NE wall — dark countertop on white base
    // Horizontal counter: tx=0.5 to 5.5, ty=0 (along top NE wall)
    drawCube(g, ox, oy, 0.5, 0.1, FLOOR_H, 5, 0.7, 0.85,
      0xe8e0d0, 0xd5ccbc, 0xcec5b5)
    // Countertop (darker surface)
    drawCube(g, ox, oy, 0.5, 0.1, FLOOR_H + 0.85, 5, 0.7, 0.07,
      0x5a5048, 0x4a4038, 0x504540)

    // Sink detail (lighter square on counter)
    drawCube(g, ox, oy, 1.0, 0.15, FLOOR_H + 0.85, 0.8, 0.5, 0.05,
      0xc8d8e8, 0xb0c4d5, 0xbccce0)

    // Fridge (tall white box) at tx=5.3, ty=0.1
    drawCube(g, ox, oy, 5.3, 0.1, FLOOR_H, 0.7, 0.7, 1.8,
      0xf0f0f0, 0xe0e0e0, 0xe8e8e8)
    // Fridge handle (small dark bar)
    drawCube(g, ox, oy, 5.38, 0.15, FLOOR_H + 1.3, 0.08, 0.08, 0.5,
      0x888888, 0x666666, 0x777777)
    // Fridge door divider
    drawCube(g, ox, oy, 5.3, 0.1, FLOOR_H + 1.1, 0.7, 0.01, 0.02,
      0xcccccc, 0xaaaaaa, 0xbbbbbb)

    // Microwave (small dark box) on counter
    drawCube(g, ox, oy, 3.8, 0.12, FLOOR_H + 0.85, 0.7, 0.55, 0.45,
      0x2a2a2a, 0x1a1a1a, 0x222222)
    // Microwave door window (dark glass)
    drawCube(g, ox, oy, 3.85, 0.13, FLOOR_H + 0.9, 0.5, 0.02, 0.3,
      0x334455, 0x223344, 0x2a3a4a)

    // Coffee machine (small dark box with accent)
    drawCube(g, ox, oy, 2.5, 0.12, FLOOR_H + 0.85, 0.5, 0.45, 0.5,
      0x1a1a1a, 0x111111, 0x161616)
    drawCube(g, ox, oy, 2.55, 0.13, FLOOR_H + 1.15, 0.3, 0.02, 0.15,
      0x33c566, 0x1d5c30, 0x267a40)

    // Announcement board (like whiteboard, smaller)
    const bz = FLOOR_H + WALL_H * 0.35
    drawCube(g, ox, oy, 0.8, -WALL_THICK + 0.01, bz, 2, 0.05, 0.9,
      0xfff8e8, 0xf0e8d8, 0xf5eedd)
    const boardCorners = [
      toScreen(0.8, -WALL_THICK + 0.01, bz + 0.9),
      toScreen(2.8, -WALL_THICK + 0.01, bz + 0.9),
      toScreen(2.8, -WALL_THICK + 0.01, bz),
      toScreen(0.8, -WALL_THICK + 0.01, bz),
    ]
    g.lineStyle(2, 0x8a7060, 0.8)
    g.strokePoints(boardCorners.map(c => ({ x: ox + c.x, y: oy + c.y })), true)
    // Board text label
    const boardPos = toScreen(1.8, -WALL_THICK + 0.02, bz + WALL_H * 0.25)
    this.add.text(ox + boardPos.x, oy + boardPos.y, '📌 anuncios', {
      fontSize: '6px', color: '#664433', fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Windows on NW wall (kitchen side)
    for (const wy of [1.5, 4]) {
      drawCube(g, ox, oy, -WALL_THICK + 0.01, wy, bz, 0.05, 1.8, 1.2,
        0x88bbdd, 0x6699bb, 0x77aacc)
    }
    // Windows on NW wall (lounge side)
    for (const wy of [6.5, 8.5]) {
      drawCube(g, ox, oy, -WALL_THICK + 0.01, wy, bz, 0.05, 1.8, 1.2,
        0x88bbdd, 0x6699bb, 0x77aacc)
    }
  }

  private drawTVWall() {
    const { ox, oy } = this
    const g = this.add.graphics()
    const artZ = FLOOR_H + WALL_H * 0.35

    // TV panel on NE wall (lounge side)
    drawCube(g, ox, oy, 8.5, -WALL_THICK + 0.01, artZ, 3, 0.05, 1.3,
      0x181818, 0x111111, 0x141414)
    // Screen
    drawCube(g, ox, oy, 8.65, -WALL_THICK + 0.02, artZ + 0.1, 2.7, 0.03, 1.1,
      0x1a3055, 0x122240, 0x162a48)
    // Screen glow line (Crombie cyan accent)
    drawCube(g, ox, oy, 8.65, -WALL_THICK + 0.02, artZ + 0.08, 2.7, 0.03, 0.05,
      0x25B2E2, 0x1a8ab5, 0x1f9ec9)
  }

  private placeStaticFurniture() {
    const { ox, oy } = this

    for (const item of GROUND_FURNITURE) {
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

  private drawZoneLabels() {
    const { ox, oy } = this
    const labels = [
      { text: '🍳 KITCHEN', tx: 2.5, ty: 3, color: '#fecc33' },
      { text: '☕ LOUNGE', tx: 9, ty: 4, color: '#33c566' },
      { text: '📺 TV AREA', tx: 10, ty: 8, color: '#25B2E2' },
    ]
    const floorSign = toScreen(3, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + floorSign.x, oy + floorSign.y, '🏠 PLANTA BAJA', {
      fontSize: '7px', color: '#fecc33', fontFamily: 'monospace',
    }).setOrigin(0.5)

    for (const l of labels) {
      const p = toScreen(l.tx, l.ty, FLOOR_H)
      this.add.text(ox + p.x, oy + p.y, l.text, {
        fontSize: '7px', color: l.color, fontFamily: 'monospace',
      }).setOrigin(0.5).setAlpha(0.6)
    }
  }
}
