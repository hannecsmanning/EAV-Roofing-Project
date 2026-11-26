// Operate mode HMI screen. Figma: section "Zoom In and Out of Map" (NOT on wire frames).
// Same layout as Drive, with + and − in the top right instead of the Tilt badge.
import { useEffect, useState } from 'react'
import { useSim } from '../store'
import { useClock } from './useClock'
import { ToastSlot } from './Toast'
import { PowerOverlay } from './PowerOverlay'
import { CabHeightPanel } from './CabHeightPanel'
import { StatusBar, LmiLightStack, LoadBadge, IconButton, TiltBadge, MapLock, PinKeypad } from './parts'
import { tryUnlock, clearTabletToast, TABLET_TOAST } from '../flows/tablet'
import { useMovementLocked } from '../flows/outriggers'
import { cancelRun, runIsMoving } from '../flows/materialRun'
import { OperateMap, type ZoomLevel } from './map/OperateMap'
import { cancelPick, pickIsMoving, tapMap } from '../flows/pickASpot'
import { zoneCenterOnRoof, type Zone } from '../scene/zones'
import plus from '../assets/hmi/plus.svg'
import plusDisabled from '../assets/hmi/plus-disabled.svg'
import minus from '../assets/hmi/minus.svg'
import minusDisabled from '../assets/hmi/minus-disabled.svg'

export function OperateScreen() {
  const load = useSim((s) => s.loadLb)
  // In Operate mode the Tilt badge only shows while tilt is a problem, under + and − (doc).
  const uneven = useSim((s) => s.alerts.uneven)
  const tilt = useSim((s) => s.tiltDeg)
  // The Load badge moves up while a toast shows, so the toast doesn't cover it.
  const toastUp = useSim((s) => s.toast !== null)
  const time = useClock()
  // Opens at the middle zoom, with both buttons available (Figma "Operate · Base").
  const [zoom, setZoom] = useState<ZoomLevel>(2)
  const movementLocked = useMovementLocked()
  // Dismounted tablet: it comes off locked (Map lock "Locked" with a Step toast), then the PIN keypad shows.
  // Off the wire, H shows the latch instead ("Latched to truck").
  const tablet = useSim((s) => s.tablet)
  const tabletToast = useSim((s) => s.toast?.id === TABLET_TOAST)
  const tabletLocked = tablet === 'locked' || tablet === 'latched'
  const locked = movementLocked || tabletLocked
  // Material run: + and − lock while the truck drives to the materials (the map stays as it is).
  const running = useSim((s) => runIsMoving(s.run.phase))
  // Pick a spot: from Allow until the move is done, + and − lock and the map shows the route on its own.
  const moving = useSim((s) => pickIsMoving(s.pick.phase))
  // The route view is for driving. Boom-only moves and the rise at the end keep the zoomed-in map (doc: "Arrived. The map
  // zooms back in.").
  const routeView = useSim((s) => s.pick.drives && ['joystick', 'descending', 'driving'].includes(s.pick.phase))
  // Drilled into a big zone: + pressed on the zone map with a big zone tapped (doc: "On the wire, tap a big zone, zoom in,
  // pick a small zone"). Full zoom, centered on that big zone, the rest dimmed. Only small zones inside it can be picked.
  const [focusZone, setFocusZone] = useState<Zone | null>(null)
  const tappedBig = useSim((s) => (s.pick.phase === 'tapped' && s.pick.zone?.kind === 'big' ? s.pick.zone : null))
  // Dimmed while picking inside it. After the move, the map zooms back into that big zone without the dim layer
  // (doc step 8: "Arrived. The map zooms back into the big zone without the dim layer").
  const [dimmed, setDimmed] = useState(true)
  const [returnTo, setReturnTo] = useState<Zone | null>(null)
  useEffect(() => {
    if (moving && focusZone) {
      // The move starts: the map shows the route, then follows the truck. Remember the big zone for the end.
      setReturnTo(focusZone)
      setFocusZone(null)
    } else if (!moving && returnTo) {
      setFocusZone(returnTo)
      setDimmed(false)
      setReturnTo(null)
    }
  }, [moving, focusZone, returnTo])

  // Before Allow, zooming drops the picked zone.
  const zoomTo = (z: ZoomLevel) => {
    // + with a big zone tapped on the zone map: jump straight to full zoom, into that big zone.
    if (z === 2 && zoom === 1 && tappedBig) {
      cancelPick()
      setFocusZone(tappedBig)
      setDimmed(true)
      setZoom(3)
      return
    }
    // − from there: back to the zone map, with the big zone still tapped.
    if (focusZone && dimmed && z < zoom) {
      const c = zoneCenterOnRoof(focusZone)
      cancelPick()
      setFocusZone(null)
      setZoom(1)
      tapMap(c.x, c.z, 1)
      return
    }
    cancelPick()
    cancelRun()
    setFocusZone(null)
    setZoom(z)
  }

  return (
    <div className="hmi-screen">
      <StatusBar time={time} />
      <div className="hmi-body">
        <LmiLightStack />
        <div className="hmi-machine-view">
          <OperateMap
            view={routeView ? 'route' : zoom}
            zoom={zoom}
            focusZone={focusZone}
            dim={dimmed}
            onZoomStep={(dir) => {
              // Same rules as + and −: one level at a time, locked during a move, a lock or the material run.
              const z = zoom + dir
              if (moving || locked || running || z < 1 || z > 3) return
              zoomTo(z as ZoomLevel)
            }}
          />
          {movementLocked && <MapLock label="Movement locked" />}
          {!movementLocked && tablet === 'latched' && <MapLock label="Latched to truck" />}
          {/* Locked: the lock badge while the "Tablet removed" toast shows, then the keypad. Tapping skips ahead. */}
          {!movementLocked && tablet === 'locked' && (
            <div onPointerDown={clearTabletToast}>
              <MapLock label="Locked">{tabletToast ? undefined : <PinKeypad onUnlock={tryUnlock} />}</MapLock>
            </div>
          )}
          {/* One zoom level per tap. At the limits the button turns gray and does nothing. */}
          <div className="hmi-zoom-buttons">
            <IconButton
              label="Zoom in"
              icon={zoom < 3 && !moving && !locked && !running ? plus : plusDisabled}
              disabled={zoom === 3 || moving || locked || running}
              onClick={() => zoomTo(Math.min(3, zoom + 1) as ZoomLevel)}
            />
            <IconButton
              label="Zoom out"
              icon={zoom > 1 && !moving && !locked && !running ? minus : minusDisabled}
              disabled={zoom === 1 || moving || locked || running}
              onClick={() => zoomTo(Math.max(1, zoom - 1) as ZoomLevel)}
            />
          </div>
          {uneven && <TiltBadge degrees={tilt} warning className={toastUp ? 'hmi-tilt-corner hmi-tilt-corner--above-toast' : 'hmi-tilt-corner'} />}
          <CabHeightPanel />
          <PowerOverlay />
          <LoadBadge pounds={load} className={toastUp ? 'hmi-drive-load hmi-drive-load--above-toast' : 'hmi-drive-load'} />
        </div>
      </div>
      <ToastSlot />
    </div>
  )
}
