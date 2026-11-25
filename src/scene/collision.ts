// Keeps the truck and the operator from driving or walking through things.
// Everything is checked as a flat footprint on the ground (seen from above).
// The truck turns, so its footprint is a row of circles along its length that turns with it.
import { WALL_OUTLINE, OBSTACLES } from './siteLayout'
import { MACHINE, MACHINE_SCALE } from './machineSpec'
import { isInside, edgeDistance } from './roofShape'
import { useSim, type Spot } from '../store'

export type Circle = { x: number; z: number; r: number }
type Box = { minX: number; maxX: number; minZ: number; maxZ: number }

// Truck footprint (see machineSpec.ts): circles from the back bumper to the fork tips (forks point to local -z).
// Measured at the renders' size, then scaled down with the model.
const TRUCK_CIRCLES = [
  { along: 2.45, r: 1.2 }, // back of the body
  { along: 0.65, r: 1.2 }, // front of the body
  { along: -1.15, r: 1.2 }, // cab
  { along: -2.9, r: 0.75 }, // forks (narrower)
].map((c) => ({ along: c.along * MACHINE_SCALE, r: c.r * MACHINE_SCALE }))
const TRUCK_HALF_WIDTH = MACHINE.width / 2


/** Turns a point given in the truck's own directions (right, back) into a spot on the ground. */
export function truckLocalToWorld(t: Spot, heading: number, right: number, back: number): Spot {
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  return { x: t.x + right * c + back * s, z: t.z - right * s + back * c }
}

export function truckCircles(t: Spot, heading: number): Circle[] {
  return TRUCK_CIRCLES.map(({ along, r }) => ({ ...truckLocalToWorld(t, heading, 0, along), r }))
}

export const OPERATOR_RADIUS = 0.3
export const operatorCircle = (o: Spot): Circle => ({ x: o.x, z: o.z, r: OPERATOR_RADIUS })

const PALLET_HALF = { x: 0.6, z: 0.5 }
// The loads on the ground right now (not the one on the forks, and not ones set down on the roof).
const loadBoxes = (): Box[] =>
  useSim
    .getState()
    .loadSpots.filter((l) => l.y < 1)
    .map((l) => {
      // A box around the pallet, whichever way it was set down.
      const r = Math.hypot(PALLET_HALF.x, PALLET_HALF.z) * 0.85
      return { minX: l.x - r, maxX: l.x + r, minZ: l.z - r, maxZ: l.z + r }
    })

/** Shortest distance from a box to a point (0 if the point is inside). */
function boxDistance(b: Box, x: number, z: number) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX)
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ)
  return Math.hypot(dx, dz)
}

const circleHitsBox = (c: Circle, b: Box) => boxDistance(b, c.x, c.z) < c.r
const circlesTouch = (a: Circle, b: Circle) => Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r
// The house walls (the roof overhang is high enough to drive under).
const circleHitsWalls = (c: Circle) => isInside(WALL_OUTLINE, c.x, c.z) || edgeDistance(WALL_OUTLINE, c.x, c.z) < c.r

/** True if any of these circles would hit the house, a bush, a post, a load or the `others` circles. */
export function isBlocked(circles: Circle[], others: Circle[] = []): boolean {
  return circles.some(
    (c) =>
      circleHitsWalls(c) ||
      loadBoxes().some((b) => circleHitsBox(c, b)) ||
      // Bushes are a bit soft at the edge, so use 85% of their size.
      OBSTACLES.some((o) => circlesTouch(c, { x: o.x, z: o.z, r: o.radius * (o.kind === 'bush' ? 0.85 : 1) })) ||
      others.some((o) => circlesTouch(c, o)),
  )
}

/**
 * Move from `from` by (dx, dz), sliding along whatever is in the way instead of stopping dead.
 * Tries the full move, then each direction on its own.
 */
export function slideMove(from: Spot, dx: number, dz: number, blocked: (s: Spot) => boolean): Spot {
  const both = { x: from.x + dx, z: from.z + dz }
  if (!blocked(both)) return both
  const onlyX = { x: from.x + dx, z: from.z }
  if (dx !== 0 && !blocked(onlyX)) return onlyX
  const onlyZ = { x: from.x, z: from.z + dz }
  if (dz !== 0 && !blocked(onlyZ)) return onlyZ
  return from
}

/** How close the operator has to be to the truck to get in. */
export const GET_IN_DISTANCE = 1.5

export function canGetIn(operator: Spot, truck: Spot, heading: number) {
  return truckCircles(truck, heading).some(
    (c) => Math.hypot(c.x - operator.x, c.z - operator.z) - c.r <= GET_IN_DISTANCE,
  )
}

/** Where the operator stands after getting out: beside the cab, on the first side that's clear. */
export function getOutSpot(truck: Spot, heading: number): Spot {
  const side = TRUCK_HALF_WIDTH + 0.9 // room to stand clear of the truck
  const options = [
    truckLocalToWorld(truck, heading, -side, -1.05 * MACHINE_SCALE), // left of the cab
    truckLocalToWorld(truck, heading, side, -1.05 * MACHINE_SCALE), // right of the cab
    truckLocalToWorld(truck, heading, 0, MACHINE.length / 2 + 0.9), // behind
  ]
  const truckBody = truckCircles(truck, heading)
  return options.find((s) => !isBlocked([operatorCircle(s)], truckBody)) ?? options[0]
}

/** How far each bush and post is from the truck's footprint, in meters (0 = touching), and which side it's on. */
export function obstacleGaps(truck: Spot, heading: number) {
  const body = truckCircles(truck, heading)
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  return OBSTACLES.map((o) => {
    let gap = Infinity
    for (const b of body) gap = Math.min(gap, Math.hypot(o.x - b.x, o.z - b.z) - b.r - o.radius)
    // Where it is in the truck's own directions: right (+) / left (-), back (+) / front (-).
    const dx = o.x - truck.x
    const dz = o.z - truck.z
    const right = dx * c - dz * s
    const back = dx * s + dz * c
    const side = Math.abs(right) >= Math.abs(back) ? (right > 0 ? 'right' : 'left') : back > 0 ? 'back' : 'front'
    return { o, gap: Math.max(0, gap), side: side as 'left' | 'right' | 'front' | 'back' }
  })
}
