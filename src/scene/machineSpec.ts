// The roofing lift's size and pose. The 3D model is in Machine.tsx.

/** The model is drawn at the size of the industrial designer's renders, then scaled down so it sits well below the roof edge. */
export const MACHINE_SCALE = 0.8

/** The renders' size, in meters: 7.3 m (24 ft) long with the forks, 2.4 m (8 ft) wide, cab roof 3 m (10 ft) high. */
export const MACHINE_DESIGN = { length: 7.3, width: 2.4, height: 3 }

/** The machine's real size in the sim, in meters (about 19.5 ft long, 6.4 ft wide, 8 ft high). */
export const MACHINE = {
  length: MACHINE_DESIGN.length * MACHINE_SCALE,
  width: MACHINE_DESIGN.width * MACHINE_SCALE,
  height: MACHINE_DESIGN.height * MACHINE_SCALE,
}

/** How the moving parts are posed. Angles in radians, extend in meters (at design size). */
export type MachinePose = {
  turretYaw: number // turret turning left (+) or right (-)
  lowerPitch: number // lower boom tipping up from flat
  upperPitch: number // upper boom tipping up, relative to the lower boom
  extend: number // how far the upper boom telescopes out
  jib: number // 0 = cab tucked behind the boom tip (folded), 1 = cab swung out in front of it (raised)
}

/** Drive mode: everything folded down, cab resting on the rear deck. */
export const FOLDED: MachinePose = { turretYaw: 0, lowerPitch: 0, upperPitch: 0, extend: 0, jib: 0 }

// ---------- Boom chain (model units: the renders' size, before MACHINE_SCALE) ----------
// The machine's own directions: forward = -z (forks), right = +x, up = +y, middle of its length at z = 0.

/** Distance along the machine from its back bumper, turned into the model's z. */
export const fromBack = (d: number) => MACHINE_DESIGN.length / 2 - d

/** The turnstile (turret): the long rounded housing turns on a ring on the chassis, 90° each way, carrying the boom
 *  (Figma "Machine References": "Turnstile rotates 180 degrees"). This is its turning point, in the middle of the
 *  housing, at the height of the boom channel on top. */
export const TURRET = { x: 0, y: 1.95, z: fromBack(1.7) }
/** The lower boom hinges at the back end of the housing ("Hinges here"), this far behind the turning point. */
export const HINGE_BACK = 1.2
export const LOWER_BOOM = 1.3 + HINGE_BACK
export const UPPER_BOOM = 2.6
/** The boom tip when folded: the boom lies flat in the channel on top of the housing, ending at the cab's front corner. */
export const FOLDED_TIP = { x: TURRET.x, y: TURRET.y, z: TURRET.z - (LOWER_BOOM + UPPER_BOOM - HINGE_BACK) }
/** Where the cab floor's middle sits relative to the boom tip (turns with the turret).
 *  Folded, the cab rests on the deck behind the tip. Raised, the jib swings it out in front of the tip,
 *  like the Operate renders: the boom meets the back of the cab. */
const CAB_TUCKED = { x: -TURRET.x, y: 0.45 - TURRET.y, z: fromBack(4.7) - FOLDED_TIP.z }
const CAB_OUT = { x: 0, y: -1.1, z: -1.6 }
export function cabFromTip(jib: number) {
  return {
    x: CAB_TUCKED.x + (CAB_OUT.x - CAB_TUCKED.x) * jib,
    y: CAB_TUCKED.y + (CAB_OUT.y - CAB_TUCKED.y) * jib,
    z: CAB_TUCKED.z + (CAB_OUT.z - CAB_TUCKED.z) * jib,
  }
}
/** How high (model units) the tip rises off the deck while the jib swings the cab out. */
export const JIB_SWING_HEIGHT = 1.2
/** The cab's floor, half width and half depth. */
export const CAB_HALF = { x: 1.05, z: 1.2 }

const deg = (d: number) => (d * Math.PI) / 180
/** Placeholder limits until the industrial designer confirms (real-world meters are converted to model units). */
export const LIMITS = {
  turret: deg(95), // 180° in total, 90° each way from forward (Hanne), plus a little slack so pointing straight out to the side isn't right on the limit
  lowerMin: 0,
  lowerMax: deg(75),
  upperRelMin: deg(-135), // the knuckle bends down
  upperRelMax: deg(5),
  extendMax: 5.5 / MACHINE_SCALE, // telescope: 5.5 m (enough to reach about 6 m out onto the roof at the 6 m ledge height)
  reachMax: 6 / MACHINE_SCALE, // from the turret, sideways or forward: 6 m
  cabFloorMax: 7, // highest the cab floor goes above the ground, in real meters
  liftFirst: 0.6, // the cab has to rise this far (model units) off the deck before it can move sideways or forward
}
