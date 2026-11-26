// Wire acquiring flow. docs/CONTEXT.md and Figma "Wire Acquiring Flow" (5 screens):
//   1 · Near the house, lined up: wire shows as available. Step toast "Wire nearby." Sound.
//   2 · Wire button (G) pressed: searching. Loading toast "Searching for the wire..."
//   3 · Acquiring: the truck slides onto the wire. Loading toast "Connecting to the wire..."
//   4 · Acquired: wire turns green. Success toast "Connected to the wire." Sound.
//   5 · Connected: the toast goes away, the green wire stays.
// Connecting only works in Drive mode. Once connected, W and S slide the truck along the wire.
// Pressing G again disconnects (placeholder until the disconnect flow is designed).
import { useSim } from '../store'
import { nearestOnWire, poseOnWire } from '../scene/wireTrack'
import { playChime } from '../sound'
import { setStartCabZone, resetPickASpot } from './pickASpot'

/** How close the truck's middle has to be to the wire, in meters (about 6.5 ft). */
export const WIRE_NEAR_M = 2
/** How close to parallel with the wire the truck has to be, in degrees. */
export const WIRE_PARALLEL_DEG = 10

const SEARCH_MS = 2000
const CONNECT_MS = 2000
const SUCCESS_TOAST_MS = 4000

const TOAST_NEARBY = 'wire-nearby'
const TOAST_FLOW = 'wire-flow'

// While acquiring: where the truck started and when, so it can slide smoothly onto the wire.
let acquireFrom = { x: 0, z: 0, heading: 0 }
let acquireStart = 0

const clearOwnToasts = () => {
  useSim.getState().clearToast(TOAST_NEARBY)
  useSim.getState().clearToast(TOAST_FLOW)
}

/** Called every frame: is the truck close enough and lined up to connect? */
export function updateWireAvailability() {
  const s = useSim.getState()
  let available = false
  if (s.wire === 'off' && s.mode === 'drive') {
    const near = nearestOnWire(s.truck.x, s.truck.z)
    // Angle between the truck's length and the wire, either way round.
    const fx = -Math.sin(s.truckHeading)
    const fz = -Math.cos(s.truckHeading)
    const sinAngle = Math.abs(fx * near.tz - fz * near.tx)
    available = near.dist <= WIRE_NEAR_M && sinAngle <= Math.sin((WIRE_PARALLEL_DEG * Math.PI) / 180)
  }
  if (available === s.wireAvailable) return
  s.setWire({ wireAvailable: available })
  if (available) {
    s.showToast({ id: TOAST_NEARBY, type: 'Step', title: 'Wire nearby.', message: 'Press the wire button to connect to the wire.' })
    playChime('info')
  } else if (s.wire === 'off' && s.toast?.id === TOAST_NEARBY) {
    s.clearToast(TOAST_NEARBY)
  }
}

/** The physical wire button (G). */
export function pressWireButton() {
  const s = useSim.getState()
  if (s.mode !== 'drive') return
  if (s.wire === 'connected') {
    // Disconnect. Placeholder: no toast until the disconnect flow is designed.
    s.setWire({ wire: 'off', wireAvailable: false })
    useSim.setState({ branchT: null })
    clearOwnToasts()
    resetPickASpot()
    return
  }
  if (s.wire !== 'off' || !s.wireAvailable) return

  s.setWire({ wire: 'searching', wireAvailable: false })
  s.showToast({ id: TOAST_FLOW, type: 'Loading', title: 'Searching for the wire...' })

  setTimeout(() => {
    const now = useSim.getState()
    if (now.wire !== 'searching') return
    // Work out where on the wire the truck will sit, facing the way it already faces.
    const near = nearestOnWire(now.truck.x, now.truck.z)
    const fx = -Math.sin(now.truckHeading)
    const fz = -Math.cos(now.truckHeading)
    const dir: 1 | -1 = fx * near.tx + fz * near.tz >= 0 ? 1 : -1
    acquireFrom = { x: now.truck.x, z: now.truck.z, heading: now.truckHeading }
    acquireStart = performance.now()
    now.setWire({ wire: 'acquiring', wireS: near.s, wireDir: dir })
    now.showToast({ id: TOAST_FLOW, type: 'Loading', title: 'Connecting to the wire...' })

    setTimeout(() => {
      const later = useSim.getState()
      if (later.wire !== 'acquiring') return
      later.setWire({ wire: 'connected' })
      setStartCabZone()
      later.showToast({ id: TOAST_FLOW, type: 'Success', title: 'Connected to the wire.', message: 'Use Pick a spot to drive to any spot along the wire.' })
      playChime('success')
      setTimeout(() => {
        if (useSim.getState().wire === 'connected') useSim.getState().clearToast(TOAST_FLOW)
      }, SUCCESS_TOAST_MS)
    }, CONNECT_MS)
  }, SEARCH_MS)
}

/** While acquiring: where the truck should be right now as it slides onto the wire. */
export function acquiringPose() {
  const { wireS, wireDir } = useSim.getState()
  const to = poseOnWire(wireS, wireDir)
  const t = Math.min(1, (performance.now() - acquireStart) / CONNECT_MS)
  const e = t * t * (3 - 2 * t) // ease in and out
  const turn = Math.atan2(Math.sin(to.heading - acquireFrom.heading), Math.cos(to.heading - acquireFrom.heading))
  return {
    x: acquireFrom.x + (to.x - acquireFrom.x) * e,
    z: acquireFrom.z + (to.z - acquireFrom.z) * e,
    heading: acquireFrom.heading + turn * e,
  }
}
