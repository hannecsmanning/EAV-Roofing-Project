// Figma "Distance pill": how far the truck is from the ledge ("8 ft away"), over the dashed distance line.
// It keeps the same size at any zoom, so the map places it in screen pixels.
import { forwardRef } from 'react'
import { ledgeDistance } from './LedgeHint'

export const DistancePill = forwardRef<HTMLDivElement>(function DistancePill(_, ref) {
  return <div ref={ref} className="hmi-distance-pill" />
})

/** Show the pill above the middle of the distance line, or hide it. `toScreen` turns world meters into map pixels. */
export function placeDistancePill(el: HTMLDivElement | null, toScreen: (x: number, z: number) => { x: number; y: number }) {
  if (!el) return
  const d = ledgeDistance()
  if (!d) {
    el.style.display = 'none'
    return
  }
  const p = toScreen((d.from.x + d.to.x) / 2, (d.from.z + d.to.z) / 2)
  el.textContent = `${d.feet} ft away`
  el.style.display = 'block'
  el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -140%)`
}
