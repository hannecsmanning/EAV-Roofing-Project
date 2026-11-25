// Placeholder sounds, made in the browser (no sound files yet).
let ctx: AudioContext | null = null

/** A short two-note chime, for heads-ups and confirmations. */
export function playChime(kind: 'info' | 'success' | 'warning' = 'info') {
  ctx ??= new AudioContext()
  // Warning: two lower, sharper beeps (doc: Warning and Danger always come with a sound).
  const notes = kind === 'success' ? [660, 880] : kind === 'warning' ? [520, 520] : [880, 660]
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    const start = ctx!.currentTime + i * 0.14
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.15, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(start)
    osc.stop(start + 0.32)
  })
}
