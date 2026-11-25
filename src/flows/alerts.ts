// Alerts that fire from the real 3D world (CLAUDE.md: "Alerts fire from real distance and tilt, not scripted triggers").
// Figma "alert flows" and docs/CONTEXT.md "Drive mode and speed alerts":
//   Uneven ground / steep slope (tilt at or over MAX_TILT_DEG): amber Tilt badge, Boom restricted + Creep speed chips,
//     Warning toast ("Ground is too steep." in Drive, "Ground is uneven." in Operate). Level again: Success toast.
//   Overweight load (load over MAX_LOAD_LB): amber Load badge with the max, Creep speed chip, Warning toast.
//     Back within the limit: Success toast.
// Creep speed means the truck (and the machine driving itself) moves at creep speed. Boom restricted means the
// boom is limited, not locked: the cab moves at half speed.
import { useSim } from '../store'
import { MAX_TILT_DEG, MAX_LOAD_LB } from '../scene/siteLayout'
import { playChime } from '../sound'
import { obstacleGaps } from '../scene/collision'
import type { Spot } from '../store'

const TOAST = 'alert'
const SUCCESS_MS = 4000

/** Speed limits while an alert is on. */
export const restrictions = () => {
  const { alerts } = useSim.getState()
  return { creep: alerts.uneven || alerts.overweight || alerts.object || alerts.danger, boomSlow: alerts.uneven }
}

let successTimer: ReturnType<typeof setTimeout> | undefined
function successToast(title: string, message: string) {
  const s = useSim.getState()
  s.showToast({ id: TOAST, type: 'Success', title, message })
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    if (useSim.getState().toast?.id === TOAST && useSim.getState().toast?.type === 'Success') useSim.getState().clearToast()
  }, SUCCESS_MS)
}

/** Called every frame: compare the real tilt and load with the limits, and start or clear the alerts. */
export function tickAlerts() {
  const s = useSim.getState()
  if (s.mode === 'walking') return
  const uneven = s.tiltDeg >= MAX_TILT_DEG
  const overweight = s.loadLb > MAX_LOAD_LB
  const was = s.alerts
  tickObjects()
  if (uneven === was.uneven && overweight === was.overweight) return
  useSim.setState({ alerts: { ...useSim.getState().alerts, uneven, overweight } })

  if (uneven && !was.uneven) {
    s.showToast({
      id: TOAST,
      type: 'Warning',
      title: s.mode === 'drive' ? 'Ground is too steep.' : 'Ground is uneven.',
      message: 'Boom movement and speed are restricted until the ground is level.',
    })
    playChime('warning')
  } else if (!uneven && was.uneven) {
    successToast('Ground is level.', 'Boom movement and normal speed are back.')
  }

  if (overweight && !was.overweight) {
    s.showToast({ id: TOAST, type: 'Warning', title: 'Load is over the limit.', message: 'Speed is reduced to creep until the load is lighter.' })
    playChime('warning')
  } else if (!overweight && was.overweight) {
    successToast('Load is within the limit.', 'Normal speed is back.')
  }
}

/** The cab's speed in real meters per second: half while Boom restricted is on (limited, not locked). */
export const cabSpeed = (base: number) => base * (restrictions().boomSlow ? 0.5 : 1)

// ---------- Object detection (Figma "Object Detection Flows") ----------
// Each bush and post is judged on its own distance from the truck's edge (placeholders until the ID confirms):
export const HEAT_RANGE_M = 2.5 // the glow starts (Figma: 180 px from the truck's edge)
export const OBJECT_ALERT_M = 1.0 // orange glow, Object detection alert, creep speed
export const OBJECT_DANGER_M = 0.35 // red-orange edge, the machine stops (the optional Danger step)
const OBJECT_TOAST = 'alert-object'

const SIDE_TEXT = { left: 'the left side of', right: 'the right side of', front: 'the front of', back: 'behind' } as const

function tickObjects() {
  const s = useSim.getState()
  const gaps = obstacleGaps(s.truck, s.truckHeading)
  const nearest = gaps.reduce((a, b) => (b.gap < a.gap ? b : a))
  const object = nearest.gap < OBJECT_ALERT_M
  const danger = nearest.gap < OBJECT_DANGER_M
  const was = s.alerts
  if (object === was.object && danger === was.danger) return
  useSim.setState({ alerts: { ...was, object, danger } })

  if (danger) {
    s.showToast({ id: OBJECT_TOAST, type: 'Danger', title: 'Object very close.', message: 'Machine stopped. Move away from the object to continue.' })
    playChime('warning')
  } else if (object) {
    const where = nearest.side === 'back' ? 'behind the truck' : `${SIDE_TEXT[nearest.side]} the truck`
    s.showToast({ id: OBJECT_TOAST, type: 'Warning', title: 'Object detected.', message: `Slowing to creep speed. Check ${where}.` })
    if (!was.object) playChime('warning')
  } else if (s.toast?.id === OBJECT_TOAST) {
    s.clearToast()
  }
}

/** Danger: the machine stopped. It may only move away from the object, not closer. */
export function blockedByObject(from: Spot, to: Spot, fromHeading: number, toHeading: number) {
  if (!useSim.getState().alerts.danger) return false
  const near = (t: Spot, h: number) => Math.min(...obstacleGaps(t, h).map((g) => g.gap))
  return near(to, toHeading) < near(from, fromHeading)
}
