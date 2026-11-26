// Material run. docs/CONTEXT.md "Material run" and Figma "Material Run Flow".
//   1 · On the wire, the Material spot shows on the map left of the house, joined to the wire by a short branch.
//   2 · Tap it: it turns teal. Action toast "Machine will drive to materials. Allow?" After Allow, a Loading toast
//       with the joystick picture: "Push the joystick forward to move."
//   3 · Holding the joystick (W): "Machine driving to new placement..." along the house wire, then out along the branch.
//       The route ahead shows dotted. (Raised, the machine folds first; outriggers down, it asks to retract them.)
//   4 · Arrived: "Arrived at materials." with a sound, for 1.5 s.
//   5 · The operator loads the forks (L). Too heavy: the Overweight load alert.
//   6 · Going back is a normal Pick a spot: the truck backs down the branch, then rides the house wire.
// The run starts from the Operate zone map and the truck stays folded the whole way.
import { releaseJoystickFirst } from '../keys'
import { useSim, NO_RUN, NO_PICK } from '../store'
import { joystickHeld, joystickPicture } from './tablet'
import { isDismounted } from '../store'
import { playChime } from '../sound'
import { BRANCH_LENGTH } from '../scene/siteLayout'
import { JUNCTION_S, bestRoute, routeLength } from '../scene/wireTrack'
import { foldStep } from './machineControl'
import { restrictions } from './alerts'
import { askRetract, movementLocked } from './outriggers'
import joystick from '../assets/hmi/toast-joystick.svg'

const TOAST = 'material-run'
const SPEED = 3 // m/s, the same as Pick a spot (placeholder)
const CREEP_SPEED = 0.5
const ACCEL = 2
const BRAKE = 5
const ARRIVED_MS = 1500

let speed = 0
let lastTick = 0

const clearOwnToast = () => {
  useSim.getState().clearToast(TOAST)
}

/** From Allow until the truck arrives. */
export const runIsMoving = (phase: string) => phase === 'joystick' || phase === 'descending' || phase === 'driving'

/** Tap on the Material spot pin. */
export function tapMaterialSpot() {
  const s = useSim.getState()
  if (movementLocked() || s.wire !== 'connected') return
  if (runIsMoving(s.run.phase) || (s.pick.phase !== 'idle' && s.pick.phase !== 'tapped')) return
  if (s.branchT !== null && s.branchT >= BRANCH_LENGTH - 0.05) return s.showBlocked('Already at the materials.')
  // Along the house wire to the branch first (unless already on the branch), the shortest way that isn't too steep.
  const route = s.branchT !== null ? { way: 1 as const, length: 0 } : bestRoute(s.wireS, JUNCTION_S, s.wireDir)
  if (!route) return s.showBlocked("The wire to the materials is blocked.")
  s.setPick(NO_PICK) // the Material spot is picked instead of a zone
  useSim.setState({ run: { phase: 'tapped', startS: s.wireS, way: route.way, length: route.length } })
  s.showToast({ id: TOAST, type: 'Action', title: 'Machine will drive to materials. Allow?', action: { label: 'Allow', onPress: allow } })
}

function allow() {
  const s = useSim.getState()
  if (s.run.phase !== 'tapped') return
  speed = 0
  useSim.setState({ run: { ...s.run, phase: 'joystick' } })
  // A dismounted tablet has no joystick: the machine just goes, and the next Loading toast shows right away.
  if (!isDismounted(s.tablet)) s.showToast({ id: TOAST, type: 'Loading', title: 'Push the joystick forward to move.', picture: joystick })
}

/** Before Allow: tapping a zone or zooming drops the picked Material spot. */
export function cancelRun() {
  const s = useSim.getState()
  if (s.run.phase !== 'tapped') return
  useSim.setState({ run: NO_RUN })
  clearOwnToast()
}

function setPhase(phase: 'descending' | 'driving') {
  const s = useSim.getState()
  useSim.setState({ run: { ...s.run, phase } })
  s.showToast({
    id: TOAST,
    type: 'Loading',
    title: phase === 'descending' ? 'Machine descending...' : 'Machine driving to new placement...',
    picture: joystickPicture(joystick),
  })
}

/**
 * Called every frame while the truck is on the wire. Moves the machine while the joystick (W) is held.
 * Returns the new spot along the house wire, or null when the run isn't moving the truck along it
 * (on the branch, it moves `branchT` itself).
 */
export function tickMaterialRun(): number | null {
  const s = useSim.getState()
  const { run } = s
  const now = performance.now()
  const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 0
  lastTick = now
  if (!runIsMoving(run.phase) || movementLocked()) return null
  const held = joystickHeld()
  const legsDown = s.outriggers.state !== 'up'

  if (run.phase === 'joystick') {
    if (!held) return null
    if (s.machineRaised) setPhase('descending')
    else if (legsDown) askRetract()
    else setPhase('driving')
    return null
  }
  if (run.phase === 'descending') {
    if (held && foldStep(dt)) {
      if (legsDown) askRetract()
      else setPhase('driving')
    }
    return null
  }

  // Driving: speed up while held, slow down when let go. Creep speed while an alert restricts it.
  const target = held ? (restrictions().creep ? CREEP_SPEED : SPEED) : 0
  const rate = target < speed ? BRAKE : ACCEL
  speed += Math.max(-rate * dt, Math.min(rate * dt, target - speed))
  const step = speed * dt
  if (step <= 0) return null

  // Out along the branch.
  if (s.branchT !== null) {
    const t = Math.min(BRANCH_LENGTH, s.branchT + step)
    useSim.setState({ branchT: t })
    if (t >= BRANCH_LENGTH) arrive()
    return null
  }
  // Along the house wire to the branch.
  const left = routeLength(s.wireS, JUNCTION_S, run.way)
  if (step >= left || left < 0.01) {
    useSim.setState({ wireS: JUNCTION_S, branchT: 0 })
    return null
  }
  return s.wireS + run.way * step
}

function arrive() {
  const s = useSim.getState()
  // Done: a joystick still held from the move does nothing until it's let go (Hanne).
  releaseJoystickFirst()
  speed = 0
  useSim.setState({ run: NO_RUN })
  s.setCabSpot(null) // the cab is no longer over the roof
  s.showToast({ id: TOAST, type: 'Success', title: 'Arrived at materials.' })
  playChime('success')
  setTimeout(() => {
    if (useSim.getState().toast?.id === TOAST && useSim.getState().run.phase === 'idle') clearOwnToast()
  }, ARRIVED_MS)
}
