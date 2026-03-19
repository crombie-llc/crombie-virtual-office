import Phaser from 'phaser'

// ── Isometric constants ──
export const T = 32       // half-tile width (full tile = 64px wide diamond)
export const TH = 16      // half-tile height (full tile = 32px tall diamond)
export const Z = 32       // pixels per Z-unit

/** Project tile coords → screen coords */
export function toScreen(tx: number, ty: number, tz = 0) {
  return {
    x: (tx - ty) * T,
    y: (tx + ty) * TH - tz * Z,
  }
}

/**
 * Draw an isometric cube (3 visible faces: top, left, right).
 * Position (tx,ty,tz) is the back-bottom corner of the cube.
 * Size (sx,sy,sz) in tile units.
 */
export function drawCube(
  g: Phaser.GameObjects.Graphics,
  ox: number, oy: number,
  tx: number, ty: number, tz: number,
  sx: number, sy: number, sz: number,
  topColor: number, leftColor: number, rightColor: number,
  alpha = 1,
) {
  const p = (x: number, y: number, z: number) => ({
    x: ox + (x - y) * T,
    y: oy + (x + y) * TH - z * Z,
  })

  const zt = tz + sz
  // Top face corners
  const A = p(tx, ty, zt)                // back
  const B = p(tx + sx, ty, zt)           // right
  const C = p(tx + sx, ty + sy, zt)      // front
  const D = p(tx, ty + sy, zt)           // left
  // Bottom face corners (only the 3 we need)
  const Bb = p(tx + sx, ty, tz)
  const Cb = p(tx + sx, ty + sy, tz)
  const Db = p(tx, ty + sy, tz)

  // Top face
  g.fillStyle(topColor, alpha)
  g.fillPoints([A, B, C, D], true)

  // Left face (bottom-left, at y=ty+sy)
  if (sz > 0) {
    g.fillStyle(leftColor, alpha)
    g.fillPoints([D, C, Cb, Db], true)
  }

  // Right face (bottom-right, at x=tx+sx)
  if (sz > 0) {
    g.fillStyle(rightColor, alpha)
    g.fillPoints([C, B, Bb, Cb], true)
  }
}

/** Draw a thin line on the floor between two tile positions */
export function drawFloorLine(
  g: Phaser.GameObjects.Graphics,
  ox: number, oy: number,
  x1: number, y1: number, x2: number, y2: number,
  color: number, alpha = 0.3, width = 1,
) {
  const a = toScreen(x1, y1)
  const b = toScreen(x2, y2)
  g.lineStyle(width, color, alpha)
  g.beginPath()
  g.moveTo(ox + a.x, oy + a.y)
  g.lineTo(ox + b.x, oy + b.y)
  g.strokePath()
}

/** Darken a color by a factor (0-1) */
export function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor)
  const g = Math.round(((color >> 8) & 0xff) * factor)
  const b = Math.round((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}
