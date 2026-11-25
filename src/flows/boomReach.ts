// Moving the boom by itself so the cab sits in a picked zone (Pick a spot: "Rising to the ledge...",
// "Configuring machine to new placement..."). docs/CONTEXT.md "Pick a spot and the wire".
// The cab ends up resting on the roof, in the middle of the zone, facing out along the boom.
// The path: up to travel height first, across at that height, then down onto the roof, so it never cuts through
// the roof. It obeys the same limits as moving the boom by hand, including the outriggers and LMI.
import { useSim, type Spot } from '../store'
import { MACHINE_SCALE, TURRET, FOLDED_TIP, CAB_HALF, LIMITS, cabFromTip } from '../scene/machineSpec'
import { groundHeight, houseHeightAt } from '../scene/siteLayout'
import { zoneCenterOnRoof, type Zone } from '../scene/zones'
import { solvePose, setTip } from './machineControl'
import { lmiFrac, DEPLOY_FRAC, LIMIT_FRAC } from './lmi'
import { askDeploy } from './outriggers'
import { lmiAtLimit } from './lmiAlerts'

type Vec = { x: number; y: number; z: number }

const ABOVE_ROOF = 0.4 // model units of clearance while travelling over the roof

/** World point → the machine's own (model) coordinates, for a truck at `truck` facing `heading`. */
function toModel(x: number, z: number, truck: Spot, heading: number) {
  const dx = x - truck.x
  const dz = z - truck.z
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  return { x: (dx * c - dz * s) / MACHINE_SCALE, z: (dx * s + dz * c) / MACHINE_SCALE }
}

/**
 * Where the boom tip has to be for the cab to rest in the middle of `zone`, with the truck at `truck` facing
 * `heading`. Null if the boom can't get it there (too far, too high, or past the turret's swing).
 */
export function boomTarget(zone: Zone, truck: Spot, heading: number): Vec | null {
  const c = zoneCenterOnRoof(zone)
  const cab = toModel(c.x, c.z, truck, heading)
  // The boom points from the turret toward the cab; the cab hangs in front of the tip along that line.
  const yaw = Math.atan2(-(cab.x - TURRET.x), -(cab.z - TURRET.z))
  const out = cabFromTip(1)
  // Rest the cab floor on the highest bit of roof under it.
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const hc = Math.cos(heading)
  const hs = Math.sin(heading)
  let roof = 0
  for (const [ax, az] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mx = cab.x + ax * CAB_HALF.x * cy + az * CAB_HALF.z * sy
    const mz = cab.z - ax * CAB_HALF.x * sy + az * CAB_HALF.z * cy
    const wx = truck.x + (mx * hc + mz * hs) * MACHINE_SCALE
    const wz = truck.z + (-mx * hs + mz * hc) * MACHINE_SCALE
    roof = Math.max(roof, houseHeightAt(wx, wz))
  }
  const floorM = roof + 0.05 - groundHeight(truck.x, truck.z) // cab floor above the truck's ground, meters
  if (floorM > LIMITS.cabFloorMax) return null
  const floorY = floorM / MACHINE_SCALE
  const tip = { x: cab.x + sy * -out.z, y: floorY - out.y, z: cab.z + cy * -out.z }
  if (!solvePose(tip, yaw)) return null
  // Check the whole path can be travelled (the boom can't always reach the points in between).
  const travel = Math.min(floorY - out.y + ABOVE_ROOF, LIMITS.cabFloorMax / MACHINE_SCALE - out.y)
  for (let k = 0; k <= 1; k += 0.1) {
    const p = { x: FOLDED_TIP.x + (tip.x - FOLDED_TIP.x) * k, y: travel, z: FOLDED_TIP.z + (tip.z - FOLDED_TIP.z) * k }
    if (!solvePose(p, yaw)) return null
  }
  return tip
}

/** How high the cab travels on its way to the zone (set when the move starts). */
let travelY = 0
export function startBoomMove(target: Vec) {
  const { machineTip } = useSim.getState()
  const out = cabFromTip(1)
  travelY = Math.max(
    machineTip.y,
    Math.min(target.y + ABOVE_ROOF, LIMITS.cabFloorMax / MACHINE_SCALE - out.y),
    FOLDED_TIP.y + LIMITS.liftFirst + 0.1,
  )
}

/**
 * One step of the boom toward `target` (model units, `dist` long). Returns 'done' on arrival, 'moving', or
 * 'stopped' when the outriggers or LMI stopped it (their own flow takes over, then the move carries on).
 */
export function boomStep(target: Vec, dist: number): 'done' | 'moving' | 'stopped' {
  const s = useSim.getState()
  const tip = s.machineTip
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3
  const overTarget = near(tip.x, target.x) && near(tip.z, target.z)
  // Up first (straight up over the deck when folded), then across, then down onto the roof.
  const way: Vec = !overTarget && tip.y < travelY - 1e-3
    ? { x: tip.x, y: travelY, z: tip.z }
    : !overTarget
      ? { x: target.x, y: travelY, z: target.z }
      : target
  const d = { x: way.x - tip.x, y: way.y - tip.y, z: way.z - tip.z }
  const len = Math.hypot(d.x, d.y, d.z)
  const k = len <= dist ? 1 : dist / len
  const next = { x: tip.x + d.x * k, y: tip.y + d.y * k, z: tip.z + d.z * k }
  const pose = solvePose(next, s.machinePose.turretYaw)
  if (!pose) return 'done' // can't go any further: stop where it is
  // Same rules as moving the boom by hand.
  const down = s.outriggers.state === 'down'
  if (!down && lmiFrac(next, pose, false) > DEPLOY_FRAC && lmiFrac(next, pose, false) > lmiFrac(tip, s.machinePose, false)) {
    askDeploy()
    return 'stopped'
  }
  if (lmiFrac(next, pose, down) > LIMIT_FRAC && lmiFrac(next, pose, down) > lmiFrac(tip, s.machinePose, down)) {
    lmiAtLimit()
    return 'stopped'
  }
  setTip(next, pose)
  return way === target && k === 1 ? 'done' : 'moving'
}
