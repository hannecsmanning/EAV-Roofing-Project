// Figma: "Cab height panel" (Ascend to Ledge Flow and Retract Machine Flow). 420 x 370, top left of the machine view.
// A side view: the roof edge, the ground, and the cab close-up moving up and down with the real cab height.
//   Ascend: "Cab height", "9 ft of 20 ft", status, dashed ledge line "Ledge · 20 ft".
//   Retract: "Retract · Step 1 of 3", "Cab at 9 ft", status, teal ground target "Ground · 0 ft".
import { useSim } from '../store'
import { cabHeight, toFeet, LEDGE_HEIGHT_M, retractStep } from '../flows/ascendRetract'
import sideArm from '../assets/hmi/side-arm.svg'
import sideCab from '../assets/hmi/side-cab.svg'
import groundLine from '../assets/hmi/side-ground-line.svg'
import ledgeLine from '../assets/hmi/side-ledge-line.svg'
import detectedAbove from '../assets/hmi/detected-above.svg'
import detectedBelow from '../assets/hmi/detected-below.svg'

// In the panel, the cab close-up sits at top 236 on the ground and 115.8 at the ledge (Figma frames).
const CAB_TOP_GROUND = 236
const CAB_TOP_LEDGE = 115.8

const ASCEND_STATUS = { ready: 'Ready to rise', moving: 'Rising', stopped: 'Stopped', canceling: 'Going back down', done: 'At the ledge' } as const

export function CabHeightPanel() {
  const lift = useSim((s) => s.lift)
  const outriggers = useSim((s) => s.outriggers.state)
  useSim((s) => s.machineTip) // redraw as the cab moves
  if (lift.flow === 'none' || lift.phase === 'tooFar') return null

  const h = cabHeight()
  const frac = Math.max(0, Math.min(1.15, h / LEDGE_HEIGHT_M))
  const cabTop = CAB_TOP_GROUND - frac * (CAB_TOP_GROUND - CAB_TOP_LEDGE)
  const ascend = lift.flow === 'ascend'

  let label: string
  let readout: string
  let status: string
  if (ascend) {
    label = 'Cab height'
    readout = `${toFeet(h)} ft of ${toFeet(LEDGE_HEIGHT_M)} ft`
    status = ASCEND_STATUS[lift.phase as keyof typeof ASCEND_STATUS] ?? ''
    // Ascend warnings (Figma "Ascend & Retract Warnings")
    if (lift.phase === 'ready' && lift.warn === 'uneven') status = 'Ready, ground is uneven'
    if (lift.phase === 'ready' && lift.warn === 'overweight') status = 'Ready, load is over the limit'
  } else {
    const step = retractStep()
    label = {
      ready: 'Retract · Ready',
      moving: `Retract · Step ${step} of 3`,
      stopped: `Retract · Step ${step} of 3`,
      canceled: 'Retract · Canceled',
      outriggers: 'Retract · Step 3 of 3',
      done: 'Retract · Done',
    }[lift.phase as string] ?? 'Retract'
    readout = `Cab at ${toFeet(h)} ft`
    status = {
      ready: 'Boom, cab, then outriggers',
      moving: step === 1 ? 'Folding the boom' : 'Lowering the cab',
      stopped: 'Stopped',
      canceled: 'Stopped here. Manual control',
      outriggers: outriggers === 'retracting' ? 'Retracting outriggers' : 'Flip the outrigger switch',
      done: 'Fully retracted',
    }[lift.phase as string] ?? ''
  }

  return (
    <div className="hmi-cab-panel">
      <div className="hmi-cab-panel__roof" />
      <div className="hmi-cab-panel__closeup" style={{ top: cabTop }}>
        <div className="hmi-cab-panel__arm">
          <img src={sideArm} alt="" className="hmi-fill" />
        </div>
        {/* Joint: the lower bracket where the arm meets the cab */}
        <div className="hmi-cab-panel__bracket" />
        <img src={sideCab} alt="" className="hmi-cab-panel__cab" />
      </div>
      <div className="hmi-cab-panel__ground" />
      <img src={groundLine} alt="" className="hmi-cab-panel__ground-line" />
      {ascend ? (
        <>
          <img src={ledgeLine} alt="" className="hmi-cab-panel__ledge-line" />
          <p className="hmi-cab-panel__meta hmi-cab-panel__ledge-label">Ledge · {toFeet(LEDGE_HEIGHT_M)} ft</p>
        </>
      ) : (
        <>
          <div className="hmi-cab-panel__ground-target" />
          <p className="hmi-cab-panel__meta hmi-cab-panel__ground-label" style={lift.warn === 'below' ? { left: 302, top: 326 } : undefined}>
            Ground · 0 ft
          </p>
        </>
      )}
      {/* Detected object: orange shape over the cab (above) or on the ground under it (below) */}
      {lift.warn === 'above' && (
        <>
          <img src={detectedAbove} width={59.92} height={60.49} alt="" className="hmi-cab-panel__object" style={{ left: 228.04, top: cabTop - 59.61 }} />
          <p className="hmi-cab-panel__meta hmi-cab-panel__object-label" style={{ left: 303, top: cabTop - 39.37 }}>Object above</p>
        </>
      )}
      {lift.warn === 'below' && (
        <>
          <img src={detectedBelow} width={45.83} height={46.26} alt="" className="hmi-cab-panel__object" style={{ left: 221.09, top: 308.87 }} />
          <p className="hmi-cab-panel__meta hmi-cab-panel__object-label" style={{ left: 106.09, top: 320 }}>Object below</p>
        </>
      )}
      <p className="hmi-cab-panel__meta hmi-cab-panel__label">{label}</p>
      <p className="hmi-readout hmi-cab-panel__readout">{readout}</p>
      <p className="hmi-cab-panel__meta hmi-cab-panel__status">{status}</p>
    </div>
  )
}
