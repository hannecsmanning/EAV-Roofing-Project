// LMI (load moment indicator): how close the machine is to tipping, as a fraction of what it can hold.
// docs/CONTEXT.md "LMI": the main safety number. The light stack shows it in 6 steps:
//   1-2 green (safe), 3-4 amber (approaching the limit), 5-6 red (at the limit).
// It's the weight out on the boom (cab + load) times how far it reaches from the middle of the machine,
// compared with what the machine can hold. The outriggers widen the base, so it can hold much more.
// All numbers are placeholders until the industrial designer confirms them.
import { useSim } from '../store'
import { MACHINE_SCALE, type MachinePose } from '../scene/machineSpec'
import { cabCenter } from './machineControl'

type Vec = { x: number; y: number; z: number }

/** The cab's own weight, in pounds (placeholder). */
const CAB_LB = 500
/** What the machine can hold, in pound-meters, without and with the outriggers down (placeholders). */
const CAPACITY = { up: 3450, down: 5200 }
/** Past this, the boom can't reach further until the outriggers are down (about the 4th light, doc "Ascend and descend"). */
export const DEPLOY_FRAC = 0.5
/** Entering the 4th light: the LMI approaching warning (with the outriggers down). */
export const APPROACH_FRAC = 0.5
/** Entering the 6th light: the machine stops (LMI at limit). */
export const LIMIT_FRAC = 5 / 6

/** LMI as a fraction (0 = nothing out, 1 = at the limit) for a boom pose. */
export function lmiFrac(tip: Vec, pose: MachinePose, outriggersDown: boolean, loadLb = useSim.getState().loadLb) {
  const c = cabCenter(tip, pose)
  const reach = Math.hypot(c.x, c.z) * MACHINE_SCALE // from the middle of the machine, in meters
  return ((CAB_LB + loadLb) * reach) / (outriggersDown ? CAPACITY.down : CAPACITY.up)
}

/** LMI right now, as a fraction. The outriggers only count once they're fully down. */
export function lmiNow() {
  const s = useSim.getState()
  return lmiFrac(s.machineTip, s.machinePose, s.outriggers.state === 'down', s.loadLb)
}

/** Which light the stack is lit up to (1 to 6). */
export const lmiLevel = (frac: number) => Math.max(1, Math.min(6, Math.ceil(frac * 6 - 1e-6)))

/** For the HMI: the light stack level, redrawn whenever the boom, load or outriggers change. */
// Stopped at the limit (until it starts reconfiguring), all 6 lights show.
export const useLmiLevel = () =>
  useSim((s) =>
    ['limit', 'sensing', 'allow'].includes(s.lmiAlert) ? 6 : lmiLevel(lmiFrac(s.machineTip, s.machinePose, s.outriggers.state === 'down', s.loadLb)),
  )

/** How far from the middle of the machine the cab can go before LMI hits the limit, in meters (for the risky zone tint). */
export function limitReach(outriggersDown: boolean, loadLb: number) {
  return (LIMIT_FRAC * (outriggersDown ? CAPACITY.down : CAPACITY.up)) / (CAB_LB + loadLb)
}
