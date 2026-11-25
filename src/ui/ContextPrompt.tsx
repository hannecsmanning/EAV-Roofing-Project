import { useSim } from '../store'
import { canGetIn } from '../scene/collision'
import { loadInReach } from '../flows/forks'
import { Keycap } from './Keycap'

// Floats over the 3D view (doc: "Context prompts float over the 3D view: a keycap plus text for actions like
// 'L Pick up load', and an amber warning for blocked actions like 'Get to the roof or ground.'").
export function ContextPrompt() {
  const blocked = useSim((s) => s.blocked)
  const getIn = useSim((s) => s.mode === 'walking' && canGetIn(s.operator, s.truck, s.truckHeading))
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
  const prompt = getIn ? { key: '4', text: 'Get in the machine' } : load ? { key: 'L', text: load } : null
  if (!prompt) return null
  return (
    <div className="context-prompt">
      <Keycap label={prompt.key} />
      <span>{prompt.text}</span>
    </div>
  )
}
