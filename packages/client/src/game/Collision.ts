/**
 * Collision grid and A* pathfinding for the virtual office.
 *
 * The office is 24×16 tiles. We discretize it into a grid with
 * CELL_SIZE resolution (0.5 tiles → 48×32 cells). Each cell is
 * either walkable (0) or blocked (1).
 *
 * Walls, desks, and furniture are marked as blocked.
 * Doorways are left open.
 */

import { toScreen } from './IsoCube'

// ── Grid resolution ──
const CELL_SIZE = 0.5          // each cell = 0.5 × 0.5 tiles
const TOTAL_W = 24
const TOTAL_H = 16
const GRID_W = Math.ceil(TOTAL_W / CELL_SIZE)   // 48
const GRID_H = Math.ceil(TOTAL_H / CELL_SIZE)   // 32

const FLOOR_H = 0.12

// ── Collision grid (1 = blocked, 0 = walkable) ──
const grid: Uint8Array = new Uint8Array(GRID_W * GRID_H)

/** Convert tile coords to grid cell */
function tileToCell(tx: number, ty: number): { cx: number; cy: number } {
  return {
    cx: Math.floor(tx / CELL_SIZE),
    cy: Math.floor(ty / CELL_SIZE),
  }
}

/** Mark a rectangular region in tile coords as blocked */
function blockRect(x1: number, y1: number, x2: number, y2: number) {
  const c1 = tileToCell(x1, y1)
  const c2 = tileToCell(x2, y2)
  const minCx = Math.max(0, Math.min(c1.cx, c2.cx))
  const maxCx = Math.min(GRID_W - 1, Math.max(c1.cx, c2.cx))
  const minCy = Math.max(0, Math.min(c1.cy, c2.cy))
  const maxCy = Math.min(GRID_H - 1, Math.max(c1.cy, c2.cy))
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      grid[cy * GRID_W + cx] = 1
    }
  }
}

/** Build the collision grid from the office layout */
function buildGrid() {
  grid.fill(0)

  // ── External walls (thin border around the office) ──
  // Characters shouldn't walk outside the office
  // Left wall (x < 0.3)
  blockRect(-0.5, -0.5, 0.3, TOTAL_H + 0.5)
  // Top wall (y < 0.3)
  blockRect(-0.5, -0.5, TOTAL_W + 0.5, 0.3)
  // Right rim (x > 23.5)
  blockRect(TOTAL_W - 0.3, -0.5, TOTAL_W + 0.5, TOTAL_H + 0.5)
  // Bottom rim (y > 15.5)
  blockRect(-0.5, TOTAL_H - 0.3, TOTAL_W + 0.5, TOTAL_H + 0.5)

  // ── Vertical divider at x=10 ──
  const wallThick = 0.6  // slightly wider than visual for collision margin
  // Segment 1: y=0 to y=3 (solid)
  blockRect(10 - wallThick / 2, 0, 10 + wallThick / 2, 3)
  // Segment 2: y=5 to y=8
  blockRect(10 - wallThick / 2, 5, 10 + wallThick / 2, 8)
  // Segment 3: y=8 to y=12
  blockRect(10 - wallThick / 2, 8, 10 + wallThick / 2, 12)
  // Segment 4: y=14 to y=16
  blockRect(10 - wallThick / 2, 14, 10 + wallThick / 2, 16)
  // Doorways at y=[3-5] and y=[12-14] are left open

  // ── Horizontal divider at y=8 (meeting rooms | corridor) ──
  // Segment x=10 to x=12.5
  blockRect(10, 8 - wallThick / 2, 12.5, 8 + wallThick / 2)
  // Segment x=14 to x=16
  blockRect(14, 8 - wallThick / 2, 16, 8 + wallThick / 2)
  // Doorway at x=[12.5-14] is left open

  // ── Kitchen wall at x=16 ──
  // Segment y=0 to y=3
  blockRect(16 - wallThick / 2, 0, 16 + wallThick / 2, 3)
  // Segment y=5 to y=8
  blockRect(16 - wallThick / 2, 5, 16 + wallThick / 2, 8)
  // Doorway at y=[3-5] is left open

  // ── Lounge separator at x=16 (y=8-16) ──
  // Segment y=8 to y=10
  blockRect(16 - wallThick / 2, 8, 16 + wallThick / 2, 10)
  // Segment y=12 to y=16
  blockRect(16 - wallThick / 2, 12, 16 + wallThick / 2, 16)
  // Doorway at y=[10-12] is left open

  // ── Horizontal divider at y=8 (kitchen/lounge) ──
  // Segment x=16 to x=19
  blockRect(16, 8 - wallThick / 2, 19, 8 + wallThick / 2)
  // Segment x=21 to x=24
  blockRect(21, 8 - wallThick / 2, 24, 8 + wallThick / 2)
  // Doorway at x=[19-21] is left open

  // ── Long desks (work area) ──
  // Each desk spans x=1.5 to x=9.5, depth ~1.2 tiles
  const deskRows = [2.5, 6, 9.5, 13]
  for (const ty of deskRows) {
    blockRect(1.5, ty - 0.8, 9.5, ty + 0.8)
  }

  // ── Kitchen counter (along top wall) ──
  blockRect(16.5, 0, 22.5, 1.0)

  // ── Kitchen table ──
  blockRect(18.5, 4.5, 20.5, 6.5)

  // ── Meeting tables ──
  blockRect(12, 2, 14, 4)     // Table 1
  blockRect(12, 5.5, 14, 7.5) // Table 2

  // ── Lounge furniture ──
  blockRect(17, 9.5, 23, 12)

  // ── Ping pong table ──
  blockRect(19, 12.5, 22, 14.5)

  // ── Bookshelves along NW wall ──
  blockRect(0, 4, 1.2, 11)
}

// Build grid on module load
buildGrid()

// ── A* Pathfinding ──

interface GridNode {
  cx: number
  cy: number
  g: number   // cost from start
  h: number   // heuristic to end
  f: number   // g + h
  parent: GridNode | null
}

/** Check if a grid cell is walkable */
function isWalkable(cx: number, cy: number): boolean {
  if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return false
  return grid[cy * GRID_W + cx] === 0
}

/** Heuristic: octile distance (allows diagonal movement) */
function heuristic(cx1: number, cy1: number, cx2: number, cy2: number): number {
  const dx = Math.abs(cx1 - cx2)
  const dy = Math.abs(cy1 - cy2)
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
}

/** 8-directional neighbors */
const DIRS = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
  { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
]

/**
 * A* pathfinding on the collision grid.
 * Returns a list of tile coordinates from start to end, or null if no path.
 */
function astarGrid(
  startCx: number, startCy: number,
  endCx: number, endCy: number,
): Array<{ cx: number; cy: number }> | null {
  // Clamp to grid bounds
  startCx = Math.max(0, Math.min(GRID_W - 1, startCx))
  startCy = Math.max(0, Math.min(GRID_H - 1, startCy))
  endCx = Math.max(0, Math.min(GRID_W - 1, endCx))
  endCy = Math.max(0, Math.min(GRID_H - 1, endCy))

  // If start or end is blocked, find nearest walkable cell
  if (!isWalkable(startCx, startCy)) {
    const nearest = findNearestWalkable(startCx, startCy)
    if (!nearest) return null
    startCx = nearest.cx
    startCy = nearest.cy
  }
  if (!isWalkable(endCx, endCy)) {
    const nearest = findNearestWalkable(endCx, endCy)
    if (!nearest) return null
    endCx = nearest.cx
    endCy = nearest.cy
  }

  // Already there
  if (startCx === endCx && startCy === endCy) {
    return [{ cx: endCx, cy: endCy }]
  }

  const open: GridNode[] = []
  const closed = new Set<number>()
  const key = (cx: number, cy: number) => cy * GRID_W + cx

  const startNode: GridNode = {
    cx: startCx, cy: startCy,
    g: 0, h: heuristic(startCx, startCy, endCx, endCy),
    f: 0, parent: null,
  }
  startNode.f = startNode.g + startNode.h
  open.push(startNode)

  const gScores = new Map<number, number>()
  gScores.set(key(startCx, startCy), 0)

  let iterations = 0
  const MAX_ITERATIONS = 3000  // safety limit

  while (open.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++

    // Find node with lowest f
    let bestIdx = 0
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i
    }
    const current = open[bestIdx]
    open.splice(bestIdx, 1)

    // Reached goal?
    if (current.cx === endCx && current.cy === endCy) {
      // Reconstruct path
      const path: Array<{ cx: number; cy: number }> = []
      let node: GridNode | null = current
      while (node) {
        path.unshift({ cx: node.cx, cy: node.cy })
        node = node.parent
      }
      return path
    }

    closed.add(key(current.cx, current.cy))

    // Explore neighbors
    for (const dir of DIRS) {
      const ncx = current.cx + dir.dx
      const ncy = current.cy + dir.dy

      if (!isWalkable(ncx, ncy)) continue
      if (closed.has(key(ncx, ncy))) continue

      // For diagonal moves, check that both adjacent cells are walkable
      // (prevents cutting through wall corners)
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!isWalkable(current.cx + dir.dx, current.cy) ||
            !isWalkable(current.cx, current.cy + dir.dy)) {
          continue
        }
      }

      const moveCost = (dir.dx !== 0 && dir.dy !== 0) ? Math.SQRT2 : 1
      const tentativeG = current.g + moveCost

      const nKey = key(ncx, ncy)
      const prevG = gScores.get(nKey)
      if (prevG !== undefined && tentativeG >= prevG) continue

      gScores.set(nKey, tentativeG)

      const neighbor: GridNode = {
        cx: ncx, cy: ncy,
        g: tentativeG,
        h: heuristic(ncx, ncy, endCx, endCy),
        f: 0,
        parent: current,
      }
      neighbor.f = neighbor.g + neighbor.h
      open.push(neighbor)
    }
  }

  // No path found
  return null
}

/** Find the nearest walkable cell to a given cell (BFS) */
function findNearestWalkable(cx: number, cy: number): { cx: number; cy: number } | null {
  if (isWalkable(cx, cy)) return { cx, cy }

  const visited = new Set<number>()
  const queue: Array<{ cx: number; cy: number }> = [{ cx, cy }]
  visited.add(cy * GRID_W + cx)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const dir of DIRS) {
      const ncx = current.cx + dir.dx
      const ncy = current.cy + dir.dy
      if (ncx < 0 || ncx >= GRID_W || ncy < 0 || ncy >= GRID_H) continue
      const key = ncy * GRID_W + ncx
      if (visited.has(key)) continue
      visited.add(key)
      if (isWalkable(ncx, ncy)) return { cx: ncx, cy: ncy }
      queue.push({ cx: ncx, cy: ncy })
    }
  }
  return null
}

/**
 * Simplify a grid path by removing redundant intermediate points.
 * Uses line-of-sight checks to skip waypoints that are in a straight
 * unobstructed line.
 */
function simplifyPath(path: Array<{ cx: number; cy: number }>): Array<{ cx: number; cy: number }> {
  if (path.length <= 2) return path

  const simplified: Array<{ cx: number; cy: number }> = [path[0]]
  let anchor = 0

  for (let i = 2; i < path.length; i++) {
    if (!hasLineOfSight(path[anchor].cx, path[anchor].cy, path[i].cx, path[i].cy)) {
      // Can't see from anchor to i, so i-1 is a required waypoint
      simplified.push(path[i - 1])
      anchor = i - 1
    }
  }

  simplified.push(path[path.length - 1])
  return simplified
}

/** Check if there's a clear line of sight between two grid cells (Bresenham) */
function hasLineOfSight(cx1: number, cy1: number, cx2: number, cy2: number): boolean {
  let x = cx1
  let y = cy1
  const dx = Math.abs(cx2 - cx1)
  const dy = Math.abs(cy2 - cy1)
  const sx = cx1 < cx2 ? 1 : -1
  const sy = cy1 < cy2 ? 1 : -1
  let err = dx - dy

  while (true) {
    if (!isWalkable(x, y)) return false
    if (x === cx2 && y === cy2) return true

    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}

// ── Public API ──

/**
 * Find a path between two tile positions, respecting walls and obstacles.
 * Returns screen-space waypoints (using toScreen + ox/oy offsets).
 * Returns null if no valid path exists.
 */
export function findPath(
  fromTx: number, fromTy: number,
  toTx: number, toTy: number,
  ox: number, oy: number,
): Array<{ x: number; y: number }> | null {
  const startCell = tileToCell(fromTx, fromTy)
  const endCell = tileToCell(toTx, toTy)

  const gridPath = astarGrid(startCell.cx, startCell.cy, endCell.cx, endCell.cy)
  if (!gridPath) return null

  // Simplify the path (remove unnecessary waypoints)
  const simplified = simplifyPath(gridPath)

  // Convert grid cells back to screen coordinates
  const screenPath: Array<{ x: number; y: number }> = []
  for (const cell of simplified) {
    const tx = (cell.cx + 0.5) * CELL_SIZE
    const ty = (cell.cy + 0.5) * CELL_SIZE
    const pos = toScreen(tx, ty, FLOOR_H)
    screenPath.push({
      x: ox + pos.x,
      y: oy + pos.y,
    })
  }

  return screenPath
}

/**
 * Convert screen coordinates back to tile coordinates.
 * Inverse of toScreen: given screenX = ox + (tx - ty) * T, screenY = oy + (tx + ty) * TH - tz * Z
 * With tz = FLOOR_H:
 *   sx = screenX - ox = (tx - ty) * T
 *   sy = screenY - oy + FLOOR_H * Z = (tx + ty) * TH
 * So: tx = (sx/T + sy'/TH) / 2, ty = (sy'/TH - sx/T) / 2
 */
export function screenToTile(screenX: number, screenY: number, ox: number, oy: number): { tx: number; ty: number } {
  const T = 32
  const TH = 16
  const Z = 32
  const sx = screenX - ox
  const sy = screenY - oy + FLOOR_H * Z
  const tx = (sx / T + sy / TH) / 2
  const ty = (sy / TH - sx / T) / 2
  return { tx, ty }
}

/**
 * Check if a tile position is walkable (not blocked by walls/furniture).
 */
export function isTileWalkable(tx: number, ty: number): boolean {
  const cell = tileToCell(tx, ty)
  return isWalkable(cell.cx, cell.cy)
}

/**
 * Find the nearest walkable tile position to a given tile.
 */
export function findNearestWalkableTile(tx: number, ty: number): { tx: number; ty: number } | null {
  const cell = tileToCell(tx, ty)
  const result = findNearestWalkable(cell.cx, cell.cy)
  if (!result) return null
  return {
    tx: (result.cx + 0.5) * CELL_SIZE,
    ty: (result.cy + 0.5) * CELL_SIZE,
  }
}
