// What every HMI map draws, in real-world meters (x = right, y = z in the 3D world).
// Built from the same site data as the 3D world, so the map always matches it.
import { forwardRef } from 'react'
import { useSim, type WireState } from '../../store'
import { color, heat } from '../../tokens/tokens'
import { ROOF_OUTLINE, OBSTACLES, wirePath, BRANCH, MATERIAL_PIN } from '../../scene/siteLayout'
import { MAP_PX_PER_M } from '../../scene/roofShape'
import { MACHINE, MACHINE_DESIGN } from '../../scene/machineSpec'
import { ROOF_BOX, gridLines } from '../../scene/zones'
import { steepPatches } from '../../scene/steepGround'
import { obstacleGaps } from '../../scene/collision'
import { HEAT_RANGE_M, OBJECT_ALERT_M, OBJECT_DANGER_M } from '../../flows/alerts'
import roofRender from '../../assets/hmi/roof-render.png'
import post from '../../assets/hmi/post.svg'
import tree1 from '../../assets/hmi/tree-1.svg'
import tree2 from '../../assets/hmi/tree-2.svg'
import tree3 from '../../assets/hmi/tree-3.svg'
import tree4 from '../../assets/hmi/tree-4.svg'

// ---------- Shared numbers ----------

/** Drive zoom: the Figma truck icon (440 px from fork tips to back) at the renders' full truck length. */
export const DRIVE_PX_PER_M = 440.117 / MACHINE_DESIGN.length
/** The Machine · Aerial icon, folded, at its Figma size. */
export const ICON = { w: 223.334, h: 440.117 }
/** How long the icon is in real meters (true to size at any zoom). */
export const ICON_LENGTH_M = MACHINE.length
/** How much the Drive screen's truck icon shrinks from its Figma size, so it matches the real (scaled) truck. */
export const DRIVE_ICON_SCALE = (ICON_LENGTH_M * DRIVE_PX_PER_M) / ICON.h
/** The icon spans fork tips to back bumper, and so does the 3D truck, so their middles match. */
export const ICON_AHEAD_M = 0

export { ROOF_BOX }

/** A view of the map: world point (wx, wz) shows at screen point (ax, ay), scaled and turned. */
export type View = { s: number; ax: number; ay: number; wx: number; wz: number; rot: number }

export const viewTransform = (v: View) =>
  `translate(${v.ax} ${v.ay}) rotate(${(v.rot * 180) / Math.PI}) scale(${v.s}) translate(${-v.wx} ${-v.wz})`

/** Where a world point lands on screen in this view. */
export function toScreen(v: View, x: number, z: number) {
  const dx = (x - v.wx) * v.s
  const dz = (z - v.wz) * v.s
  const c = Math.cos(v.rot)
  const s = Math.sin(v.rot)
  return { x: v.ax + dx * c - dz * s, y: v.ay + dx * s + dz * c }
}

// ---------- Drawing ----------

// The roof picture, from the zone map frame: 720 x 577 px, starting 8 px up and left of the roof edge.
const ROOF_IMAGE = {
  x: ROOF_BOX.minX - 8 / MAP_PX_PER_M,
  z: ROOF_BOX.minZ - 8 / MAP_PX_PER_M,
  w: 720 / MAP_PX_PER_M,
  h: 577 / MAP_PX_PER_M,
}

const bigLines = gridLines('big')
const smallLines = gridLines('small')

// Tree and post pictures carry room for a soft shadow around the shape (percent of the shape's size, from Figma).
type Pad = { t: number; r: number; b: number; l: number }
const TREES: { src: string; pad: Pad }[] = [
  { src: tree1, pad: { t: 10.65, r: 16.24, b: 21.29, l: 16.24 } },
  { src: tree2, pad: { t: 7.56, r: 10.75, b: 15.11, l: 10.75 } },
  { src: tree3, pad: { t: 9.55, r: 13.64, b: 19.1, l: 13.64 } },
  { src: tree4, pad: { t: 5.79, r: 8.6, b: 11.59, l: 8.6 } },
]
const POST = { src: post, pad: { t: 30.77, r: 46.15, b: 61.54, l: 46.15 }, sizeM: 0.35 }

function Padded({ src, pad, x, z, w, h }: { src: string; pad: Pad; x: number; z: number; w: number; h: number }) {
  return (
    <image
      href={src}
      x={x - w / 2 - (w * pad.l) / 100}
      y={z - h / 2 - (h * pad.t) / 100}
      width={w * (1 + (pad.l + pad.r) / 100)}
      height={h * (1 + (pad.t + pad.b) / 100)}
      preserveAspectRatio="none"
    />
  )
}

const wireD =
  'M' + wirePath().map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join('L') + 'Z' +
  // The branch out to the Material spot pin (Figma "Wire branch to materials").
  ` M${BRANCH.start.x},${BRANCH.start.z}L${MATERIAL_PIN.x},${MATERIAL_PIN.z}`
const roofPoints = ROOF_OUTLINE.map(([x, z]) => `${x},${z}`).join(' ')
// Ground to avoid: every patch too steep for the machine, worked out once from the real ground.
const steepD = steepPatches()
  .map((loop) => 'M' + loop.map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`).join('L') + 'Z')
  .join(' ')

/** The truck location ring is this wide in real meters at every zoom (70 px on the zone map, 300 px zoomed in). */
export const RING_DIAMETER_M = 70.7 / MAP_PX_PER_M

type Props = {
  /** Zone grids on the roof (Operate): big zones (3 px lines) and small zones (2 px). Opacity set from outside. */
  bigGridRef?: React.Ref<SVGGElement>
  smallGridRef?: React.Ref<SVGGElement>
  /** Extra drawing on the roof, clipped to the roof edge (cab zone, picked zone). */
  onRoof?: React.ReactNode
  /** Extra drawing on top of the wire (Pick a spot route). */
  overWire?: React.ReactNode
  /** Drawn last, on top of everything (the live machine when raised). */
  onTop?: React.ReactNode
  /** Truck location ring (Operate). Its position and line width are set from outside. */
  ringRef?: React.Ref<SVGCircleElement>
  /** The wire line. Its opacity is set from outside (the Operate zone map hides it). */
  wireRef?: React.Ref<SVGGElement>
  /** The soft green band under a connected wire. Its opacity is set from outside (the zone map has none). */
  bandRef?: React.Ref<SVGPathElement>
  /** How wide the green band is, in real meters. */
  bandWidthM: number
  /** Dark outline on the roof edge (Operate frames have it, Drive does not). */
  roofEdge?: boolean
}

/** The map's world layer. Move it with the `transform` from viewTransform(). */
export const MapContents = forwardRef<SVGGElement, Props>(function MapContents({ bigGridRef, smallGridRef, onRoof, overWire, onTop, ringRef, wireRef, bandRef, bandWidthM, roofEdge = false }, ref) {
  return (
    <g ref={ref}>
      <defs>
        <clipPath id="hmi-roof-clip">
          <polygon points={roofPoints} />
        </clipPath>
      </defs>
      {/* Ground to avoid (Figma): see-through orange with a dashed orange edge, drawn under objects since it's part of the ground */}
      <path d={steepD} fill={color.feedbackWarning} fillOpacity={0.18} stroke={color.feedbackWarning} strokeWidth={3} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {OBSTACLES.filter((o) => o.kind === 'bush').map((o, i) => (
        <Padded key={o.id} {...TREES[i % TREES.length]} x={o.x} z={o.z} w={o.radius * 2} h={o.radius * 2} />
      ))}
      {OBSTACLES.filter((o) => o.kind === 'post').map((o) => (
        <Padded key={o.id} src={POST.src} pad={POST.pad} x={o.x} z={o.z} w={POST.sizeM} h={POST.sizeM} />
      ))}
      <HeatGlow />
      <image
        href={roofRender}
        x={ROOF_IMAGE.x}
        y={ROOF_IMAGE.z}
        width={ROOF_IMAGE.w}
        height={ROOF_IMAGE.h}
        preserveAspectRatio="none"
        clipPath="url(#hmi-roof-clip)"
        opacity={0.55}
      />
      {smallGridRef && <Grid lines={smallLines} px={2} gRef={smallGridRef} />}
      {bigGridRef && <Grid lines={bigLines} px={3} gRef={bigGridRef} />}
      {onRoof && <g clipPath="url(#hmi-roof-clip)">{onRoof}</g>}
      {roofEdge && (
        // Roof edge: border-control gray, 3 px on screen (Figma "Roof edge")
        <polygon points={roofPoints} fill="none" stroke={color.borderControl} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
      <WireLine wireRef={wireRef} bandRef={bandRef} bandWidthM={bandWidthM} />
      {overWire}
      {ringRef && (
        // Truck location ring, Type=Truck: interactive-focus line and a light fill (Figma ring: 12% fill).
        <circle ref={ringRef} r={RING_DIAMETER_M / 2} fill={color.interactiveFocus} fillOpacity={0.12} stroke={color.interactiveFocus} vectorEffect="non-scaling-stroke" />
      )}
      {onTop}
    </g>
  )
})

// ---------- Wire ----------
// How the wire looks in each state of the Wire acquiring flow (Figma "Wire Acquiring Flow"). Always 6 px on screen.
//   not connected: light gray line · available: gray dashes at 60% · searching: teal dashes
//   acquiring: green dashes · connected: green line over a soft green band (25%)
const DASH = '14 10' // Figma: 14 px dashes, 10 px gaps
function wireLook(wire: WireState, available: boolean, routeShown: boolean) {
  // Pick a spot: while the route shows, the rest of the wire is action-disabled gray.
  if (wire === 'connected' && routeShown) return { stroke: color.actionDisabled, dash: undefined, opacity: 1 }
  if (wire === 'connected') return { stroke: color.feedbackSuccess, dash: undefined, opacity: 1 }
  if (wire === 'acquiring') return { stroke: color.feedbackSuccess, dash: DASH, opacity: 1 }
  if (wire === 'searching') return { stroke: color.interactiveAction, dash: DASH, opacity: 1 }
  if (available) return { stroke: color.borderControl, dash: DASH, opacity: 0.6 }
  return { stroke: color.neutral200, dash: undefined, opacity: 1 }
}

function WireLine({ wireRef, bandRef, bandWidthM }: Pick<Props, 'wireRef' | 'bandRef' | 'bandWidthM'>) {
  const wire = useSim((s) => s.wire)
  const available = useSim((s) => s.wireAvailable)
  const routeShown = useSim((s) => s.pick.drives && (s.pick.phase === 'joystick' || s.pick.phase === 'descending' || s.pick.phase === 'driving'))
  const look = wireLook(wire, available, routeShown)
  return (
    <>
      {wire === 'connected' && !routeShown && (
        <path ref={bandRef} d={wireD} fill="none" stroke={color.feedbackSuccess} strokeOpacity={0.25} strokeWidth={bandWidthM} strokeLinejoin="round" />
      )}
      <g ref={wireRef}>
        <path
          d={wireD}
          fill="none"
          stroke={look.stroke}
          strokeOpacity={look.opacity}
          strokeWidth={6}
          strokeDasharray={look.dash}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </g>
    </>
  )
}

// Zone grid lines: white, clipped to the roof (Figma "Big zone line" 3 px, "Grid col/row" 2 px).
function Grid({ lines, px, gRef }: { lines: ReturnType<typeof gridLines>; px: number; gRef: React.Ref<SVGGElement> }) {
  return (
    <g ref={gRef} clipPath="url(#hmi-roof-clip)">
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.z1} x2={l.x2} y2={l.z2} stroke={color.surfaceCanvas} strokeWidth={px} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
}

// ---------- Object proximity heat map (Figma "Object Detection Flows") ----------
// Bushes and posts near the truck light up on the side facing it. The closer, the bigger and hotter the glow:
// light amber, then orange when the Object detection alert fires, then a red-orange edge when the machine stops.
// Each object is judged on its own distance, so several can glow at once.
const GLOW_STOPS = {
  far: [[0, heat.light], [1, heat.base]],
  alert: [[0, heat.orange], [0.45, heat.light], [1, heat.base]],
  danger: [[0, heat.hot], [0.3, heat.orange], [0.7, heat.light], [1, heat.base]],
} as const

function HeatGlow() {
  const truck = useSim((s) => s.truck)
  const heading = useSim((s) => s.truckHeading)
  const inTruck = useSim((s) => s.mode !== 'walking')
  if (!inTruck) return null
  const bushes = OBSTACLES.filter((o) => o.kind === 'bush')
  return (
    <>
      {obstacleGaps(truck, heading)
        .filter((g) => g.gap < HEAT_RANGE_M)
        .map(({ o, gap }) => {
          const bush = o.kind === 'bush'
          const size = bush ? o.radius * 2 : POST.sizeM
          const look = bush ? TREES[bushes.indexOf(o) % TREES.length] : POST
          const band = gap < OBJECT_DANGER_M ? 'danger' : gap < OBJECT_ALERT_M ? 'alert' : 'far'
          // Grows from about half the object to past its far side as the gap closes (Figma: 41, 67, 86 px on a 74 px object).
          const closeness = 1 - gap / HEAT_RANGE_M
          const r = size * (0.55 + 0.6 * closeness)
          // Centered on the object's edge facing the truck.
          const d = Math.hypot(truck.x - o.x, truck.z - o.z) || 1
          const cx = o.x + ((truck.x - o.x) / d) * (size / 2)
          const cz = o.z + ((truck.z - o.z) / d) * (size / 2)
          return (
            <g key={o.id}>
              <defs>
                <radialGradient id={`heat-${o.id}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cz} r={r}>
                  {GLOW_STOPS[band].map(([offset, c]) => (
                    <stop key={offset} offset={offset} stopColor={c} />
                  ))}
                </radialGradient>
                <mask id={`heat-mask-${o.id}`}>
                  <Padded src={look.src} pad={look.pad} x={o.x} z={o.z} w={size} h={size} />
                </mask>
              </defs>
              <rect
                x={o.x - size * 1.5} y={o.z - size * 1.5} width={size * 3} height={size * 3}
                fill={`url(#heat-${o.id})`} mask={`url(#heat-mask-${o.id})`}
              />
            </g>
          )
        })}
    </>
  )
}
