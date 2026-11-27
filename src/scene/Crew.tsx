// The crew (Hanne): two roofers working on the roof and a foreman walking the ground, so the site feels alive and
// the machine has moving people to work around.
//   Roofers: each works one part of the roof. Walk to a spot, kneel and hammer for a few seconds, then move on.
//     They stay clear of the roof edge, the chimney and the vents, and step away when the cab comes close.
//   Foreman: walks a slow loop around the house on the ground, stopping at the corners to look up at the roof.
//     He steps aside when the truck comes close.
// The foreman counts as an obstacle for the truck (object detection: heat glow, "Object detected.", creep speed, and the
// truck can't drive through him). People on the HMI map (a person marker, their own wording) wait for Figma screens.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim, type Spot } from '../store'
import { ROOF_OUTLINE, ROOF_ITEMS, groundHeight, houseHeightAt, type Obstacle } from './siteLayout'
import { isInside, edgeDistance } from './roofShape'
import { truckCircles } from './collision'
import { cabWorld } from '../flows/machineControl'
import { OperatorFigure, type WalkState, type FigureLook } from './OperatorFigure'
import { seeded } from './look'

const WALK = 1.1 // m/s, an easy walking pace
const STEP_ASIDE = 1.6 // m/s, a quicker step out of the way
const CAB_CLEAR_M = 3.5 // roofers keep this far from the cab
const TRUCK_CLEAR_M = 4 // the foreman keeps this far from the truck's body

type Person = {
  look: FigureLook
  at: Spot
  facing: number
  target: Spot
  /** Seconds left at the current spot (working, or looking up). */
  wait: number
  working: boolean
  walk: WalkState
  /** Roofers: the part of the roof they work. Foreman: his loop of corners. */
  area?: { x0: number; x1: number; z0: number; z1: number }
  route?: Spot[]
  leg?: number
  rand: () => number
}

// ---------- Where they go ----------
/** Clear of the roof edge, the chimney and the vents. */
const goodRoofSpot = (x: number, z: number) =>
  isInside(ROOF_OUTLINE, x, z) && edgeDistance(ROOF_OUTLINE, x, z) > 1.5 && ROOF_ITEMS.every((i) => Math.hypot(x - i.x, z - i.z) > i.half + 1.2)
/** The straight walk between two roof spots stays on good roof. */
const goodRoofPath = (a: Spot, b: Spot) => {
  for (let t = 0.1; t < 1; t += 0.1) if (!goodRoofSpot(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false
  return true
}
function nextRoofSpot(p: Person): Spot {
  const a = p.area!
  for (let i = 0; i < 40; i++) {
    const s = { x: a.x0 + p.rand() * (a.x1 - a.x0), z: a.z0 + p.rand() * (a.z1 - a.z0) }
    if (Math.hypot(s.x - p.at.x, s.z - p.at.z) > 2 && goodRoofSpot(s.x, s.z) && goodRoofPath(p.at, s)) return s
  }
  return p.at
}

// The foreman's loop: well outside the wire, around the house, away from the bushes and the material spot.
const FOREMAN_ROUTE: Spot[] = [
  { x: -36, z: 16 },
  { x: 32, z: 16 },
  { x: 32, z: -45 },
  { x: -36, z: -45 },
]

function makeCrew(): Person[] {
  const blank = (): WalkState => ({ stride: 0, moving: 0, kneel: 0, hammer: 0, lookUp: 0 })
  return [
    { look: 'roofer', at: { x: -10, z: -22 }, facing: 0, target: { x: -10, z: -22 }, wait: 2, working: true, walk: blank(), area: { x0: -17, x1: -3, z0: -30, z1: -15 }, rand: seeded(31) },
    { look: 'roofer', at: { x: 8, z: -22 }, facing: 2, target: { x: 8, z: -22 }, wait: 4, working: true, walk: blank(), area: { x0: 3, x1: 18, z0: -31, z1: -13 }, rand: seeded(47) },
    { look: 'foreman', at: { ...FOREMAN_ROUTE[0] }, facing: 0, target: { ...FOREMAN_ROUTE[1] }, wait: 0, working: false, walk: blank(), route: FOREMAN_ROUTE, leg: 1, rand: seeded(59) },
  ]
}
const crew = makeCrew()

/** The foreman as an obstacle for the truck (object detection and collision), like a post he's about as wide as. */
export function crewObstacles(): Obstacle[] {
  const f = crew.find((p) => p.look === 'foreman')!
  return [{ id: 'crew-foreman', kind: 'post', x: f.at.x, z: f.at.z, radius: 0.35, height: 1.6 }]
}

/** Turn smoothly toward a heading. */
function turnToward(p: Person, want: number, dt: number) {
  const d = Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing))
  p.facing += d * (1 - Math.exp(-10 * dt))
}

/** Move toward `to` at `speed`; true once there. */
function walkTo(p: Person, to: Spot, speed: number, dt: number) {
  const dx = to.x - p.at.x
  const dz = to.z - p.at.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return true
  const step = Math.min(d, speed * dt)
  p.at = { x: p.at.x + (dx / d) * step, z: p.at.z + (dz / d) * step }
  turnToward(p, Math.atan2(dx, dz), dt)
  p.walk.moving = Math.min(1, speed / WALK)
  p.walk.stride += dt * 9 * p.walk.moving
  return false
}

/** Step away from a point that's too close (`clear` meters), sliding along if the way out is blocked. True if stepping. */
function stepAside(p: Person, from: Spot, clear: number, ok: (s: Spot) => boolean, dt: number) {
  const dx = p.at.x - from.x
  const dz = p.at.z - from.z
  const d = Math.hypot(dx, dz)
  if (d >= clear) return false
  const ux = d > 0.01 ? dx / d : 1
  const uz = d > 0.01 ? dz / d : 0
  // Straight away first, then off to either side.
  for (const [ax, az] of [[ux, uz], [-uz, ux], [uz, -ux]]) {
    const next = { x: p.at.x + ax * STEP_ASIDE * dt, z: p.at.z + az * STEP_ASIDE * dt }
    if (ok(next)) {
      p.at = next
      turnToward(p, Math.atan2(ax, az), dt)
      p.walk.moving = 1
      p.walk.stride += dt * 11
      p.working = false
      p.walk.kneel = 0
      p.walk.hammer = 0
      return true
    }
  }
  return true
}

function tickRoofer(p: Person, dt: number) {
  const s = useSim.getState()
  p.walk.moving = 0
  // The cab over the roof and close: step away from it, then pick somewhere else to work.
  if (s.machineRaised) {
    const c = cabWorld()
    if (houseHeightAt(c.x, c.z) > 0 && stepAside(p, c, CAB_CLEAR_M, (q) => goodRoofSpot(q.x, q.z), dt)) {
      p.target = p.at
      p.wait = 0.5
      return
    }
  }
  if (p.working || p.wait > 0) {
    p.wait -= dt
    p.walk.kneel = Math.min(1, (p.walk.kneel ?? 0) + dt * 3)
    p.walk.hammer = (p.walk.hammer ?? 0) + dt * 9
    if (p.wait <= 0) {
      p.working = false
      p.target = nextRoofSpot(p)
    }
    return
  }
  // Getting up, then walking to the next spot.
  p.walk.hammer = 0
  p.walk.kneel = Math.max(0, (p.walk.kneel ?? 0) - dt * 3)
  if ((p.walk.kneel ?? 0) > 0) return
  if (walkTo(p, p.target, WALK, dt)) {
    p.working = true
    p.wait = 4 + p.rand() * 4
  }
}

function tickForeman(p: Person, dt: number) {
  const s = useSim.getState()
  p.walk.moving = 0
  // How close the truck's body is.
  const body = truckCircles(s.truck, s.truckHeading)
  let near = body[0]
  let gap = Infinity
  for (const b of body) {
    const g = Math.hypot(b.x - p.at.x, b.z - p.at.z) - b.r
    if (g < gap) {
      gap = g
      near = b
    }
  }
  const crowded = gap < TRUCK_CLEAR_M
  // At a corner: stop and look up at the roof for a moment (unless the truck is coming close).
  if (p.wait > 0 && !crowded) {
    p.wait -= dt
    p.walk.lookUp = Math.min(1, (p.walk.lookUp ?? 0) + dt * 2)
    return
  }
  p.walk.lookUp = Math.max(0, (p.walk.lookUp ?? 0) - dt * 2)
  const route = p.route!
  const target = route[p.leg!]
  // Head for the next corner, but steer around the truck: the closer it is, the more he moves away from it and
  // around it (so he never walks into a parked truck, and steps aside from one driving at him).
  let dx = target.x - p.at.x
  let dz = target.z - p.at.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.05 && !crowded) {
    p.leg = (p.leg! + 1) % route.length
    p.wait = 3 + p.rand() * 2
    return
  }
  dx /= dist || 1
  dz /= dist || 1
  let speed = WALK * 0.8
  if (crowded) {
    const w = 1 - Math.max(0, gap) / TRUCK_CLEAR_M
    const ad = Math.hypot(p.at.x - near.x, p.at.z - near.z) || 1
    const ax = (p.at.x - near.x) / ad
    const az = (p.at.z - near.z) / ad
    // Around: the sideways direction closest to where he wants to go.
    const side = -az * dx + ax * dz >= 0 ? 1 : -1
    dx = dx * (1 - w) + ax * w * 1.5 + -az * side * w
    dz = dz * (1 - w) + az * w * 1.5 + ax * side * w
    const l = Math.hypot(dx, dz) || 1
    dx /= l
    dz /= l
    speed = STEP_ASIDE
  }
  const step = Math.min(speed * dt, crowded ? speed * dt : dist)
  p.at = { x: p.at.x + dx * step, z: p.at.z + dz * step }
  turnToward(p, Math.atan2(dx, dz), dt)
  p.walk.moving = Math.min(1, speed / WALK)
  p.walk.stride += dt * 9 * p.walk.moving
}

/** One crew member: moves its figure to where the person is each frame. */
function CrewFigure({ p }: { p: Person }) {
  const ref = useRef<THREE.Group>(null)
  const walk = useRef(p.walk)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    walk.current = p.walk
    const y = p.look === 'foreman' ? groundHeight(p.at.x, p.at.z) : houseHeightAt(p.at.x, p.at.z)
    g.position.set(p.at.x, y, p.at.z)
    g.rotation.y = p.facing
  })
  return (
    <group ref={ref}>
      <OperatorFigure walk={walk} look={p.look} />
    </group>
  )
}

export function Crew() {
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    for (const p of crew) (p.look === 'foreman' ? tickForeman : tickRoofer)(p, step)
  })
  return (
    <>
      {crew.map((p, i) => (
        <CrewFigure key={i} p={p} />
      ))}
    </>
  )
}
