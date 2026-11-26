// The roofing lift, in simple shapes. Based on the industrial designer's renders
// (Figma "Machine References"): Drive mode (boom folded) for now.
// Drawn at the renders' size (7.3 m long, 2.4 m wide, 3 m high), then scaled down by MACHINE_SCALE.
//
// The machine's own directions: forward = -z (the forks), right = +x, up = +y. Its middle (0, 0, 0)
// is halfway between the fork tips and the back bumper, on the ground.
//
// Moving parts are a chain, so the mechanics step can pose them:
//   turret (turns) → lower boom (hinges at the turret) → upper boom (hinges at the knuckle, telescopes)
//   → jib with U-joint (keeps the cab level) → cab, with the forks fixed to it.
// The chassis, big wheels and the rear deck with its small wheels stay on the ground. The long rounded housing is the
// turnstile: it sits on a turntable ring on the chassis and turns with the boom, 90° each way (Figma "Machine
// References": "Turnstile rotates 180 degrees"). Turned sideways, it sticks out past the sides a little (Hanne).
// The lower boom hinges low at the back end of the housing ("Hinges here") and folds into a channel along its top.
import { RoundedBox } from '@react-three/drei'
import { color, scene } from '../tokens/tokens'
import { useSim, isDismounted } from '../store'
import { OperatorFigure } from './OperatorFigure'
import { LoadStack } from './Site'
import { FORK_REST, loadById } from '../flows/forks'

import {
  MACHINE_DESIGN as MACHINE, MACHINE_SCALE, FOLDED, type MachinePose,
  fromBack, TURRET, HINGE_BACK, LOWER_BOOM, UPPER_BOOM, cabFromTip,
} from './machineSpec'

const BOOM = { w: 0.42, h: 0.38 }

const TEAL = color.interactiveAction
const DARK = scene.truckBoom

function Wheel({ x, y, z, r, w }: { x: number; y: number; z: number; r: number; w: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, w, 20]} />
        <meshStandardMaterial color={scene.tire} roughness={0.9} />
      </mesh>
      {/* Hub, on the outside face (the wheel is turned on its side, so outward is -y here) */}
      <mesh position={[0, -Math.sign(x) * (w / 2 + 0.01), 0]}>
        <cylinderGeometry args={[r * 0.5, r * 0.5, 0.02, 16]} />
        <meshStandardMaterial color={scene.rim} />
      </mesh>
    </group>
  )
}

/** The cab: open roll-cage frame with a curved, slanted roof and low rails. Forks fixed to its front. */
function Cab() {
  const forks = useSim((s) => s.forks)
  const carried = useSim((s) => s.carried)
  // The operator rides in the cab whenever they're not out walking, facing the forks.
  const inCab = useSim((s) => s.mode !== 'walking')
  const holding = useSim((s) => isDismounted(s.tablet))
  const W = 2.1 // cab width
  const D = 2.4 // cab depth (front to back)
  const post = 0.09
  const roofY = 2.5 // above the cab floor
  return (
    <group>
      {inCab && (
        <group position={[0, 0.14, 0.35]} rotation={[0, Math.PI, 0]} scale={1 / MACHINE_SCALE}>
          <OperatorFigure tablet={holding} />
        </group>
      )}
      {/* Floor */}
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.14, D]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {/* Four corner posts of the roll cage */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (W - post)) / 2, roofY / 2, (sz * (D - post)) / 2]} castShadow>
            <boxGeometry args={[post, roofY, post]} />
            <meshStandardMaterial color={TEAL} />
          </mesh>
        )),
      )}
      {/* Curved roof, slanted down toward the back for shade */}
      <RoundedBox args={[W + 0.15, 0.14, D + 0.2]} radius={0.06} position={[0, roofY + 0.05, -0.05]} rotation={[-0.05, 0, 0]} castShadow>
        <meshStandardMaterial color={TEAL} />
      </RoundedBox>
      {/* Low side rails (two bars each side) */}
      {[-1, 1].map((sx) =>
        [0.55, 1.05].map((y) => (
          <mesh key={`${sx}${y}`} position={[(sx * (W - post)) / 2, y, 0]} castShadow>
            <boxGeometry args={[0.06, 0.06, D]} />
            <meshStandardMaterial color={TEAL} />
          </mesh>
        )),
      )}
      {/* Front plate the forks hang from, with the detachable HMI spot behind it */}
      <mesh position={[0, 0.65, -D / 2 - 0.06]} castShadow>
        <boxGeometry args={[W, 1.1, 0.12]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {/* Forks: they slide up and down the front plate and push out (Fork operation), carrying the load */}
      <group position={[0, forks.lift, -forks.extend]}>
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, FORK_REST.y, -D / 2 - 0.12 - 0.8]} castShadow>
            <boxGeometry args={[0.15, 0.08, 1.6]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        ))}
        {carried && (
          <group position={[0, FORK_REST.y + 0.04, FORK_REST.z]} scale={1 / MACHINE_SCALE}>
            <LoadStack load={loadById(carried)} tag={false} />
          </group>
        )}
      </group>
    </group>
  )
}

export function Machine({ pose = FOLDED }: { pose?: MachinePose }) {
  const W = MACHINE.width
  const bodyFront = fromBack(3.5) // where the body ends and the rear deck begins
  const bodyLen = 3.5 - 0.05
  const legs = useSim((s) => s.outriggers.t)
  return (
    <group scale={MACHINE_SCALE}>
      {/* ---------- Stays on the ground ---------- */}
      {/* Chassis: darker side panels with a step along them */}
      <mesh position={[0, 0.95, fromBack(0.05 + bodyLen / 2)]} castShadow receiveShadow>
        <boxGeometry args={[W - 0.1, 0.9, bodyLen]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[(sx * W) / 2, 0.62, fromBack(1.8)]} castShadow>
          <boxGeometry args={[0.12, 0.08, 2.6]} />
          <meshStandardMaterial color={TEAL} />
        </mesh>
      ))}
      {/* Turntable ring on top of the chassis, under the housing */}
      <mesh position={[0, 1.43, TURRET.z]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.1, 0.06, 32]} />
        <meshStandardMaterial color={scene.tire} />
      </mesh>
      {/* Four big off-road wheels */}
      {[-1, 1].map((sx) =>
        [0.66, 2.9].map((d) => <Wheel key={`${sx}${d}`} x={sx * (W / 2 - 0.1)} y={0.53} z={fromBack(d)} r={0.53} w={0.42} />),
      )}
      {/* Rear deck the cab rests on, with low walls, and two pairs of small wheels under it */}
      <mesh position={[0, 0.37, fromBack(4.7)]} castShadow receiveShadow>
        <boxGeometry args={[W - 0.3, 0.16, 2.4]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {[-1, 1].map((sx) =>
        [4.97, 5.5].map((d) => <Wheel key={`${sx}${d}`} x={sx * 0.95} y={0.28} z={fromBack(d)} r={0.28} w={0.24} />),
      )}
      <mesh position={[0, 0.65, bodyFront + 0.05]} castShadow>
        <boxGeometry args={[W - 0.3, 0.5, 0.1]} />
        <meshStandardMaterial color={DARK} />
      </mesh>

      {/* Four outriggers on the body's corners: stowed upright along the sides, swung out and down onto pads */}
      {[-1, 1].map((sx) => [0.35, 3.15].map((d) => <Outrigger key={`${sx}${d}`} side={sx} z={fromBack(d)} t={legs} />))}

      {/* ---------- The boom chain ---------- */}
      <group position={[TURRET.x, TURRET.y, TURRET.z]} rotation={[0, pose.turretYaw, 0]}>
        <Housing />
        {/* Hinge at the back end of the housing: a block the lower boom pivots on */}
        <mesh position={[0, -0.05, HINGE_BACK]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, BOOM.w + 0.16, 16]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <group position={[0, 0, HINGE_BACK]} rotation={[pose.lowerPitch, 0, 0]}>
          {/* Lower boom */}
          <mesh position={[0, 0, -LOWER_BOOM / 2]} castShadow>
            <boxGeometry args={[BOOM.w, BOOM.h, LOWER_BOOM]} />
            <meshStandardMaterial color={TEAL} />
          </mesh>
          {/* Knuckle */}
          <group position={[0, 0, -LOWER_BOOM]} rotation={[pose.upperPitch, 0, 0]}>
            {/* Upper boom: outer section, and an inner section that slides out to telescope */}
            <mesh position={[0, 0, -UPPER_BOOM / 2]} castShadow>
              <boxGeometry args={[BOOM.w, BOOM.h, UPPER_BOOM]} />
              <meshStandardMaterial color={TEAL} />
            </mesh>
            {/* Inner section: always reaches back into the outer one, from its middle to the tip */}
            <mesh position={[0, 0, -(UPPER_BOOM / 2 + UPPER_BOOM + pose.extend) / 2]} castShadow>
              <boxGeometry args={[BOOM.w * 0.8, BOOM.h * 0.8, UPPER_BOOM / 2 + pose.extend]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            {/* Boom tip → jib. The jib turns back by the boom's angle so the cab always stays level. */}
            <group position={[0, 0, -UPPER_BOOM - pose.extend]} rotation={[-(pose.lowerPitch + pose.upperPitch), 0, 0]}>
              {/* Jib with its compound U-joint: two short jointed pieces */}
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.5, 14]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
              <mesh position={[0, -0.35, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.13, 0.6, 14]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
              <group position={[cabFromTip(pose.jib).x, cabFromTip(pose.jib).y, cabFromTip(pose.jib).z]}>
                <Cab />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// ---------- Turnstile housing ----------
// The long rounded housing that turns with the boom. In turret coordinates: centered on the turning point, its bottom
// just above the turntable ring. Two rounded halves leave a channel down the middle of the top, where the folded boom
// lies (Figma Drive mode renders).
const HOUSING = { len: 3.3, h: 1.5, bottom: 1.46 - TURRET.y, channel: BOOM.w + 0.16 }
function Housing() {
  const W = MACHINE.width
  const half = (W - HOUSING.channel) / 2
  const midY = HOUSING.bottom + HOUSING.h / 2
  const floorTop = -BOOM.h / 2 - 0.02 // the channel floor, just under the folded boom
  return (
    <group>
      {[-1, 1].map((sx) => (
        <RoundedBox
          key={sx}
          args={[half, HOUSING.h, HOUSING.len]}
          radius={0.4}
          smoothness={4}
          position={[sx * (HOUSING.channel / 2 + half / 2), midY, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={TEAL} />
        </RoundedBox>
      ))}
      {/* Channel floor between the two halves */}
      <RoundedBox
        args={[HOUSING.channel + 0.2, floorTop - HOUSING.bottom, HOUSING.len - 0.1]}
        radius={0.1}
        position={[0, (floorTop + HOUSING.bottom) / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={DARK} />
      </RoundedBox>
    </group>
  )
}

// ---------- Outriggers (simple shapes until the real model) ----------
// A beam hinged on the side of the body. t = 0: stowed, pointing up along the side. t = 1: swung out and down,
// its pad flat on the ground about 1.2 m (design size) out from the body.
const OUT_PIVOT_Y = 1.15
const OUT_BEAM = 1.6
const OUT_DOWN = Math.asin((OUT_PIVOT_Y - 0.08) / OUT_BEAM) // angle below flat that puts the pad on the ground
const OUT_UP = -Math.PI / 2 + 0.12 // stowed: just short of straight up
function Outrigger({ side, z, t }: { side: number; z: number; t: number }) {
  const ease = t * t * (3 - 2 * t)
  const a = OUT_UP + (OUT_DOWN - OUT_UP) * ease // angle below flat, outward
  return (
    <group position={[side * (MACHINE.width / 2 + 0.1), OUT_PIVOT_Y, z]} scale={[side, 1, 1]}>
      {/* Hinge block on the body */}
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.3, 0.3]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      <group rotation={[0, 0, -a]}>
        <mesh position={[OUT_BEAM / 2, 0, 0]} castShadow>
          <boxGeometry args={[OUT_BEAM, 0.16, 0.2]} />
          <meshStandardMaterial color={TEAL} />
        </mesh>
        {/* Pad, kept flat */}
        <group position={[OUT_BEAM, 0, 0]} rotation={[0, 0, a]}>
          <mesh position={[0, -0.06, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.06, 20]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
