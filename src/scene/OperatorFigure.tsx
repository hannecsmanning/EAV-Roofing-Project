// The operator, a Smiski-style figure (Figma "Operator references"): a big round head with tiny dot eyes and a small
// mouth, a short soft body, stubby arms and legs, pale yellow-green with a faint glow, and a plain green hard hat.
// About 1.6 m tall, so the truck and roof keep their scale. Faces +z. Feet at y = 0.
//   walk: a shared { stride, moving } the walker updates each frame. Legs step and arms swing with it.
//   tablet: holding the dismounted tablet in both hands, in front of the chest.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scene } from '../tokens/tokens'
import { toonGradient } from './look'

export type WalkState = { stride: number; moving: number; kneel?: number; hammer?: number; lookUp?: number }
/** Who the figure is: the operator (green hard hat), a roofer (orange, with a hammer) or the foreman (white, clipboard). */
export type FigureLook = 'operator' | 'roofer' | 'foreman'
const HATS: Record<FigureLook, [string, string]> = {
  operator: [scene.hardHat, scene.hardHatDark],
  roofer: [scene.rooferHat, scene.rooferHatDark],
  foreman: [scene.foremanHat, scene.foremanHatDark],
}

// The body glows softly, like the glow-in-the-dark toy.
function Skin() {
  return <meshToonMaterial color={scene.operator} emissive={scene.operator} emissiveIntensity={0.22} gradientMap={toonGradient} />
}
const Face = () => <meshBasicMaterial color={scene.operatorFace} />

const HIP_Y = 0.4
const SHOULDER_Y = 0.84
const HEAD_Y = 1.2
const HEAD_R = 0.36

export function OperatorFigure({
  walk,
  tablet = false,
  look = 'operator',
}: {
  walk?: React.MutableRefObject<WalkState>
  tablet?: boolean
  look?: FigureLook
}) {
  const [hat, hatDark] = HATS[look]
  const head = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)

  useFrame(() => {
    const w = walk?.current ?? { stride: 0, moving: 0 }
    const swing = Math.sin(w.stride) * w.moving
    // Kneeling (a roofer at work): the body drops and the legs fold forward.
    const k = w.kneel ?? 0
    if (body.current) body.current.position.y = Math.abs(Math.sin(w.stride)) * 0.05 * w.moving - k * 0.3
    if (legL.current) legL.current.rotation.x = swing * 0.55 - k * 1.3
    if (legR.current) legR.current.rotation.x = -swing * 0.55 - k * 0.5
    // The foreman tips his head back to look up at the roof.
    if (head.current) head.current.rotation.x = -(w.lookUp ?? 0) * 0.45
    // Arms swing opposite to the legs, or hold the tablet out in front.
    const hold = -1.05
    if (armL.current) {
      armL.current.rotation.x = tablet ? hold : -swing * 0.45
      armL.current.rotation.z = tablet ? 0.45 : -0.2
    }
    if (armR.current) {
      // A roofer hammering: the right arm chops up and down while kneeling.
      const chop = w.hammer ? -1.3 + Math.sin(w.hammer) * 0.55 : 0
      armR.current.rotation.x = tablet ? hold : w.hammer ? chop : look === 'foreman' ? -0.9 : swing * 0.45
      armR.current.rotation.z = tablet ? -0.45 : 0.2
    }
  })

  return (
    <group ref={body}>
      {/* Legs: short and stubby, rounded feet */}
      {([[-0.13, legL], [0.13, legR]] as const).map(([x, ref]) => (
        <group key={x} ref={ref} position={[x, HIP_Y, 0]}>
          <mesh position={[0, -HIP_Y / 2 + 0.04, 0]} castShadow>
            <capsuleGeometry args={[0.11, HIP_Y - 0.2, 6, 14]} />
            <Skin />
          </mesh>
          <mesh position={[0, -HIP_Y + 0.06, 0.05]} scale={[1, 0.65, 1.35]} castShadow>
            <sphereGeometry args={[0.12, 14, 10]} />
            <Skin />
          </mesh>
        </group>
      ))}
      {/* Body: a short soft bean, a little wider at the bottom */}
      <mesh position={[0, 0.66, 0]} scale={[1, 1, 0.85]} castShadow>
        <capsuleGeometry args={[0.25, 0.32, 8, 18]} />
        <Skin />
      </mesh>
      {/* Arms: stubby, hanging a little out from the body */}
      {([[-0.27, armL], [0.27, armR]] as const).map(([x, ref]) => (
        <group key={x} ref={ref} position={[x, SHOULDER_Y, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.28, 6, 12]} />
            <Skin />
          </mesh>
          {/* In the right hand: a roofer's hammer, or the foreman's clipboard */}
          {x > 0 && look === 'roofer' && (
            <group position={[0, -0.42, 0.02]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.022, 0.022, 0.32, 8]} />
                <meshToonMaterial color={scene.clipboard} gradientMap={toonGradient} />
              </mesh>
              <mesh position={[0, -0.15, 0.04]} castShadow>
                <boxGeometry args={[0.06, 0.06, 0.16]} />
                <meshToonMaterial color={scene.hammer} gradientMap={toonGradient} />
              </mesh>
            </group>
          )}
          {x > 0 && look === 'foreman' && (
            <group position={[-0.08, -0.4, 0.06]} rotation={[0.9, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.24, 0.32, 0.02]} />
                <meshToonMaterial color={scene.clipboard} gradientMap={toonGradient} />
              </mesh>
              <mesh position={[0, -0.01, 0.012]}>
                <planeGeometry args={[0.2, 0.26]} />
                <meshBasicMaterial color={scene.paper} />
              </mesh>
            </group>
          )}
        </group>
      ))}
      {/* Head: big and round */}
      <group ref={head} position={[0, HEAD_Y, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[HEAD_R, 28, 20]} />
          <Skin />
        </mesh>
        {/* Tiny dot eyes and a small frowny mouth */}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 0.0, HEAD_R * 0.95]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <Face />
          </mesh>
        ))}
        <mesh position={[0, -0.14, HEAD_R * 0.92]}>
          <torusGeometry args={[0.032, 0.012, 8, 16, Math.PI]} />
          <Face />
        </mesh>
        {/* Plain green hard hat: a dome, a ridge along the top and a brim that sticks out more at the front */}
        <group position={[0, 0.1, 0]} rotation={[-0.12, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[HEAD_R + 0.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial color={hat} gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, 0.02, 0.06]} scale={[1, 1, 1.25]} castShadow>
            <cylinderGeometry args={[HEAD_R + 0.08, HEAD_R + 0.08, 0.03, 28]} />
            <meshToonMaterial color={hatDark} gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, HEAD_R + 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.3, 10]} />
            <meshToonMaterial color={hatDark} gradientMap={toonGradient} />
          </mesh>
        </group>
      </group>
      {/* The dismounted tablet, held in both hands in front of the chest */}
      {tablet && (
        <group position={[0, 0.68, 0.42]} rotation={[-0.55, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.28, 0.03]} />
            <meshToonMaterial color={scene.tabletBody} gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, 0, 0.016]}>
            <planeGeometry args={[0.37, 0.23]} />
            <meshBasicMaterial color={scene.tabletScreen} />
          </mesh>
        </group>
      )}
    </group>
  )
}
