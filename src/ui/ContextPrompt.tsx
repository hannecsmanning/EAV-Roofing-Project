import { useSim } from '../store'
import { canGetIn } from '../scene/collision'
import { roofStepOut, canGetInFromRoof } from '../flows/roofWalk'
import { loadInReach } from '../flows/forks'
import { Keycap } from './Keycap'

// Floats over the 3D view (doc: "Context prompts float over the 3D view: a keycap plus text for actions like
// 'L Pick up load', and an amber warning for blocked actions like 'Get to the roof or ground.'").
export function ContextPrompt() {
  const blocked = useSim((s) => s.blocked)
  const getIn = useSim((s) => s.mode === 'walking' && (s.operatorOnRoof ? canGetInFromRoof(s.operator) : canGetIn(s.operator, s.truck, s.truckHeading)))
  // Walking next to a crew member (a roofer on the roof, the foreman on the ground): Space talks to them.
  const talk = useSim((s) => s.canTalk && s.talking === null)
  // Off, in the cab: how to turn the machine on (P is the Start button; tapping the dark tablet works too).
  const off = useSim((s) => s.power === 'off' && s.mode !== 'walking')
  // In the cab at the roof: 4 steps out onto it.
  const stepOut = useSim((s) => s.mode !== 'walking' && s.machineRaised && roofStepOut() !== null)
  // L: drop the load on the forks, or pick up one the forks are close to. (Shown while carrying only in Fork operation, so it doesn't sit on screen the whole time.)
  const load = useSim((s) => {
    if (s.mode === 'walking') return null
    if (s.carried) return s.mode === 'forks' ? 'Drop load' : null
    return loadInReach() ? 'Pick up load' : null
  })
  if (blocked) {
    return (
      <div className="context-prompt context-prompt--warning" role="alert">
        <span>{blocked}</span>
      </div>
    )
  }
  const prompt = off
    ? { key: 'P', text: 'Tap the screen or press P to turn on the truck', at: 'tablet' }
    : talk
    ? { key: 'Space', text: 'Press space to talk' }
    : getIn
    ? { key: '4', text: 'Get in the machine' }
    : load
      ? { key: 'L', text: load }
      : stepOut
        ? { key: '4', text: 'Step onto the roof' }
        : null
  if (!prompt) return null
  return (
    <div className={'at' in prompt && prompt.at === 'tablet' ? 'context-prompt context-prompt--tablet' : 'context-prompt'}>
      <Keycap label={prompt.key} />
      <span>{prompt.text}</span>
    </div>
  )
}
