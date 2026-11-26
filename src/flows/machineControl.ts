// Moving the boom in Operate mode. The operator moves the cab in straight lines and the machine works out
// how to turn the turret, tip the two booms and telescope (doc: "Operate mode: WASD moves the cab forward,
// backward and side to side. Up and down arrows move the cab up and down").
//   W / S: cab forward / back (the way the forks point)   A / D: cab left / right   ↑ / ↓: cab up / down
// Rules (placeholders until the industrial designer confirms):
//   - The cab first lifts straight up off the deck before it can move forward or sideways, and comes back
//     over the deck before it can settle down onto it.
//   - The cab can rest on the roof but not go into it or the walls.
//   - Limits: turret 90° each way (+5° slack), telescope 5.5 m, reach 6 m, cab floor up to 7 m.
import { useSim, type Spot } from '../store'
import { isHeld } from '../keys'
import {
  MACHINE_SCALE, FOLDED, FOLDED_TIP, TURRET, HINGE_BACK, LOWER_BOOM, UPPER_BOOM, CAB_HALF, LIMITS, JIB_SWING_HEIGHT, cabFromTip,
  type MachinePose,
} from '../scene/machineSpec'
import { groundHeight, houseHeightAt } from '../scene/siteLayout'
import { zoneAt, sameZone } from '../scene/zones'
import { cabSpeed } from './alerts'
import { lmiFrac, DEPLOY_FRAC, LIMIT_FRAC } from './lmi'
import { lmiAtLimit } from './lmiAlerts'
import { askDeploy, movementLocked } from './outriggers'

type Vec = { x: number; y: number; z: number }

/** How fast the cab moves, in real meters per second (placeholder). */
const CAB_SPEED = 0.8
const EPS = 0.02

/**
 * Inverse kinematics: the pose that puts the boom tip at `tip` (model units), or null if the machine can't.
 * The booms bend at the knuckle like an elbow pointing up; the upper boom telescopes only when the two booms
 * together aren't long enough.
 */
export function solvePose(tip: Vec, prevYaw: number): MachinePose | null {
  const dx = tip.x - TURRET.x
  const dy = tip.y - TURRET.y
  const dz = tip.z - TURRET.z
  const r = Math.hypot(dx, dz)
  // The boom points along (-sin yaw, -cos yaw) on the ground.
  const turretYaw = r > 0.2 ? Math.atan2(-dx, -dz) : prevYaw
  // The lower boom hinges behind the turning point (at the back of the housing), in line with the boom.
  const rh = r + HINGE_BACK
  const d = Math.hypot(rh, dy)
  const reach = LOWER_BOOM + UPPER_BOOM
  let lower: number
  let upper: number
  let extend = 0
  if (d >= reach) {
    lower = upper = Math.atan2(dy, rh)
    extend = d - reach
  } else {
    const c = (LOWER_BOOM ** 2 + d ** 2 - UPPER_BOOM ** 2) / (2 * LOWER_BOOM * d)
    lower = Math.atan2(dy, rh) + Math.acos(Math.max(-1, Math.min(1, c)))
    upper = Math.atan2(dy - LOWER_BOOM * Math.sin(lower), rh - LOWER_BOOM * Math.cos(lower))
  }
  // The jib swings the cab out in front of the tip as it lifts off the deck.
  const jib = Math.max(0, Math.min(1, (tip.y - FOLDED_TIP.y) / JIB_SWING_HEIGHT))
  const pose = { turretYaw, lowerPitch: lower, upperPitch: upper - lower, extend, jib }
  const ok =
    Math.abs(pose.turretYaw) <= LIMITS.turret + 1e-6 &&
    pose.lowerPitch >= LIMITS.lowerMin - 1e-6 &&
    pose.lowerPitch <= LIMITS.lowerMax &&
    pose.upperPitch >= LIMITS.upperRelMin &&
    pose.upperPitch <= LIMITS.upperRelMax &&
    pose.extend <= LIMITS.extendMax &&
    r <= LIMITS.reachMax
  return ok ? pose : null
}

/** The cab floor's middle for a boom tip and turret angle, in model units. */
export function cabCenter(tip: Vec, pose: MachinePose): Vec {
  const o = cabFromTip(pose.jib)
  const c = Math.cos(pose.turretYaw)
  const s = Math.sin(pose.turretYaw)
  return { x: tip.x + o.x * c + o.z * s, y: tip.y + o.y, z: tip.z - o.x * s + o.z * c }
}

/** A model point → the world, for a truck at `truck` facing `heading`. */
export function toWorld(p: Vec, truck: Spot, heading: number) {
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  const x = p.x * MACHINE_SCALE
  const z = p.z * MACHINE_SCALE
  return { x: truck.x + x * c + z * s, y: groundHeight(truck.x, truck.z) + p.y * MACHINE_SCALE, z: truck.z - x * s + z * c }
}

/** Where the cab floor is in the world right now (middle point). */
export function cabWorld() {
  const { machineTip, machinePose, truck, truckHeading } = useSim.getState()
  return toWorld(cabCenter(machineTip, machinePose), truck, truckHeading)
}

// Folded only when the cab is really down on the deck. (Folding and lowering land on FOLDED_TIP exactly, so this can be
// tight. A loose check snapped the cab back down every frame on fast screens, where each frame lifts it less than 2 cm.)
const FOLD_EPS = 1e-3
const isFolded = (tip: Vec) =>
  Math.abs(tip.x - FOLDED_TIP.x) < FOLD_EPS && Math.abs(tip.y - FOLDED_TIP.y) < FOLD_EPS && Math.abs(tip.z - FOLDED_TIP.z) < FOLD_EPS
const overDeck = (tip: Vec) => Math.abs(tip.x - FOLDED_TIP.x) < EPS && Math.abs(tip.z - FOLDED_TIP.z) < EPS

/** How far the cab floor (middle or any corner) is below the roof surface, in meters. 0 = clear of the house. */
function roofDepth(tip: Vec, pose: MachinePose, truck: Spot, heading: number) {
  const center = cabCenter(tip, pose)
  const c = Math.cos(pose.turretYaw)
  const s = Math.sin(pose.turretYaw)
  let depth = 0
  for (const [ax, az] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = ax * CAB_HALF.x
    const lz = az * CAB_HALF.z
    const p = toWorld({ x: center.x + lx * c + lz * s, y: center.y, z: center.z - lx * s + lz * c }, truck, heading)
    depth = Math.max(depth, houseHeightAt(p.x, p.z) - p.y)
  }
  return depth
}

/** Why the cab can't be at this tip position (null = it can). Checks the deck rule, the height limit, and the house. */
function blockedReason(tip: Vec, pose: MachinePose, truck: Spot, heading: number, depthNow: number): string | null {
  if (tip.y < FOLDED_TIP.y - EPS) return 'The cab is down on the deck.'
  // Low down, the cab can only move straight up and down over the deck.
  if (tip.y < FOLDED_TIP.y + LIMITS.liftFirst && !overDeck(tip)) return 'Raise the cab off the deck first.'
  const center = cabCenter(tip, pose)
  if (toWorld(center, truck, heading).y - groundHeight(truck.x, truck.z) > LIMITS.cabFloorMax) return 'The cab is at its highest.'
  // The cab can't go into the roof or the walls. If it starts out tucked under the roof overhang (the truck parked
  // tight to the house), it may still move out of it, just not further in.
  if (roofDepth(tip, pose, truck, heading) > Math.max(0.01, depthNow + 1e-4)) return 'The roof is in the way.'
  return null
}

export function setTip(tip: Vec, pose: MachinePose) {
  const s = useSim.getState()
  const folded = isFolded(tip)
  useSim.setState({ machineTip: folded ? { ...FOLDED_TIP } : tip, machinePose: folded ? FOLDED : pose, machineRaised: !folded })
  // The green cab zone follows the real cab when it's over the roof.
  if (!folded) {
    const cab = cabWorld()
    const onRoof = houseHeightAt(cab.x, cab.z) > 0
    // Only store a new spot when the cab crosses into another small zone, so the map doesn't redraw every frame.
    const prev = s.cabSpot
    if (!onRoof) {
      if (prev) s.setCabSpot(null)
    } else if (!prev || !sameZone(zoneAt('small', cab.x, cab.z), zoneAt('small', prev.x, prev.z))) {
      s.setCabSpot({ x: cab.x, z: cab.z })
    }
  }
}

/** Try to move the tip by (dx, dy, dz) model units, one direction at a time so it slides along limits. */
function tryMove(dx: number, dy: number, dz: number) {
  const { machineTip: tip, machinePose: pose, truck, truckHeading, outriggers } = useSim.getState()
  const down = outriggers.state === 'down'
  let cur = tip
  let curPose = pose
  let reason: string | null = null
  for (const step of [{ x: dx, y: 0, z: 0 }, { x: 0, y: dy, z: 0 }, { x: 0, y: 0, z: dz }]) {
    if (!step.x && !step.y && !step.z) continue
    const next = { x: cur.x + step.x, y: cur.y + step.y, z: cur.z + step.z }
    // Coming down near the deck: line up over it, so the cab can settle back down.
    if (next.y < FOLDED_TIP.y + LIMITS.liftFirst && Math.abs(next.x - FOLDED_TIP.x) < 0.3 && Math.abs(next.z - FOLDED_TIP.z) < 0.3) {
      next.x = FOLDED_TIP.x
      next.z = FOLDED_TIP.z
    }
    if (next.y < FOLDED_TIP.y) next.y = FOLDED_TIP.y
    const p = solvePose(next, curPose.turretYaw)
    const why = p ? blockedReason(next, p, truck, truckHeading, roofDepth(cur, curPose, truck, truckHeading)) : 'The boom can\'t reach any further.'
    if (why) reason = why
    if (p && !why) {
      // Reaching past the set point with the outriggers up: the machine stops and asks for them (moving back in is fine).
      if (!down) {
        const after = lmiFrac(next, p, false)
        if (after > DEPLOY_FRAC && after > lmiFrac(cur, curPose, false)) {
          askDeploy()
          continue
        }
      }
      // Past the limit (the 6th light): the machine stops and the LMI at limit flow starts.
      const afterNow = lmiFrac(next, p, down)
      if (afterNow > LIMIT_FRAC && afterNow > lmiFrac(cur, curPose, down)) {
        lmiAtLimit()
        continue
      }
      cur = next
      curPose = p
    }
  }
  if (cur !== tip) setTip(cur, curPose)
  // Nothing moved: say why, so the boom never looks frozen.
  else if (reason) useSim.getState().showBlocked(reason)
}

/** Move the tip straight toward a target point (used to fold the machine on its own). Returns true on arrival. */
export function moveToward(target: Vec, dist: number) {
  const { machineTip: tip, machinePose: pose } = useSim.getState()
  const d = { x: target.x - tip.x, y: target.y - tip.y, z: target.z - tip.z }
  const len = Math.hypot(d.x, d.y, d.z)
  if (len <= dist) {
    const p = solvePose(target, pose.turretYaw)
    if (p) setTip({ ...target }, p)
    return true
  }
  const next = { x: tip.x + (d.x / len) * dist, y: tip.y + (d.y / len) * dist, z: tip.z + (d.z / len) * dist }
  const p = solvePose(next, pose.turretYaw)
  if (p) setTip(next, p)
  return false
}

/** Fold the machine a step: back over the deck at a safe height, then down onto it. Returns true once folded. */
export function foldStep(dt: number): boolean {
  const { machineRaised, machineTip: tip } = useSim.getState()
  if (!machineRaised) return true
  const dist = (cabSpeed(CAB_SPEED) / MACHINE_SCALE) * dt
  const safeY = Math.max(tip.y, FOLDED_TIP.y + LIMITS.liftFirst + 0.1)
  if (!overDeck(tip)) {
    moveToward({ x: FOLDED_TIP.x, y: safeY, z: FOLDED_TIP.z }, dist)
    return false
  }
  return moveToward({ ...FOLDED_TIP }, dist) && !useSim.getState().machineRaised
}

/** Called every frame: Operate mode keys move the cab. */
export function tickMachine(dt: number) {
  const s = useSim.getState()
  if (s.mode !== 'operate' || (s.pick.phase !== 'idle' && s.pick.phase !== 'tapped')) return
  if (movementLocked()) return
  // Ascend or Retract is moving the boom.
  if (s.lift.flow !== 'none' && !['tooFar', 'canceled', 'done'].includes(s.lift.phase)) return
  const step = (cabSpeed(CAB_SPEED) / MACHINE_SCALE) * Math.min(dt, 0.1)
  // In the machine's own directions: forward is -z, right is +x.
  const fwd = (isHeld('w') ? 1 : 0) - (isHeld('s') ? 1 : 0)
  const side = (isHeld('d') ? 1 : 0) - (isHeld('a') ? 1 : 0)
  const up = (isHeld('arrowup') ? 1 : 0) - (isHeld('arrowdown') ? 1 : 0)
  if (fwd || side || up) tryMove(side * step, up * step, -fwd * step)
}
