import Phaser from 'phaser'
import { Avatar } from './Avatar'
import { AgentBot } from './AgentBot'
import { drawCube, drawFloorLine, toScreen, Z } from './IsoCube'
import type { OfficeState, DeveloperState } from '../types'

// ── Layout: 3 connected zones in one large floor ──
// Total floor: 24 wide × 16 deep
// Left: Work area (cols 0-10, rows 0-16)
// Right-top: Meeting rooms (cols 10-16, rows 0-8)
// Right-bottom: Open corridor / lounge (cols 10-16, rows 8-16)
// Far-right-top: Kitchen (cols 16-24, rows 0-8)
// Far-right-bottom: Lounge + Game (cols 16-24, rows 8-16)

const TOTAL_W = 24
const TOTAL_H = 16
const DIVIDER_X = 10      // vertical divider at x=10
const DIVIDER_Y = 8       // horizontal divider at row 8

const WALL_H = 3.2
const WALL_THICK = 0.3
const RIM_H = 0.5
const RIM_THICK = 0.3
const FLOOR_H = 0.12
const DIVIDER_H = 2.0     // internal walls shorter than external

// ── Crombie Brand Colors ──
const C_GREEN   = 0x33c566
const C_CYAN    = 0x25B2E2
const C_DARK    = 0x181816
const C_GREY    = 0x777777
const C_YELLOW  = 0xfecc33
const C_PINK    = 0xff3366
const C_PURPLE  = 0x923392

// ── Surface Colors ──
const FLOOR      = { top: 0xede3d0, left: 0xd5cab5, right: 0xc8bda9 }
const FLOOR_ALT  = { top: 0xe4dac6, left: 0xcdc2ae, right: 0xc0b5a1 }
const WALL_NW    = { top: 0x8a9db5, left: 0xdde3ec, right: 0xc8d0de }
const WALL_NE    = { top: 0x8a9db5, left: 0xc8d0de, right: 0xdde3ec }
const RIM_C      = { top: 0x6a6c76, left: 0x9a9daa, right: 0x888b98 }
const DIV_C      = { top: 0x70727c, left: 0xb0b3c0, right: 0x9598a5 }
const GRID_COLOR = 0xbcaa90

// Long desk colors (Crombie dark with green accent)
const DESK_C = { top: 0x3a3a3a, left: 0x2a2a2a, right: 0x333333 }
const DESK_ACCENT = { top: C_GREEN, left: 0x267a40, right: 0x2a8a48 }
const DESK_LEG = { top: 0x555555, left: 0x444444, right: 0x4a4a4a }

// ── Desk positions: seats along long shared tables ──
// Each row has 2 seats with wider spacing (4 tiles apart) to avoid overlap
// Row A: long table at ty=2.5, seats at tx=3.5, 7.5
// Row B: long table at ty=6,   seats at tx=3.5, 7.5
// Row C: long table at ty=9.5, seats at tx=3.5, 7.5
// Row D: long table at ty=13,  seats at tx=3.5, 7.5
const DESK_ROWS = [
  { tableY: 2.5,  seats: [3.5, 7.5] },
  { tableY: 6,    seats: [3.5, 7.5] },
  { tableY: 9.5,  seats: [3.5, 7.5] },
  { tableY: 13,   seats: [3.5, 7.5] },
]

// Flatten to individual desk positions for avatar placement.
// Interleave rows so first 4 devs go to different rows (spread out visually).
const _allSeats: Array<{ tx: number; ty: number }> = []
for (const row of DESK_ROWS) {
  for (const seatX of row.seats) {
    _allSeats.push({ tx: seatX, ty: row.tableY + 0.8 })
  }
}
// Interleave: pick one seat from each row in round-robin order
const DESK_POSITIONS: Array<{ tx: number; ty: number }> = []
const seatsPerRow = DESK_ROWS[0].seats.length
for (let col = 0; col < seatsPerRow; col++) {
  for (let row = 0; row < DESK_ROWS.length; row++) {
    DESK_POSITIONS.push(_allSeats[row * seatsPerRow + col])
  }
}

// ── Static furniture placements ──
interface FurnitureDef { key: string; tx: number; ty: number; scale: number; depth?: number }

const STATIC_FURNITURE: FurnitureDef[] = [
  // ── Meeting room (right-top: x=10-16, y=0-8) ──
  { key: 'tableCross_SE',     tx: 13,   ty: 3,    scale: 0.5 },
  { key: 'tableCross_SE',     tx: 13,   ty: 6.5,  scale: 0.45 },

  // ── Lounge (right-bottom: x=16-24, y=8-16) ──
  { key: 'loungeSofa_SE',             tx: 18,   ty: 10.5, scale: 0.42 },
  { key: 'loungeDesignSofa_SW',       tx: 22,   ty: 10.5, scale: 0.42 },
  { key: 'loungeChair_SE',            tx: 18,   ty: 12.5, scale: 0.42 },
  { key: 'tableCoffeeGlassSquare_SE', tx: 20,   ty: 11,   scale: 0.45 },
  { key: 'lampRoundFloor_SE',         tx: 23.2, ty: 14.5, scale: 0.5 },

  // ── Kitchen (right-top: x=16-24, y=0-8) ──
  { key: 'sideTableDrawers_SE', tx: 17,   ty: 0.5, scale: 0.45 },
  { key: 'sideTable_SE',        tx: 19,   ty: 0.5, scale: 0.45 },
  { key: 'sideTableDrawers_SE', tx: 21,   ty: 0.5, scale: 0.45 },
  { key: 'tableRound_SE',       tx: 19.5, ty: 5.5, scale: 0.45 },
  { key: 'lampSquareFloor_SE',  tx: 22.5, ty: 7.5, scale: 0.5 },

  // ── Decorative plants (well-placed, not behind walls) ──
  { key: 'pottedPlant_SE',  tx: 1,    ty: 0.5,  scale: 0.8 },   // top-left corner
  { key: 'pottedPlant_SE',  tx: 9.2,  ty: 0.5,  scale: 0.75 },  // near divider
  { key: 'pottedPlant_SE',  tx: 1,    ty: 11.5, scale: 0.8 },   // left wall lower
  { key: 'plantSmall2_SE',  tx: 23,   ty: 0.5,  scale: 0.9 },   // kitchen corner
  { key: 'plantSmall3_SE',  tx: 23,   ty: 8.5,  scale: 0.9 },   // lounge corner
  { key: 'plantSmall1_SE',  tx: 15.5, ty: 0.5,  scale: 0.8 },   // between meeting & kitchen
  { key: 'plantSmall1_SE',  tx: 9.2,  ty: 11,   scale: 0.75 },  // corridor near divider
  { key: 'pottedPlant_SE',  tx: 15.5, ty: 15,   scale: 0.7 },   // lounge entrance
  { key: 'plantSmall2_SE',  tx: 1,    ty: 15,   scale: 0.75 },  // bottom-left corner

  // ── Bookshelves along NW wall (work area) ──
  { key: 'bookcaseOpen_SE',       tx: 0.5, ty: 4.5,  scale: 0.45 },
  { key: 'bookcaseClosed_SE',     tx: 0.5, ty: 7.5,  scale: 0.45 },
  { key: 'bookcaseClosedWide_SE', tx: 0.5, ty: 10,   scale: 0.4 },
]

// ── Zoom config ──
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1
const ZOOM_LERP_SPEED = 0.12

export class OfficeScene extends Phaser.Scene {
  private avatars = new Map<string, Avatar>()
  private bots = new Map<string, AgentBot>()
  private devIndex = new Map<string, number>()
  private botAgentName = new Map<string, string>()
  private pendingState?: OfficeState
  private ox = 0
  private oy = 0
  private _dragStart: { x: number; y: number } | null = null
  private _targetZoom = 1
  private _zoomDirty = false

  constructor() { super({ key: 'OfficeScene' }) }

  preload() {
    const fb = '/assets/furniture/'
    const keys = new Set<string>()
    STATIC_FURNITURE.forEach(f => keys.add(f.key))
    // We still load desk/chair assets for meeting room chairs
    keys.add('desk_SE'); keys.add('computerScreen_SE')
    keys.add('chairDesk_SE'); keys.add('chairDesk_SW')
    for (const key of keys) {
      this.load.image(key, `${fb}${key}.png`)
    }
    // Characters are drawn procedurally — no PNGs needed
  }

  create() {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)

    // Center the office in the viewport
    const center = toScreen(TOTAL_W / 2, TOTAL_H / 2)
    this.ox = this.scale.width / 2 - center.x
    this.oy = 90

    // ── Camera setup: pan (drag) + zoom (wheel / pinch / keys) ──
    const cam = this.cameras.main
    const pad = 800
    const topLeft = toScreen(0, 0)
    const botRight = toScreen(TOTAL_W, TOTAL_H)
    const bx = this.ox + Math.min(topLeft.x, botRight.x) - pad
    const by = this.oy + Math.min(topLeft.y, botRight.y) - pad - WALL_H * Z
    const bw = Math.abs(botRight.x - topLeft.x) + pad * 2
    const bh = Math.abs(botRight.y - topLeft.y) + pad * 2 + WALL_H * Z
    cam.setBounds(bx, by, bw, bh)

    this._targetZoom = cam.zoom

    // ── Drag-to-pan ──
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown() || p.leftButtonDown()) {
        this._dragStart = { x: cam.scrollX + p.x / cam.zoom, y: cam.scrollY + p.y / cam.zoom }
      }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && this._dragStart) {
        cam.scrollX = this._dragStart.x - p.x / cam.zoom
        cam.scrollY = this._dragStart.y - p.y / cam.zoom
      }
    })
    this.input.on('pointerup', () => { this._dragStart = null })

    // ── Mouse-wheel zoom ──
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _currentlyOver: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const oldZoom = this._targetZoom
      this._targetZoom = Phaser.Math.Clamp(
        oldZoom - Math.sign(deltaY) * ZOOM_STEP,
        MIN_ZOOM, MAX_ZOOM,
      )
      this._zoomDirty = true
    })

    // ── Keyboard shortcuts ──
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const PAN_SPEED = 20 / cam.zoom
      switch (event.key) {
        case '+': case '=':
          this._targetZoom = Phaser.Math.Clamp(this._targetZoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM)
          this._zoomDirty = true
          break
        case '-': case '_':
          this._targetZoom = Phaser.Math.Clamp(this._targetZoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM)
          this._zoomDirty = true
          break
        case '0':
          this._targetZoom = 1
          this._zoomDirty = true
          break
        case 'ArrowUp':    cam.scrollY -= PAN_SPEED; break
        case 'ArrowDown':  cam.scrollY += PAN_SPEED; break
        case 'ArrowLeft':  cam.scrollX -= PAN_SPEED; break
        case 'ArrowRight': cam.scrollX += PAN_SPEED; break
      }
    })

    this.drawFloorAndWalls()
    this.drawInternalDividers()
    this.drawWallDecorations()
    this.drawLongDesks()
    this.placeStaticFurniture()
    this.drawMeetingChairs()
    this.drawKitchenCounter()
    this.drawKitchenChairs()
    this.drawPingPongTable()
    this.drawZoneLabels()
    this.drawLogoMural()

    if (this.pendingState) {
      this.applyFullState(this.pendingState)
      this.pendingState = undefined
    }

    ;(window as Window & { __officeReady?: boolean }).__officeReady = true
  }

  update() {
    if (this._zoomDirty) {
      const cam = this.cameras.main
      const diff = this._targetZoom - cam.zoom
      if (Math.abs(diff) < 0.005) {
        cam.setZoom(this._targetZoom)
        this._zoomDirty = false
      } else {
        cam.setZoom(cam.zoom + diff * ZOOM_LERP_SPEED)
      }
    }
  }

  // ── Public helpers for external UI ──
  zoomIn()  { this._targetZoom = Phaser.Math.Clamp(this._targetZoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM); this._zoomDirty = true }
  zoomOut() { this._targetZoom = Phaser.Math.Clamp(this._targetZoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM); this._zoomDirty = true }
  resetZoom() { this._targetZoom = 1; this._zoomDirty = true }
  getZoom() { return this._targetZoom }

  // ── Rendering ──

  private drawFloorAndWalls() {
    const { ox, oy } = this

    // ── Floor ──
    const floorG = this.add.graphics()
    floorG.setDepth(-2)
    for (let x = 0; x < TOTAL_W; x++) {
      for (let y = 0; y < TOTAL_H; y++) {
        const c = (x + y) % 2 === 0 ? FLOOR : FLOOR_ALT
        drawCube(floorG, ox, oy, x, y, 0, 1, 1, FLOOR_H, c.top, c.left, c.right)
      }
    }

    // ── Grid lines ──
    const gridG = this.add.graphics()
    gridG.setDepth(-1)
    for (let x = 0; x <= TOTAL_W; x++) {
      drawFloorLine(gridG, ox, oy, x, 0, x, TOTAL_H, GRID_COLOR, 0.12)
    }
    for (let y = 0; y <= TOTAL_H; y++) {
      drawFloorLine(gridG, ox, oy, 0, y, TOTAL_W, y, GRID_COLOR, 0.12)
    }

    // ── Back walls ──
    const wallG = this.add.graphics()
    wallG.setDepth(0)
    // NW wall (left)
    drawCube(wallG, ox, oy, -WALL_THICK, 0, FLOOR_H, WALL_THICK, TOTAL_H, WALL_H,
      WALL_NW.top, WALL_NW.left, WALL_NW.right)
    // NE wall (top)
    drawCube(wallG, ox, oy, 0, -WALL_THICK, FLOOR_H, TOTAL_W, WALL_THICK, WALL_H,
      WALL_NE.top, WALL_NE.left, WALL_NE.right)
    // Corner
    drawCube(wallG, ox, oy, -WALL_THICK, -WALL_THICK, FLOOR_H, WALL_THICK, WALL_THICK, WALL_H,
      WALL_NW.top, WALL_NW.left, WALL_NE.right)

    // Crombie green accent strip at base of NE wall
    drawCube(wallG, ox, oy, 0, -WALL_THICK, 0, TOTAL_W, WALL_THICK, 0.15,
      0x267a40, 0x1d5c30, 0x225236)

    // ── Front rim walls ──
    const rimG = this.add.graphics()
    const rimDepth = oy + toScreen(TOTAL_W, TOTAL_H).y + 500
    rimG.setDepth(rimDepth)
    drawCube(rimG, ox, oy, 0, TOTAL_H, 0, TOTAL_W, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(rimG, ox, oy, TOTAL_W, 0, 0, RIM_THICK, TOTAL_H, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
    drawCube(rimG, ox, oy, TOTAL_W, TOTAL_H, 0, RIM_THICK, RIM_THICK, RIM_H,
      RIM_C.top, RIM_C.left, RIM_C.right)
  }

  private drawInternalDividers() {
    const { ox, oy } = this

    // ── Vertical divider at x=10 (work area | meeting/corridor) ──
    // Segment 1: y=0 to y=3 (solid wall)
    const div1 = this.add.graphics()
    drawCube(div1, ox, oy, DIVIDER_X, 0.3, FLOOR_H, WALL_THICK, 2.7, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    div1.setDepth(oy + toScreen(DIVIDER_X, 1.5).y)

    // Gap: y=3-5 (doorway)
    // Segment 2: y=5 to y=8
    const div2 = this.add.graphics()
    drawCube(div2, ox, oy, DIVIDER_X, 5, FLOOR_H, WALL_THICK, 3, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    div2.setDepth(oy + toScreen(DIVIDER_X, 6.5).y)

    // Segment 3: y=8 to y=12 (work area | corridor below)
    const div3 = this.add.graphics()
    drawCube(div3, ox, oy, DIVIDER_X, 8, FLOOR_H, WALL_THICK, 4, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    div3.setDepth(oy + toScreen(DIVIDER_X, 10).y)

    // Gap: y=12-14 (doorway to lower corridor)
    // Segment 4: y=14 to y=16
    const div4 = this.add.graphics()
    drawCube(div4, ox, oy, DIVIDER_X, 14, FLOOR_H, WALL_THICK, 2, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    div4.setDepth(oy + toScreen(DIVIDER_X, 15).y)

    // ── Horizontal divider at y=8 (meeting rooms | corridor/lounge) ──
    // Segment from x=10 to x=12.5
    const divH1 = this.add.graphics()
    drawCube(divH1, ox, oy, DIVIDER_X, DIVIDER_Y, FLOOR_H, 2.5, WALL_THICK, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    divH1.setDepth(oy + toScreen(11.25, DIVIDER_Y).y)

    // Gap: x=12.5-14 (doorway)
    // Segment from x=14 to x=16
    const divH2 = this.add.graphics()
    drawCube(divH2, ox, oy, 14, DIVIDER_Y, FLOOR_H, 2, WALL_THICK, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    divH2.setDepth(oy + toScreen(15, DIVIDER_Y).y)

    // ── Kitchen wall at x=16 (separates kitchen from meeting/lounge) ──
    // Segment from y=0 to y=3
    const kitchenWall1 = this.add.graphics()
    drawCube(kitchenWall1, ox, oy, 16, 0.3, FLOOR_H, WALL_THICK, 2.7, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    kitchenWall1.setDepth(oy + toScreen(16, 1.5).y)

    // Gap: y=3-5 (kitchen doorway)
    // Segment from y=5 to y=8
    const kitchenWall2 = this.add.graphics()
    drawCube(kitchenWall2, ox, oy, 16, 5, FLOOR_H, WALL_THICK, 3, DIVIDER_H,
      DIV_C.top, DIV_C.left, DIV_C.right)
    kitchenWall2.setDepth(oy + toScreen(16, 6.5).y)

    // ── Lounge separator at x=16, y=8-16 (partial wall) ──
    // Segment from y=8 to y=10
    const loungeWall1 = this.add.graphics()
    drawCube(loungeWall1, ox, oy, 16, 8, FLOOR_H, WALL_THICK, 2, DIVIDER_H * 0.6,
      DIV_C.top, DIV_C.left, DIV_C.right)
    loungeWall1.setDepth(oy + toScreen(16, 9).y)

    // Gap: y=10-12 (wide opening to lounge)
    // Segment from y=12 to y=16 (half-height wall)
    const loungeWall2 = this.add.graphics()
    drawCube(loungeWall2, ox, oy, 16, 12, FLOOR_H, WALL_THICK, 4, DIVIDER_H * 0.6,
      DIV_C.top, DIV_C.left, DIV_C.right)
    loungeWall2.setDepth(oy + toScreen(16, 14).y)

    // ── Horizontal divider at y=8 for kitchen/lounge (x=16 to x=24) ──
    const divKL = this.add.graphics()
    drawCube(divKL, ox, oy, 16, DIVIDER_Y, FLOOR_H, 3, WALL_THICK, DIVIDER_H * 0.6,
      DIV_C.top, DIV_C.left, DIV_C.right)
    // Gap at x=19-21
    drawCube(divKL, ox, oy, 21, DIVIDER_Y, FLOOR_H, 3, WALL_THICK, DIVIDER_H * 0.6,
      DIV_C.top, DIV_C.left, DIV_C.right)
    divKL.setDepth(oy + toScreen(20, DIVIDER_Y).y)

    // ── Crombie green accent on divider tops ──
    const accentG = this.add.graphics()
    accentG.setDepth(oy + toScreen(DIVIDER_X, 8).y + 5)

    // Green strip on top of vertical divider at x=10
    drawCube(accentG, ox, oy, DIVIDER_X, 0.3, FLOOR_H + DIVIDER_H, WALL_THICK, 2.7, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentG, ox, oy, DIVIDER_X, 5, FLOOR_H + DIVIDER_H, WALL_THICK, 3, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentG, ox, oy, DIVIDER_X, 8, FLOOR_H + DIVIDER_H, WALL_THICK, 4, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentG, ox, oy, DIVIDER_X, 14, FLOOR_H + DIVIDER_H, WALL_THICK, 2, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)

    // Green strip on top of kitchen wall at x=16
    const accentK = this.add.graphics()
    accentK.setDepth(oy + toScreen(16, 4).y + 5)
    drawCube(accentK, ox, oy, 16, 0.3, FLOOR_H + DIVIDER_H, WALL_THICK, 2.7, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentK, ox, oy, 16, 5, FLOOR_H + DIVIDER_H, WALL_THICK, 3, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)

    // Green strip on top of lounge separator at x=16 (half-height walls)
    drawCube(accentK, ox, oy, 16, 8, FLOOR_H + DIVIDER_H * 0.6, WALL_THICK, 2, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentK, ox, oy, 16, 12, FLOOR_H + DIVIDER_H * 0.6, WALL_THICK, 4, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)

    // Green strip on top of horizontal divider at y=8 (meeting/corridor)
    const accentH = this.add.graphics()
    accentH.setDepth(oy + toScreen(13, DIVIDER_Y).y + 5)
    drawCube(accentH, ox, oy, DIVIDER_X, DIVIDER_Y, FLOOR_H + DIVIDER_H, 2.5, WALL_THICK, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentH, ox, oy, 14, DIVIDER_Y, FLOOR_H + DIVIDER_H, 2, WALL_THICK, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)

    // Green strip on top of horizontal divider at y=8 (kitchen/lounge)
    drawCube(accentH, ox, oy, 16, DIVIDER_Y, FLOOR_H + DIVIDER_H * 0.6, 3, WALL_THICK, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
    drawCube(accentH, ox, oy, 21, DIVIDER_Y, FLOOR_H + DIVIDER_H * 0.6, 3, WALL_THICK, 0.06,
      C_GREEN, 0x267a40, 0x2a8a48)
  }

  private drawWallDecorations() {
    const { ox, oy } = this
    const g = this.add.graphics()
    g.setDepth(1)
    const artZ = FLOOR_H + WALL_H * 0.35

    // Whiteboard on NE wall (above work area)
    drawCube(g, ox, oy, 3, -WALL_THICK + 0.01, artZ, 3, 0.05, 1.3,
      0xffffff, 0xe8e8e8, 0xf0f0f0)
    const wbCorners = [
      toScreen(3, -WALL_THICK + 0.01, artZ + 1.3),
      toScreen(6, -WALL_THICK + 0.01, artZ + 1.3),
      toScreen(6, -WALL_THICK + 0.01, artZ),
      toScreen(3, -WALL_THICK + 0.01, artZ),
    ]
    g.lineStyle(2, 0x555566, 0.8)
    g.strokePoints(wbCorners.map(c => ({ x: ox + c.x, y: oy + c.y })), true)

    // TV screen on NE wall (above kitchen zone) — shifted left so it's not cut off
    drawCube(g, ox, oy, 18, -WALL_THICK + 0.01, artZ, 2.5, 0.05, 1.1,
      0x222233, 0x1a1a2e, 0x1e1e30)
    drawCube(g, ox, oy, 18.15, -WALL_THICK + 0.02, artZ + 0.1, 2.2, 0.03, 0.9,
      0x3366aa, 0x2255aa, 0x2860aa)

    // Windows on NW wall
    for (const wy of [1, 3.5, 6, 8.5, 11, 13.5]) {
      drawCube(g, ox, oy, -WALL_THICK + 0.01, wy, artZ, 0.05, 1.8, 1.2,
        0x88bbdd, 0x6699bb, 0x77aacc)
    }

    // Clock on NE wall
    const cp = toScreen(9, -WALL_THICK + 0.02, FLOOR_H + WALL_H * 0.65)
    this.add.circle(ox + cp.x, oy + cp.y, 8, 0xffffff).setStrokeStyle(1.5, 0x444455).setDepth(1)
    this.add.circle(ox + cp.x, oy + cp.y, 1.5, 0x333344).setDepth(1)

    // Room name signs
    const meetSign = toScreen(13, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + meetSign.x, oy + meetSign.y, '📋 SALA 1', {
      fontSize: '7px', color: '#ccc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1)

    const workSign = toScreen(5, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + workSign.x, oy + workSign.y, '💻 DEV FLOOR', {
      fontSize: '7px', color: '#33c566', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1)

    const kitchenSign = toScreen(19, -WALL_THICK + 0.03, FLOOR_H + WALL_H * 0.75)
    this.add.text(ox + kitchenSign.x, oy + kitchenSign.y, '🍳 KITCHEN', {
      fontSize: '7px', color: '#fecc33', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1)
  }

  /** Draw long shared desks (conference-table style) for the work area */
  private drawLongDesks() {
    const { ox, oy } = this

    for (const row of DESK_ROWS) {
      const g = this.add.graphics()
      const ty = row.tableY
      const tableStartX = 1.5
      const tableEndX = 9.5
      const tableW = tableEndX - tableStartX
      const tableD = 1.2  // depth of table
      const tableH = 0.65 // height of table
      const legW = 0.15
      const legD = 0.15

      // Table legs (4 corners)
      for (const [lx, ly] of [
        [tableStartX, ty - tableD / 2],
        [tableEndX - legW, ty - tableD / 2],
        [tableStartX, ty + tableD / 2 - legD],
        [tableEndX - legW, ty + tableD / 2 - legD],
      ]) {
        drawCube(g, ox, oy, lx, ly, FLOOR_H, legW, legD, tableH,
          DESK_LEG.top, DESK_LEG.left, DESK_LEG.right)
      }

      // Main tabletop
      drawCube(g, ox, oy, tableStartX, ty - tableD / 2, FLOOR_H + tableH,
        tableW, tableD, 0.06,
        DESK_C.top, DESK_C.left, DESK_C.right)

      // Crombie green accent strip along front edge
      drawCube(g, ox, oy, tableStartX, ty + tableD / 2 - 0.08, FLOOR_H + tableH + 0.06,
        tableW, 0.08, 0.03,
        DESK_ACCENT.top, DESK_ACCENT.left, DESK_ACCENT.right)

      // Monitors at each seat position — BIGGER and more visible
      for (const seatX of row.seats) {
        // Monitor stand
        drawCube(g, ox, oy, seatX - 0.1, ty - 0.2, FLOOR_H + tableH + 0.06,
          0.2, 0.1, 0.25,
          0x444444, 0x333333, 0x3a3a3a)
        // Monitor screen — wider and taller
        drawCube(g, ox, oy, seatX - 0.55, ty - 0.35, FLOOR_H + tableH + 0.31,
          1.1, 0.07, 0.65,
          0x222233, 0x1a1a2e, 0x1e1e30)
        // Screen glow (Crombie cyan) — brighter
        drawCube(g, ox, oy, seatX - 0.48, ty - 0.34, FLOOR_H + tableH + 0.36,
          0.96, 0.04, 0.55,
          C_CYAN, 0x1a8ab0, 0x2090b8, 0.8)
      }

      const depthPos = toScreen(tableStartX + tableW / 2, ty)
      g.setDepth(oy + depthPos.y + 5)
    }
  }

  /** Place image-based chairs around meeting tables */
  private drawMeetingChairs() {
    const { ox, oy } = this

    // Meeting table 1 at tx=13, ty=3 — chairs around it
    // SE-facing chairs on the left/top side, SW-facing on the right/bottom
    const meetingChairs: Array<{ tx: number; ty: number; key: string; flipX?: boolean }> = [
      // Table 1 (tx=13, ty=3)
      { tx: 11.6, ty: 2.4, key: 'chairDesk_SE' },
      { tx: 11.6, ty: 3.6, key: 'chairDesk_SE' },
      { tx: 14.4, ty: 2.4, key: 'chairDesk_SW' },
      { tx: 14.4, ty: 3.6, key: 'chairDesk_SW' },
      // Table 2 (tx=13, ty=6.5)
      { tx: 11.6, ty: 5.9, key: 'chairDesk_SE' },
      { tx: 11.6, ty: 7.1, key: 'chairDesk_SE' },
      { tx: 14.4, ty: 5.9, key: 'chairDesk_SW' },
      { tx: 14.4, ty: 7.1, key: 'chairDesk_SW' },
    ]

    for (const chair of meetingChairs) {
      const pos = toScreen(chair.tx, chair.ty, FLOOR_H)
      const sprite = this.add.image(ox + pos.x, oy + pos.y, chair.key)
      sprite.setScale(0.35)
      sprite.setOrigin(0.5, 0.85)
      if (chair.flipX) sprite.setFlipX(true)
      sprite.setDepth(oy + toScreen(chair.tx, chair.ty).y)
      // Tint with Crombie pink for brand consistency
      sprite.setTint(0xff6688)
    }
  }

  /** Place image-based chairs around kitchen table */
  private drawKitchenChairs() {
    const { ox, oy } = this
    const kitchenChairs: Array<{ tx: number; ty: number; key: string }> = [
      { tx: 18.5, ty: 4.8, key: 'chairDesk_SW' },
      { tx: 20.5, ty: 4.8, key: 'chairDesk_SW' },
      { tx: 18.5, ty: 6.2, key: 'chairDesk_SE' },
      { tx: 20.5, ty: 6.2, key: 'chairDesk_SE' },
    ]
    for (const chair of kitchenChairs) {
      const pos = toScreen(chair.tx, chair.ty, FLOOR_H)
      const sprite = this.add.image(ox + pos.x, oy + pos.y, chair.key)
      sprite.setScale(0.32)
      sprite.setOrigin(0.5, 0.85)
      sprite.setDepth(oy + toScreen(chair.tx, chair.ty).y)
      // Tint with Crombie yellow for brand consistency
      sprite.setTint(0xffdd55)
    }
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
        sprite.setDepth(item.depth ?? (oy + toScreen(item.tx, item.ty).y))
      } catch {
        // Skip if texture not found
      }
    }
  }

  private drawKitchenCounter() {
    const { ox, oy } = this
    const g = this.add.graphics()
    // Kitchen counter along NE wall
    drawCube(g, ox, oy, 16.5, 0.1, FLOOR_H, 6, 0.7, 0.85,
      0xe8e0d0, 0xd5ccbc, 0xcec5b5)
    // Countertop
    drawCube(g, ox, oy, 16.5, 0.1, FLOOR_H + 0.85, 6, 0.7, 0.07,
      0x5a5048, 0x4a4038, 0x504540)
    // Coffee machine
    drawCube(g, ox, oy, 19, 0.12, FLOOR_H + 0.85, 0.5, 0.45, 0.5,
      0x1a1a1a, 0x111111, 0x161616)
    // Crombie green accent on coffee machine
    drawCube(g, ox, oy, 19.05, 0.13, FLOOR_H + 1.15, 0.3, 0.02, 0.15,
      C_GREEN, 0x1d5c30, 0x267a40)
    const depthPos = toScreen(19, 0.5, FLOOR_H)
    g.setDepth(oy + depthPos.y + 10)
  }

  private drawPingPongTable() {
    const { ox, oy } = this
    const g = this.add.graphics()
    const ptx = 19.5, pty = 13, ptz = FLOOR_H
    const tw = 2.2, td = 1.2, tHeight = 0.6

    // Table legs
    const legS = 0.15, legH = tHeight
    for (const [lx, ly] of [[0, 0], [tw - legS, 0], [0, td - legS], [tw - legS, td - legS]]) {
      drawCube(g, ox, oy, ptx + lx, pty + ly, ptz, legS, legS, legH,
        0x333344, 0x222233, 0x2a2a3a)
    }
    // Green tabletop (Crombie green!)
    drawCube(g, ox, oy, ptx, pty, ptz + tHeight, tw, td, 0.08,
      C_GREEN, 0x267a40, 0x2a8a48)
    // White center line
    const midY = pty + td / 2
    const lineStart = toScreen(ptx + 0.05, midY, ptz + tHeight + 0.09)
    const lineEnd = toScreen(ptx + tw - 0.05, midY, ptz + tHeight + 0.09)
    g.lineStyle(1.5, 0xffffff, 0.9)
    g.beginPath()
    g.moveTo(ox + lineStart.x, oy + lineStart.y)
    g.lineTo(ox + lineEnd.x, oy + lineEnd.y)
    g.strokePath()
    // Net
    drawCube(g, ox, oy, ptx + tw / 2 - 0.03, pty, ptz + tHeight, 0.06, td, 0.2,
      0xdddddd, 0xcccccc, 0xbbbbbb, 0.7)

    const depthPos = toScreen(ptx + tw / 2, pty + td / 2, ptz)
    g.setDepth(oy + depthPos.y)
  }

  private drawZoneLabels() {
    const { ox, oy } = this
    const labels: Array<{ text: string; tx: number; ty: number; color?: string }> = [
      { text: 'LOUNGE',   tx: 20, ty: 11.5, color: '#25B2E2' },
      { text: 'GAME',     tx: 20, ty: 14,   color: '#888' },
      { text: 'SALA 2',   tx: 13, ty: 5,    color: '#25B2E2' },
      { text: 'KITCHEN',  tx: 20, ty: 3.5,  color: '#fecc33' },
      { text: 'DEV AREA', tx: 5,  ty: 7.5,  color: '#33c566' },
    ]
    for (const l of labels) {
      const p = toScreen(l.tx, l.ty, FLOOR_H)
      this.add.text(ox + p.x, oy + p.y, l.text, {
        fontSize: '8px', color: l.color ?? '#999', fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.35).setDepth(2)
    }
  }

  private drawLogoMural() {
    const { ox, oy } = this
    const g = this.add.graphics()
    g.setDepth(1)
    // Crombie brand colors as abstract bars on NW wall — BIGGER and more visible
    const bars = [
      { color: C_PINK,   ty: 8.0,  width: 3.0 },
      { color: C_CYAN,   ty: 8.6,  width: 2.5 },
      { color: C_PURPLE, ty: 9.2,  width: 1.2 },
      { color: C_YELLOW, ty: 9.8,  width: 2.8 },
      { color: C_GREEN,  ty: 10.4, width: 2.0 },
      { color: C_PINK,   ty: 11.0, width: 0.8 },
      { color: C_CYAN,   ty: 11.6, width: 1.5 },
    ]
    for (const bar of bars) {
      drawCube(g, ox, oy, -WALL_THICK + 0.01, bar.ty, FLOOR_H + WALL_H * 0.3,
        0.06, bar.width, 0.35,
        bar.color, bar.color - 0x101010, bar.color - 0x080808, 0.65)
    }

    // "CROMBIE" text on the wall
    const textPos = toScreen(-WALL_THICK + 0.04, 9.8, FLOOR_H + WALL_H * 0.72)
    this.add.text(ox + textPos.x, oy + textPos.y, 'C R O M B I E', {
      fontSize: '6px', color: '#33c566', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.6).setDepth(1).setAngle(-25)
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
    this.devIndex.clear()
  }
}
