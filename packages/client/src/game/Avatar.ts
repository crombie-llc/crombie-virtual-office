import Phaser from 'phaser'
import { toScreen, Z } from './IsoCube'
import { findPath, screenToTile, isTileWalkable, findNearestWalkableTile } from './Collision'
import type { DeveloperState } from '../types'

/**
 * Avatar with Sims-like behavior:
 * - Walks between Points of Interest (desk, kitchen, meeting, lounge)
 * - Turns to face the direction of movement (SE/SW/NE/NW)
 * - Has walking animation (leg alternation + body bob)
 * - Performs contextual activities at each POI
 * - Sits at desk when working/thinking
 */

const FLOOR_H = 0.12

// Crombie brand colors
const CROMBIE_GREEN  = 0x33c566
const CROMBIE_CYAN   = 0x25B2E2
const CROMBIE_PURPLE = 0x923392
const CROMBIE_YELLOW = 0xfecc33
const CROMBIE_DARK   = 0x181816

// Character color palettes — each dev gets a unique Crombie-themed combo
const CHAR_PALETTES = [
  { body: 0x33c566, pants: 0x1a5c30, skin: 0xf5c6a0, hair: 0x3a2a1a },
  { body: 0x25B2E2, pants: 0x1a3a5c, skin: 0xe8b090, hair: 0x1a1a2e },
  { body: 0x923392, pants: 0x3a1a3a, skin: 0xf5c6a0, hair: 0xcc8833 },
  { body: 0xfecc33, pants: 0x5c4a1a, skin: 0xe8b090, hair: 0x2a1a0a },
  { body: 0xff3366, pants: 0x4a1a2a, skin: 0xf5c6a0, hair: 0x5a3a1a },
  { body: 0x4a9eff, pants: 0x1a2a5c, skin: 0xe8b090, hair: 0x1a1a1a },
  { body: 0xff9800, pants: 0x5c3a0a, skin: 0xf5c6a0, hair: 0x8a5a2a },
  { body: 0x607d8b, pants: 0x2a3a3a, skin: 0xe8b090, hair: 0x3a2a1a },
]

// ── Direction enum ──
type Direction = 'SE' | 'SW' | 'NE' | 'NW'

// ── Behavior states ──
type BehaviorState =
  | 'seated'          // sitting at desk, working
  | 'walking'         // moving between POIs
  | 'idle_standing'   // standing still at a POI, doing an activity
  | 'returning'       // walking back to desk

// ── Points of Interest ──
interface POI {
  name: string
  tx: number
  ty: number
  activity: string       // emoji + label shown while at this POI
  duration: [number, number]  // [min, max] ms to stay
  facingDir?: Direction  // preferred facing direction at this POI
}

const POINTS_OF_INTEREST: POI[] = [
  // Kitchen area (positions are near furniture, not inside it)
  { name: 'coffee_machine', tx: 19,   ty: 2,   activity: '☕ getting coffee',    duration: [3000, 6000], facingDir: 'NE' },
  { name: 'kitchen_table',  tx: 18,   ty: 4,   activity: '🍽️ having a snack',   duration: [4000, 8000], facingDir: 'SE' },
  { name: 'kitchen_counter',tx: 21,   ty: 2,   activity: '🥤 grabbing a drink',  duration: [2000, 4000], facingDir: 'NE' },

  // Meeting rooms (stand next to tables, not on them)
  { name: 'meeting_1',      tx: 11,   ty: 3,   activity: '📋 in a meeting',      duration: [5000, 10000], facingDir: 'SE' },
  { name: 'meeting_2',      tx: 15,   ty: 6.5, activity: '🗣️ discussing',        duration: [4000, 8000],  facingDir: 'SW' },

  // Lounge (stand near sofas, not on them)
  { name: 'sofa',           tx: 17.5, ty: 13,   activity: '🛋️ taking a break',   duration: [4000, 9000], facingDir: 'SE' },
  { name: 'lounge_chair',   tx: 23,   ty: 13,   activity: '📱 checking phone',   duration: [3000, 6000], facingDir: 'SW' },

  // Game area (stand next to ping pong, not on it)
  { name: 'ping_pong',      tx: 18.5, ty: 13.5, activity: '🏓 playing ping pong', duration: [5000, 12000], facingDir: 'SE' },

  // Corridors / wandering (open walkable areas)
  { name: 'hallway_1',      tx: 12,   ty: 12,   activity: '🚶 walking around',   duration: [1000, 2500] },
  { name: 'hallway_2',      tx: 5,    ty: 15,   activity: '🚶 stretching legs',  duration: [1000, 2500] },
  { name: 'hallway_3',      tx: 20,   ty: 15,   activity: '🚶 taking a walk',    duration: [1000, 2500] },
  { name: 'corridor_meet',  tx: 13,   ty: 9,    activity: '🚶 passing through',  duration: [800, 1500] },

  // Near bookshelves (stand in front, not inside)
  { name: 'bookshelf',      tx: 2,    ty: 5,    activity: '📚 browsing books',   duration: [3000, 6000], facingDir: 'NW' },

  // Whiteboard (stand in front of it)
  { name: 'whiteboard',     tx: 4,    ty: 1.5,  activity: '✏️ at the whiteboard', duration: [3000, 7000], facingDir: 'NE' },

  // Window (stand near the window)
  { name: 'window',         tx: 1.5,  ty: 12,   activity: '🪟 looking outside',   duration: [2000, 5000], facingDir: 'NW' },

  // Doorway areas (natural gathering spots)
  { name: 'door_work_meet', tx: 10.5, ty: 4,    activity: '🚶 at the door',      duration: [800, 1500], facingDir: 'SE' },
  { name: 'door_kitchen',   tx: 16.5, ty: 4,    activity: '🚶 entering kitchen',  duration: [800, 1500], facingDir: 'SE' },
]

// ── Walking speed (pixels per second) ──
const WALK_SPEED = 55
const WALK_BOB_AMOUNT = 1.5    // vertical bob in pixels
const WALK_BOB_SPEED = 180     // ms per bob cycle
const LEG_SWING_ANGLE = 12     // degrees of leg swing

/**
 * Calculate direction from one screen position to another.
 * In isometric view:
 *   SE = moving right+down on screen (increasing tx)
 *   SW = moving left+down (increasing ty)
 *   NE = moving right+up (decreasing ty)
 *   NW = moving left+up (decreasing tx)
 */
function getDirection(fromX: number, fromY: number, toX: number, toY: number): Direction {
  const dx = toX - fromX
  const dy = toY - fromY
  // Use screen-space direction
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'SE' : 'NW'
  } else {
    return dy > 0 ? 'SW' : 'NE'
  }
}

/**
 * Draw a retro playmobil/minecraft style character facing a given direction.
 * The character is drawn with slight perspective changes based on direction.
 */
function drawRetroCharacter(
  g: Phaser.GameObjects.Graphics,
  palette: typeof CHAR_PALETTES[0],
  direction: Direction,
  scale = 1,
  legPhase = 0,   // -1 to 1 for walking animation (0 = standing)
  seated = false,
) {
  const s = scale
  g.clear()

  // Mirror for NW/NE directions (character faces left)
  const facingRight = direction === 'SE' || direction === 'NE'
  const facingFront = direction === 'SE' || direction === 'SW'
  const mx = facingRight ? 1 : -1  // mirror X

  // ── Shadow on ground ──
  g.fillStyle(0x000000, 0.15)
  g.fillEllipse(0, (seated ? 20 : 22) * s, 18 * s, 6 * s)

  // ── Legs ──
  const legLen = seated ? 8 : 12
  const legY = seated ? 10 : 8
  const shoeY = legY + legLen - 1

  if (legPhase !== 0 && !seated) {
    // Walking animation: alternate legs
    const swing = legPhase * LEG_SWING_ANGLE * (Math.PI / 180)
    const leftOffset = Math.sin(swing) * 3 * s
    const rightOffset = -Math.sin(swing) * 3 * s

    // Left leg
    g.fillStyle(palette.pants, 1)
    g.fillRect((-6 + leftOffset) * s, legY * s, 5 * s, legLen * s)
    // Right leg
    g.fillRect((1 + rightOffset) * s, legY * s, 5 * s, legLen * s)

    // Shoes
    g.fillStyle(0x2a2a2a, 1)
    g.fillRect((-7 + leftOffset) * s, (shoeY) * s, 6 * s, 3 * s)
    g.fillRect((1 + rightOffset) * s, (shoeY) * s, 6 * s, 3 * s)
  } else {
    // Standing / seated: legs together
    g.fillStyle(palette.pants, 1)
    g.fillRect(-6 * s, legY * s, 5 * s, legLen * s)
    g.fillRect(1 * s, legY * s, 5 * s, legLen * s)

    g.fillStyle(0x2a2a2a, 1)
    g.fillRect(-7 * s, shoeY * s, 6 * s, 3 * s)
    g.fillRect(1 * s, shoeY * s, 6 * s, 3 * s)
  }

  // ── Body (blocky torso) ──
  g.fillStyle(palette.body, 1)
  g.fillRect(-8 * s, -6 * s, 16 * s, 17 * s)

  // Body highlight (lighter stripe) — shifts based on facing direction
  const lighter = Phaser.Display.Color.IntegerToColor(palette.body)
  const highlight = Phaser.Display.Color.GetColor(
    Math.min(255, lighter.red + 35),
    Math.min(255, lighter.green + 35),
    Math.min(255, lighter.blue + 35),
  )
  g.fillStyle(highlight, 0.5)
  const hlX = facingRight ? -6 : 2
  g.fillRect(hlX * s, -4 * s, 4 * s, 14 * s)

  // ── Arms ──
  g.fillStyle(palette.body, 1)
  if (legPhase !== 0 && !seated) {
    // Walking: arms swing opposite to legs
    const armSwing = -legPhase * LEG_SWING_ANGLE * 0.7 * (Math.PI / 180)
    const leftArmOff = Math.sin(armSwing) * 2 * s
    const rightArmOff = -Math.sin(armSwing) * 2 * s
    g.fillRect((-12 + leftArmOff) * s, (-3 + Math.abs(leftArmOff) * 0.3) * s, 5 * s, 13 * s)
    g.fillRect((7 + rightArmOff) * s, (-3 + Math.abs(rightArmOff) * 0.3) * s, 5 * s, 13 * s)
    // Hands
    g.fillStyle(palette.skin, 1)
    g.fillRect((-12 + leftArmOff) * s, (9 + Math.abs(leftArmOff) * 0.3) * s, 5 * s, 4 * s)
    g.fillRect((7 + rightArmOff) * s, (9 + Math.abs(rightArmOff) * 0.3) * s, 5 * s, 4 * s)
  } else {
    g.fillRect(-12 * s, -3 * s, 5 * s, 13 * s)
    g.fillRect(7 * s, -3 * s, 5 * s, 13 * s)
    g.fillStyle(palette.skin, 1)
    g.fillRect(-12 * s, 9 * s, 5 * s, 4 * s)
    g.fillRect(7 * s, 9 * s, 5 * s, 4 * s)
  }

  // ── Head ──
  g.fillStyle(palette.skin, 1)
  g.fillRect(-7 * s, -22 * s, 14 * s, 16 * s)

  // ── Hair ──
  g.fillStyle(palette.hair, 1)
  g.fillRect(-8 * s, -24 * s, 16 * s, 7 * s)

  if (facingFront) {
    // Front-facing: side hair visible
    g.fillRect(-8 * s, -19 * s, 3 * s, 5 * s)
    g.fillRect(5 * s, -19 * s, 3 * s, 5 * s)
  } else {
    // Back-facing: full hair cap visible, no face details
    g.fillRect(-8 * s, -19 * s, 16 * s, 6 * s)
  }

  // ── Face (only when facing front) ──
  if (facingFront) {
    // Eyes — shift slightly based on direction
    const eyeShift = facingRight ? 1 : -1
    g.fillStyle(0x1a1a1a, 1)
    g.fillRect((-5 + eyeShift) * s, -16 * s, 3 * s, 3 * s)
    g.fillRect((2 + eyeShift) * s, -16 * s, 3 * s, 3 * s)

    // Eye highlights
    g.fillStyle(0xffffff, 0.9)
    g.fillRect((-4 + eyeShift) * s, -16.5 * s, 1.5 * s, 1.5 * s)
    g.fillRect((3 + eyeShift) * s, -16.5 * s, 1.5 * s, 1.5 * s)

    // Mouth
    g.fillStyle(0x8a5a4a, 0.7)
    g.fillRect(-2.5 * s, -10 * s, 5 * s, 2 * s)
  }
}

/**
 * Draw a small office chair (isometric-style).
 */
function drawDeskChair(
  g: Phaser.GameObjects.Graphics,
  accentColor: number,
  scale = 1,
) {
  const s = scale

  // Chair base
  g.fillStyle(0x333333, 1)
  g.fillRect(-2 * s, 14 * s, 4 * s, 10 * s)
  g.fillRect(-10 * s, 22 * s, 20 * s, 3 * s)
  g.fillRect(-2 * s, 19 * s, 4 * s, 7 * s)
  g.fillStyle(0x222222, 1)
  g.fillCircle(-9 * s, 24 * s, 2 * s)
  g.fillCircle(9 * s, 24 * s, 2 * s)

  // Seat cushion
  g.fillStyle(0x2a2a2a, 1)
  g.fillRect(-10 * s, 9 * s, 20 * s, 6 * s)
  g.fillStyle(accentColor, 0.7)
  g.fillRect(-9 * s, 10 * s, 18 * s, 3 * s)

  // Backrest
  g.fillStyle(0x2a2a2a, 1)
  g.fillRect(-9 * s, -6 * s, 18 * s, 16 * s)
  g.fillStyle(accentColor, 0.6)
  g.fillRect(-8 * s, -4 * s, 16 * s, 3 * s)

  // Top edge
  g.fillStyle(0x3a3a3a, 1)
  g.fillRect(-9 * s, -7 * s, 18 * s, 3 * s)
}

export class Avatar {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private charGraphics: Phaser.GameObjects.Graphics
  private chairGraphics: Phaser.GameObjects.Graphics
  private celebContainer!: Phaser.GameObjects.Container
  private celebOriginY = -80
  private statusDot!: Phaser.GameObjects.Arc
  private activityLabel!: Phaser.GameObjects.Text
  private thinkingTween?: Phaser.Tweens.Tween
  private deskX: number
  private deskY: number
  private ox: number
  private oy: number
  private palette: typeof CHAR_PALETTES[0]

  // ── Sims-like behavior ──
  private behaviorState: BehaviorState = 'seated'
  private currentDirection: Direction = 'SE'
  private walkTween: Phaser.Tweens.Tween | null = null
  private walkBobTween: Phaser.Tweens.Tween | null = null
  private walkAnimTimer: Phaser.Time.TimerEvent | null = null
  private behaviorTimer: Phaser.Time.TimerEvent | null = null
  private legPhase = 0
  private isOnline = false
  private isBusy = false   // thinking/celebrating/agent active
  private currentPOI: POI | null = null
  private walkPath: Array<{ x: number; y: number }> = []
  private walkPathIndex = 0

  // Walking animation state
  private _walkAnimFrame = 0
  private _bobTarget = { y: 0 }

  constructor(scene: Phaser.Scene, screenX: number, screenY: number, ox: number, oy: number, index: number, state: DeveloperState) {
    this.scene = scene
    this.deskX = screenX
    this.deskY = screenY
    this.ox = ox
    this.oy = oy
    const color = parseInt(state.color.replace('#', ''), 16)
    const items: Phaser.GameObjects.GameObject[] = []

    this.palette = CHAR_PALETTES[index % CHAR_PALETTES.length]

    // ── Chair (drawn behind the character) ──
    this.chairGraphics = scene.add.graphics()
    drawDeskChair(this.chairGraphics, this.palette.body, 0.75)
    this.chairGraphics.setPosition(0, 12)
    items.push(this.chairGraphics)

    // ── Character sprite ──
    this.charGraphics = scene.add.graphics()
    drawRetroCharacter(this.charGraphics, this.palette, 'SE', 1.1, 0, true)
    this.charGraphics.setPosition(0, 2)
    items.push(this.charGraphics)

    // ── Name label ──
    const nameText = scene.add.text(0, -38, state.name, {
      fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5)
    // Pill wide enough to contain the status dot (dot center at nameText.width/2+12, radius 3.5)
    const pill = scene.add.rectangle(0, -38, nameText.width + 30, 19, CROMBIE_DARK, 0.92)
    pill.setStrokeStyle(1.5, color, 0.85)
    this.statusDot = scene.add.circle(nameText.width / 2 + 12, -38, 3.5,
      state.online ? CROMBIE_GREEN : 0x666666)
    items.push(pill, nameText, this.statusDot)

    // ── Activity label ──
    const activityText = scene.add.text(0, -58, '', {
      fontSize: '9px', color: '#25B2E2', fontFamily: 'monospace',
      backgroundColor: '#0d0d1a', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0.5).setAlpha(0.9)
    this.activityLabel = activityText
    items.push(activityText)

    // ── Celebration ──
    const ce1 = scene.add.text(0, 0, '🎉', { fontSize: '20px' }).setOrigin(0.5)
    const ce2 = scene.add.text(-16, 8, '✨', { fontSize: '14px' }).setOrigin(0.5)
    const ce3 = scene.add.text(16, 8, '🎊', { fontSize: '14px' }).setOrigin(0.5)
    this.celebContainer = scene.add.container(0, this.celebOriginY, [ce1, ce2, ce3])
    this.celebContainer.setVisible(false)
    items.push(this.celebContainer)

    // ── Assemble ──
    this.container = scene.add.container(screenX, screenY, items)
    this.container.setDepth(screenY + 200)

    this.applyState(state)
  }

  applyState(state: DeveloperState) {
    this.isOnline = state.online
    this.isBusy = !!(state.thinking || state.activeAgent || state.celebrating)

    // Decide behavior based on state
    if (state.online && !this.isBusy) {
      // Online and idle → wander like a Sim
      if (this.behaviorState === 'seated') {
        this.startSimsBehavior()
      }
    } else {
      // Busy or offline → return to desk and sit
      if (this.behaviorState !== 'seated' && this.behaviorState !== 'returning') {
        this.returnToDesk()
      }
    }

    this.container.setAlpha(state.online ? 1 : 0.3)
    this.statusDot.setFillStyle(state.online ? CROMBIE_GREEN : 0x666666)

    // ── Activity label (only when seated/busy) ──
    if (!state.online) {
      this.activityLabel.setText('')
    } else if (state.celebrating) {
      this.activityLabel.setText('🎉 pushed!')
    } else if (state.thinking && state.activeAgent) {
      const agentShort = state.activeAgent.replace(/^crombie[:-]/, '')
      this.activityLabel.setText(`🤖 ${agentShort} thinking`)
    } else if (state.thinking) {
      this.activityLabel.setText('🤔 thinking...')
    } else if (this.behaviorState === 'idle_standing' && this.currentPOI) {
      this.activityLabel.setText(this.currentPOI.activity)
    } else if (this.behaviorState === 'walking') {
      this.activityLabel.setText('🚶 on the move')
    } else if (state.online) {
      this.activityLabel.setText('💻 working')
    }

    // ── Thinking pulse: yellow + blink on activity label ──
    if (state.thinking) {
      this.activityLabel.setColor('#fecc33')
      if (!this.thinkingTween) {
        this.thinkingTween = this.scene.tweens.add({
          targets: this.activityLabel,
          alpha: { from: 1, to: 0.3 },
          yoyo: true, repeat: -1, duration: 500,
        })
      }
    } else {
      this.activityLabel.setColor('#25B2E2')
      this.thinkingTween?.stop()
      this.thinkingTween = undefined
      this.activityLabel.setAlpha(0.9)
    }

    // ── Celebration ──
    if (state.celebrating) {
      this.scene.tweens.killTweensOf(this.celebContainer)
      this.celebContainer.setVisible(true)
      this.celebContainer.setAlpha(1)
      this.celebContainer.y = this.celebOriginY
      // Brief green flash on the camera (Crombie green, low intensity)
      this.scene.cameras.main.flash(350, 20, 80, 40)
      this.scene.tweens.add({
        targets: this.celebContainer,
        y: this.celebOriginY - 60,
        alpha: { from: 1, to: 0 },
        duration: 3000,
        onComplete: () => { this.celebContainer.setVisible(false) },
      })
    }
  }

  // ── Sims-like behavior system ──

  private startSimsBehavior() {
    // Start the behavior loop: wait at desk briefly, then wander
    const initialDelay = 1500 + Math.random() * 3000
    this.behaviorTimer = this.scene.time.delayedCall(initialDelay, () => {
      this.pickNextPOI()
    })
  }

  private pickNextPOI() {
    if (!this.isOnline || this.isBusy) {
      this.returnToDesk()
      return
    }

    // Shuffle POIs and pick the first one with a valid path
    const shuffled = [...POINTS_OF_INTEREST].sort(() => Math.random() - 0.5)
    let chosenPOI: POI | null = null
    let chosenPath: Array<{ x: number; y: number }> | null = null

    for (const poi of shuffled) {
      // Ensure the POI tile is walkable (or find nearest walkable)
      let targetTx = poi.tx
      let targetTy = poi.ty
      if (!isTileWalkable(targetTx, targetTy)) {
        const nearest = findNearestWalkableTile(targetTx, targetTy)
        if (!nearest) continue
        targetTx = nearest.tx
        targetTy = nearest.ty
      }

      const targetPos = toScreen(targetTx, targetTy, FLOOR_H)
      const targetX = this.ox + targetPos.x
      const targetY = this.oy + targetPos.y

      const path = this.buildPath(this.container.x, this.container.y, targetX, targetY)
      if (path.length > 0) {
        chosenPOI = poi
        chosenPath = path
        break
      }
    }

    if (!chosenPOI || !chosenPath) {
      // No valid POI found, stay seated
      this.sitDown()
      return
    }

    this.currentPOI = chosenPOI
    this.walkPath = chosenPath
    this.walkPathIndex = 0

    // Start walking
    this.behaviorState = 'walking'
    this.showChair(false)
    this.updateCharacterPose(false, 0)
    this.activityLabel.setText('🚶 on the move')
    this.walkToNextWaypoint()
  }

  /**
   * Build a path using A* pathfinding that respects walls and obstacles.
   * Falls back to a direct path if A* can't find a route.
   */
  private buildPath(fromX: number, fromY: number, toX: number, toY: number): Array<{ x: number; y: number }> {
    // Convert screen coords to tile coords
    const fromTile = screenToTile(fromX, fromY, this.ox, this.oy)
    const toTile = screenToTile(toX, toY, this.ox, this.oy)

    // Use A* pathfinding
    const astarPath = findPath(fromTile.tx, fromTile.ty, toTile.tx, toTile.ty, this.ox, this.oy)

    if (astarPath && astarPath.length > 1) {
      // Skip the first point (current position) and return the rest
      return astarPath.slice(1)
    }

    // Fallback: direct path (shouldn't happen often with a good grid)
    return [{ x: toX, y: toY }]
  }

  private walkToNextWaypoint() {
    if (this.walkPathIndex >= this.walkPath.length) {
      // Arrived at POI
      this.arriveAtPOI()
      return
    }

    const target = this.walkPath[this.walkPathIndex]
    const dist = Math.hypot(target.x - this.container.x, target.y - this.container.y)
    const duration = Math.max(400, (dist / WALK_SPEED) * 1000)

    // Face the direction of movement
    const newDir = getDirection(this.container.x, this.container.y, target.x, target.y)
    if (newDir !== this.currentDirection) {
      this.currentDirection = newDir
    }

    // Start walking animation
    this.startWalkAnimation()

    // Move to waypoint
    this.walkTween = this.scene.tweens.add({
      targets: this.container,
      x: target.x,
      y: target.y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        // Update depth while walking
        this.container.setDepth(this.container.y + 200)
      },
      onComplete: () => {
        this.walkPathIndex++
        // Brief pause between waypoints (makes movement look more natural)
        if (this.walkPathIndex < this.walkPath.length) {
          const pauseDuration = 100 + Math.random() * 200
          this.behaviorTimer = this.scene.time.delayedCall(pauseDuration, () => {
            this.walkToNextWaypoint()
          })
        } else {
          this.walkToNextWaypoint()
        }
      },
    })
  }

  private startWalkAnimation() {
    // Stop any existing walk animation
    this.stopWalkAnimation()

    this._walkAnimFrame = 0
    this._bobTarget = { y: 0 }

    // Leg swing animation (updates character graphics)
    this.walkAnimTimer = this.scene.time.addEvent({
      delay: WALK_BOB_SPEED,
      loop: true,
      callback: () => {
        this._walkAnimFrame++
        // Alternate leg phase: -1, 0, 1, 0, -1, 0, 1, ...
        const phase = Math.sin(this._walkAnimFrame * Math.PI * 0.5)
        this.legPhase = phase
        this.updateCharacterPose(false, phase)
      },
    })

    // Body bob (subtle up-down while walking)
    this.walkBobTween = this.scene.tweens.add({
      targets: this.charGraphics,
      y: { from: 2, to: 2 - WALK_BOB_AMOUNT },
      duration: WALK_BOB_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private stopWalkAnimation() {
    this.walkAnimTimer?.remove()
    this.walkAnimTimer = null
    this.walkBobTween?.stop()
    this.walkBobTween = null
    this.charGraphics.setPosition(0, 2)
    this.legPhase = 0
  }

  private arriveAtPOI() {
    this.stopWalkAnimation()
    this.behaviorState = 'idle_standing'

    // Face the POI's preferred direction, or keep current
    if (this.currentPOI?.facingDir) {
      this.currentDirection = this.currentPOI.facingDir
    }

    // Update character to standing pose facing the right direction
    this.updateCharacterPose(false, 0)

    // Show activity label
    if (this.currentPOI) {
      this.activityLabel.setText(this.currentPOI.activity)
    }

    // Add a subtle idle animation (slight sway)
    this.walkBobTween = this.scene.tweens.add({
      targets: this.charGraphics,
      y: { from: 2, to: 0.5 },
      duration: 1200 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Stay at POI for a while, then decide next action
    const [minDur, maxDur] = this.currentPOI?.duration ?? [2000, 5000]
    const stayDuration = minDur + Math.random() * (maxDur - minDur)

    this.behaviorTimer = this.scene.time.delayedCall(stayDuration, () => {
      // 40% chance to visit another POI, 60% chance to return to desk
      if (Math.random() < 0.4 && this.isOnline && !this.isBusy) {
        this.pickNextPOI()
      } else {
        this.returnToDesk()
      }
    })
  }

  returnToDesk() {
    // Cancel any ongoing behavior
    this.cancelBehavior()
    this.behaviorState = 'returning'

    // Build path back to desk using A* pathfinding
    const path = this.buildPath(this.container.x, this.container.y, this.deskX, this.deskY)
    this.walkPath = path.length > 0 ? path : [{ x: this.deskX, y: this.deskY }]
    this.walkPathIndex = 0

    this.showChair(false)
    this.updateCharacterPose(false, 0)
    this.activityLabel.setText('🚶 heading back')

    this.walkToNextWaypointReturn()
  }

  private walkToNextWaypointReturn() {
    if (this.walkPathIndex >= this.walkPath.length) {
      // Arrived at desk
      this.sitDown()
      return
    }

    const target = this.walkPath[this.walkPathIndex]
    const dist = Math.hypot(target.x - this.container.x, target.y - this.container.y)
    const duration = Math.max(400, (dist / WALK_SPEED) * 1000)

    const newDir = getDirection(this.container.x, this.container.y, target.x, target.y)
    if (newDir !== this.currentDirection) {
      this.currentDirection = newDir
    }

    this.startWalkAnimation()

    this.walkTween = this.scene.tweens.add({
      targets: this.container,
      x: target.x,
      y: target.y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        this.container.setDepth(this.container.y + 200)
      },
      onComplete: () => {
        this.walkPathIndex++
        if (this.walkPathIndex < this.walkPath.length) {
          this.behaviorTimer = this.scene.time.delayedCall(100, () => {
            this.walkToNextWaypointReturn()
          })
        } else {
          this.walkToNextWaypointReturn()
        }
      },
    })
  }

  private sitDown() {
    this.stopWalkAnimation()
    this.behaviorState = 'seated'
    this.currentDirection = 'SE'
    this.currentPOI = null

    // Show chair, draw seated character
    this.showChair(true)
    this.updateCharacterPose(true, 0)
    this.container.setDepth(this.deskY + 200)

    // Update activity label
    if (this.isOnline && !this.isBusy) {
      this.activityLabel.setText('💻 working')
    }

    // After sitting for a while, maybe wander again
    if (this.isOnline && !this.isBusy) {
      const sitDuration = 5000 + Math.random() * 10000
      this.behaviorTimer = this.scene.time.delayedCall(sitDuration, () => {
        if (this.isOnline && !this.isBusy) {
          this.pickNextPOI()
        }
      })
    }
  }

  private showChair(visible: boolean) {
    this.chairGraphics.setVisible(visible)
  }

  private updateCharacterPose(seated: boolean, legPhase: number) {
    drawRetroCharacter(
      this.charGraphics,
      this.palette,
      this.currentDirection,
      1.1,
      legPhase,
      seated,
    )
    // Adjust vertical position based on seated/standing
    if (seated) {
      this.charGraphics.setPosition(0, 2)
    } else {
      this.charGraphics.setPosition(0, -2)
    }
  }

  private cancelBehavior() {
    this.behaviorTimer?.remove()
    this.behaviorTimer = null
    this.walkTween?.stop()
    this.walkTween = null
    this.stopWalkAnimation()
    this.walkPath = []
    this.walkPathIndex = 0
  }

  destroy() {
    this.cancelBehavior()
    this.thinkingTween?.stop()
    this.container.destroy()
  }
}
