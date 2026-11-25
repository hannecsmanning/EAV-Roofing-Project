// Drive mode HMI screen. Figma: "Drive · Base" (node 40000273:10010).
import { useSim } from '../store'
import { useClock } from './useClock'
import { ToastSlot } from './Toast'
import { CabHeightPanel } from './CabHeightPanel'
import { StatusBar, LmiLightStack, TiltBadge, LoadBadge, MapLock } from './parts'
import { useMovementLocked } from '../flows/outriggers'
import { MachineAerial } from './MachineAerial'
import { DriveMap } from './map/DriveMap'
import { DRIVE_ICON_SCALE } from './map/MapContents'

export function DriveScreen() {
  const tilt = useSim((s) => s.tiltDeg)
  const uneven = useSim((s) => s.alerts.uneven)
  const load = useSim((s) => s.loadLb)
  // The Load badge moves up while a toast shows, so the toast doesn't cover it.
  const toastUp = useSim((s) => s.toast !== null)
  const time = useClock()
  const locked = useMovementLocked()

  return (
    <div className="hmi-screen">
      <StatusBar time={time} />
      <div className="hmi-body">
        <LmiLightStack />
        <div className="hmi-machine-view">
          <DriveMap />
          {locked && <MapLock label="Movement locked" />}
          {/* The truck icon at its Figma spot, shrunk to the real truck's size */}
          <div className="hmi-machine" style={{ transform: `scale(${DRIVE_ICON_SCALE})` }}>
            <MachineAerial />
          </div>
          <TiltBadge degrees={tilt} warning={uneven} className="hmi-drive-tilt" />
          <CabHeightPanel />
          <LoadBadge pounds={load} className={toastUp ? 'hmi-drive-load hmi-drive-load--above-toast' : 'hmi-drive-load'} />
        </div>
      </div>
      <ToastSlot />
    </div>
  )
}
