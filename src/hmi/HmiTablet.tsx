// The HMI tablet frame on the right of the simulator screen.
// Screens are built at the Figma size (1280 x 832) and scaled down to fit the frame.
import { useSim, isDismounted } from '../store'
import { DriveScreen } from './DriveScreen'
import { OperateScreen } from './OperateScreen'
import { tapDarkScreen, wake, touch } from '../flows/power'
import './hmi.css'

export function HmiTablet() {
  const mode = useSim((s) => s.mode)
  const raised = useSim((s) => s.machineRaised)
  // Off the truck, the tablet is for Pick a spot: always the Operate map (Figma "Pick a Spot - Dismounted HMI tablet").
  const dismounted = useSim((s) => isDismounted(s.tablet))
  const power = useSim((s) => s.power)
  // Touching the screen counts as activity. While idle, the touch only wakes the machine (it doesn't also tap a zone).
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (useSim.getState().power === 'idle') {
      e.stopPropagation()
      e.preventDefault()
      wake()
      return
    }
    touch()
  }
  return (
    <div className="tablet">
      <div className="tablet__screen" onPointerDownCapture={onPointerDownCapture} onClickCapture={(e) => { if (justWoke()) e.stopPropagation() }}>
        {mode !== 'walking' || dismounted ? (
          <div className="hmi-scaler">
            {/* Fork operation has no screen of its own: the Drive view on the ground, the Operate view when raised */}
            {!dismounted && (mode === 'drive' || (mode === 'forks' && !raised)) ? <DriveScreen /> : <OperateScreen />}
          </div>
        ) : (
          <div className="tablet__body">
            <p>This screen comes next</p>
          </div>
        )}
        {/* Off: the screen is dark (Figma "Screen off"). P or a tap turns it on. */}
        {power === 'off' && <div className="hmi-screen-off" onClick={tapDarkScreen} />}
      </div>
    </div>
  )
}

// The click that follows a waking touch shouldn't also press whatever is under it.
let wokeAt = 0
const justWoke = () => performance.now() - wokeAt < 400
useSim.subscribe((s, prev) => {
  if (prev.power === 'idle' && s.power === 'on') wokeAt = performance.now()
})
