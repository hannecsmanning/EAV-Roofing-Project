// Power on, idle and off. docs/CONTEXT.md "Power on, idle and off", Figma "Power On, Idle and Off".
//   off: the screen is dark. P (the physical Start button) or a tap turns the screen on.
//   pin: the map is under the Map lock with the PIN keypad (1117, or Unlock with no PIN).
//   checking: the start-up check card (Outriggers, then LMI), Loading toast "Running start-up check...".
//   ready: both checks show OK and a Step toast says "Start-up check passed." for a second (Hanne, 2026-11-25).
//   on: then the machine starts on its own: the main screen, Success toast "Machine started. You are in Drive mode."
//     and a sound. No Start press.
//   idle: after 60 seconds without movement (Hanne), the map dims, the Idle chip shows and a Step toast says how to
//     wake it. Touching the screen or moving a joystick wakes it, with no password.
//   turningOff: P while on. Loading toast "Turning off...", then the screen goes dark.
// The machine only moves while on. Off and idle both lock it in place.
import { useSim, isDismounted } from '../store'
import { playChime } from '../sound'

export type Power = 'off' | 'pin' | 'checking' | 'ready' | 'on' | 'idle' | 'turningOff'

export const POWER_TOAST = 'power'
const PIN = '1117'
export const IDLE_AFTER_MS = 60_000
const CHECK_STEP_MS = 1200 // each start-up check takes this long (placeholder)
const PASSED_MS = 1000 // "Start-up check passed." shows this long before the machine starts
const OFF_MS = 1500 // "Turning off..." shows this long before the screen goes dark
const STARTED_TOAST_MS = 3000

let timers: ReturnType<typeof setTimeout>[] = []
const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms))
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}
const setPower = (power: Power) => useSim.setState({ power })
const toast = (t: Parameters<ReturnType<typeof useSim.getState>['showToast']>[0]) => useSim.getState().showToast({ id: POWER_TOAST, ...t })

/** The machine is running (not off, starting up, idle or turning off). */
export const machineOn = () => useSim.getState().power === 'on'

/** The physical Start button (P, in the cab). */
export function pressStart() {
  const s = useSim.getState()
  switch (s.power) {
    case 'off':
      // The screen turns on, locked behind the PIN.
      setPower('pin')
      break
    case 'on':
    case 'idle':
      turnOff()
      break
    default:
      // Mid start-up: the button does nothing until the check passes.
      break
  }
}

/** Tapping the dark screen turns it on too. */
export function tapDarkScreen() {
  if (useSim.getState().power === 'off') setPower('pin')
}

/** The PIN keypad's Unlock. The right PIN, or no PIN (simulator bypass), runs the start-up check. */
export function unlockPower(pin: string): boolean {
  if (pin !== '' && pin !== PIN) return false
  clearTimers()
  useSim.setState({ power: 'checking', startupCheck: { outriggers: false, lmi: false } })
  toast({ type: 'Loading', title: 'Running start-up check...' })
  later(CHECK_STEP_MS, () => useSim.setState({ startupCheck: { outriggers: true, lmi: false } }))
  later(CHECK_STEP_MS * 2, () => {
    useSim.setState({ power: 'ready', startupCheck: { outriggers: true, lmi: true } })
    toast({ type: 'Step', title: 'Start-up check passed.' })
    later(PASSED_MS, start)
  })
  return true
}

function start() {
  const s = useSim.getState()
  clearTimers()
  // Folded, the machine starts in Drive mode. If it was turned off with the cab up, it starts in Operate mode.
  const mode = s.machineRaised ? 'operate' : 'drive'
  if (s.mode !== 'walking') s.setMode(mode)
  setPower('on')
  touch()
  toast({ type: 'Success', title: 'Machine started.', message: mode === 'drive' ? 'You are in Drive mode.' : 'You are in Operate mode.' })
  playChime('success')
  later(STARTED_TOAST_MS, () => useSim.getState().clearToast(POWER_TOAST))
}

function turnOff() {
  clearTimers()
  setPower('turningOff')
  toast({ type: 'Loading', title: 'Turning off...' })
  later(OFF_MS, () => {
    useSim.getState().clearToast(POWER_TOAST)
    setPower('off')
  })
}

// ---------- Idle ----------
let lastActive = performance.now()
/** Something happened (a key, a tap, the machine moving): the idle clock starts over. */
export function touch() {
  lastActive = performance.now()
}

/** Wake from idle (touching the screen or moving a joystick). No password. */
export function wake() {
  if (useSim.getState().power !== 'idle') return
  setPower('on')
  touch()
  useSim.getState().clearToast(POWER_TOAST)
}

/** Joystick keys: moving one wakes the machine from idle. */
export const JOYSTICK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']

// Nothing in progress that the operator is in the middle of (a move, an ask, an alert flow).
function busy() {
  const s = useSim.getState()
  return (
    s.pick.phase !== 'idle' ||
    s.run.phase !== 'idle' ||
    s.lift.flow !== 'none' ||
    s.outriggers.ask !== null ||
    s.outriggers.state === 'deploying' ||
    s.outriggers.state === 'retracting' ||
    s.lmiAlert !== 'none' ||
    s.wire === 'searching' ||
    s.wire === 'acquiring'
  )
}

setInterval(() => {
  const s = useSim.getState()
  if (s.power !== 'on') return
  if (busy()) return touch()
  if (performance.now() - lastActive < IDLE_AFTER_MS) return
  setPower('idle')
  // A dismounted tablet has no joystick, so only the screen wakes it.
  toast({
    type: 'Step',
    title: 'Machine is idle.',
    message: isDismounted(s.tablet) ? 'Touch the screen to wake it.' : 'Touch the screen or move a joystick to wake it.',
  })
}, 1000)

// The machine moving counts as activity.
useSim.subscribe((s, prev) => {
  if (s.truck !== prev.truck || s.machineTip !== prev.machineTip) touch()
})
