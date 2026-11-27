// The job site layout, in meters. One place for every position and weight,
// so later steps (heat map, tilt and overweight alerts) read the same numbers the 3D world draws.
// x = right, z = toward the camera at the start, y = up.

import { roofOutline, insetOutline, wireLoop, isInside, squareDistance, type Pt } from './roofShape'

// Placeholder limits until the industrial designer confirms (CLAUDE.md).
export const MAX_LOAD_LB = 1000
export const MAX_TILT_DEG = 9

// ---------- House ----------
// The footprint comes from the roof edge in Figma (see roofShape.ts). About 44 m x 34 m (144 ft x 113 ft).
export const HOUSE = {
  center: [0, -20] as [number, number], // x, z of the middle of the roof
  wallHeight: 6, // meters to the roof edge (about 19.5 ft)
  overhang: 0.5, // the roof ledge sticks out this far past the walls
  pitchDeg: 25, // hip roof: every side slopes up at this angle
}

/** The roof ledge (the roof edge seen from above), corner by corner. */
export const ROOF_OUTLINE: Pt[] = roofOutline(HOUSE.center[0], HOUSE.center[1])
/** The outside of the walls, corner by corner. */
export const WALL_OUTLINE: Pt[] = insetOutline(ROOF_OUTLINE, HOUSE.overhang)

// ---------- Wire ----------
// Runs a set distance outside the roof ledge, parallel to it everywhere, with rounded corners.
export const WIRE_OFFSET = 1.5

let wireCache: Pt[] | undefined
/** Points along the wire on the ground (x, z), about every 0.25 m, as a closed loop. */
export function wirePath(): Pt[] {
  wireCache ??= wireLoop(ROOF_OUTLINE, WIRE_OFFSET, 0.25)
  return wireCache
}

// ---------- Steep slope ----------
// The ground drops away to the east, starting right at the house's east wall.
// The back part of the wire's east side runs down it, steeper than the max tilt,
// so the truck can't follow the wire there.
export const SLOPE = {
  startX: Math.max(...WALL_OUTLINE.map((p) => p[0])), // the east wall: the ground starts dropping here
  grade: Math.tan((22 * Math.PI) / 180), // 22°, steeper than MAX_TILT_DEG
  maxDrop: 4, // meters, then it levels off at the bottom
  zFrom: -33.5, // the bank fades in and out along z
  zTo: -24.5,
  fade: 2, // meters to blend into flat ground at each z end
}

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Ground height in meters at (x, z). Flat everywhere except the slope. */
export function groundHeight(x: number, z: number): number {
  const run = x - SLOPE.startX
  if (run <= 0) return 0
  const drop = Math.min(SLOPE.maxDrop, run * SLOPE.grade)
  const along = smoothstep(SLOPE.zFrom - SLOPE.fade, SLOPE.zFrom, z) * (1 - smoothstep(SLOPE.zTo, SLOPE.zTo + SLOPE.fade, z))
  return -drop * along
}

/** How steep the ground is at (x, z), in degrees. Looks at the ground about a meter around the spot. */
export function groundTiltDeg(x: number, z: number): number {
  const d = 1
  const dx = (groundHeight(x + d, z) - groundHeight(x - d, z)) / (2 * d)
  const dz = (groundHeight(x, z + d) - groundHeight(x, z - d)) / (2 * d)
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI
}

// ---------- Obstacles ----------
// Bushes are lumpy clusters, posts are small and round, like the heat map reference in Figma.
export type Obstacle = { id: string; kind: 'bush' | 'post'; x: number; z: number; radius: number; height: number }

export const OBSTACLES: Obstacle[] = [
  // Along the front of the house, just outside the wire
  { id: 'bush-front-1', kind: 'bush', x: -13.3, z: -4, radius: 1.0, height: 1.3 },
  { id: 'bush-front-2', kind: 'bush', x: 13.3, z: -1.3, radius: 0.9, height: 1.1 },
  // West side, behind the material branch
  { id: 'bush-west-1', kind: 'bush', x: -30, z: -22.5, radius: 1.2, height: 1.6 }, // clear of the material branch
  { id: 'bush-west-2', kind: 'bush', x: -26, z: -26.3, radius: 1.0, height: 1.3 },
  // Back of the house
  { id: 'bush-back-1', kind: 'bush', x: -1.6, z: -41.6, radius: 1.1, height: 1.4 },
  // Out in the yard
  { id: 'bush-yard-1', kind: 'bush', x: 29.7, z: 9.7, radius: 1.4, height: 1.8 },
  // Posts: a mailbox, a lamp post, a fence post
  { id: 'post-mailbox', kind: 'post', x: 10.9, z: 12.9, radius: 0.12, height: 1.1 },
  { id: 'post-lamp', kind: 'post', x: -15.2, z: -3.1, radius: 0.1, height: 2.2 },
  { id: 'post-fence', kind: 'post', x: 26.2, z: -1.2, radius: 0.12, height: 1.2 },
]

// ---------- Material spot ----------
// Where the loads wait. One is normal, one is over MAX_LOAD_LB to trigger the Overweight load flow.
// ---------- Material run (Figma "Material Run Flow") ----------
// The material spot sits left of the house, joined to the house wire by a short straight branch. The truck rides
// the branch out to it, forks first, and stops with the forks just short of the normal load. The overweight load
// is beside it. (Set beforehand in other software, doc "Material run".)
// Where the branch leaves the wire: the wire point nearest this spot, on the house's left side.
const BRANCH_TOWARD = { x: -40, z: -11 }
const BRANCH_DIR = { x: -1, z: 0 } // straight out to the left
export const BRANCH_LENGTH = 9 // meters, junction to where the truck's middle stops
const FORKS_AHEAD = 2.54 // meters from the truck's middle to the middle of its forks (folded)

function branchJunction(): Pt {
  const w = wirePath()
  let best: Pt = w[0]
  let bestD = Infinity
  for (const p of w) {
    const d = Math.hypot(p[0] - BRANCH_TOWARD.x, p[1] - BRANCH_TOWARD.z)
    if (d < bestD) [best, bestD] = [p, d]
  }
  return best
}
const J = branchJunction()
/** The wire branch to the materials: from the junction on the house wire to where the truck stops. */
export const BRANCH = {
  start: { x: J[0], z: J[1] },
  end: { x: J[0] + BRANCH_DIR.x * BRANCH_LENGTH, z: J[1] + BRANCH_DIR.z * BRANCH_LENGTH },
  dir: BRANCH_DIR,
  length: BRANCH_LENGTH,
  // Facing out along the branch (the truck faces (-sin h, -cos h)).
  heading: Math.atan2(-BRANCH_DIR.x, -BRANCH_DIR.z),
}
const loadX = BRANCH.end.x + BRANCH_DIR.x * (FORKS_AHEAD + 1)
const loadZ = BRANCH.end.z + BRANCH_DIR.z * (FORKS_AHEAD + 1)
/** The gravel pad the loads sit on, and the map pin. */
export const MATERIAL_SPOT = { x: loadX, z: loadZ - 1.4, width: 3, depth: 6 }
/** Where the Material spot pin sits on the map: at the end of the branch, on the normal load. */
export const MATERIAL_PIN = { x: loadX, z: loadZ }

export type Load = { id: string; label: string; weightLb: number; x: number; z: number; bundles: number }

export const LOADS: Load[] = [
  { id: 'load-normal', label: 'Normal load', weightLb: 800, x: loadX, z: loadZ, bundles: 4 },
  { id: 'load-overweight', label: 'Overweight load', weightLb: 1400, x: loadX, z: loadZ - 2.8, bundles: 7 },
]

export const TRUCK_START: [number, number, number] = [-6, 0, 9]

/** The roof surface at (x, z), ignoring what sits on it. */
function roofSurface(x: number, z: number) {
  return HOUSE.wallHeight + squareDistance(ROOF_OUTLINE, x, z) * Math.tan((HOUSE.pitchDeg * Math.PI) / 180)
}

// ---------- Things on the roof (Hanne): a chimney and two vents. The cab and the operator have to go around them. ----------
// Like the chimney and round vents in the Figma roof render. Placed well inside the roof, away from the edges where
// the cab usually lands. Each is a square footprint (half = half its width) standing `height` above the roof.
export type RoofItem = { id: string; kind: 'chimney' | 'vent'; x: number; z: number; half: number; height: number }
export const ROOF_ITEMS: RoofItem[] = [
  { id: 'chimney', kind: 'chimney', x: 12, z: -28, half: 0.6, height: 1.6 },
  { id: 'vent-1', kind: 'vent', x: -8, z: -26, half: 0.25, height: 0.45 },
  { id: 'vent-2', kind: 'vent', x: 3, z: -15, half: 0.25, height: 0.45 },
]
/** The roof item at (x, z), counting `margin` meters around it, or null. */
export function roofItemAt(x: number, z: number, margin = 0): RoofItem | null {
  return ROOF_ITEMS.find((i) => Math.abs(x - i.x) <= i.half + margin && Math.abs(z - i.z) <= i.half + margin) ?? null
}
/** The top of a roof item (its base is the roof under its middle). */
export const roofItemTop = (i: RoofItem) => roofSurface(i.x, i.z) + i.height

/** How high the house is at (x, z), in meters: the roof surface (or a chimney or vent on it) over the roof, 0 elsewhere. */
export function houseHeightAt(x: number, z: number): number {
  if (!isInside(ROOF_OUTLINE, x, z)) return 0
  const r = roofSurface(x, z)
  const item = roofItemAt(x, z)
  return item ? Math.max(r, roofItemTop(item)) : r
}
