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

/** The zone of this kind that holds (x, z). */
export function zoneAt(kind: ZoneKind, x: number, z: number): Zone {
  const size = sizeOf(kind)
  return { kind, col: Math.floor((x - ZONE_ORIGIN.x) / size), row: Math.floor((z - ZONE_ORIGIN.z) / size) }
}

/** The zone's square in meters: top-left corner and size. */
export function zoneRect(zone: Zone) {
  const size = sizeOf(zone.kind)
  return { x: ZONE_ORIGIN.x + zone.col * size, z: ZONE_ORIGIN.z + zone.row * size, size }
}

/** The middle of the part of the zone that is on the roof (edge zones are cut off by the roof line). */
export function zoneCenterOnRoof(zone: Zone) {
  const r = zoneRect(zone)
  let sx = 0
  let sz = 0
  let n = 0
  const steps = 8
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
  return n ? { x: sx / n, z: sz / n } : { x: r.x + r.size / 2, z: r.z + r.size / 2 }
}

/** The big zone a zone sits in (itself, if it's big). */
export const bigZoneOf = (zone: Zone): Zone =>
  zone.kind === 'big' ? zone : { kind: 'big', col: Math.floor(zone.col / 4), row: Math.floor(zone.row / 4) }

export const sameZone = (a: Zone | null, b: Zone | null) => !!a && !!b && a.kind === b.kind && a.col === b.col && a.row === b.row

/** Grid lines covering the roof, for one zone size. */
export function gridLines(kind: ZoneKind) {
  const size = sizeOf(kind)
  const lines: { x1: number; z1: number; x2: number; z2: number }[] = []
  const first = (min: number, origin: number) => origin + Math.ceil((min - origin) / size) * size
  for (let x = first(ROOF_BOX.minX, ZONE_ORIGIN.x); x < ROOF_BOX.maxX; x += size)
    lines.push({ x1: x, z1: ROOF_BOX.minZ, x2: x, z2: ROOF_BOX.maxZ })
  for (let z = first(ROOF_BOX.minZ, ZONE_ORIGIN.z); z < ROOF_BOX.maxZ; z += size)
    lines.push({ x1: ROOF_BOX.minX, z1: z, x2: ROOF_BOX.maxX, z2: z })
  return lines
}
