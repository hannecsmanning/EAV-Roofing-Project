// Outriggers. docs/CONTEXT.md "Outriggers" and Figma "Outrigger Flows".
// The machine decides when they're needed, but the operator always flips the switch (the O key, a green backlit
// rocker switch in the cab).
//   Deploy: the boom reaches past the set point (about the 4th LMI light) → the machine stops. Warning toast
//     "Deploy outriggers." with the Switch deploy picture and a sound → flip → Loading "Deploying outriggers..."
//     → Success "Successfully deployed. Continue operation."
//   Retract: the operator tries to drive while they're down → the machine stops. Warning toast "Retract outriggers."
//     with the Switch retract picture → flip → Loading "Retracting outriggers..." → Success.
//     Fully retract (0) does this as its step 3, then ends in Drive mode.
// From the stop until the legs finish moving, the map shows "Movement locked" and + and − are disabled.
import { useSim } from '../store'
import { playChime } from '../sound'
import { lmiFrac, DEPLOY_FRAC } from './lmi'
import { lmiLocked } from './lmiAlerts'
import switchDeploy from '../assets/hmi/toast-switch-deploy.svg'
import switchRetract from '../assets/hmi/toast-switch-retract.svg'
import deployingPic from '../assets/hmi/toast-outriggers-deploying.svg'
import retractingPic from '../assets/hmi/toast-outriggers-retracting.svg'

const TOAST = 'outriggers'
const MOVE_S = 2.5 // how long the legs take to go down or up (placeholder)
const SUCCESS_MS = 3000

/** Who asked for the retract: retract step 3 ends the flow itself, so it shows its own Success toast. */
let askedBy: 'drive' | 'lift' = 'drive'
let successTimer: ReturnType<typeof setTimeout> | undefined

const set = (o: Partial<ReturnType<typeof useSim.getState>['outriggers']>) =>
  useSim.setState((s) => ({ outriggers: { ...s.outriggers, ...o } }))

/** The map is locked and nothing moves: from the stop until the legs finish moving. */
// (LMI at limit locks movement the same way, until the machine has moved itself back.)
const locked = (s: ReturnType<typeof useSim.getState>) =>
  s.outriggers.ask !== null || s.outriggers.state === 'deploying' || s.outriggers.state === 'retracting' || lmiLocked(s.lmiAlert)
export const movementLocked = () => locked(useSim.getState())
export const useMovementLocked = () => useSim(locked)

/** The boom tried to reach past the set point with the outriggers up: stop and ask for them. */
export function askDeploy() {
  const s = useSim.getState()
  if (s.outriggers.state !== 'up' || s.outriggers.ask) return
  set({ ask: 'deploy' })
  s.showToast({
    id: TOAST,
    type: 'Warning',
    title: 'Deploy outriggers.',
    message: 'Flip the switch to deploy before operation continues.',
    picture: switchDeploy,
  })
  playChime('warning')
}

/** Something needs the truck to drive while the outriggers are down: stop and ask to retract them. */
export function askRetract(by: 'drive' | 'lift' = 'drive') {
  const s = useSim.getState()
  if (s.outriggers.state !== 'down' || s.outriggers.ask) return
  askedBy = by
  set({ ask: 'retract' })
  s.showToast({
    id: TOAST,
    type: 'Warning',
    title: 'Retract outriggers.',
    message: 'Flip the switch to retract before operation continues.',
    picture: switchRetract,
  })
  playChime('warning')
}

/** The O key: the outrigger switch. */
export function flipSwitch() {
  const s = useSim.getState()
  if (s.mode === 'walking') return
  const o = s.outriggers
  if (o.state === 'deploying' || o.state === 'retracting') return
  if (o.state === 'up') {
    if (!o.ask) askedBy = 'drive'
    startMoving('deploying')
    return
  }
  // Down: the operator can fold them up any time, unless the boom is reaching too far to stay up without them.
  if (!o.ask && lmiFrac(s.machineTip, s.machinePose, false) > DEPLOY_FRAC) {
    s.showBlocked('Bring the boom in before retracting the outriggers.')
    return
  }
  if (!o.ask) askedBy = 'drive'
  startMoving('retracting')
}

function startMoving(state: 'deploying' | 'retracting') {
  const s = useSim.getState()
  // Flipping the switch without being asked still locks movement until the legs finish (the same as being asked).
  set({ state, ask: state === 'deploying' ? 'deploy' : 'retract' })
  clearTimeout(successTimer)
  s.showToast({
    id: TOAST,
    type: 'Loading',
    title: state === 'deploying' ? 'Deploying outriggers...' : 'Retracting outriggers...',
    picture: state === 'deploying' ? deployingPic : retractingPic,
  })
}

/** Called every frame: move the legs, and finish the flow when they're all the way down or up. */
export function tickOutriggers(dt: number) {
  const s = useSim.getState()
  const o = s.outriggers
  if (o.state !== 'deploying' && o.state !== 'retracting') return
  const down = o.state === 'deploying'
  const t = Math.max(0, Math.min(1, o.t + ((down ? 1 : -1) * Math.min(dt, 0.1)) / MOVE_S))
  if (t !== (down ? 1 : 0)) {
    set({ t })
    return
  }
  set({ t, state: down ? 'down' : 'up', ask: null })
  playChime('success')
  // Retract step 3 of Fully retract shows its own "Successfully retracted. Switching to Drive mode." toast.
  if (!down && askedBy === 'lift') return
  s.showToast({
    id: TOAST,
    type: 'Success',
    title: down ? 'Successfully deployed.' : 'Successfully retracted.',
    message: 'Continue operation.',
  })
  successTimer = setTimeout(() => {
    if (useSim.getState().toast?.id === TOAST) useSim.getState().clearToast()
  }, SUCCESS_MS)
}
