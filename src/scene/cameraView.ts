// Looking around the 3D view with the mouse (Hanne: hold and drag).
//   Hold and drag on the 3D view: turn the camera around the truck (or the operator) and tilt it up and down.
//   Scroll on the 3D view: zoom in and out.
//   C or a double-click: back to the normal view behind the truck.
// Over the HMI tablet (or any panel), dragging and scrolling don't move the camera, because those events never
// reach the 3D view underneath.
// The camera keeps following the truck from whatever angle you set.

/** How far the view is turned from "behind the truck" (radians), tilted (radians) and zoomed (1 = normal). */
export const view = { turn: 0, tilt: 0, zoom: 1 }

const TURN_PER_PX = 0.006
const TILT_PER_PX = 0.004
export const TILT_LIMITS = { min: -0.35, max: 0.9 } // from the normal tilt: a bit lower, or up to almost overhead
const ZOOM_LIMITS = { min: 0.3, max: 2.2 }

export function resetView() {
  view.turn = 0
  view.tilt = 0
  view.zoom = 1
}

/** Hook the mouse up to the 3D view's canvas. Returns a function that unhooks it. */
export function attachViewControls(el: HTMLElement) {
  let drag: { id: number; x: number; y: number } | null = null
  el.style.cursor = 'grab'

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    el.setPointerCapture(e.pointerId)
    el.style.cursor = 'grabbing'
  }
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    view.turn -= (e.clientX - drag.x) * TURN_PER_PX
    view.tilt = Math.max(TILT_LIMITS.min, Math.min(TILT_LIMITS.max, view.tilt + (e.clientY - drag.y) * TILT_PER_PX))
    drag.x = e.clientX
    drag.y = e.clientY
  }
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    el.style.cursor = 'grab'
  }
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    view.zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, view.zoom * Math.exp(e.deltaY * 0.001)))
  }

  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('wheel', wheel, { passive: false })
  el.addEventListener('dblclick', resetView)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeEventListener('wheel', wheel)
    el.removeEventListener('dblclick', resetView)
  }
}
