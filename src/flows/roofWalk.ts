// Walking on the roof. docs/CONTEXT.md Simulator plan: "4 gets the operator out of the machine. If the machine is
// raised and not over the roof, getting out is blocked ... On the roof, the edges have an invisible force field so the
// operator cannot fall off."
//   Stepping out: the cab is at the roof when its floor is close to the roof surface right next to it. That is the cab
//     at the ledge after Ascend, or resting on the roof after Pick a spot. The operator steps out beside the cab.
//   On the roof: the operator walks up and down the slopes. The roof edge holds them in, and they can't walk through
//     the cab.
//   Getting back in: walk up to the cab and press 4. That puts them in Operate mode, since the machine is raised.
import { useSim, type Spot } from '../store'
import { ROOF_OUTLINE, houseHeightAt, groundHeight } from '../scene/siteLayout'
import { isInside, edgeDistance } from '../scene/roofShape'
import { OPERATOR_RADIUS, slideMove, type Circle } from '../scene/collision'
import { CAB_HALF, MACHINE_SCALE } from '../scene/machineSpec'
import { cabWorld } from './machineControl'

/** How far the roof can be above or below the cab floor and still be a safe step across, in meters. */
const STEP_M = 0.45
/** The force field: how close to the roof edge the operator's middle can get, in meters. */
const EDGE_KEEP = OPERATOR_RADIUS + 0.1
/** The cab as a circle on the roof, so the operator walks around it. */
const CAB_RADIUS = Math.min(CAB_HALF.x, CAB_HALF.z) * MACHINE_SCALE + 0.1
/** How close to the cab the operator has to be to get back in. */
const GET_IN_M = 1.2

const cabCircle = (): Circle => {
  const c = cabWorld()
  return { x: c.x, z: c.z, r: CAB_RADIUS }
}

/** Is this spot on the roof, inside the force field? */
const onRoofInside = (x: number, z: number) => isInside(ROOF_OUTLINE, x, z) && edgeDistance(ROOF_OUTLINE, x, z) >= EDGE_KEEP

/** Where the operator would step out onto the roof from the cab right now, or null when the cab isn't at the roof. */
export function roofStepOut(): Spot | null {
  const s = useSim.getState()
  if (!s.machineRaised) return null
  // Not while the cab is still moving on its own (Ascend, Retract, Pick a spot).
  if (s.lift.flow !== 'none' && s.lift.phase !== 'done') return null
  if (['joystick', 'descending', 'driving', 'configuring'].includes(s.pick.phase)) return null
  const cab = cabWorld()
  let best: Spot | null = null
  let bestDiff = Infinity
  // Look all around the cab, just clear of it, for a spot on the roof about level with the cab floor.
  for (const r of [CAB_RADIUS + OPERATOR_RADIUS + 0.25, CAB_RADIUS + OPERATOR_RADIUS + 0.7]) {
    for (let a = 0; a < 360; a += 15) {
      const x = cab.x + r * Math.sin((a * Math.PI) / 180)
      const z = cab.z + r * Math.cos((a * Math.PI) / 180)
      if (!onRoofInside(x, z)) continue
      const diff = Math.abs(houseHeightAt(x, z) - cab.y)
      if (diff <= STEP_M && diff < bestDiff) {
        best = { x, z }
        bestDiff = diff
      }
    }
    if (best) return best
  }
  return null
}

/** Close enough to the cab to get back in (on the roof). */
export function canGetInFromRoof(o: Spot) {
  const c = cabWorld()
  return Math.hypot(o.x - c.x, o.z - c.z) <= CAB_RADIUS + GET_IN_M && Math.abs(houseHeightAt(o.x, o.z) - c.y) <= STEP_M + 0.3
}

/** One step of walking on the roof: slides along the edge and around the cab instead of going through them. */
export function roofMove(at: Spot, dx: number, dz: number): Spot {
  const cab = cabCircle()
  return slideMove(at, dx, dz, (p) => !onRoofInside(p.x, p.z) || Math.hypot(p.x - cab.x, p.z - cab.z) < cab.r + OPERATOR_RADIUS)
}

/** How high the operator's feet are: on the roof surface or on the ground. */
export const operatorHeight = (o: Spot, onRoof: boolean) => (onRoof ? houseHeightAt(o.x, o.z) : groundHeight(o.x, o.z))
