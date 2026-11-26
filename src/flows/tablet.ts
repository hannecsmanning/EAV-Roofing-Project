// The detachable HMI tablet. docs/CONTEXT.md "Dismounted HMI tablet", Figma "Pick a Spot - Dismounted HMI tablet".
//   H in the truck takes the tablet off, or clips it back on.
//   Off the wire, the latch stays locked: Map lock "Latched to truck" and a Step toast "Tablet is latched".
//     Once the wire connects, a Success toast says the latch is released.
//   On the wire: it comes off locked (Map lock "Locked", Step toast "Tablet removed"), then the PIN keypad.
//     PIN 1117, or Unlock with no PIN (simulator bypass). Success toast "Unlocked".
//   Off the truck the status bar shows the Dismounted pill, and the operator can walk with it (4).
//   Pick a spot from the tablet has no joystick: tap Allow and go.
//   Getting back in the truck with 4 clips it back on.
import { useSim, isDismounted, type TabletState } from '../store'
import { isHeld } from '../keys'
import { roofStepOut } from './roofWalk'

export const TABLET_TOAST = 'tablet'
const PIN = '1117'
const TOAST_MS = 3000

let toastTimer: ReturnType<typeof setTimeout> | undefined
const setTablet = (tablet: TabletState) => useSim.setState({ tablet })

function toast(type: 'Step' | 'Success', title: string, message: string) {
  const s = useSim.getState()
  s.showToast({ id: TABLET_TOAST, type, title, message })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(clearTabletToast, TOAST_MS)
}
export function clearTabletToast() {
  clearTimeout(toastTimer)
  const s = useSim.getState()
  s.clearToast(TABLET_TOAST)
}

/** The H key. */
export function pressH() {
  const s = useSim.getState()
  if (s.mode === 'walking') {
    if (isDismounted(s.tablet)) s.showBlocked('Get in the machine to put the tablet back.')
    return
  }
  switch (s.tablet) {
    case 'mounted':
      // It comes off on the wire, or with the cab at the roof (doc: "the tablet can be removed when the truck is on the
      // wire or when the cab is at the ledge (after Ascend, even though the wire disconnects)").
      if (s.wire !== 'connected' && !roofStepOut()) {
        setTablet('latched')
        toast('Step', 'Tablet is latched', 'Connect to the wire before you remove the tablet.')
      } else {
        setTablet('locked')
        toast('Step', 'Tablet removed', 'Unlock to use Pick a spot.')
      }
      break
    case 'latched':
      // Pressing H again lets go of the tablet: the lock goes away.
      setTablet('mounted')
      clearTabletToast()
      break
    default:
      putBack()
  }
}

/** Clip the tablet back onto the truck (H in the truck, or getting back in with 4). */
export function putBack() {
  const s = useSim.getState()
  if (s.tablet === 'mounted') return
  setTablet('mounted')
  clearTabletToast()
}

/** Unlock on the PIN keypad. The right PIN, or no PIN at all (simulator bypass), unlocks. */
export function tryUnlock(pin: string): boolean {
  if (pin !== '' && pin !== PIN) return false
  setTablet('unlocked')
  toast('Success', 'Unlocked', 'Pick a spot to move the machine.')
  return true
}

// Off the wire, the tablet waits for the wire. When it connects, the latch lets go.
useSim.subscribe((s, prev) => {
  if (s.tablet === 'latched' && s.wire === 'connected' && prev.wire !== 'connected') {
    setTablet('mounted')
    toast('Success', 'Latch released', 'You can remove the tablet now.')
  }
})

/**
 * Is the joystick pushed forward? In the cab that's holding W. A dismounted tablet has no joystick: after Allow the
 * machine just goes (doc: "Dismounted tablet: no joystick, so Pick a spot stays tap Allow and go").
 */
export function joystickHeld() {
  const s = useSim.getState()
  if (isDismounted(s.tablet)) return true
  return s.mode !== 'walking' && isHeld('w')
}

/** The joystick picture on Loading toasts, or none on a dismounted tablet. */
export const joystickPicture = (pic: string) => (isDismounted(useSim.getState().tablet) ? undefined : pic)
