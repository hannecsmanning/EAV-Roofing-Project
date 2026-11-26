// The Drive screen map. The truck icon stays put and the map moves and turns under it,
// so the truck always points up (like the Figma Drive frame).
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useSim } from '../../store'
import { MapContents, DRIVE_PX_PER_M, DRIVE_ICON_SCALE, ICON_AHEAD_M, viewTransform, toScreen, type View } from './MapContents'
import { LedgeHint } from './LedgeHint'
import { DistancePill, placeDistancePill } from './DistancePill'
import { MATERIAL_PIN } from '../../scene/siteLayout'
import { tapMaterialSpot } from '../../flows/materialRun'
import { tapWire, pickIsMoving } from '../../flows/pickASpot'
import { pointAt, routePoints, routeLength, branchPoints, JUNCTION_S } from '../../scene/wireTrack'
import type { PickState } from '../../store'
import { color } from '../../tokens/tokens'
import destinationRing from '../../assets/hmi/destination-ring.svg'
import packageIcon from '../../assets/hmi/material-package.svg'
import packageIconSelected from '../../assets/hmi/material-package-selected.svg'

// Where the middle of the truck icon sits in the machine view (Figma: 223 x 440 at left 352, top 124).
const ICON_CENTER = { x: 352 + 223.334 / 2, y: 124 + 440.117 / 2 }

// Dragged away from the truck: how far, in screen pixels (Figma size). The map and the truck icon move together.
// It snaps back once the truck starts moving.
const pan = { x: 0, y: 0 }
let panFrom: { x: number; z: number } | null = null // where the truck was when the map was dragged
// Pinch or scroll zooms smoothly around the truck (the Drive map has no zoom levels). 1 = the Figma Drive scale.
// The zoom stays while you drive; only the drag snaps back.
let zoom = 1
const ZOOM_MIN = 0.3
const ZOOM_MAX = 2
/** How far from the wire a tap still picks it: about a finger's width on the tablet (Figma px). */
const TAP_REACH_PX = 48

const pathD = (pts: { x: number; z: number }[]) => (pts.length ? 'M' + pts.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join('L') : '')

/** Where a spot picked on the wire is (house wire or branch). */
const pickedSpot = (p: PickState) => (p.branchTo !== null ? branchPoints(p.branchTo, p.branchTo)[0] : pointAt(p.destS))

/** The route still ahead of the truck, and the part already driven (Pick a spot route look). */
function routeParts(p: PickState, wireS: number, branchT: number | null) {
  const toDest = (from: number) => routePoints(from, p.way, routeLength(from, p.destS, p.way))
  let ahead: { x: number; z: number }[]
  if (branchT !== null) {
    ahead = p.branchTo !== null ? branchPoints(branchT, p.branchTo) : branchPoints(branchT, 0).concat(toDest(JUNCTION_S))
  } else {
    ahead = toDest(wireS).concat(p.branchTo !== null ? branchPoints(0, p.branchTo) : [])
  }
  const driven = branchT === null ? routePoints(p.startS, p.way, routeLength(p.startS, wireS, p.way)) : []
  return { ahead, driven }
}
// The map redraws through this when the zoom changes outside a store update (the + and − buttons, a pinch).
let redraw: () => void = () => {}
const listeners = new Set<() => void>()
function setZoom(z: number) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  redraw()
  listeners.forEach((l) => l())
}
/** The Drive map's zoom, for the + and − buttons (which turn gray at the limits). */
export function useDriveZoom() {
  const z = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => zoom)
  return { atMin: z <= ZOOM_MIN + 1e-3, atMax: z >= ZOOM_MAX - 1e-3 }
}
/** + and −: one step (×1.5 in or out), easing over 300 ms like the Operate map. */
const STEP = 1.5
const ZOOM_MS = 300
let anim = 0
let settle: ReturnType<typeof setTimeout> | undefined
let target = 1 // where the current step ends, so quick taps add up
export function stepDriveZoom(dir: 1 | -1) {
  const from = zoom
  const base = anim ? target : zoom
  const to = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, base * (dir > 0 ? STEP : 1 / STEP)))
  target = to
  const start = performance.now()
  cancelAnimationFrame(anim)
  // Always land on the step, even if animation frames are slow (a busy or background tab).
  clearTimeout(settle)
  settle = setTimeout(() => {
    cancelAnimationFrame(anim)
    anim = 0
    setZoom(to)
  }, ZOOM_MS + 30)
  const tick = () => {
    const t = Math.min(1, (performance.now() - start) / ZOOM_MS)
    const e = 1 - Math.pow(1 - t, 3)
    setZoom(from * Math.pow(to / from, e))
    anim = t < 1 ? requestAnimationFrame(tick) : 0
  }
  tick()
}

export function DriveMap({ iconRef }: { iconRef?: React.RefObject<HTMLDivElement | null> }) {
  const world = useRef<SVGGElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const materialPin = useRef<HTMLButtonElement>(null)
  const destination = useRef<HTMLImageElement>(null)
  const ahead = useRef<SVGPathElement>(null)
  const driven = useRef<SVGPathElement>(null)
  const placeRef = useRef<() => void>(() => {})

  // Move the map straight from the truck's position (no React re-render every frame).
  useEffect(() => {
    const place = ({ truck, truckHeading, run, pick, wireS, branchT }: {
      truck: { x: number; z: number }
      truckHeading: number
      run: { phase: string }
      pick: PickState
      wireS: number
      branchT: number | null
    }) => {
      // The truck moved since the drag: back to the normal view.
      if (panFrom && Math.hypot(truck.x - panFrom.x, truck.z - panFrom.z) > 0.05) {
        pan.x = pan.y = 0
        panFrom = null
      }
      if (iconRef?.current) iconRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${DRIVE_ICON_SCALE * zoom})`
      const view: View = {
        s: DRIVE_PX_PER_M * zoom,
        ax: ICON_CENTER.x + pan.x,
        ay: ICON_CENTER.y + pan.y,
        wx: truck.x - Math.sin(truckHeading) * ICON_AHEAD_M,
        wz: truck.z - Math.cos(truckHeading) * ICON_AHEAD_M,
        rot: truckHeading,
      }
      world.current?.setAttribute('transform', viewTransform(view))
      placeDistancePill(pill.current, (x, z) => toScreen(view, x, z))
      // Material spot pin: tap it to send the truck to the materials, the same as on the Operate map (Hanne).
      if (materialPin.current) {
        const m = toScreen(view, MATERIAL_PIN.x, MATERIAL_PIN.z)
        materialPin.current.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%)`
        materialPin.current.classList.toggle('hmi-material-pin--selected', run.phase !== 'idle')
      }
      // A spot picked on the wire: the green destination dot, then the route once the move starts.
      const wirePick = pick.phase !== 'idle' && pick.zone === null
      if (destination.current) {
        destination.current.style.display = wirePick ? 'block' : 'none'
        if (wirePick) {
          const d = toScreen(view, pickedSpot(pick).x, pickedSpot(pick).z)
          destination.current.style.transform = `translate(${d.x}px, ${d.y}px) translate(-50%, -50%)`
        }
      }
      const showRoute = wirePick && pickIsMoving(pick.phase)
      const parts = showRoute ? routeParts(pick, wireS, branchT) : { ahead: [], driven: [] }
      ahead.current?.setAttribute('d', pathD(parts.ahead))
      driven.current?.setAttribute('d', pathD(pick.phase === 'driving' ? parts.driven : []))
    }
    placeRef.current = () => place(useSim.getState())
    redraw = placeRef.current
    place(useSim.getState())
    return useSim.subscribe(place)
  }, [iconRef])

  // Pull and drag to pan (Hanne). Pointer moves are in screen pixels; the HMI is scaled to fit the tablet.
  // A short press is a tap (it picks a spot on the wire); moving past a few pixels makes it a drag.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = svg.current
    if (!d || !el) return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return
      d.moved = true
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // Not a live pointer (test events): dragging still works while over the map.
      }
    }
    const k = el.clientWidth / el.getBoundingClientRect().width // screen px → Figma px
    pan.x += (e.clientX - d.x) * k
    pan.y += (e.clientY - d.y) * k
    const { truck } = useSim.getState()
    panFrom = { x: truck.x, z: truck.z }
    d.x = e.clientX
    d.y = e.clientY
    placeRef.current()
  }
  const onPointerUp = () => {
    // Let the click that follows a drag know it was a drag.
    setTimeout(() => (drag.current = null))
  }
  // Tap: a spot on the wire (Drive mode, on the wire) starts Pick a spot to there.
  const onTap = (e: React.MouseEvent) => {
    if (drag.current?.moved) return
    const m = world.current?.getScreenCTM()
    if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    tapWire(p.x, p.y, TAP_REACH_PX / (DRIVE_PX_PER_M * zoom))
  }

  // Pinch (a trackpad pinch arrives as a scroll with Ctrl) or scroll: smooth zoom, kept within limits.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      // The truck stays where it is on screen; the map grows or shrinks around it.
      cancelAnimationFrame(anim)
      setZoom(zoom * factor)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  return (
    <>
      <svg
        ref={svg}
        className="hmi-live-map"
        width="100%"
        height="100%"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onTap}
        style={{ cursor: 'grab' }}
      >
        <MapContents
          ref={world}
          bandWidthM={40 / DRIVE_PX_PER_M}
          overWire={
            <>
              <LedgeHint />
              {/* Route to a spot picked on the wire: driven part solid green, the part ahead green dots */}
              <path ref={driven} fill="none" stroke={color.feedbackSuccess} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path ref={ahead} fill="none" stroke={color.feedbackSuccess} strokeWidth={7} strokeDasharray="0 13.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </>
          }
        />
      </svg>
      <DistancePill ref={pill} />
      {/* Truck location ring, Type=Destination: where the truck will stop on the wire */}
      <img ref={destination} src={destinationRing} width={120} height={120} alt="" className="hmi-destination" />
      <button ref={materialPin} className="hmi-material-pin" aria-label="Material spot" onClick={tapMaterialSpot}>
        <img src={packageIcon} width={44} height={44} alt="" className="hmi-material-pin__icon" />
        <img src={packageIconSelected} width={44} height={44} alt="" className="hmi-material-pin__icon--selected" />
      </button>
    </>
  )
}
