// The Operate screen map. Figma sections "Zoom In and Out of Map" and "'Pick a spot' Feature - Wire ON".
//   1 · Zone map: the whole roof, centered. Big zones when on the wire; no wire line when off it.
//   2 · Zooming in: 2.2x, following the truck. Small-zone lines when on the wire.
//   3 · Zoomed in: 4.2x, following the truck, small-zone grid.
//   Route: during Pick a spot (after Allow), the map zooms to show just the route, above the toast and left of the buttons.
// The map turns so the truck always points up. Zooming takes 300 ms and eases out.
import { useEffect, useMemo, useRef } from 'react'
import { useSim, type PickPhase } from '../../store'
import { color } from '../../tokens/tokens'
import { MAP_PX_PER_M } from '../../scene/roofShape'
import { pointAt, routePoints, routeLength, poseOnWire, branchPoints, JUNCTION_S } from '../../scene/wireTrack'
import { zoneRect, zoneAt, sameZone, SMALL_ZONE_M, type Zone } from '../../scene/zones'
import { useLmiLevel, limitReach } from '../../flows/lmi'
import { lmiLocked } from '../../flows/lmiAlerts'
import { tapMap, pickIsMoving } from '../../flows/pickASpot'
import { MachineAerial } from '../MachineAerial'
import { LiveMachine, machineTransform, type LiveMachineHandle } from './LiveMachine'
import { LedgeHint } from './LedgeHint'
import { DistancePill, placeDistancePill } from './DistancePill'
import { MapContents, ROOF_BOX, ICON, ICON_LENGTH_M, ICON_AHEAD_M, viewTransform, toScreen, type View } from './MapContents'
import destinationRing from '../../assets/hmi/destination-ring.svg'
import packageIcon from '../../assets/hmi/material-package.svg'
import packageIconSelected from '../../assets/hmi/material-package-selected.svg'
import { tapMaterialSpot, runIsMoving } from '../../flows/materialRun'
import { MATERIAL_PIN, BRANCH_LENGTH } from '../../scene/siteLayout'
import truckArrow from '../../assets/hmi/truck-indicator-arrow.svg'

export type ZoomLevel = 1 | 2 | 3
export type ViewKey = ZoomLevel | 'route'

const ZOOM_S: Record<ZoomLevel, number> = {
  1: MAP_PX_PER_M, // roof edge 701 px wide
  2: (MAP_PX_PER_M * 1542.2) / 701,
  3: (MAP_PX_PER_M * 2974.4) / 701,
}
// Where the followed point sits in the machine view (Figma). Zone map: roof centered. Zoomed: truck location ring center.
const ANCHOR: Record<ZoomLevel, [number, number]> = {
  1: [188 + 701 / 2, 48 + 552 / 2],
  2: [423 + 155.54 / 2, 405 + 155.54 / 2],
  3: [450 + 299.98 / 2, 316 + 299.98 / 2],
}
// The route view fits here: above the toast (top at 516) and left of the + and − buttons (at 988).
const ROUTE_BOX = { left: 40, right: 960, top: 40, bottom: 492 }

// The green band under a connected wire: 80 px wide fully zoomed in (doc), the same real width at the middle zoom.
const BAND_WIDTH_M = 80 / ZOOM_S[3]
const ZOOM_MS = 300
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** The short way round from angle a to angle b. */
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

type Params = {
  s: number
  /** Which way the map is turned (radians). */
  rot: number
  anchor: [number, number]
  focus: [number, number]
  ringPx: number
  bigGrid: number
  smallGrid: number
  wire: number
  band: number
}

// Panning (drag the map) and drilling into a big zone (+ with a big zone tapped). Set by OperateMap, read by paramsFor.
const mapView: { pan: { x: number; z: number }; focus: Zone | null } = { pan: { x: 0, z: 0 }, focus: null }
// Drilled into a big zone: centered in the machine view (doc: "jumps straight to full zoom, centered on the tapped big zone").
const FOCUS_ANCHOR: [number, number] = [1108 / 2, 716 / 2]

// The route view only changes when a new route starts, so it is worked out once per route.
let routeCache: { key: string; params: Params } | null = null

/** Everything that depends on the zoom level (or the route view), for the current truck and wire state. */
function paramsFor(key: ViewKey): Params {
  const { truck, truckHeading, wire, pick, wireDir } = useSim.getState()
  const onWire = wire === 'connected'
  if (key === 'route') {
    const cacheKey = `${pick.startS}|${pick.destS}|${pick.way}`
    if (routeCache?.key === cacheKey) return routeCache.params
    // Fit the truck, the route and the stop point, turned the same way as the map.
    const pts = routePoints(pick.startS, pick.way, pick.length).concat([truck])
    // The route view holds still: turned the way the truck faced when the move started, not following each corner.
    const rot = poseOnWire(pick.startS, wireDir).heading
    const c = Math.cos(rot)
    const sn = Math.sin(rot)
    const rx = pts.map((p) => p.x * c - p.z * sn)
    const ry = pts.map((p) => p.x * sn + p.z * c)
    const [minX, maxX, minY, maxY] = [Math.min(...rx), Math.max(...rx), Math.min(...ry), Math.max(...ry)]
    const pad = 4 // meters of breathing room
    const s = Math.min(
      (ROUTE_BOX.right - ROUTE_BOX.left) / (maxX - minX + pad * 2),
      (ROUTE_BOX.bottom - ROUTE_BOX.top) / (maxY - minY + pad * 2),
      ZOOM_S[3],
    )
    // The middle of the fitted box, turned back into world meters.
    const mx = (minX + maxX) / 2
    const my = (minY + maxY) / 2
    const params: Params = {
      s,
      rot,
      anchor: [(ROUTE_BOX.left + ROUTE_BOX.right) / 2, (ROUTE_BOX.top + ROUTE_BOX.bottom) / 2],
      focus: [mx * c + my * sn, -mx * sn + my * c],
      ringPx: 4,
      bigGrid: 1,
      smallGrid: 0,
      wire: 1,
      band: 0,
    }
    routeCache = { key: cacheKey, params }
    return params
  }
  return {
    s: ZOOM_S[key],
    rot: truckHeading,
    anchor: key === 3 && mapView.focus ? FOCUS_ANCHOR : ANCHOR[key],
    focus:
      key === 1
        ? [(ROOF_BOX.minX + ROOF_BOX.maxX) / 2, (ROOF_BOX.minZ + ROOF_BOX.maxZ) / 2]
        : key === 3 && mapView.focus
          ? [zoneMiddle(mapView.focus)[0] + mapView.pan.x, zoneMiddle(mapView.focus)[1] + mapView.pan.z]
          : [truck.x + mapView.pan.x, truck.z + mapView.pan.z],
    ringPx: { 1: 4, 2: 5, 3: 6 }[key],
    // On the wire: big zones on the zone map, small-zone lines zoomed in. Off the wire: small zones only fully zoomed in.
    bigGrid: onWire && key === 1 ? 1 : 0,
    smallGrid: key === 3 || (onWire && key === 2) ? 1 : 0,
    // Off the wire, the zone map shows no wire line.
    wire: onWire || key !== 1 ? 1 : 0,
    band: key === 1 ? 0 : 1,
  }
}

/** The middle of a zone, in world meters. */
function zoneMiddle(zone: Zone): [number, number] {
  const r = zoneRect(zone)
  return [r.x + r.size / 2, r.z + r.size / 2]
}

const pathD = (pts: { x: number; z: number }[]) => (pts.length ? 'M' + pts.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join('L') : '')

export function OperateMap({ view, zoom, focusZone = null, dim = true }: { view: ViewKey; zoom: ZoomLevel; focusZone?: Zone | null; dim?: boolean }) {
  mapView.focus = focusZone
  const world = useRef<SVGGElement>(null)
  const bigGrid = useRef<SVGGElement>(null)
  const smallGrid = useRef<SVGGElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const wire = useRef<SVGGElement>(null)
  const band = useRef<SVGPathElement>(null)
  const driven = useRef<SVGPathElement>(null)
  const ahead = useRef<SVGPathElement>(null)
  const startDot = useRef<SVGCircleElement>(null)
  const icon = useRef<HTMLDivElement>(null)
  const liveG = useRef<SVGGElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const live = useRef<LiveMachineHandle>(null)
  const destination = useRef<HTMLImageElement>(null)
  const materialPin = useRef<HTMLButtonElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const indicatorArrow = useRef<HTMLImageElement>(null)
  // Zoom animation: from one view to another, starting at a time.
  const anim = useRef<{ from: ViewKey; to: ViewKey; start: number }>({ from: view, to: view, start: 0 })

  // Draw everything for the current truck position, Pick a spot state and zoom progress.
  const draw = useRef<() => boolean>(() => false)
  draw.current = () => {
    const st = useSim.getState()
    const { truck, truckHeading, pick, wireS } = st
    const { from, to, start } = anim.current
    const t = to === from ? 1 : easeOut(Math.min(1, (performance.now() - start) / ZOOM_MS))
    const a = paramsFor(from)
    const b = paramsFor(to)
    const v: View = {
      s: a.s * Math.pow(b.s / a.s, t), // zoom evenly, not faster at one end
      ax: lerp(a.anchor[0], b.anchor[0], t),
      ay: lerp(a.anchor[1], b.anchor[1], t),
      wx: lerp(a.focus[0], b.focus[0], t),
      wz: lerp(a.focus[1], b.focus[1], t),
      rot: a.rot + angleDiff(a.rot, b.rot) * t,
    }
    world.current?.setAttribute('transform', viewTransform(v))
    bigGrid.current?.setAttribute('opacity', String(lerp(a.bigGrid, b.bigGrid, t)))
    smallGrid.current?.setAttribute('opacity', String(lerp(a.smallGrid, b.smallGrid, t)))
    wire.current?.setAttribute('opacity', String(lerp(a.wire, b.wire, t)))
    band.current?.setAttribute('opacity', String(lerp(a.band, b.band, t)))
    if (ring.current) {
      ring.current.setAttribute('cx', String(truck.x))
      ring.current.setAttribute('cy', String(truck.z))
      ring.current.setAttribute('stroke-width', String(lerp(a.ringPx, b.ringPx, t)))
    }

    // Pick a spot route: solid green behind the truck, green dots ahead, a small green dot where it started.
    if (driven.current && ahead.current && startDot.current) {
      if (runIsMoving(st.run.phase)) {
        // Material run: dotted ahead along the house wire to the branch, then out the branch to the materials.
        const onBranch = st.branchT !== null
        const loop = onBranch ? [] : routePoints(wireS, st.run.way, routeLength(wireS, JUNCTION_S, st.run.way))
        ahead.current.setAttribute('d', pathD(loop.concat(branchPoints(st.branchT ?? 0, BRANCH_LENGTH + 3.5))))
        driven.current.setAttribute('d', '')
        startDot.current.setAttribute('opacity', '0')
      } else if (pickIsMoving(pick.phase) && pick.drives && pick.phase !== 'configuring') {
        const done = routeLength(pick.startS, wireS, pick.way)
        const driving = done > 0.05 && done < pick.length + 0.5
        const left = routeLength(wireS, pick.destS, pick.way)
        driven.current.setAttribute('d', pathD(driving ? routePoints(pick.startS, pick.way, done) : []))
        ahead.current.setAttribute('d', pathD(routePoints(wireS, pick.way, Math.min(left, pick.length))))
        const s0 = pointAt(pick.startS)
        startDot.current.setAttribute('cx', String(s0.x))
        startDot.current.setAttribute('cy', String(s0.z))
        startDot.current.setAttribute('r', String(8 / v.s))
        startDot.current.setAttribute('opacity', driving ? '1' : '0')
      } else {
        driven.current.setAttribute('d', '')
        ahead.current.setAttribute('d', '')
        startDot.current.setAttribute('opacity', '0')
      }
    }

    // Raised: draw the machine live in its real pose. Folded: the Figma render.
    const raised = st.machineRaised
    if (liveG.current) {
      liveG.current.setAttribute('display', raised ? 'inline' : 'none')
      if (raised) {
        liveG.current.setAttribute('transform', machineTransform(truck.x, truck.z, truckHeading))
        live.current?.update(st.machineTip, st.machinePose)
      }
    }
    if (icon.current) icon.current.style.display = raised ? 'none' : 'block'

    // Truck icon: always points up (the map turns instead) and is true to size at every zoom.
    const c = toScreen(v, truck.x - Math.sin(truckHeading) * ICON_AHEAD_M, truck.z - Math.cos(truckHeading) * ICON_AHEAD_M)
    if (icon.current) {
      const k = (ICON_LENGTH_M * v.s) / ICON.h
      // Normally the map turns so the icon points up. In the route view the map holds still, so the icon turns instead.
      icon.current.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%) rotate(${-(truckHeading - v.rot)}rad) scale(${k})`
    }

    // Destination dot on the wire where the truck will stop (same size at every zoom).
    if (destination.current) {
      const show = pick.phase !== 'idle' && pick.drives // boom-only moves: the truck doesn't go anywhere
      destination.current.style.display = show ? 'block' : 'none'
      if (show) {
        const p = pointAt(pick.destS)
        const d = toScreen(v, p.x, p.z)
        destination.current.style.transform = `translate(${d.x}px, ${d.y}px) translate(-50%, -50%)`
      }
    }

    // Truck indicator: when the truck is off screen (or under the toast), pin a pill to the edge pointing at it.
    if (indicator.current && indicatorArrow.current) {
      const bottom = st.toast ? 516 : 716
      const off = c.x < 0 || c.x > 1108 || c.y < 0 || c.y > bottom
      indicator.current.style.display = off ? 'flex' : 'none'
      if (off) {
        const x = Math.max(24 + 85, Math.min(1108 - 24 - 85, c.x))
        const y = Math.max(24 + 31, Math.min(bottom - 16 - 31, c.y))
        indicator.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
        const deg = (Math.atan2(c.y - y, c.x - x) * 180) / Math.PI - 90
        indicatorArrow.current.style.transform = `rotate(${deg}deg)`
      }
    }
    // Material spot pin: same size at every zoom. Teal from the tap until the truck arrives.
    if (materialPin.current) {
      const m = toScreen(v, MATERIAL_PIN.x, MATERIAL_PIN.z)
      materialPin.current.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%)`
      materialPin.current.classList.toggle('hmi-material-pin--selected', st.run.phase !== 'idle')
    }
    placeDistancePill(pill.current, (x, z) => toScreen(v, x, z))
    return t < 1
  }

  // Start a zoom animation when the view changes.
  useEffect(() => {
    // A new view starts centered again (panning is per view).
    mapView.pan = { x: 0, z: 0 }
    const { to } = anim.current
    if (view === to) return
    anim.current = { from: to, to: view, start: performance.now() }
    let frame = 0
    const step = () => {
      if (draw.current()) frame = requestAnimationFrame(step)
      else anim.current.from = anim.current.to
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [view])

  // Redraw after React updates what's drawn (wire state, picked zone, cab zone).
  const wireState = useSim((s) => s.wire)
  const pick = useSim((s) => s.pick)
  const run = useSim((s) => s.run)
  const cabZone = useSim((s) => s.cabZone)
  useEffect(() => {
    draw.current()
  }, [wireState, pick, cabZone, run, focusZone])

  // Follow the truck as it moves or turns.
  useEffect(() => {
    draw.current()
    return useSim.subscribe(() => draw.current())
  }, [])

  /** A point on screen → world meters, through the map's current transform. */
  const toWorldPt = (clientX: number, clientY: number) => {
    const m = world.current?.getScreenCTM()
    return m ? new DOMPoint(clientX, clientY).matrixTransform(m.inverse()) : null
  }

  // Pull and drag to pan the map, zoomed in (doc: "Pull and drag to pan the map"). A short press is still a tap.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const canPan = view === 2 || (view === 3 && !(focusZone && dim))
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !canPan) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return
    if (!d.moved) {
      // Keep getting moves even if the cursor leaves the map mid-drag.
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // Not a live pointer (can happen with test events): panning still works while over the map.
      }
    }
    d.moved = true
    const a = toWorldPt(d.x, d.y)
    const b = toWorldPt(e.clientX, e.clientY)
    if (a && b) {
      mapView.pan.x += a.x - b.x
      mapView.pan.z += a.y - b.y
      draw.current()
    }
    d.x = e.clientX
    d.y = e.clientY
  }
  const onPointerUp = () => {
    // Let the click that follows a drag know it was a drag.
    setTimeout(() => (drag.current = null))
  }

  // Tap the map to pick a zone (Pick a spot).
  const onTap = (e: React.MouseEvent) => {
    if (drag.current?.moved) return
    const p = toWorldPt(e.clientX, e.clientY)
    if (!p) return
    // Drilled into a big zone: only small zones inside it can be picked.
    if (focusZone && dim && !sameZone(zoneAt('big', p.x, p.y), focusZone)) return
    tapMap(p.x, p.y, zoom)
  }

  return (
    <>
      <svg
        className="hmi-live-map"
        width="100%"
        height="100%"
        onClick={onTap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: canPan ? 'grab' : undefined }}
      >
        <MapContents
          ref={world}
          bigGridRef={bigGrid}
          smallGridRef={smallGrid}
          ringRef={ring}
          wireRef={wire}
          bandRef={band}
          bandWidthM={BAND_WIDTH_M}
          roofEdge
          onTop={
            <>
              {focusZone && dim && <FocusDim zone={focusZone} />}
              <LiveMachine ref={live} gRef={liveG} />
            </>
          }
          onRoof={<><RiskTint />{focusZone && dim && <FocusOutline zone={focusZone} />}<RoofZones onWire={wireState === 'connected'} cabZone={cabZone} picked={pick.zone} phase={pick.phase} /></>}
          overWire={
            <>
              <LedgeHint />
              {/* Route: driven part solid green, the part ahead green dots (Figma "Route · ahead": 7 px round dots) */}
              <path ref={driven} fill="none" stroke={color.feedbackSuccess} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path ref={ahead} fill="none" stroke={color.feedbackSuccess} strokeWidth={7} strokeDasharray="0 13.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle ref={startDot} fill={color.feedbackSuccess} opacity={0} />
            </>
          }
        />
      </svg>
      <div ref={icon} className="hmi-operate-icon">
        <MachineAerial />
      </div>
      {/* Truck location ring, Type=Destination: where the truck will stop on the wire */}
      <img ref={destination} src={destinationRing} width={120} height={120} alt="" className="hmi-destination" />
      {/* Material spot (Figma "Material spot"): tap it to send the truck to the materials */}
      <button ref={materialPin} className="hmi-material-pin" aria-label="Material spot" onClick={tapMaterialSpot}>
        <img src={packageIcon} width={44} height={44} alt="" className="hmi-material-pin__icon" />
        <img src={packageIconSelected} width={44} height={44} alt="" className="hmi-material-pin__icon--selected" />
      </button>
      <DistancePill ref={pill} />
      {/* Truck indicator: points at the truck when it's off screen */}
      <div ref={indicator} className="hmi-truck-indicator">
        <img ref={indicatorArrow} src={truckArrow} width={32} height={32} alt="" />
        <span>Truck</span>
      </div>
    </>
  )
}

/** The green cab zone ("cab is here") and the picked zone (Tapped, then Confirming). Clipped to the roof. */
function RoofZones({ onWire, cabZone, picked, phase }: { onWire: boolean; cabZone: Zone | null; picked: Zone | null; phase: PickPhase }) {
  return (
    <>
      {onWire && cabZone && (
        // Cab zone, Fill=Soft: success green at 55%.
        <rect {...xywh(zoneRect(cabZone))} fill={color.feedbackSuccess} fillOpacity={0.55} />
      )}
      {picked && (
        // Selected zone: Tapped = 20% teal fill, Confirming = solid teal. 6 px interactive-action outline.
        <rect
          {...xywh(zoneRect(picked))}
          fill={color.interactiveAction}
          fillOpacity={phase === 'tapped' ? 0.2 : 1}
          stroke={color.interactiveAction}
          strokeWidth={6}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  )
}

const xywh = (r: { x: number; z: number; size: number }) => ({ x: r.x, y: r.z, width: r.size, height: r.size })

// ---------- Risky zones (Figma "LMI Flows" · Risk tint + Risk line) ----------
// As LMI rises, the zones where the cab would push LMI past the limit tint feedback-warning at 30% with a 4 px
// warning line along their edge. At the limit, they tint feedback-error. Worked out from the real truck spot, load
// and outriggers, one small zone at a time. Sits inside the roof clip.
function RiskTint() {
  const level = useLmiLevel()
  const atLimit = useSim((s) => lmiLocked(s.lmiAlert))
  const truck = useSim((s) => s.truck)
  const down = useSim((s) => s.outriggers.state === 'down')
  const load = useSim((s) => s.loadLb)
  const tint = atLimit ? color.feedbackError : color.feedbackWarning
  const { rects, line } = useMemo(() => {
    const R = limitReach(down, load)
    const size = SMALL_ZONE_M
    const risky = (col: number, row: number) => {
      const r = zoneRect({ kind: 'small', col, row })
      return Math.hypot(r.x + size / 2 - truck.x, r.z + size / 2 - truck.z) > R
    }
    const c0 = zoneAt('small', ROOF_BOX.minX, ROOF_BOX.minZ)
    const c1 = zoneAt('small', ROOF_BOX.maxX, ROOF_BOX.maxZ)
    const rects: { x: number; z: number; size: number }[] = []
    let line = ''
    for (let col = c0.col; col <= c1.col; col++) {
      for (let row = c0.row; row <= c1.row; row++) {
        if (!risky(col, row)) continue
        const r = zoneRect({ kind: 'small', col, row })
        rects.push(r)
        // The risk line: every edge this zone shares with a safe zone.
        if (!risky(col - 1, row)) line += `M${r.x},${r.z}V${r.z + size}`
        if (!risky(col + 1, row)) line += `M${r.x + size},${r.z}V${r.z + size}`
        if (!risky(col, row - 1)) line += `M${r.x},${r.z}H${r.x + size}`
        if (!risky(col, row + 1)) line += `M${r.x},${r.z + size}H${r.x + size}`
      }
    }
    return { rects, line }
  }, [truck.x, truck.z, down, load])
  if (level < 3 && !atLimit) return null
  return (
    <g>
      {rects.map((r) => (
        <rect key={`${r.x},${r.z}`} x={r.x} y={r.z} width={r.size} height={r.size} fill={tint} fillOpacity={0.3} />
      ))}
      <path d={line} stroke={tint} strokeWidth={4} vectorEffect="non-scaling-stroke" fill="none" />
    </g>
  )
}

// ---------- Drilled into a big zone (doc: "On the wire, tap a big zone, zoom in, pick a small zone", step 3) ----------
// The big zone is outlined in interactive-action (6 px), clipped to the roof edge, and the rest of the map is dimmed
// with a 60% white layer.
function FocusOutline({ zone }: { zone: Zone }) {
  return <rect {...xywh(zoneRect(zone))} fill="none" stroke={color.interactiveAction} strokeWidth={6} vectorEffect="non-scaling-stroke" />
}
function FocusDim({ zone }: { zone: Zone }) {
  const r = zoneRect(zone)
  const far = 1000 // meters: well past the edge of the map
  // A huge rectangle with the big zone cut out of it.
  const d = `M${-far},${-far}H${far}V${far}H${-far}Z M${r.x},${r.z}V${r.z + r.size}H${r.x + r.size}V${r.z}Z`
  return <path d={d} fill={color.surfaceCanvas} fillOpacity={0.6} fillRule="evenodd" pointerEvents="none" />
}
