// The wire as a track the truck can ride: positions are measured as "meters along the wire" (s).
import { wirePath, groundTiltDeg, MAX_TILT_DEG, BRANCH } from './siteLayout'
import type { Spot } from '../store'

const pts = wirePath()
const n = pts.length
// Distance along the wire to each point.
const at: number[] = [0]
for (let i = 1; i <= n; i++) {
  const [ax, az] = pts[i - 1]
  const [bx, bz] = pts[i % n]
  at.push(at[i - 1] + Math.hypot(bx - ax, bz - az))
}
/** Total length of the wire loop, in meters. */
export const WIRE_LENGTH = at[n]

const wrap = (s: number) => ((s % WIRE_LENGTH) + WIRE_LENGTH) % WIRE_LENGTH

/** The spot on the wire `s` meters along it (wraps around the loop). */
export function pointAt(s: number): Spot {
  const t = wrap(s)
  let lo = 0
  let hi = n
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (at[mid] <= t) lo = mid
    else hi = mid
  }
  const [ax, az] = pts[lo]
  const [bx, bz] = pts[(lo + 1) % n]
  const k = (t - at[lo]) / (at[lo + 1] - at[lo])
  return { x: ax + (bx - ax) * k, z: az + (bz - az) * k }
}

/** The nearest spot on the wire to (x, z): how far along it is, how far away, and which way the wire runs there. */
export function nearestOnWire(x: number, z: number) {
  let best = { s: 0, dist: Infinity, tx: 1, tz: 0 }
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[(i + 1) % n]
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
    const d = Math.hypot(x - (ax + dx * k), z - (az + dz * k))
    if (d < best.dist) {
      const len = Math.sqrt(len2)
      best = { s: at[i] + k * len, dist: d, tx: dx / len, tz: dz / len }
    }
  }
  return best
}

// The truck rides the wire like a vehicle on a rail: points this far ahead and behind its middle sit on the wire.
const HALF_WHEELBASE = 2

/** Where the truck sits, and which way it faces, when its middle is `s` along the wire. `dir` = +1 or -1: which way along the wire is forward. */
export function poseOnWire(s: number, dir: 1 | -1) {
  const front = pointAt(s + dir * HALF_WHEELBASE)
  const rear = pointAt(s - dir * HALF_WHEELBASE)
  const fx = front.x - rear.x
  const fz = front.z - rear.z
  // The truck faces (-sin h, -cos h), so h comes from the forward direction like this.
  return { x: (front.x + rear.x) / 2, z: (front.z + rear.z) / 2, heading: Math.atan2(-fx, -fz) }
}

// ---------- Routes along the wire (Pick a spot) ----------

/** How far the truck travels from s0 to s1 going in direction `way` (+1 = increasing s). */
export function routeLength(s0: number, s1: number, way: 1 | -1) {
  return wrap(way * (s1 - s0))
}

/** Can the truck ride this stretch? Not where the wire runs down ground steeper than the max tilt. */
export function routeIsClear(s0: number, s1: number, way: 1 | -1, dir: 1 | -1) {
  const len = routeLength(s0, s1, way)
  for (let d = 0; d <= len; d += 0.5) {
    const p = poseOnWire(s0 + way * d, dir)
    if (groundTiltDeg(p.x, p.z) > MAX_TILT_DEG) return false
  }
  return true
}

/** The shortest clear way from s0 to s1, or null if both ways are blocked. */
export function bestRoute(s0: number, s1: number, dir: 1 | -1): { way: 1 | -1; length: number } | null {
  const ways = ([1, -1] as const)
    .map((way) => ({ way, length: routeLength(s0, s1, way) }))
    .sort((a, b) => a.length - b.length)
  return ways.find((w) => routeIsClear(s0, s1, w.way, dir)) ?? null
}

/** Points along the wire from s0, going `way`, for `length` meters (about every 0.25 m). */
export function routePoints(s0: number, way: 1 | -1, length: number): Spot[] {
  const out: Spot[] = []
  const steps = Math.max(1, Math.ceil(length / 0.25))
  for (let i = 0; i <= steps; i++) out.push(pointAt(s0 + (way * length * i) / steps))
  return out
}

// ---------- The branch to the materials (Figma "Material Run Flow") ----------
// Positions on the branch are "meters out from the junction" (t): 0 = on the house wire, BRANCH.length = at the materials.

/** Where the branch leaves the house wire, as meters along the wire. */
export const JUNCTION_S = nearestOnWire(BRANCH.start.x, BRANCH.start.z).s
/** Over the first few meters of the branch the truck turns from the wire's direction to face out along the branch. */
const TURN_M = 3

/** Where the truck sits, and which way it faces, `t` meters out along the branch. On the branch it always faces out
 *  (forks toward the materials). `dir` is which way it faced on the house wire, so the turn blends from there. */
export function poseOnBranch(t: number, dir: 1 | -1) {
  const k = Math.max(0, Math.min(1, t / TURN_M))
  const ease = k * k * (3 - 2 * k)
  const from = poseOnWire(JUNCTION_S, dir).heading
  const turn = Math.atan2(Math.sin(BRANCH.heading - from), Math.cos(BRANCH.heading - from))
  return { x: BRANCH.start.x + BRANCH.dir.x * t, z: BRANCH.start.z + BRANCH.dir.z * t, heading: from + turn * ease }
}

/** Points along the branch between t0 and t1. */
export function branchPoints(t0: number, t1: number): Spot[] {
  const steps = Math.max(1, Math.ceil(Math.abs(t1 - t0) / 0.25))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / steps
    return { x: BRANCH.start.x + BRANCH.dir.x * t, z: BRANCH.start.z + BRANCH.dir.z * t }
  })
}
