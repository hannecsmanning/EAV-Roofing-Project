// Drive mode HMI screen. Figma: "Drive · Base" (node 40000273:10010).
import { useRef } from 'react'
import { useSim } from '../store'
import { useClock } from './useClock'
import { ToastSlot } from './Toast'
import { PowerOverlay } from './PowerOverlay'
import { CabHeightPanel } from './CabHeightPanel'
import { StatusBar, LmiLightStack, TiltBadge, LoadBadge, MapLock, IconButton } from './parts'
import { useMovementLocked } from '../flows/outriggers'
import { MachineAerial } from './MachineAerial'
import { DriveMap, useDriveZoom, stepDriveZoom } from './map/DriveMap'
import plus from '../assets/hmi/plus.svg'
import plusDisabled from '../assets/hmi/plus-disabled.svg'
import minus from '../assets/hmi/minus.svg'
import minusDisabled from '../assets/hmi/minus-disabled.svg'
import { DRIVE_ICON_SCALE } from './map/MapContents'

export function DriveScreen() {
  const tilt = useSim((s) => s.tiltDeg)
  const uneven = useSim((s) => s.alerts.uneven)
  const load = useSim((s) => s.loadLb)
  // The Load badge moves up while a toast shows, so the toast doesn't cover it.
  const toastUp = useSim((s) => s.toast !== null)
  const time = useClock()
  const locked = useMovementLocked()
  const icon = useRef<HTMLDivElement>(null)
  // H off the wire: the latch stays locked (Figma "Dismounted · Not on wire · 1 · Tablet latched").
  const latched = useSim((s) => s.tablet === 'latched')
  // + and − (Hanne): the same buttons as the Operate map, gray at the zoom limits and while the map is locked.
  const { atMin, atMax } = useDriveZoom()
  const mapLocked = locked || latched

  return (
    <div className="hmi-screen">
      <StatusBar time={time} />
      <div className="hmi-body">
        <LmiLightStack />
        <div className="hmi-machine-view">
          <DriveMap iconRef={icon} />
          {locked && <MapLock label="Movement locked" />}
          {latched && !locked && <MapLock label="Latched to truck" />}
          {/* The truck icon at its Figma spot, shrunk to the real truck's size */}
          {/* (Dragging the map moves it along with the map: DriveMap sets its transform.) */}
          <div ref={icon} className="hmi-machine" style={{ transform: `scale(${DRIVE_ICON_SCALE})` }}>
            <MachineAerial />
          </div>
          <div className="hmi-zoom-buttons">
            <IconButton label="Zoom in" icon={!atMax && !mapLocked ? plus : plusDisabled} disabled={atMax || mapLocked} onClick={() => stepDriveZoom(1)} />
            <IconButton label="Zoom out" icon={!atMin && !mapLocked ? minus : minusDisabled} disabled={atMin || mapLocked} onClick={() => stepDriveZoom(-1)} />
          </div>
          {/* The Tilt badge sits bottom right, mirroring the Load badge, and moves up above a toast like it */}
          <TiltBadge degrees={tilt} warning={uneven} className={toastUp ? 'hmi-tilt-corner hmi-tilt-corner--above-toast' : 'hmi-tilt-corner'} />
          <CabHeightPanel />
          <PowerOverlay />
          <LoadBadge pounds={load} className={toastUp ? 'hmi-drive-load hmi-drive-load--above-toast' : 'hmi-drive-load'} />
        </div>
      </div>
      <ToastSlot />
    </div>
  )
}
