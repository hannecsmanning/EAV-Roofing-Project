// Ascend on the map (Figma "Ascend to Ledge Flow"): the nearest roof edge lights up as a teal "Ledge highlight"
// (8 px). When the truck is too far, a dashed teal line runs from the truck's side to the ledge, with a
// "Distance pill" ("8 ft away") placed by the map on top.
import { useSim } from '../../store'
import { color } from '../../tokens/tokens'
import { MACHINE } from '../../scene/machineSpec'
import { ledgeFromTruck, toFeet } from '../../flows/ascendRetract'

/** The dashed distance line's ends (world meters) and the feet to show, or null when it shouldn't show. */
export function ledgeDistance() {
  const { lift, truck, truckHeading } = useSim.getState()
  if (lift.flow !== 'ascend' || lift.phase !== 'tooFar') return null
  const l = ledgeFromTruck()
  // From the middle of the truck's side facing the ledge (or its middle, if the ledge isn't beside it).
  const side = l.beside ? Math.sign(l.right) * (MACHINE.width / 2) : 0
  const back = l.beside ? l.back : 0
  const c = Math.cos(truckHeading)
  const s = Math.sin(truckHeading)
  const from = { x: truck.x + side * c + back * s, z: truck.z - side * s + back * c }
  return { from, to: { x: l.edge.point[0], z: l.edge.point[1] }, feet: toFeet(l.gap) }
}

export function LedgeHint() {
  const lift = useSim((s) => s.lift)
  useSim((s) => s.truck) // follow the truck while it drives closer
  if (lift.flow !== 'ascend') return null
  const { edge } = ledgeFromTruck()
  const d = ledgeDistance()
  return (
    <g>
      <line
        x1={edge.a[0]} y1={edge.a[1]} x2={edge.b[0]} y2={edge.b[1]}
        stroke={color.interactiveAction} strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke"
      />
      {d && (
        <line
          x1={d.from.x} y1={d.from.z} x2={d.to.x} y2={d.to.z}
          stroke={color.interactiveAction} strokeWidth={3} strokeDasharray="9.4 7.5" vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}
