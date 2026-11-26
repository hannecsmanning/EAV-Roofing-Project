import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Stage } from './ui/Stage'
import { ModeChip } from './ui/ModeChip'
import { ControlsPanel } from './ui/ControlsPanel'
import { HmiTablet } from './hmi/HmiTablet'
import { useSim, isDismounted } from './store'
import { canGetIn, getOutSpot } from './scene/collision'
import { pressWireButton } from './flows/wireAcquiring'
import { pressAscend, pressRetract } from './flows/ascendRetract'
import { ContextPrompt } from './ui/ContextPrompt'
import { flipSwitch } from './flows/outriggers'
import { pressL } from './flows/forks'
import { resetView } from './scene/cameraView'
import { pressH, putBack } from './flows/tablet'
import { roofStepOut, canGetInFromRoof } from './flows/roofWalk'
import { pressStart, wake, touch, JOYSTICK_KEYS } from './flows/power'

function useModeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Tab would normally jump around the page. Here it changes speed.
      if (e.key === 'Tab') e.preventDefault()
      // The arrow keys move the cab, so they shouldn't scroll the page.
      if (e.key.startsWith('Arrow')) e.preventDefault()
      if (e.repeat) return
      const { mode, truck, truckHeading, operator, machineRaised, setMode, setOperator, cycleSpeed, toggleControls, showBlocked, power } = useSim.getState()
      const k = e.key.toLowerCase()
      // P is the physical Start button in the cab: screen on, start, or turn off.
      if (k === 'p') {
        if (mode !== 'walking') pressStart()
        return
      }
      if (mode !== 'walking') {
        // Moving a joystick wakes the machine from idle (and only wakes it).
        if (power === 'idle' && JOYSTICK_KEYS.includes(k)) return wake()
        touch()
      }
      // Until the machine is on, only getting in or out, the Controls panel and the view keys work.
      if (power !== 'on' && !['4', 'k', 'c'].includes(k)) return
      switch (k) {
        // Drive mode needs the machine folded (doc: "The machine must be fully stowed").
        case '1':
          if (mode === 'walking') break
          if (machineRaised) showBlocked('Lower the cab to drive.')
          else setMode('drive')
          break
        case '2': if (mode !== 'walking') setMode('operate'); break
        case '3': if (mode !== 'walking') setMode('forks'); break
        case 'tab': if (mode === 'drive') cycleSpeed(); break
        case 'g': pressWireButton(); break
        case '9': pressAscend(); break
        case '0': pressRetract(); break
        case 'o': flipSwitch(); break
        case 'l': pressL(); break
        case 'h': pressH(); break
        // 4 gets out next to the cab, or back in when standing close to it.
        // Raised, the operator can only step out onto the roof, when the cab is at it (doc: "If the machine is raised
        // and not over the roof, getting out is blocked").
        case '4': {
          const onRoof = useSim.getState().operatorOnRoof
          if (mode !== 'walking' && machineRaised) {
            const spot = roofStepOut()
            if (!spot) showBlocked('Get to the roof or ground.')
            else {
              setOperator(spot)
              useSim.setState({ operatorOnRoof: true })
              setMode('walking')
            }
          } else if (mode !== 'walking') {
            setOperator(getOutSpot(truck, truckHeading))
            useSim.setState({ operatorOnRoof: false })
            setMode('walking')
          } else if (onRoof ? canGetInFromRoof(operator) : canGetIn(operator, truck, truckHeading)) {
            // Getting back in clips a dismounted tablet back onto the truck. From the roof the cab is up: Operate mode.
            putBack()
            useSim.setState({ operatorOnRoof: false })
            setMode(machineRaised ? 'operate' : 'drive')
          } else if (onRoof) {
            showBlocked('Walk to the cab to get in.')
          }
          break
        }
        case 'k': toggleControls(); break
        case 'c': resetView(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  useModeKeys()
  const mode = useSim((s) => s.mode)
  // The HMI shows when the operator is in the truck, or walking with the tablet. It closes when they walk without it.
  const holding = useSim((s) => isDismounted(s.tablet))
  const showHmi = mode !== 'walking' || holding

  return (
    <>
      <Canvas shadows camera={{ fov: 50, position: [0, 6, 20] }} className="world">
        <World />
      </Canvas>
      <Stage>
        <ModeChip />
        <ContextPrompt />
        {showHmi && <HmiTablet />}
        <ControlsPanel />
      </Stage>
    </>
  )
}
