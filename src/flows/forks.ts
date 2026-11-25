// Fork operation (key 3). docs/CONTEXT.md "Step 4: keyboard controls":
//   ↑ / ↓ move the forks up and down. W pushes them out, S pulls them back in.
//   Loads: forks are hard to aim in a game, so L picks up a load when the forks are close to it, and drops it again
//   (an "L Pick up load" / "L Drop load" prompt shows when it can). The Load badge, Overweight alert and LMI all use
//   the real weight on the forks.
// The forks hang from the front of the cab, so they go wherever the cab goes (down on the deck, or up at the roof).
import { useSim, type LoadSpot } from '../store'
import { isHeld } from '../keys'
import { LOADS, groundHeight, houseHeightAt } from '../scene/siteLayout'
import { cabCenter, toWorld } from './machineControl'
import { movementLocked } from './outriggers'

/** Fork limits and speed, in model units (placeholders). */
export const FORK = { liftMin: -0.42, liftMax: 1.2, extendMax: 0.9, speed: 0.5 }
/** Where the middle of the forks sits on the cab at rest (cab floor middle = 0; forward is -z). */
export const FORK_REST = { y: 0.1, z: -2.12 }
/** How close (meters, side to side) the forks have to be to a load to pick it up. */
const REACH_M = 1.3
/** How far above or below the forks a load can be and still be picked up (meters). */
const LEVEL_M = 1.2

export const loadById = (id: string) => LOADS.find((l) => l.id === id)!

/** The middle of the forks in the world, and the way they point (radians, like the truck heading). */
export function forkWorld() {
  const s = useSim.getState()
  const center = cabCenter(s.machineTip, s.machinePose)
  const yaw = s.machinePose.turretYaw
  const lz = FORK_REST.z - s.forks.extend
  const c = Math.cos(yaw)
  const sn = Math.sin(yaw)
  const p = toWorld({ x: center.x + lz * sn, y: center.y + FORK_REST.y + s.forks.lift, z: center.z + lz * c }, s.truck, s.truckHeading)
  return { ...p, heading: s.truckHeading + yaw }
}

/** The load the forks can pick up right now, if any. */
export function loadInReach(): LoadSpot | null {
  const s = useSim.getState()
  if (s.mode === 'walking' || s.carried) return null
  const f = forkWorld()
  let best: LoadSpot | null = null
  let bestD = REACH_M
  for (const l of s.loadSpots) {
    const d = Math.hypot(l.x - f.x, l.z - f.z)
    if (d < bestD && Math.abs(l.y - f.y) < LEVEL_M) {
      best = l
      bestD = d
    }
  }
  return best
}

/** The L key: pick up the load in reach, or drop the one on the forks. */
export function pressL() {
  const s = useSim.getState()
  if (s.mode === 'walking') return
  if (movementLocked()) return s.showBlocked('Movement is locked.')
  if (s.carried) {
    // Set it down right under the forks, on whatever is there (the ground or the roof).
    const f = forkWorld()
    const y = Math.max(groundHeight(f.x, f.z), houseHeightAt(f.x, f.z))
    useSim.setState({
      carried: null,
      loadLb: 0,
      loadSpots: [...s.loadSpots, { id: s.carried, x: f.x, y, z: f.z, heading: f.heading }],
    })
    return
  }
  const l = loadInReach()
  if (!l) return s.showBlocked('Get the forks closer to a load.')
  useSim.setState({ carried: l.id, loadLb: loadById(l.id).weightLb, loadSpots: s.loadSpots.filter((x) => x.id !== l.id) })
}

/** Called every frame: in Fork operation, the arrows and W / S move the forks. */
export function tickForks(dt: number) {
  const s = useSim.getState()
  if (s.mode !== 'forks' || movementLocked()) return
  const step = FORK.speed * Math.min(dt, 0.1)
  const up = (isHeld('arrowup') ? 1 : 0) - (isHeld('arrowdown') ? 1 : 0)
  const out = (isHeld('w') ? 1 : 0) - (isHeld('s') ? 1 : 0)
  if (!up && !out) return
  const lift = Math.max(FORK.liftMin, Math.min(FORK.liftMax, s.forks.lift + up * step))
  const extend = Math.max(0, Math.min(FORK.extendMax, s.forks.extend + out * step))
  if (lift !== s.forks.lift || extend !== s.forks.extend) useSim.setState({ forks: { lift, extend } })
}
