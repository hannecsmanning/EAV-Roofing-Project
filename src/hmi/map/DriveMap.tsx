// The Drive screen map. The truck icon stays put and the map moves and turns under it,
// so the truck always points up (like the Figma Drive frame).
import { useEffect, useRef } from 'react'
import { useSim } from '../../store'
import { MapContents, DRIVE_PX_PER_M, ICON_AHEAD_M, viewTransform, toScreen, type View } from './MapContents'
import { LedgeHint } from './LedgeHint'
import { DistancePill, placeDistancePill } from './DistancePill'

// Where the middle of the truck icon sits in the machine view (Figma: 223 x 440 at left 352, top 124).
const ICON_CENTER = { x: 352 + 223.334 / 2, y: 124 + 440.117 / 2 }

export function DriveMap() {
  const world = useRef<SVGGElement>(null)
  const pill = useRef<HTMLDivElement>(null)

  // Move the map straight from the truck's position (no React re-render every frame).
  useEffect(() => {
    const place = ({ truck, truckHeading }: { truck: { x: number; z: number }; truckHeading: number }) => {
      const view: View = {
        s: DRIVE_PX_PER_M,
        ax: ICON_CENTER.x,
        ay: ICON_CENTER.y,
        wx: truck.x - Math.sin(truckHeading) * ICON_AHEAD_M,
        wz: truck.z - Math.cos(truckHeading) * ICON_AHEAD_M,
        rot: truckHeading,
      }
      world.current?.setAttribute('transform', viewTransform(view))
      placeDistancePill(pill.current, (x, z) => toScreen(view, x, z))
    }
    place(useSim.getState())
    return useSim.subscribe(place)
  }, [])

  return (
    <>
      <svg className="hmi-live-map" width="100%" height="100%">
        <MapContents ref={world} bandWidthM={40 / DRIVE_PX_PER_M} overWire={<LedgeHint />} />
      </svg>
      <DistancePill ref={pill} />
    </>
  )
}
