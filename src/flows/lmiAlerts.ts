// LMI alerts. docs/CONTEXT.md "LMI" and Figma "LMI Flows".
//   Approaching (entering the 4th light): Warning toast "Warning: LMI approaching limit." with a sound. Moving back to
//     a safer position: Success "LMI is back to a safe zone." The map tints the risky zones amber.
//   At the limit (entering the 6th light): the machine stops, the map locks ("Movement locked") and the risky zones
//     tint red. Danger toast with the LMI button picture and a sound. The operator presses and holds the LMI button
//     (B): "Sensing machine balance..." until a sound. Then "Machine will begin reconfiguring. Allow?" After Allow the
//     machine pulls the cab back in by itself ("Machine reconfiguring..."), then "Done configuring."
import { useSim } from '../store'
import { isHeld } from '../keys'
import { playChime } from '../sound'
import { MACHINE_SCALE, TURRET } from '../scene/machineSpec'
import { lmiNow, APPROACH_FRAC } from './lmi'
import { moveToward } from './machineControl'
import lmiButton from '../assets/hmi/toast-lmi-button.svg'

const TOAST = 'lmi'
const SAFE_FRAC = APPROACH_FRAC - 0.04 // back under the 4th light, with a little room so it doesn't flicker
const SETTLED_FRAC = 0.6 // reconfiguring stops once LMI is back down to about the 4th light
const SENSING_S = 2 // how long the LMI button has to be held (placeholder)
const SPEED = 0.5 // how fast the machine pulls the cab in, real meters per second (placeholder)
const SUCCESS_MS = 3000

let sensed = 0
let successTimer: ReturnType<typeof setTimeout> | undefined

const setAlert = (lmiAlert: ReturnType<typeof useSim.getState>['lmiAlert']) => useSim.setState({ lmiAlert })
const toast = (t: Parameters<ReturnType<typeof useSim.getState>['showToast']>[0]) => {
  clearTimeout(successTimer)
  useSim.getState().showToast({ id: TOAST, ...t })
}
function success(title: string, message: string) {
  toast({ type: 'Success', title, message })
  successTimer = setTimeout(() => {
    useSim.getState().clearToast(TOAST)
  }, SUCCESS_MS)
}

/** LMI at limit: the machine stopped a move that would go past the limit. */
export function lmiAtLimit() {
  const s = useSim.getState()
  if (['limit', 'sensing', 'allow', 'reconfiguring'].includes(s.lmiAlert)) return
  setAlert('limit')
  dangerToast()
  playChime('warning')
}
const dangerToast = () =>
  toast({
    type: 'Danger',
    title: 'LMI % at hazardous level.',
    message: 'Press and hold the LMI button to return to a safer position.',
    picture: lmiButton,
  })

/** The machine is stopped by LMI and the operator can't move it. */
export const lmiLocked = (a = useSim.getState().lmiAlert) => a === 'limit' || a === 'sensing' || a === 'allow' || a === 'reconfiguring'

/** Called every frame. */
export function tickLmi(dt: number) {
  const s = useSim.getState()
  if (s.mode === 'walking') return
  const frac = lmiNow()
  dt = Math.min(dt, 0.1)

  switch (s.lmiAlert) {
    case 'none':
      if (frac > APPROACH_FRAC && s.outriggers.state === 'down' && !s.outriggers.ask) {
        setAlert('approaching')
        toast({ type: 'Warning', title: 'Warning: LMI approaching limit.', message: 'If extended further, you may reach LMI limit.' })
        playChime('warning')
      }
      return
    case 'approaching':
      if (frac < SAFE_FRAC) {
        setAlert('none')
        success('LMI is back to a safe zone.', 'Continue operating.')
      }
      return
    case 'limit':
      if (isHeld('b')) {
        sensed = 0
        setAlert('sensing')
        toast({ type: 'Loading', title: 'Sensing machine balance...', message: 'Keep holding the button until you hear a sound.', picture: lmiButton })
      }
      return
    case 'sensing':
      // Let go too early: back to the Danger toast.
      if (!isHeld('b')) {
        setAlert('limit')
        dangerToast()
        return
      }
      sensed += dt
      if (sensed >= SENSING_S) {
        setAlert('allow')
        playChime('success')
        toast({ type: 'Action', title: 'Machine will begin reconfiguring. Allow?', action: { label: 'Allow', onPress: allow } })
      }
      return
    case 'reconfiguring': {
      // Pull the cab straight back in toward the machine at the same height, until LMI is safe again.
      const tip = s.machineTip
      // (The cab hangs out in front of the boom tip, so aim the tip just in front of the turret.)
      const arrived = moveToward({ x: TURRET.x, y: tip.y, z: TURRET.z - 1 }, (SPEED / MACHINE_SCALE) * dt)
      if (frac <= SETTLED_FRAC || arrived) {
        setAlert(frac > APPROACH_FRAC ? 'approaching' : 'none')
        playChime('success')
        success('Done configuring.', 'Machine is ready to operate.')
      }
      return
    }
  }
}

function allow() {
  if (useSim.getState().lmiAlert !== 'allow') return
  setAlert('reconfiguring')
  toast({ type: 'Loading', title: 'Machine reconfiguring...' })
}
