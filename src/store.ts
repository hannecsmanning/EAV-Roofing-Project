import { create } from 'zustand'
import { TRUCK_START, LOADS } from './scene/siteLayout'
import type { Zone } from './scene/zones'
import type { Power } from './flows/power'
import { FOLDED, FOLDED_TIP, type MachinePose } from './scene/machineSpec'

// The simulator's shared state. Mode names match the Simulator plan in docs/CONTEXT.md.
export type Mode = 'drive' | 'operate' | 'forks' | 'walking'

export const modeLabel: Record<Mode, string> = {
  drive: 'Drive mode',
  operate: 'Operate mode',
  forks: 'Forks',
  walking: 'Walking',
}

// The truck has three speeds (docs/CONTEXT.md, Drive mode and speed alerts).
export type Speed = 'creep' | 'slow' | 'fast'
export const speedOrder: Speed[] = ['creep', 'slow', 'fast']
export const speedLabel: Record<Speed, string> = {
  creep: 'Creep speed',
  slow: 'Slow speed',
  fast: 'Fast speed',
}

/** A spot on the ground: x and z in meters. Height comes from the ground. */
export type Spot = { x: number; z: number }

// Wire acquiring flow (docs/CONTEXT.md, Figma "Wire Acquiring Flow").
// off: not connected. searching: wire button pressed. acquiring: connecting, truck slides onto the wire. connected: riding the wire.
export type WireState = 'off' | 'searching' | 'acquiring' | 'connected'

// Pick a spot on the wire (docs/CONTEXT.md "Pick a spot screens", Figma "Pick a spot - Wire ON").
// idle: nothing picked. tapped: a zone is picked, Allow? shows. joystick: allowed, waiting for the joystick.
// descending: the machine folds before driving. driving: riding the wire to the stop point.
export type PickPhase = 'idle' | 'tapped' | 'joystick' | 'descending' | 'driving' | 'configuring'
export type PickState = {
  phase: PickPhase
  zone: Zone | null
  /** Where on the wire the truck will stop, where it started, and which way it goes (+1 or -1 along the wire). */
  destS: number
  startS: number
  way: 1 | -1
  length: number
  /** True when the machine folds before driving (big zones, or a small zone in another big zone). */
  folds: boolean
  /** False when only the boom moves (a small zone it can reach without the truck moving). */
  drives: boolean
  /** How long the operator has held the joystick while descending, in seconds. */
  descended: number
  /** Dismounted tablet, big zone: the small zone on that big zone's edge nearest the truck, where the cab rises to. */
  land: Zone | null
  /** Drive mode, a spot tapped on the branch to the materials: how far out along it the truck stops (meters). */
  branchTo: number | null
}
export const NO_PICK: PickState = { phase: 'idle', zone: null, destS: 0, startS: 0, way: 1, length: 0, folds: false, drives: true, descended: 0, land: null, branchTo: null }

// Ascend to the ledge and Retract the machine (Figma "Ascend to Ledge Flow", "Retract Machine Flow").
export type LiftFlow = 'none' | 'ascend' | 'retract'
export type LiftPhase =
  | 'tooFar' // ascend: the truck isn't next to the ledge
  | 'ready' // button pressed, waiting for the joystick
  | 'moving' // rising (ascend) or folding / lowering (retract) while the joystick is held
  | 'stopped' // joystick let go: cancel?
  | 'canceling' // ascend canceled: the cab goes back down on its own
  | 'canceled' // retract canceled: stopped where it is, full manual control
  | 'outriggers' // retract step 3: waiting for the outrigger switch, then the outriggers fold up
  | 'done'
// A warning on the flow (Figma "Ascend & Retract Warnings"): uneven ground or overweight load (ascend warns, you can
// still continue), or something above / under the cab (the cab stops and asks to cancel).
export type LiftWarning = 'uneven' | 'overweight' | 'above' | 'below' | null
export type LiftState = { flow: LiftFlow; phase: LiftPhase; warn?: LiftWarning }

// Outriggers (Figma "Outrigger Flows"): the legs that steady the machine when the boom reaches out.
//   ask: the machine stopped and wants the operator to flip the switch (deploy or retract).
//   t: how far down the legs are, 0 = stowed, 1 = on the ground.
export type OutriggerState = 'up' | 'deploying' | 'down' | 'retracting'
export type Outriggers = { state: OutriggerState; ask: 'deploy' | 'retract' | null; t: number }

// LMI alerts (Figma "LMI Flows"): approaching the limit (a warning), or at the limit, where the machine stops and the
// operator holds the LMI button (sensing), taps Allow, and the machine moves itself back (reconfiguring).
export type LmiAlert = 'none' | 'approaching' | 'limit' | 'sensing' | 'allow' | 'reconfiguring'

// The HMI tablet (docs/CONTEXT.md "Dismounted HMI tablet", Figma "Pick a Spot - Dismounted HMI tablet").
//   mounted: on the truck. latched: H was pressed off the wire, so the latch stayed locked ("Latched to truck").
//   locked: taken off, waiting for the PIN. unlocked: taken off and ready for Pick a spot.
export type TabletState = 'mounted' | 'latched' | 'locked' | 'unlocked'
export const isDismounted = (t: TabletState) => t === 'locked' || t === 'unlocked'

// Forks (Fork operation, key 3): how far they're raised (+) or lowered (-) from their rest height, and pushed out,
// in model units. Loads sit where they were left (y = height of what they rest on) unless they're on the forks.
export type Forks = { lift: number; extend: number }
export type LoadSpot = { id: string; x: number; y: number; z: number; heading: number }

// Material run (Figma "Material Run Flow"): tap the Material spot, Allow, hold the joystick, ride the wire and its branch.
// The loop part is `length` meters from `startS` going `way`, then the branch out to the materials.
export type RunPhase = 'idle' | 'tapped' | 'joystick' | 'descending' | 'driving'
export type MaterialRun = { phase: RunPhase; startS: number; way: 1 | -1; length: number }
export const NO_RUN: MaterialRun = { phase: 'idle', startS: 0, way: 1, length: 0 }

// A toast at the bottom of the HMI (Figma "Toast"). Only one shows at a time.
export type ToastType = 'Action' | 'Step' | 'Loading' | 'Success' | 'Warning' | 'Danger'
export type ToastData = {
  /** Names the toast so a flow can clear only its own. */
  id?: string
  type: ToastType
  title?: string
  message?: string
  /** Optional picture on the right (240 x 152 frame), like the joystick. */
  picture?: string
  /** Action toasts: the button label (usually "Allow") and what it does. */
  action?: { label: string; onPress: () => void }
}

type SimState = {
  mode: Mode
  speed: Speed
  controlsOpen: boolean
  truck: Spot
  // Which way the truck faces, in radians. 0 = forks pointing away from the starting camera. Q turns left, E turns right.
  truckHeading: number
  operator: Spot
  /** Walking on the roof (stepped out of the cab at the roof) instead of on the ground. */
  operatorOnRoof: boolean
  // How much the ground under the truck leans, in whole degrees. Shown on the Tilt badge.
  tiltDeg: number
  // Weight on the forks, in pounds. Shown on the Load badge.
  loadLb: number
  setMode: (mode: Mode) => void
  cycleSpeed: () => void
  toggleControls: () => void
  setTruck: (spot: Spot) => void
  setTruckHeading: (heading: number) => void
  setOperator: (spot: Spot) => void
  setTilt: (deg: number) => void
  wire: WireState
  /** Close enough and lined up to connect (Drive mode, not connected). The map shows the wire as available. */
  wireAvailable: boolean
  /** While on the wire: how far along it the truck is (meters) and which way is forward. */
  wireS: number
  wireDir: 1 | -1
  setWire: (patch: Partial<Pick<SimState, 'wire' | 'wireAvailable' | 'wireS' | 'wireDir'>>) => void
  pick: PickState
  setPick: (patch: Partial<PickState>) => void
  /** Where the cab is on the roof (x, z), for the green cab zone. The map shows the big or small zone around it,
   *  to match the zoom. Folded on the wire, it's a placeholder spot on the roof in front of the truck. */
  cabSpot: Spot | null
  /** Is the machine raised (cab off the deck) or folded on the ground? */
  machineRaised: boolean
  /** How the boom is posed, and where its tip is (model units, the machine's own directions). */
  machinePose: MachinePose
  machineTip: { x: number; y: number; z: number }
  /** A short amber message over the 3D view for a blocked action, like "Get to the roof or ground." */
  blocked: string | null
  showBlocked: (text: string) => void
  setCabSpot: (spot: Spot | null) => void
  /** Alerts from the real world (Figma "alert flows"): steep or uneven ground, and an overweight load. */
  alerts: { uneven: boolean; overweight: boolean; object: boolean; danger: boolean }
  lift: LiftState
  setLift: (lift: LiftState) => void
  outriggers: Outriggers
  lmiAlert: LmiAlert
  tablet: TabletState
  /** Power on, idle and off (flows/power.ts). The simulator starts off (Hanne). */
  power: Power
  /** The start-up check card: which checks have passed. */
  startupCheck: { outriggers: boolean; lmi: boolean }
  /** Walking on the roof close to a roofer: Space talks to them (Hanne). */
  canTalk: boolean
  /** Which crew member is talking right now (their speech bubble shows), or null. */
  talking: number | null
  forks: Forks
  carried: string | null
  loadSpots: LoadSpot[]
  run: MaterialRun
  // On the material branch: meters out from the house wire (null = on the house wire itself).
  branchT: number | null
  toast: ToastData | null
  /** A flow's Loading or Action toast that an alert is covering. It comes back when the alert clears. */
  heldToast: ToastData | null
  showToast: (toast: ToastData) => void
  /** Clear the toast showing. With an id, only that flow's toast (showing or held behind an alert). */
  clearToast: (id?: string) => void
}

let blockedTimer: ReturnType<typeof setTimeout> | undefined

export const useSim = create<SimState>((set) => ({
  mode: 'drive',
  speed: 'slow',
  controlsOpen: true,
  truck: { x: TRUCK_START[0], z: TRUCK_START[2] },
  truckHeading: 0,
  operator: { x: TRUCK_START[0], z: TRUCK_START[2] },
  operatorOnRoof: false,
  tiltDeg: 0,
  loadLb: 0,
  setMode: (mode) => set({ mode }),
  cycleSpeed: () => set((s) => ({ speed: speedOrder[(speedOrder.indexOf(s.speed) + 1) % speedOrder.length] })),
  toggleControls: () => set((s) => ({ controlsOpen: !s.controlsOpen })),
  setTruck: (truck) => set({ truck }),
  setTruckHeading: (truckHeading) => set({ truckHeading }),
  setOperator: (operator) => set({ operator }),
  setTilt: (tiltDeg) => set({ tiltDeg }),
  wire: 'off',
  wireAvailable: false,
  wireS: 0,
  wireDir: 1,
  setWire: (patch) => set(patch),
  pick: NO_PICK,
  setPick: (patch) => set((s) => ({ pick: { ...s.pick, ...patch } })),
  cabSpot: null,
  machineRaised: false,
  machinePose: FOLDED,
  machineTip: { ...FOLDED_TIP },
  blocked: null,
  showBlocked: (text) => {
    set({ blocked: text })
    clearTimeout(blockedTimer)
    blockedTimer = setTimeout(() => set({ blocked: null }), 2500)
  },
  setCabSpot: (cabSpot) => set({ cabSpot }),
  alerts: { uneven: false, overweight: false, object: false, danger: false },
  lift: { flow: 'none', phase: 'ready' },
  setLift: (lift) => set({ lift }),
  outriggers: { state: 'up', ask: null, t: 0 },
  lmiAlert: 'none',
  tablet: 'mounted',
  power: 'off',
  startupCheck: { outriggers: false, lmi: false },
  canTalk: false,
  talking: null,
  forks: { lift: 0, extend: 0 },
  carried: null,
  loadSpots: LOADS.map((l) => ({ id: l.id, x: l.x, y: 0, z: l.z, heading: 0 })),
  run: NO_RUN,
  branchT: null,
  toast: null,
  heldToast: null,
  // A heads-up (Step) never hides a Warning or Danger that is showing.
  // An alert (Warning, Danger) that covers a flow's ongoing toast (Loading, or an Action waiting on the operator) holds
  // that toast, and it comes back when the alert clears. While the alert shows, the flow's Loading updates wait behind
  // it, so the alert stays readable and the newest flow toast comes back.
  showToast: (toast) =>
    set((s) => {
      const cur = s.toast
      const alertUp = cur?.type === 'Warning' || cur?.type === 'Danger'
      if (toast.type === 'Step' && alertUp) return {}
      const ongoing = (t: ToastData | null) => !!t && (t.type === 'Loading' || t.type === 'Action') && !!t.id
      // A flow's Loading update while another alert shows: wait behind the alert.
      if (toast.type === 'Loading' && alertUp && cur?.id !== toast.id) return { heldToast: toast }
      // The same flow showing something new: what it held is out of date.
      const held = s.heldToast && s.heldToast.id === toast.id ? null : s.heldToast
      // An alert covering a flow's ongoing toast: hold it.
      if ((toast.type === 'Warning' || toast.type === 'Danger') && ongoing(cur) && cur!.id !== toast.id) return { toast, heldToast: cur }
      return { toast, heldToast: held }
    }),
  clearToast: (id) =>
    set((s) => {
      if (id !== undefined && s.toast?.id !== id) return s.heldToast?.id === id ? { heldToast: null } : {}
      // The toast showing goes. A held flow toast comes back (unless it's the one being cleared).
      const back = s.heldToast && s.heldToast.id !== s.toast?.id ? s.heldToast : null
      return { toast: back, heldToast: null }
    }),
}))
