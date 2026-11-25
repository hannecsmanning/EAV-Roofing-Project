// Pick a spot, on the wire. docs/CONTEXT.md "Pick a spot and the wire" + "Pick a spot screens",
// Figma "'Pick a spot' Feature - Wire ON".
//   1 · Tap a zone on the Operate map (big zones on the zone map and middle zoom, small zones zoomed in).
//       It shows as Selected zone, Tapped, with the green destination dot on the wire. Action toast: Allow?
//   2 · Allow: the zone turns Confirming (solid teal). + and − lock and the map zooms to the route.
//       Loading toast "Push the joystick forward to move." (hold W).
//   3 · Machine descending (only if the machine is raised and has to fold: big zones, or a small zone in another big zone).
//   4 · Driving along the wire while the joystick is held.
//   5 · Arrived: the cab zone moves to the picked zone. Success toast "Done configuring."
// Not built yet (they need a moving boom): unfolding and telescoping the boom into the zone.
import { useSim, NO_PICK, type PickState } from '../store'
import { isHeld } from '../keys'
import { ROOF_OUTLINE } from '../scene/siteLayout'
import { isInside, edgeDistance } from '../scene/roofShape'
import { nearestOnWire, bestRoute, routeLength, poseOnWire } from '../scene/wireTrack'
import { zoneAt, zoneCenterOnRoof, bigZoneOf, sameZone, type ZoneKind } from '../scene/zones'
import { foldStep } from './machineControl'
import { restrictions } from './alerts'
import joystick from '../assets/hmi/toast-joystick.svg'
import { askRetract, movementLocked } from './outriggers'
import { cancelRun, runIsMoving } from './materialRun'
import { boomTarget, startBoomMove, boomStep } from './boomReach'
import { cabSpeed } from './alerts'
import { MACHINE_SCALE } from '../scene/machineSpec'

const TOAST = 'pick-a-spot'
/** How fast the machine drives itself along the wire, m/s (placeholder, about 6.5 mph). */
const PICK_SPEED = 3
/** How fast the cab moves when the boom moves itself, real m/s (the same as by hand). */
const BOOM_SPEED = 0.8
const CREEP_SPEED = 0.5
const PICK_ACCEL = 2
const PICK_BRAKE = 5
const DONE_TOAST_MS = 4000

let speed = 0 // m/s along the route
let lastTick = 0 // when the last frame ran (ms), so timing follows the real clock

const clearOwnToast = () => {
  if (useSim.getState().toast?.id === TOAST) useSim.getState().clearToast()
}

/** Which zones can be picked at each Operate zoom level. */
export const zoneKindForZoom = (zoom: 1 | 2 | 3): ZoneKind => (zoom === 3 ? 'small' : 'big')

/** A tap on the Operate map at world point (x, z). */
export function tapMap(x: number, z: number, zoom: 1 | 2 | 3) {
  if (movementLocked()) return
  const s = useSim.getState()
  if (runIsMoving(s.run.phase)) return
  if (s.pick.phase !== 'idle' && s.pick.phase !== 'tapped') return
  if (!isInside(ROOF_OUTLINE, x, z)) return
  const onWire = s.wire === 'connected'

  // Off the wire, the zone map can't send the machine anywhere: only the boom moves, to small zones (zoomed in).
  if (!onWire && zoom !== 3) {
    s.showToast({ id: TOAST, type: 'Step', title: 'Pick a spot needs the wire.', message: 'Zoom in to move the boom instead.' })
    return
  }
  cancelRun() // a zone is picked instead of the Material spot

  const zone = zoneAt(zoneKindForZoom(zoom), x, z)
  if (sameZone(zone, s.cabZone)) return

  // Off the wire: the boom angles or telescopes to the zone, and the truck never moves.
  if (!onWire) {
    if (!boomTarget(zone, s.truck, s.truckHeading)) return s.showBlocked("The boom can't reach that zone from here.")
    return offerPick({ zone, destS: s.wireS, startS: s.wireS, way: 1, length: 0, folds: false, drives: false })
  }

  // On the wire, the truck stops level with the zone.
  const target = zoneCenterOnRoof(zone)
  const dest = nearestOnWire(target.x, target.z).s
  // A small zone the boom can reach from where the truck already is: only the boom moves, angling and telescoping
  // (no fold, no driving). The truck only slides along the wire when the zone is out of reach (Hanne, 2026-11-24).
  if (zone.kind === 'small' && boomTarget(zone, s.truck, s.truckHeading)) {
    return offerPick({ zone, destS: s.wireS, startS: s.wireS, way: 1, length: 0, folds: false, drives: false })
  }
  const route = bestRoute(s.wireS, dest, s.wireDir)
  // Can't reach it: the stop point is on (or only reachable through) the steep slope.
  if (!route) return s.showBlocked("The wire to that zone is blocked.")
  // A small zone has to be in the boom's reach from the stop point, since the cab rises into it at the end.
  if (zone.kind === 'small') {
    const stop = poseOnWire(dest, s.wireDir)
    if (!boomTarget(zone, stop, stop.heading)) return s.showBlocked("The boom can't reach that zone from the wire.")
  }

  // The machine folds ("Machine descending...") only if it is raised and has to drive somewhere far:
  // a big zone, or a small zone in another big zone. Already folded on the ground, it just drives.
  const far = zone.kind === 'big' || !s.cabZone || !sameZone(bigZoneOf(zone), bigZoneOf(s.cabZone))
  const folds = s.machineRaised && far
  offerPick({ zone, destS: dest, startS: s.wireS, way: route.way, length: route.length, folds, drives: true })
}

/** Show the picked zone and ask Allow? The wording says whether the truck drives or only the boom moves. */
function offerPick(p: Omit<PickState, 'phase' | 'descended'>) {
  const s = useSim.getState()
  s.setPick({ ...p, phase: 'tapped', descended: 0 })
  s.showToast({
    id: TOAST,
    type: 'Action',
    title: p.drives ? 'Machine will drive to new spot. Allow?' : 'Machine will configure to new spot. Allow?',
    action: { label: 'Allow', onPress: allow },
  })
}

/** Allow pressed: lock in the pick and wait for the joystick. */
function allow() {
  const s = useSim.getState()
  if (s.pick.phase !== 'tapped') return
  speed = 0
  stopped = false
  s.setPick({ phase: 'joystick', startS: s.wireS })
  s.showToast({ id: TOAST, type: 'Loading', title: 'Push the joystick forward to move.', picture: joystick })
}

/** Before Allow, zooming in or out drops the picked zone (doc: "goes back to the normal map"). */
export function cancelPick() {
  const s = useSim.getState()
  if (s.pick.phase !== 'tapped') return
  s.setPick(NO_PICK)
  clearOwnToast()
}

/** True from Allow until the move is done: + and − are locked and the map shows the route. */
export const pickIsMoving = (phase: string) =>
  phase === 'joystick' || phase === 'descending' || phase === 'driving' || phase === 'configuring'

// ---------- Letting go of the joystick mid-move (doc: "Letting go of the joystick stops the machine") ----------
let stopped = false
/** The joystick was let go during the move: the machine stops and asks. Pushing it again carries on. */
function joystickReleased(held: boolean) {
  const s = useSim.getState()
  if (!held && !stopped) {
    stopped = true
    s.showToast({
      id: TOAST,
      type: 'Action',
      title: 'Machine stopped.',
      message: 'Push the joystick to keep moving, or cancel to take full control.',
      action: { label: 'Cancel', onPress: cancelMove },
    })
  } else if (held && stopped) {
    stopped = false
    s.showToast({ id: TOAST, type: 'Loading', title: movingTitle(), picture: joystick })
  }
}
/** Cancel: the machine stays right where it is and the operator has full manual control. */
function cancelMove() {
  const s = useSim.getState()
  speed = 0
  stopped = false
  s.setPick(NO_PICK)
  clearOwnToast()
}

/** The Loading toast for the part of the move happening now. */
function movingTitle() {
  const { pick, machineRaised } = useSim.getState()
  if (pick.phase === 'descending') return 'Machine descending...'
  if (pick.phase === 'driving') return 'Machine driving to new placement...'
  if (pick.phase === 'configuring') return pick.drives && !configFromRaised ? 'Rising to the ledge...' : 'Configuring machine to new placement...'
  return machineRaised ? 'Configuring machine to new placement...' : 'Push the joystick forward to move.'
}

/**
 * Called every frame while the truck is on the wire. Moves the machine while the joystick (W) is held.
 * Returns the new spot along the wire, or null when Pick a spot isn't moving the truck.
 */
export function tickPickASpot(): number | null {
  const s = useSim.getState()
  const { pick } = s
  const now = performance.now()
  const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0
  lastTick = now
  // Boom-only moves and the rise at the end are run by tickPickBoom.
  if (!pickIsMoving(pick.phase) || pick.phase === 'configuring' || !pick.drives) return null
  const held = s.mode !== 'walking' && isHeld('w')
  // Waiting on the outrigger switch: nothing moves.
  if (movementLocked()) return s.wireS
  // The truck can't drive with the outriggers down: the machine stops and asks to retract them first.
  const legsDown = s.outriggers.state !== 'up'

  if (pick.phase === 'joystick') {
    if (held && !pick.folds && legsDown) askRetract()
    else if (held) startNextStage(pick.folds ? 'descending' : 'driving')
    return s.wireS
  }
  joystickReleased(held)
  if (pick.phase === 'descending') {
    // The machine folds while the joystick is held, then drives.
    if (held && foldStep(dt)) {
      if (legsDown) askRetract()
      else startNextStage('driving')
    }
    return s.wireS
  }

  // Driving: speed up while held, slow down when let go.
  // Creep speed while an alert restricts it.
  const target = held ? (restrictions().creep ? CREEP_SPEED : PICK_SPEED) : 0
  const rate = target < speed ? PICK_BRAKE : PICK_ACCEL
  speed += Math.max(-rate * dt, Math.min(rate * dt, target - speed))
  // At the materials: back down the branch to the house wire first (forks still facing out), then ride the wire.
  if (s.branchT !== null) {
    const t = s.branchT - speed * dt
    if (t > 0) {
      useSim.setState({ branchT: t })
      return null
    }
    useSim.setState({ branchT: null })
    return s.wireS
  }
  const left = routeLength(s.wireS, pick.destS, pick.way)
  const step = speed * dt
  if (step >= left || left < 0.01) {
    arrivedAtStop()
    return pick.destS
  }
  return s.wireS + pick.way * step
}

function startNextStage(phase: 'descending' | 'driving' | 'configuring') {
  const s = useSim.getState()
  s.setPick({ phase })
  s.showToast({ id: TOAST, type: 'Loading', title: movingTitle(), picture: joystick })
}

/** The truck reached its stop on the wire. A big zone ends here, folded. A small zone: the cab rises into it. */
function arrivedAtStop() {
  const s = useSim.getState()
  speed = 0
  // Sliding along the wire with the boom up (a small zone in the same big zone) keeps the boom as it is.
  if (s.pick.zone?.kind !== 'small' || s.machineRaised) return arrive()
  startConfiguring()
}

/** Where the boom is headed (model units), and whether it started raised. Set when configuring starts. */
let configTarget: { x: number; y: number; z: number } | null = null
let configFromRaised = false
function startConfiguring() {
  const s = useSim.getState()
  configTarget = s.pick.zone ? boomTarget(s.pick.zone, s.truck, s.truckHeading) : null
  if (!configTarget) return arrive()
  configFromRaised = s.machineRaised
  startBoomMove(configTarget)
  startNextStage('configuring')
}

/**
 * Called every frame, on or off the wire: boom-only moves (after Allow, while the joystick is held) and the rise
 * into a small zone at the end of a drive.
 */
export function tickPickBoom(dt: number) {
  const s = useSim.getState()
  const { pick } = s
  if (movementLocked()) return
  const held = s.mode !== 'walking' && isHeld('w')
  if (pick.phase === 'joystick' && !pick.drives) {
    if (held) startConfiguring()
    return
  }
  if (pick.phase !== 'configuring' || !configTarget) return
  joystickReleased(held)
  if (!held) return
  const step = (cabSpeed(BOOM_SPEED) / MACHINE_SCALE) * Math.min(dt, 0.1)
  if (boomStep(configTarget, step) === 'done') arrive()
}

function arrive() {
  const s = useSim.getState()
  speed = 0
  stopped = false
  configTarget = null
  s.setCabZone(s.pick.zone)
  s.setPick(NO_PICK)
  s.showToast({ id: TOAST, type: 'Success', title: 'Arrived.', message: 'Done configuring.' })
  setTimeout(() => {
    if (useSim.getState().toast?.id === TOAST && useSim.getState().pick.phase === 'idle') useSim.getState().clearToast()
  }, DONE_TOAST_MS)
}

/** When the wire connects: the cab zone is the big zone of the roof right in front of the truck (placeholder). */
export function setStartCabZone() {
  const s = useSim.getState()
  const p = poseOnWire(s.wireS, s.wireDir)
  // Walk from the truck toward the roof until we're a meter inside the roof edge.
  let best = { x: p.x, z: p.z }
  let bestD = Infinity
  for (let a = 0; a < 360; a += 5) {
    const r = (a * Math.PI) / 180
    for (let d = 0.5; d < 6; d += 0.25) {
      const x = p.x + Math.cos(r) * d
      const z = p.z + Math.sin(r) * d
      if (isInside(ROOF_OUTLINE, x, z) && edgeDistance(ROOF_OUTLINE, x, z) >= 1 && d < bestD) {
        best = { x, z }
        bestD = d
        break
      }
    }
  }
  s.setCabZone(zoneAt('big', best.x, best.z))
}

/** When the wire disconnects: drop any pick and the cab zone. */
export function resetPickASpot() {
  const s = useSim.getState()
  speed = 0
  s.setPick(NO_PICK)
  s.setCabZone(null)
  clearOwnToast()
}
