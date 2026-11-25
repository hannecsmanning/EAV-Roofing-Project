// The HMI tablet frame on the right of the simulator screen.
// Screens are built at the Figma size (1280 x 832) and scaled down to fit the frame.
import { useSim } from '../store'
import { DriveScreen } from './DriveScreen'
import { OperateScreen } from './OperateScreen'
import './hmi.css'

export function HmiTablet() {
  const mode = useSim((s) => s.mode)
  const raised = useSim((s) => s.machineRaised)
  return (
    <div className="tablet">
      <div className="tablet__screen">
        {mode !== 'walking' ? (
          <div className="hmi-scaler">
            {/* Fork operation has no screen of its own: the Drive view on the ground, the Operate view when raised */}
            {mode === 'drive' || (mode === 'forks' && !raised) ? <DriveScreen /> : <OperateScreen />}
          </div>
        ) : (
          <div className="tablet__body">
            <p>This screen comes next</p>
          </div>
        )}
      </div>
    </div>
  )
}
