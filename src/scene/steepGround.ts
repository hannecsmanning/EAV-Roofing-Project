// "Ground to avoid" (Figma "alert flows"): parts of the ground too steep for the machine, as outlines on the map.
// Traced from the real ground (the same tilt the Uneven ground alert uses), so the map and the alert always agree.
import { groundTiltDeg, MAX_TILT_DEG } from './siteLayout'
import type { Pt } from './roofShape'

const AREA = { minX: -70, maxX: 70, minZ: -80, maxZ: 60 } // the part of the site to check, in meters
const CELL = 0.5

/** Outlines (closed loops of [x, z] points) around every patch of ground at or over the max tilt. */
export function steepPatches(): Pt[][] {
  const cols = Math.ceil((AREA.maxX - AREA.minX) / CELL)
  const rows = Math.ceil((AREA.maxZ - AREA.minZ) / CELL)
  // Inside a patch where the value is >= 0.
  const f: number[] = new Array((cols + 1) * (rows + 1))
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c <= cols; c++) f[r * (cols + 1) + c] = groundTiltDeg(AREA.minX + c * CELL, AREA.minZ + r * CELL) - MAX_TILT_DEG
  const val = (c: number, r: number) => f[r * (cols + 1) + c]
  const inside = (c: number, r: number) => val(c, r) >= 0

  // Marching squares: line pieces where the edge of a patch crosses each cell, joined up by shared grid lines.
  type Cross = { id: string; p: Pt }
  const cross = (c1: number, r1: number, c2: number, r2: number): Cross => {
    if (c2 < c1 || r2 < r1) [c1, r1, c2, r2] = [c2, r2, c1, r1]
    const a = val(c1, r1)
    const t = a / (a - val(c2, r2))
    return { id: `${r1 === r2 ? 'h' : 'v'}${c1},${r1}`, p: [AREA.minX + (c1 + (c2 - c1) * t) * CELL, AREA.minZ + (r1 + (r2 - r1) * t) * CELL] }
  }
  const links = new Map<string, string[]>()
  const pointOf = new Map<string, Pt>()
  const link = (a: Cross, b: Cross) => {
    for (const [p, q] of [[a, b], [b, a]]) {
      pointOf.set(p.id, p.p)
      if (!links.has(p.id)) links.set(p.id, [])
      links.get(p.id)!.push(q.id)
    }
  }
  const crosses = (c1: number, r1: number, c2: number, r2: number) => inside(c1, r1) !== inside(c2, r2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e: Cross[] = []
      if (crosses(c, r, c + 1, r)) e.push(cross(c, r, c + 1, r))
      if (crosses(c + 1, r, c + 1, r + 1)) e.push(cross(c + 1, r, c + 1, r + 1))
      if (crosses(c + 1, r + 1, c, r + 1)) e.push(cross(c + 1, r + 1, c, r + 1))
      if (crosses(c, r + 1, c, r)) e.push(cross(c, r + 1, c, r))
      if (e.length === 2) link(e[0], e[1])
      else if (e.length === 4) {
        link(e[0], e[1])
        link(e[2], e[3])
      }
    }
  }

  const used = new Set<string>()
  const loops: Pt[][] = []
  for (const start of links.keys()) {
    if (used.has(start)) continue
    const loop: Pt[] = []
    let k: string | undefined = start
    while (k && !used.has(k)) {
      used.add(k)
      loop.push(pointOf.get(k)!)
      k = links.get(k)!.find((n) => !used.has(n))
    }
    if (loop.length > 8) loops.push(smooth(loop))
  }
  return loops
}

/** Round off the stair-steps of the grid (Chaikin smoothing), for a soft, amorphous edge like the Figma shape. */
function smooth(pts: Pt[], passes = 3): Pt[] {
  let out = pts
  for (let i = 0; i < passes; i++) {
    const next: Pt[] = []
    for (let j = 0; j < out.length; j++) {
      const a = out[j]
      const b = out[(j + 1) % out.length]
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    out = next
  }
  return out
}
