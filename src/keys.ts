// Tracks which keys are held down. The 3D scene reads this every frame.
const held = new Set<string>()

window.addEventListener('keydown', (e) => held.add(e.key.toLowerCase()))
window.addEventListener('keyup', (e) => {
  held.delete(e.key.toLowerCase())
  // While Cmd is down, macOS never reports letting go of other keys (like during a screenshot), so they'd stay
  // "held" forever. Letting go of Cmd clears them all.
  if (e.key === 'Meta') held.clear()
})
document.addEventListener('visibilitychange', () => held.clear())
window.addEventListener('blur', () => held.clear())

export const isHeld = (key: string) => held.has(key)
