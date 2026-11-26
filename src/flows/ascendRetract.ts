// Ascend to the ledge (9) and Retract the machine (0). docs/CONTEXT.md "Ascend and descend",
// Figma "Ascend to Ledge Flow" and "Retract Machine Flow".
//
// Ascend: pressing the button is the confirmation. If the truck isn't right next to the ledge: Warning toast
//   "Drive closer to the ledge." with the distance on the map. Otherwise: "Push the joystick forward." Holding the
//   joystick (W) raises the cab straight up beside the ledge, to the ledge height the machine senses. Letting go stops
//   it and asks to cancel; canceling sends the cab back down. At the ledge: "At the ledge." and Operate mode.
//   On the wire, the truck stays connected while ascending (Hanne, 2026-11-26).
// Retract: same rules. The boom folds, then the cab lowers, while the joystick is held. Letting go asks to cancel;
//   canceling stops right there with full manual control. Done: "Successfully retracted." and Drive mode.
//   With the outriggers down, step 3 asks for the outrigger switch (Figma "Retract Machine Flow" 4-6).
import { useSim, type LiftPhase, type LiftFlow, type LiftWarning } from '../store'
import { isHeld, releaseJoystickFirst } from '../keys'
import { MACHINE, MACHINE_SCALE, FOLDED_TIP, TURRET, CAB_HALF, cabFromTip } from '../scene/machineSpec'
import {
  ROOF_OUTLINE, HOUSE, OBSTACLES, LOADS, MAX_TILT_DEG, MAX_LOAD_LB, groundHeight, groundTiltDeg, houseHeightAt,
} from '../scene/siteLayout'
import { nearestEdge } from '../scene/roofShape'
import { solvePose, moveToward, foldStep, cabWorld, cabCenter } from './machineControl'
import { cabSpeed } from './alerts'
import { askRetract, movementLocked } from './outriggers'
import joystick from '../assets/hmi/toast-joystick.svg'

const TOAST = 'lift'
const CAB_SPEED = 0.8 // real meters per second (same as manual control)
/** How far the truck's side can be from the ledge for the cab to rise to it (placeholder, about 4 ft). */
const LEDGE_REACH_M = 1.2
const DONE_MS = 4000
const TOO_FAR_MS = 6000

const M = 3.28084 // feet per meter
export const toFeet = (m: number) => Math.round(m * M)

/** The ledge height the machine senses (the roof edge), in meters. */
export const LEDGE_HEIGHT_M = HOUSE.wallHeight

/** How high the cab floor is above the ground right now, in meters. */
export function cabHeight() {
  const { truck } = useSim.getState()
  return Math.max(0, cabWorld().y - groundHeight(truck.x, truck.z))
}

/** The nearest stretch of roof edge, and where it is from the truck (in the truck's own directions). */
export function ledgeFromTruck() {
  const { truck, truckHeading } = useSim.getState()
  const edge = nearestEdge(ROOF_OUTLINE, truck.x, truck.z)
  const dx = edge.point[0] - truck.x
  const dz = edge.point[1] - truck.z
  const c = Math.cos(truckHeading)
  const s = Math.sin(truckHeading)
  const right = dx * c - dz * s
  const back = dx * s + dz * c
  const beside = Math.abs(back) <= MACHINE.length / 2
  // Gap from the truck's side to the ledge (or from its nearest corner, when the ledge isn't beside it).
  const gap = beside ? Math.abs(right) - MACHINE.width / 2 : Math.max(0, edge.dist - MACHINE.width / 2)
  return { edge, right, back, beside, gap: Math.max(0, gap) }
}

let target: { x: number; y: number; z: number } | null = null // ascend: where the boom tip ends up (model units)
let stage = 0 // ascend: 0 = rising straight up over the deck, 1 = moving beside the ledge
let timer: ReturnType<typeof setTimeout> | undefined

const set = (flow: LiftFlow, phase: LiftPhase, warn: LiftWarning = null) => useSim.getState().setLift({ flow, phase, warn })
const toast = (t: Parameters<ReturnType<typeof useSim.getState>['showToast']>[0]) => useSim.getState().showToast({ id: TOAST, ...t })
const clearToast = () => useSim.getState().clearToast(TOAST)
/** Close the flow after a short while (the panel and toast stay up long enough to read). */
function endLater(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    set('none', 'ready')
    clearToast()
  }, ms)
}

/** Work out where the boom tip goes so the cab rises beside the ledge, side on, floor level with the ledge. */
function ascendTarget(): { x: number; y: number; z: number } | null {
  const { right } = ledgeFromTruck()
  const side = Math.sign(right) || 1
  const cabRight = side * (Math.abs(right) - CAB_HALF.x * MACHINE_SCALE - 0.2) // leave about 8 in to the ledge
  const floorY = LEDGE_HEIGHT_M / MACHINE_SCALE + 0.02 // cab floor level with the ledge
  const jibOut = cabFromTip(1)
  for (const z of [-2.4, -2.8, -3.2, -2.0, -3.6]) {
    const cab = { x: cabRight / MACHINE_SCALE, z }
    // The boom points from the turret toward the cab; the cab hangs in front of the tip along that line.
    const yaw = Math.atan2(-(cab.x - TURRET.x), -(cab.z - TURRET.z))
    const tip = { x: cab.x + Math.sin(yaw) * -jibOut.z, y: floorY - jibOut.y, z: cab.z + Math.cos(yaw) * -jibOut.z }
    if (solvePose(tip, yaw)) return tip
  }
  return null
}

// ---------- What's around the cab (the machine senses objects above and under it) ----------

/** The cab floor's middle and four corners, in the world. */
function cabFootprint() {
  const { machineTip, machinePose, truck, truckHeading } = useSim.getState()
  const center = cabCenter(machineTip, machinePose)
  const cy = Math.cos(machinePose.turretYaw)
  const sy = Math.sin(machinePose.turretYaw)
  const ch = Math.cos(truckHeading)
  const sh = Math.sin(truckHeading)
  return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([ax, az]) => {
    // Corner in the machine's units → the world.
    const mx = center.x + ax * CAB_HALF.x * cy + az * CAB_HALF.z * sy
    const mz = center.z - ax * CAB_HALF.x * sy + az * CAB_HALF.z * cy
    return { x: truck.x + (mx * ch + mz * sh) * MACHINE_SCALE, z: truck.z + (-mx * sh + mz * ch) * MACHINE_SCALE }
  })
}

const CAB_TOP_M = 2.65 * MACHINE_SCALE // cab roof above its floor
/** How much room is above the cab roof before it hits something (the roof overhang), in meters. */
function roomAbove() {
  const floor = cabWorld().y
  let room = Infinity
  for (const p of cabFootprint()) {
    const h = houseHeightAt(p.x, p.z)
    if (h > floor) room = Math.min(room, h - (floor + CAB_TOP_M))
  }
  return room
}

/** How much room is under the cab floor before it touches something (a bush, post, or load), in meters. */
function roomBelow() {
  const floor = cabWorld().y
  const pts = cabFootprint()
  const xs = pts.map((p) => p.x)
  const zs = pts.map((p) => p.z)
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
  const under = (x: number, z: number, r: number) => x + r > box.minX && x - r < box.maxX && z + r > box.minZ && z - r < box.maxZ
  let room = Infinity
  for (const o of OBSTACLES) if (under(o.x, o.z, o.radius)) room = Math.min(room, floor - (groundHeight(o.x, o.z) + o.height))
  for (const p of useSim.getState().loadSpots) {
    const l = LOADS.find((x) => x.id === p.id)!
    if (under(p.x, p.z, 0.6)) room = Math.min(room, floor - (p.y + 0.15 + l.bundles * 0.18))
  }
  return room
}

/** When to warn (stop and ask), and when the cab can't move any further. */
const WARN_ROOM_M = 0.5
const CONTACT_M = 0.03
let warnedAbove = false
let warnedBelow = false

// ---------- Buttons ----------

/** The physical "bring to ledge" button (9). */
export function pressAscend() {
  const s = useSim.getState()
  if (s.mode === 'walking' || s.lift.flow !== 'none') return
  if (movementLocked()) return s.showBlocked('Movement is locked.')
  if (s.machineRaised) {
    s.showBlocked('The cab is already up.')
    return
  }
  const ledge = ledgeFromTruck()
  if (!ledge.beside || ledge.gap > LEDGE_REACH_M) {
    set('ascend', 'tooFar')
    toast({ type: 'Warning', title: 'Drive closer to the ledge.', message: 'The cab can only rise to the ledge when the truck is right next to it.' })
    endLater(TOO_FAR_MS)
    return
  }
  target = ascendTarget()
  if (!target) {
    s.showBlocked('The cab can\'t reach the ledge from here.')
    return
  }
  stage = 0
  warnedAbove = false
  clearTimeout(timer)
  // Ascend warns instead of blocking: uneven ground or an overweight load, and the operator can still continue.
  if (Math.round(groundTiltDeg(s.truck.x, s.truck.z)) >= MAX_TILT_DEG) {
    set('ascend', 'ready', 'uneven')
    toast({ type: 'Warning', title: 'Ground is uneven.', message: 'Rising here is less stable. Push the joystick to continue.', picture: joystick })
  } else if (s.loadLb > MAX_LOAD_LB) {
    set('ascend', 'ready', 'overweight')
    toast({ type: 'Warning', title: 'Load is over the limit.', message: 'It is less stable up high. Push the joystick to continue.', picture: joystick })
  } else {
    set('ascend', 'ready')
    toast({ type: 'Step', title: 'Push the joystick forward.', message: `The cab will rise ${toFeet(LEDGE_HEIGHT_M)} ft to the ledge.`, picture: joystick })
  }
}

/** The physical "retract machine" button (0). */
export function pressRetract() {
  const s = useSim.getState()
  if (s.mode === 'walking' || (s.lift.flow !== 'none' && s.lift.phase !== 'canceled')) return
  if (movementLocked()) return s.showBlocked('Movement is locked.')
  const legsDown = s.outriggers.state === 'down'
  if (!s.machineRaised && !legsDown) {
    s.showBlocked('The machine is already retracted.')
    return
  }
  warnedBelow = false
  clearTimeout(timer)
  // Only the outriggers are left: go straight to step 3.
  if (!s.machineRaised) {
    set('retract', 'outriggers')
    askRetract('lift')
    return
  }
  set('retract', 'ready')
  toast({
    type: 'Step',
    title: 'Push the joystick forward.',
    message: legsDown
      ? 'The boom will fold and the cab will lower. Then you will flip the outrigger switch.'
      : 'The boom will fold and the cab will lower.',
    picture: joystick,
  })
}

/** Cancel, from the "Machine stopped." toast. */
function cancel() {
  const { lift } = useSim.getState()
  if (lift.phase !== 'stopped') return
  if (lift.flow === 'ascend') {
    set('ascend', 'canceling')
    toast({ type: 'Loading', title: 'Going back down...' })
  } else {
    set('retract', 'canceled')
    toast({ type: 'Step', title: 'Retract canceled.', message: 'The machine stopped here. You have full control of the joysticks.' })
    endLater(DONE_MS)
  }
}

// ---------- Every frame ----------

/** True while Ascend or Retract is driving the boom, so the manual controls stay out of the way. */
export const liftIsDriving = (phase: LiftPhase, flow: LiftFlow) => flow !== 'none' && phase !== 'tooFar' && phase !== 'canceled' && phase !== 'done'

export function tickLift(dt: number) {
  const s = useSim.getState()
  const { flow, phase } = s.lift
  if (flow === 'none') return
  const held = s.mode !== 'walking' && isHeld('w')
  const step = (cabSpeed(CAB_SPEED) / MACHINE_SCALE) * Math.min(dt, 0.1)

  // The ascend warning clears once the truck is close enough.
  if (flow === 'ascend' && phase === 'tooFar') {
    const l = ledgeFromTruck()
    if (l.beside && l.gap <= LEDGE_REACH_M) {
      clearTimeout(timer)
      set('none', 'ready')
      clearToast()
    }
    return
  }

  if (phase === 'canceling') {
    if (foldStep(Math.min(dt, 0.1))) {
      set('none', 'ready')
      clearToast()
    }
    return
  }

  // Retract step 3: waiting for the outrigger switch and the legs to fold up.
  if (phase === 'outriggers') {
    if (s.outriggers.state === 'up') finishRetract()
    return
  }

  if (phase === 'ready' || phase === 'stopped') {
    if (!held) return
    set(flow, 'moving')
    toast({ type: 'Loading', title: movingTitle(flow), picture: joystick })
    return
  }

  if (phase !== 'moving') return
  if (!held) {
    set(flow, 'stopped')
    toast({
      type: 'Action',
      title: 'Machine stopped.',
      message: flow === 'ascend' ? 'Push the joystick to keep rising, or cancel to go back down.' : 'Push the joystick to keep retracting, or cancel to take full control.',
      action: { label: 'Cancel', onPress: cancel },
    })
    return
  }

  if (flow === 'ascend' && target) {
    // Something above the cab (like the roof overhang): stop and ask once, then the operator can keep rising
    // until the cab would touch it.
    const room = roomAbove()
    if (room < WARN_ROOM_M && !warnedAbove) {
      warnedAbove = true
      set('ascend', 'stopped', 'above')
      toast({
        type: 'Action',
        title: 'Object above the cab.',
        message: 'The cab stopped. Push the joystick to keep rising, or cancel to go back down.',
        action: { label: 'Cancel', onPress: cancel },
      })
      return
    }
    if (room <= CONTACT_M) return
    // First straight up over the deck to the ledge height, then over beside the ledge.
    if (stage === 0 && moveToward({ x: FOLDED_TIP.x, y: target.y, z: FOLDED_TIP.z }, step)) stage = 1
    if (stage === 1 && moveToward(target, step)) {
      set('ascend', 'done')
      releaseJoystickFirst()
      s.setMode('operate')
      toast({ type: 'Success', title: 'At the ledge.', message: 'Switching to Operate mode.' })
      endLater(DONE_MS)
    }
    return
  }

  if (flow === 'retract') {
    // Lowering the cab: stop for anything under it (retract keeps going for high LMI, load or uneven ground).
    if (retractStep() === 2) {
      const room = roomBelow()
      if (room < WARN_ROOM_M && !warnedBelow) {
        warnedBelow = true
        set('retract', 'stopped', 'below')
        toast({
          type: 'Action',
          title: 'Something is under the cab.',
          message: 'Retract stopped. Clear the area and push the joystick, or cancel to take full control.',
          action: { label: 'Cancel', onPress: cancel },
        })
        return
      }
      if (room <= CONTACT_M) return
    }
    const before = retractStep()
    if (foldStep(Math.min(dt, 0.1))) {
      // Step 3: the outriggers come up last, so the machine stays steady the longest.
      if (s.outriggers.state === 'down') {
        set('retract', 'outriggers')
        askRetract('lift')
      } else finishRetract()
    } else if (retractStep() !== before) {
      // Step 1 (folding the boom) → step 2 (lowering the cab): the toast follows.
      toast({ type: 'Loading', title: movingTitle('retract'), picture: joystick })
    }
  }
}

function finishRetract() {
  set('retract', 'done')
  // Done: a joystick still held from the move does nothing until it's let go (Hanne).
  releaseJoystickFirst()
  useSim.getState().setMode('drive')
  toast({ type: 'Success', title: 'Successfully retracted.', message: 'Switching to Drive mode.' })
  endLater(DONE_MS)
}

/** The Loading toast while the joystick is held. */
function movingTitle(flow: LiftFlow) {
  if (flow === 'ascend') return 'Rising to the ledge...'
  return retractStep() === 1 ? 'Folding the boom...' : 'Lowering the cab...'
}

/** For the cab height panel: which retract step the boom is on. */
export function retractStep(): 1 | 2 {
  const tip = useSim.getState().machineTip
  const overDeck = Math.abs(tip.x - FOLDED_TIP.x) < 0.02 && Math.abs(tip.z - FOLDED_TIP.z) < 0.02
  return overDeck ? 2 : 1
}
