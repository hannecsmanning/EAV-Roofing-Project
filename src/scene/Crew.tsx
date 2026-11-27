// The crew (Hanne): two roofers working on the roof and a foreman walking the ground, so the site feels alive and
// the machine has moving people to work around.
//   Roofers: each works one part of the roof. Walk to a spot, kneel and hammer for a few seconds, then move on.
//     They stay clear of the roof edge, the chimney and the vents, and step away when the cab comes close.
//   Foreman: walks a slow loop around the house on the ground, stopping at the corners to look up at the roof.
//     He steps aside when the truck comes close.
// The foreman counts as an obstacle for the truck (object detection: heat glow, "Object detected.", creep speed, and the
// truck can't drive through him). People on the HMI map (a person marker, their own wording) wait for Figma screens.
// Talking (Hanne): walking on the roof close to a roofer, a chip says "Press space to talk". Space: the roofer stops,
// stands, turns to face the operator, and a speech bubble says "meow" for 30 seconds.
import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim, type Spot } from '../store'
import { ROOF_OUTLINE, ROOF_ITEMS, OBSTACLES, MATERIAL_SPOT, groundHeight, houseHeightAt, type Obstacle } from './siteLayout'
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
  /** Seconds left talking to the operator. */
  talk: number
  /** Working up on the roof (roofers) or walking the ground (the foreman and the ground roofers). */
  onRoof: boolean
}

const TALK_REACH_M = 3 // how close the operator has to be to talk
const TALK_S = 30 // how long the speech bubble stays

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

// Ground roofers wander their own part of the yard: away from the house (and the wire next to it), the bushes and
// posts, and the material spot.
const goodGroundSpot = (x: number, z: number) =>
  !isInside(ROOF_OUTLINE, x, z) &&
  edgeDistance(ROOF_OUTLINE, x, z) > 5 &&
  OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + 1.5) &&
  !(Math.abs(x - MATERIAL_SPOT.x) < 6 && Math.abs(z - MATERIAL_SPOT.z) < 8)
function nextGroundSpot(p: Person): Spot {
  const a = p.area!
  for (let i = 0; i < 40; i++) {
    const s = { x: a.x0 + p.rand() * (a.x1 - a.x0), z: a.z0 + p.rand() * (a.z1 - a.z0) }
    if (Math.hypot(s.x - p.at.x, s.z - p.at.z) > 4 && goodGroundSpot(s.x, s.z)) return s
  }
  return p.at
}

function makeCrew(): Person[] {
  const blank = (): WalkState => ({ stride: 0, moving: 0, kneel: 0, hammer: 0, lookUp: 0 })
  const roofer = (x: number, z: number, area: Person['area'], seed: number, wait: number): Person => ({
    look: 'roofer', at: { x, z }, facing: 0, target: { x, z }, wait, working: true, walk: blank(), area, rand: seeded(seed), talk: 0, onRoof: true,
  })
  const groundRoofer = (x: number, z: number, area: Person['area'], seed: number): Person => ({
    look: 'roofer', at: { x, z }, facing: 0, target: { x, z }, wait: 1, working: false, walk: blank(), area, rand: seeded(seed), talk: 0, onRoof: false,
  })
  return [
    // On the roof: the west part, the east part and the back section.
    roofer(-10, -22, { x0: -17, x1: -3, z0: -30, z1: -15 }, 31, 2),
    roofer(8, -22, { x0: 3, x1: 18, z0: -31, z1: -13 }, 47, 4),
    roofer(0, -33, { x0: -8, x1: 8, z0: -35.5, z1: -30.5 }, 71, 3),
    // On the ground: the foreman's loop, and two roofers in the east yard and the west-back yard.
    { look: 'foreman', at: { ...FOREMAN_ROUTE[0] }, facing: 0, target: { ...FOREMAN_ROUTE[1] }, wait: 0, working: false, walk: blank(), route: FOREMAN_ROUTE, leg: 1, rand: seeded(59), talk: 0, onRoof: false },
    groundRoofer(32, -20, { x0: 27, x1: 42, z0: -42, z1: 2 }, 83),
    groundRoofer(-38, -38, { x0: -46, x1: -24, z0: -48, z1: -30 }, 97),
  ]
}
const crew = makeCrew()

/** Everyone on the ground as obstacles for the truck (object detection and collision), each like a post a person wide. */
export function crewObstacles(): Obstacle[] {
  return crew
    .filter((p) => !p.onRoof)
    .map((p, i) => ({ id: `crew-ground-${i}`, kind: 'post' as const, x: p.at.x, z: p.at.z, radius: 0.35, height: 1.6 }))
}

/** The roofer the operator is close enough to talk to (walking on the roof), or -1. */
// Who the operator can talk to, on the same level: the roofers when on the roof, the foreman on the ground.
function talkableRoofer() {
  const s = useSim.getState()
  if (s.mode !== 'walking') return -1
  let best = -1
  let bestD = TALK_REACH_M
  crew.forEach((p, i) => {
    if (p.onRoof !== s.operatorOnRoof) return
    const d = Math.hypot(p.at.x - s.operator.x, p.at.z - s.operator.z)
    if (d <= bestD) {
      best = i
      bestD = d
    }
  })
  return best
}

/** Space: talk to the crew member close by. They stop (a roofer stands up), face the operator, and say "meow" for 30 seconds. */
export function talkToRoofer() {
  const i = talkableRoofer()
  if (i < 0) return
  const p = crew[i]
  p.talk = TALK_S
  p.working = false
  p.walk.hammer = 0
  useSim.setState({ talking: i })
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
  // Talking: stand up, face the operator and stay put until the bubble goes away.
  if (p.talk > 0) {
    p.talk -= dt
    p.walk.hammer = 0
    p.walk.kneel = Math.max(0, (p.walk.kneel ?? 0) - dt * 3)
    const o = s.operator
    turnToward(p, Math.atan2(o.x - p.at.x, o.z - p.at.z), dt)
    if (p.talk <= 0) {
      p.wait = 0
      p.target = nextRoofSpot(p)
      if (useSim.getState().talking === crew.indexOf(p)) useSim.setState({ talking: null })
    }
    return
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
  // Talking: stop and face the operator until the bubble goes away (the truck still makes him step aside, below).
  const talkingNow = p.talk > 0
  if (talkingNow) {
    p.talk -= dt
    if (p.talk <= 0 && useSim.getState().talking === crew.indexOf(p)) useSim.setState({ talking: null })
  }
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
  if (talkingNow && !crowded) {
    p.walk.lookUp = Math.max(0, (p.walk.lookUp ?? 0) - dt * 2)
    turnToward(p, Math.atan2(s.operator.x - p.at.x, s.operator.z - p.at.z), dt)
    return
  }
  // At a corner: stop and look up at the roof for a moment (unless the truck is coming close).
  if (p.wait > 0 && !crowded) {
    p.wait -= dt
    // The foreman looks up at the roof; a ground roofer just stands for a moment.
    if (p.look === 'foreman') p.walk.lookUp = Math.min(1, (p.walk.lookUp ?? 0) + dt * 2)
    return
  }
  p.walk.lookUp = Math.max(0, (p.walk.lookUp ?? 0) - dt * 2)
  // The foreman walks his loop; a ground roofer picks spots in their part of the yard.
  const route = p.route
  const target = route ? route[p.leg!] : p.target
  // Head for the next corner, but steer around the truck: the closer it is, the more he moves away from it and
  // around it (so he never walks into a parked truck, and steps aside from one driving at him).
  let dx = target.x - p.at.x
  let dz = target.z - p.at.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.05 && !crowded) {
    if (route) p.leg = (p.leg! + 1) % route.length
    else p.target = nextGroundSpot(p)
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
    const y = p.onRoof ? houseHeightAt(p.at.x, p.at.z) : groundHeight(p.at.x, p.at.z)
    g.position.set(p.at.x, y, p.at.z)
    g.rotation.y = p.facing
  })
  const talking = useSim((s) => s.talking !== null && crew[s.talking] === p)
  return (
    <group ref={ref}>
      <OperatorFigure walk={walk} look={p.look} />
      {talking && (
        <Html position={[0, 2.05, 0]} center distanceFactor={10} zIndexRange={[0, 0]}>
          <div className="speech-bubble">meow</div>
        </Html>
      )}
    </group>
  )
}

export function Crew() {
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    for (const p of crew) (p.onRoof ? tickRoofer : tickForeman)(p, step)
    // The "Press space to talk" chip: only update the store when it changes.
    const can = talkableRoofer() >= 0
    if (can !== useSim.getState().canTalk) useSim.setState({ canTalk: can })
  })
  return (
    <>
      {crew.map((p, i) => (
        <CrewFigure key={i} p={p} />
      ))}
    </>
  )
}
