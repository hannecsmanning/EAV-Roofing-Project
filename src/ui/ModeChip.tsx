import { modeLabel, speedLabel, useSim } from '../store'

// Top left: the mode chip, and in Drive mode a chip for the current speed.
export function ModeChip() {
  const mode = useSim((s) => s.mode)
  const speed = useSim((s) => s.speed)
  return (
    <div className="top-chips">
      <div className="mode-chip">{modeLabel[mode]}</div>
      {mode === 'drive' && <div className="mode-chip mode-chip--speed">{speedLabel[speed]}</div>}
    </div>
  )
}
