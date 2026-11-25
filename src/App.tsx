import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Stage } from './ui/Stage'
import { ModeChip } from './ui/ModeChip'
import { ControlsPanel } from './ui/ControlsPanel'
import { HmiTablet } from './hmi/HmiTablet'
import { useSim } from './store'
import { canGetIn, getOutSpot } from './scene/collision'
import { pressWireButton } from './flows/wireAcquiring'
import { pressAscend, pressRetract } from './flows/ascendRetract'
import { ContextPrompt } from './ui/ContextPrompt'
import { flipSwitch } from './flows/outriggers'
import { pressL } from './flows/forks'
import { resetView } from './scene/cameraView'

function useModeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Tab would normally jump around the page. Here it changes speed.
      if (e.key === 'Tab') e.preventDefault()
      // The arrow keys move the cab, so they shouldn't scroll the page.
      if (e.key.startsWith('Arrow')) e.preventDefault()
      if (e.repeat) return
      const { mode, truck, truckHeading, operator, machineRaised, setMode, setOperator, cycleSpeed, toggleControls, showBlocked } = useSim.getState()
      switch (e.key.toLowerCase()) {
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
        // 4 gets out next to the cab, or back in when standing close to the truck.
        // Raised, getting out is blocked (doc). Stepping out onto the roof comes later.
        case '4':
          if (mode !== 'walking' && machineRaised) {
            showBlocked('Get to the roof or ground.')
          } else if (mode !== 'walking') {
            setOperator(getOutSpot(truck, truckHeading))
            setMode('walking')
          } else if (canGetIn(operator, truck, truckHeading)) {
            setMode('drive')
          }
          break
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
  // The HMI shows when the operator is in the truck. Holding the detached tablet comes later.
  const showHmi = mode !== 'walking'

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
