// Tracks which keys are held down. The 3D scene reads this every frame.
const held = new Set<string>()
// Keys still held down from a move that just finished. They don't count as held until they're let go
// (Hanne: after a joystick move completes, holding W does nothing until you let go and press it again).
const ignored = new Set<string>()

window.addEventListener('keydown', (e) => held.add(e.key.toLowerCase()))
window.addEventListener('keyup', (e) => {
  held.delete(e.key.toLowerCase())
  ignored.delete(e.key.toLowerCase())
  // While Cmd is down, macOS never reports letting go of other keys (like during a screenshot), so they'd stay
  // "held" forever. Letting go of Cmd clears them all.
  if (e.key === 'Meta') {
    held.clear()
    ignored.clear()
  }
})
const clearAll = () => {
  held.clear()
  ignored.clear()
}
document.addEventListener('visibilitychange', clearAll)
window.addEventListener('blur', clearAll)

export const isHeld = (key: string) => held.has(key) && !ignored.has(key)

/** A joystick move just finished: if the joystick (W) is still held, ignore it until it's let go. */
export function releaseJoystickFirst() {
  if (held.has('w')) ignored.add('w')
}
