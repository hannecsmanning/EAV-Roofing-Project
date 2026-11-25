// The house shape, taken from the roof edge in Figma
// ("Zoom 1 · Zone map (zoomed all the way out)", layer "Roof edge", node 40000057:2712).
// Everything here is plain math with no imports, so it can be tested on its own.

export type Pt = [number, number] // x, z in meters

// The roof edge as drawn in Figma, in map pixels (y down = toward the front of the house).
const ROOF_EDGE_PX: Pt[] = [
  [1.5, 111.5], [1.5, 367.5], [75.5, 367.5], [75.5, 423.5], [105.5, 429.5], [109.5, 464.5],
  [233.5, 464.5], [234.5, 553.5], [460.5, 553.5], [465.5, 471.5], [491.5, 474.5], [491.5, 511.5],
  [679.5, 511.5], [679.5, 421.5], [702.5, 415.5], [699.5, 72.5], [527.5, 75.5], [525.5, 1.5],
  [181.5, 1.5], [179.5, 58.5], [83.5, 58.5], [80.5, 108.5],
]

// Map scale: how many map pixels make one meter. 16 makes the house about 44 m x 34 m
// (144 ft x 113 ft). Change this one number to resize the house.
export const MAP_PX_PER_M = 16

const SNAP = 0.25 // meters. Corners snap to this grid so the roof mesh lines up neatly.
const snap = (v: number) => Math.round(v / SNAP) * SNAP

/**
 * The roof edge in world meters, with every side made exactly straight (the Figma edges lean a pixel or two).
 * Sides alternate up-down and left-right, so each corner is where one straight side meets the next.
 */
export function roofOutline(centerX: number, centerZ: number): Pt[] {
  const xs = ROOF_EDGE_PX.map((p) => p[0])
  const ys = ROOF_EDGE_PX.map((p) => p[1])
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2
  const n = ROOF_EDGE_PX.length
  // Side i runs from point i to point i+1. Even sides run front-to-back (fixed x), odd sides left-to-right (fixed z).
  const sideValue = (i: number) => {
    const a = ROOF_EDGE_PX[i]
    const b = ROOF_EDGE_PX[(i + 1) % n]
    return i % 2 === 0 ? ((a[0] + b[0]) / 2 - midX) / MAP_PX_PER_M + centerX : ((a[1] + b[1]) / 2 - midY) / MAP_PX_PER_M + centerZ
  }
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    // Corner i+1 sits where side i meets side i+1.
    const s = sideValue(i)
    const t = sideValue((i + 1) % n)
    pts.push(i % 2 === 0 ? [snap(s), snap(t)] : [snap(t), snap(s)])
  }
  return pts
}

/** True if (x, z) is inside the outline. */
export function isInside(poly: Pt[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Straight-line distance from (x, z) to the nearest side of the outline. */
export function edgeDistance(poly: Pt[], x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]
    const [bx, bz] = poly[(i + 1) % poly.length]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)))
  }
  return best
}

/**
 * How far in from the edge a point is, measured the "square" way (the bigger of left-right and front-back).
 * For a house with only square corners, this times the roof pitch gives a proper hip roof:
 * hips at the outside corners, valleys at the inside corners, ridges along the middle.
 */
export function squareDistance(poly: Pt[], x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]
    const [bx, bz] = poly[(i + 1) % poly.length]
    const dx = Math.max(Math.min(ax, bx) - x, 0, x - Math.max(ax, bx))
    const dz = Math.max(Math.min(az, bz) - z, 0, z - Math.max(az, bz))
    best = Math.min(best, Math.max(dx, dz))
  }
  return best
}

/** The outline moved inward by `d` meters on every side (used for the walls under the roof overhang). */
export function insetOutline(poly: Pt[], d: number): Pt[] {
  // Work out which way is "inside" from the winding direction.
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]
    const [bx, bz] = poly[(i + 1) % poly.length]
    area += ax * bz - bx * az
  }
  const sign = area > 0 ? 1 : -1
  const n = poly.length
  // Each side, shifted inward. Sides are straight up-down or left-right.
  const shifted = poly.map((a, i) => {
    const b = poly[(i + 1) % n]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    // Inward normal for this winding.
    const nx = (-dz / len) * sign
    const nz = (dx / len) * sign
    return { vertical: Math.abs(dx) < 1e-9, x: a[0] + nx * d, z: a[1] + nz * d }
  })
  return shifted.map((s, i) => {
    const next = shifted[(i + 1) % n]
    return s.vertical ? ([s.x, next.z] as Pt) : ([next.x, s.z] as Pt)
  })
}

/**
 * The wire: a loop on the ground `offset` meters outside the roof edge everywhere.
 * Found by tracing where the distance to the roof edge equals `offset`, then smoothed so the
 * corners are rounded, and spaced about every `step` meters.
 */
export function wireLoop(poly: Pt[], offset: number, step = 0.25): Pt[] {
  const cell = 0.1
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  const x0 = Math.min(...xs) - offset - 1
  const z0 = Math.min(...zs) - offset - 1
  const cols = Math.ceil((Math.max(...xs) + offset + 1 - x0) / cell)
  const rows = Math.ceil((Math.max(...zs) + offset + 1 - z0) / cell)

  // Positive outside the wire line, negative inside it.
  const f: number[] = new Array((cols + 1) * (rows + 1))
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = x0 + c * cell
      const z = z0 + r * cell
      const d = isInside(poly, x, z) ? -edgeDistance(poly, x, z) : edgeDistance(poly, x, z)
      f[r * (cols + 1) + c] = d - offset
    }
  }
  const val = (c: number, r: number) => f[r * (cols + 1) + c]
  // A crossing point on a grid line, named by that grid line so neighbouring cells share it exactly.
  type Cross = { id: string; p: Pt }
  const cross = (c1: number, r1: number, c2: number, r2: number): Cross => {
    if (c2 < c1 || r2 < r1) [c1, r1, c2, r2] = [c2, r2, c1, r1]
    const a = val(c1, r1)
    const b = val(c2, r2)
    const t = a / (a - b)
    return { id: `${r1 === r2 ? 'h' : 'v'}${c1},${r1}`, p: [x0 + (c1 + (c2 - c1) * t) * cell, z0 + (r1 + (r2 - r1) * t) * cell] }
  }

  // Marching squares: line pieces in every cell the wire passes through.
  const links = new Map<string, string[]>()
  const pointOf = new Map<string, Pt>()
  const link = (a: Cross, b: Cross) => {
    for (const [p, q] of [[a, b], [b, a]]) {
      pointOf.set(p.id, p.p)
      if (!links.has(p.id)) links.set(p.id, [])
      links.get(p.id)!.push(q.id)
    }
  }
  // A grid line crosses the wire when one end is inside it and the other is not (exactly on it counts as outside).
  const crosses = (c1: number, r1: number, c2: number, r2: number) => val(c1, r1) < 0 !== val(c2, r2) < 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const edges: Cross[] = []
      if (crosses(c, r, c + 1, r)) edges.push(cross(c, r, c + 1, r))
      if (crosses(c + 1, r, c + 1, r + 1)) edges.push(cross(c + 1, r, c + 1, r + 1))
      if (crosses(c + 1, r + 1, c, r + 1)) edges.push(cross(c + 1, r + 1, c, r + 1))
      if (crosses(c, r + 1, c, r)) edges.push(cross(c, r + 1, c, r))
      if (edges.length === 2) link(edges[0], edges[1])
      else if (edges.length === 4) {
        link(edges[0], edges[1])
        link(edges[2], edges[3])
      }
    }
  }

  // Chain the pieces into loops and keep the longest one.
  const used = new Set<string>()
  let best: Pt[] = []
  for (const startKey of links.keys()) {
    if (used.has(startKey)) continue
    const loop: Pt[] = []
    let k: string | undefined = startKey
    while (k && !used.has(k)) {
      used.add(k)
      loop.push(pointOf.get(k)!)
      k = links.get(k)!.find((nk) => !used.has(nk))
    }
    if (loop.length > best.length) best = loop
  }

  // Round the corners a little (Chaikin smoothing), then space the points evenly.
  let pts = best
  for (let pass = 0; pass < 3; pass++) {
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]])
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]])
    }
    pts = out
  }
  return resample(pts, step)
}

function resample(loop: Pt[], step: number): Pt[] {
  const out: Pt[] = [loop[0]]
  let carry = 0
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    let t = step - carry
    while (t <= len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len])
      t += step
    }
    carry = len - (t - step)
  }
  out.pop() // the last point lands back on the first
  return out
}

/** The nearest point on the outline to (x, z), and the side (segment) it's on. */
export function nearestEdge(poly: Pt[], x: number, z: number) {
  let best = { dist: Infinity, point: [0, 0] as Pt, a: poly[0], b: poly[1] }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    const p: Pt = [a[0] + t * dx, a[1] + t * dz]
    const d = Math.hypot(x - p[0], z - p[1])
    if (d < best.dist) best = { dist: d, point: p, a, b }
  }
  return best
}
