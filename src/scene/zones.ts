// Roof zones for Pick a spot. From the Figma zone map: small zones are 26.75 map px square,
// big zones are 4 x 4 small zones (107 px), and the grid lines up 290 px and 376 px in from the roof's top left.
import { ROOF_OUTLINE } from './siteLayout'
import { MAP_PX_PER_M, isInside } from './roofShape'

export type ZoneKind = 'big' | 'small'
/** A zone on the roof: its kind and grid position (column, row). */
export type Zone = { kind: ZoneKind; col: number; row: number }

const xs = ROOF_OUTLINE.map((p) => p[0])
const zs = ROOF_OUTLINE.map((p) => p[1])
export const ROOF_BOX = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }

export const SMALL_ZONE_M = 26.75 / MAP_PX_PER_M
export const BIG_ZONE_M = SMALL_ZONE_M * 4
/** Where grid column 0, row 0 starts, in meters. */
export const ZONE_ORIGIN = { x: ROOF_BOX.minX + 290 / MAP_PX_PER_M, z: ROOF_BOX.minZ + 376 / MAP_PX_PER_M }

const sizeOf = (kind: ZoneKind) => (kind === 'big' ? BIG_ZONE_M : SMALL_ZONE_M)

// ---------- Merging edge zones (doc: "A clipped zone smaller than half a full zone is not its own zone. It merges
// into the neighbor it shares the longest edge with, and the grid line between them is removed.") ----------
// A zone is named by its main grid square. A merged zone is that square plus the slivers that joined it.

const key = (col: number, row: number) => `${col},${row}`
type Cell = { col: number; row: number }

/** How much of a grid square is on the roof, 0 to 1. */
function areaOnRoof(kind: ZoneKind, col: number, row: number) {
  const size = sizeOf(kind)
  const x0 = ZONE_ORIGIN.x + col * size
  const z0 = ZONE_ORIGIN.z + row * size
  const steps = 10
  let n = 0
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) if (isInside(ROOF_OUTLINE, x0 + ((i + 0.5) / steps) * size, z0 + ((j + 0.5) / steps) * size)) n++
  return n / (steps * steps)
}

/** How long the edge two side-by-side squares share is, on the roof (0 to 1 of a side). */
function sharedOnRoof(kind: ZoneKind, a: Cell, b: Cell) {
  const size = sizeOf(kind)
  const steps = 12
  let n = 0
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps
    // A point on the shared edge, nudged a hair into each square.
    const ex = b.col !== a.col ? Math.max(a.col, b.col) : a.col + t
    const ez = b.row !== a.row ? Math.max(a.row, b.row) : a.row + t
    const x = ZONE_ORIGIN.x + ex * size
    const z = ZONE_ORIGIN.z + ez * size
    const dx = (b.col - a.col) * 0.01
    const dz = (b.row - a.row) * 0.01
    if (isInside(ROOF_OUTLINE, x - dx, z - dz) && isInside(ROOF_OUTLINE, x + dx, z + dz)) n++
  }
  return n / steps
}

/** For each zone size: which main square every grid square belongs to. */
const hosts: Record<ZoneKind, Map<string, Cell>> = { big: new Map(), small: new Map() }
for (const kind of ['big', 'small'] as ZoneKind[]) {
  const size = sizeOf(kind)
  const c0 = Math.floor((ROOF_BOX.minX - ZONE_ORIGIN.x) / size)
  const c1 = Math.floor((ROOF_BOX.maxX - ZONE_ORIGIN.x) / size)
  const r0 = Math.floor((ROOF_BOX.minZ - ZONE_ORIGIN.z) / size)
  const r1 = Math.floor((ROOF_BOX.maxZ - ZONE_ORIGIN.z) / size)
  const area = new Map<string, number>()
  for (let col = c0; col <= c1; col++) for (let row = r0; row <= r1; row++) area.set(key(col, row), areaOnRoof(kind, col, row))
  const areaOf = (c: Cell) => area.get(key(c.col, c.row)) ?? 0
  const next = new Map<string, Cell>()
  for (let col = c0; col <= c1; col++) {
    for (let row = r0; row <= r1; row++) {
      const a = areaOf({ col, row })
      if (a === 0 || a >= 0.5) continue
      // A sliver: join the neighbor it shares the longest edge with (on the roof). Ties go to the bigger neighbor.
      let best: Cell | null = null
      let bestLen = 0
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { col: col + dc, row: row + dr }
        if (areaOf(n) === 0) continue
        const len = sharedOnRoof(kind, { col, row }, n) + areaOf(n) * 1e-3
        if (len > bestLen) {
          best = n
          bestLen = len
        }
      }
      if (best) next.set(key(col, row), best)
    }
  }
  // Follow the chain (a sliver next to a sliver) to a square that keeps its own zone.
  for (const [k, first] of next) {
    let h = first
    for (let i = 0; i < 6 && next.has(key(h.col, h.row)); i++) h = next.get(key(h.col, h.row))!
    hosts[kind].set(k, h)
  }
}
const hostOf = (kind: ZoneKind, col: number, row: number): Cell => hosts[kind].get(key(col, row)) ?? { col, row }

/** The zone of this kind that holds (x, z). A sliver of roof belongs to the zone it merged into. */
export function zoneAt(kind: ZoneKind, x: number, z: number): Zone {
  const size = sizeOf(kind)
  const h = hostOf(kind, Math.floor((x - ZONE_ORIGIN.x) / size), Math.floor((z - ZONE_ORIGIN.z) / size))
  return { kind, ...h }
}

/** The zone's main square in meters: top-left corner and size. */
export function zoneRect(zone: Zone) {
  const size = sizeOf(zone.kind)
  return { x: ZONE_ORIGIN.x + zone.col * size, z: ZONE_ORIGIN.z + zone.row * size, size }
}

/** Every grid square that makes up the zone: its main square plus any slivers merged into it. */
export function zoneRects(zone: Zone) {
  const rects = [zoneRect(zone)]
  for (const [k, h] of hosts[zone.kind]) {
    if (h.col !== zone.col || h.row !== zone.row) continue
    const [col, row] = k.split(',').map(Number)
    rects.push(zoneRect({ kind: zone.kind, col, row }))
  }
  return rects
}

/** SVG path of the zone's outline (around the merged shape, with no line between its squares). */
export function zoneOutlineD(zone: Zone) {
  const size = sizeOf(zone.kind)
  const own = new Set(zoneRects(zone).map((r) => key(Math.round((r.x - ZONE_ORIGIN.x) / size), Math.round((r.z - ZONE_ORIGIN.z) / size))))
  let d = ''
  for (const k of own) {
    const [col, row] = k.split(',').map(Number)
    const x = ZONE_ORIGIN.x + col * size
    const z = ZONE_ORIGIN.z + row * size
    if (!own.has(key(col - 1, row))) d += `M${x},${z}V${z + size}`
    if (!own.has(key(col + 1, row))) d += `M${x + size},${z}V${z + size}`
    if (!own.has(key(col, row - 1))) d += `M${x},${z}H${x + size}`
    if (!own.has(key(col, row + 1))) d += `M${x},${z + size}H${x + size}`
  }
  return d
}

/** SVG path that fills the whole zone (one square per grid square). */
export const zoneFillD = (zone: Zone) => zoneRects(zone).map((r) => `M${r.x},${r.z}h${r.size}v${r.size}h${-r.size}Z`).join('')

/** The middle of the part of the zone that is on the roof (edge zones are cut off by the roof line). */
export function zoneCenterOnRoof(zone: Zone) {
  let sx = 0
  let sz = 0
  let n = 0
  const steps = 8
  for (const r of zoneRects(zone)) {
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = r.x + ((i + 0.5) / steps) * r.size
        const z = r.z + ((j + 0.5) / steps) * r.size
        if (isInside(ROOF_OUTLINE, x, z)) {
          sx += x
          sz += z
          n++
        }
      }
    }
  }
  const r = zoneRect(zone)
  return n ? { x: sx / n, z: sz / n } : { x: r.x + r.size / 2, z: r.z + r.size / 2 }
}

/** The big zone a spot on the roof sits in. */
export const bigZoneAt = (x: number, z: number) => zoneAt('big', x, z)

/** The big zone a zone sits in (itself, if it's big). Judged from the middle of the zone, so merged slivers count. */
export const bigZoneOf = (zone: Zone): Zone => {
  if (zone.kind === 'big') return zone
  const c = zoneCenterOnRoof(zone)
  return zoneAt('big', c.x, c.z)
}

export const sameZone = (a: Zone | null, b: Zone | null) => !!a && !!b && a.kind === b.kind && a.col === b.col && a.row === b.row

/** Grid lines covering the roof, for one zone size. A line between a zone and a sliver merged into it is left out. */
export function gridLines(kind: ZoneKind) {
  const size = sizeOf(kind)
  const lines: { x1: number; z1: number; x2: number; z2: number }[] = []
  const c0 = Math.floor((ROOF_BOX.minX - ZONE_ORIGIN.x) / size) - 1
  const c1 = Math.floor((ROOF_BOX.maxX - ZONE_ORIGIN.x) / size) + 1
  const r0 = Math.floor((ROOF_BOX.minZ - ZONE_ORIGIN.z) / size) - 1
  const r1 = Math.floor((ROOF_BOX.maxZ - ZONE_ORIGIN.z) / size) + 1
  const same = (a: Cell, b: Cell) => {
    const ha = hostOf(kind, a.col, a.row)
    const hb = hostOf(kind, b.col, b.row)
    return ha.col === hb.col && ha.row === hb.row
  }
  // Vertical lines: the left edge of each column, in runs where the squares on either side are different zones.
  for (let col = c0 + 1; col <= c1; col++) {
    const x = ZONE_ORIGIN.x + col * size
    let runStart: number | null = null
    for (let row = r0; row <= r1 + 1; row++) {
      const show = row <= r1 && !same({ col: col - 1, row }, { col, row })
      if (show && runStart === null) runStart = row
      if (!show && runStart !== null) {
        lines.push({ x1: x, z1: ZONE_ORIGIN.z + runStart * size, x2: x, z2: ZONE_ORIGIN.z + row * size })
        runStart = null
      }
    }
  }
  // Horizontal lines: the top edge of each row.
  for (let row = r0 + 1; row <= r1; row++) {
    const z = ZONE_ORIGIN.z + row * size
    let runStart: number | null = null
    for (let col = c0; col <= c1 + 1; col++) {
      const show = col <= c1 && !same({ col, row: row - 1 }, { col, row })
      if (show && runStart === null) runStart = col
      if (!show && runStart !== null) {
        lines.push({ x1: ZONE_ORIGIN.x + runStart * size, z1: z, x2: ZONE_ORIGIN.x + col * size, z2: z })
        runStart = null
      }
    }
  }
  return lines
}
