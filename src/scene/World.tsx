import { useEffect, useRef } from 'react'
import { OperatorFigure, type WalkState } from './OperatorFigure'
import { skyGradient } from './look'
import { roofMove, operatorHeight } from '../flows/roofWalk'
import { useFrame, useThree } from '@react-three/fiber'
import { view, attachViewControls } from './cameraView'
import * as THREE from 'three'
import { isHeld } from '../keys'
import { useSim, isDismounted, type Speed } from '../store'
import { color, scene } from '../tokens/tokens'
import { Site } from './Site'
import { Machine } from './Machine'
import { groundHeight, groundTiltDeg, TRUCK_START, MAX_TILT_DEG, BRANCH_LENGTH, houseHeightAt } from './siteLayout'
import { poseOnWire, poseOnBranch, JUNCTION_S } from './wireTrack'
import { acquiringPose, updateWireAvailability } from '../flows/wireAcquiring'
import { tickPickASpot, pickIsMoving, tickPickBoom } from '../flows/pickASpot'
import { tickMaterialRun, runIsMoving } from '../flows/materialRun'
import { tickMachine } from '../flows/machineControl'
import { tickLift } from '../flows/ascendRetract'
import { tickLmi } from '../flows/lmiAlerts'
import { tickForks } from '../flows/forks'
import { tickOutriggers, askRetract, movementLocked } from '../flows/outriggers'
import { tickAlerts, restrictions, blockedByObject } from '../flows/alerts'
import { slideMove, isBlocked, truckCircles, truckLocalToWorld, operatorCircle } from './collision'

// The 3D world. The site layout lives in siteLayout.ts and Site.tsx.

// Top speed for each truck speed, in meters per second. Placeholders until the industrial designer confirms.
// For reference: 1 m/s is about 2.2 mph.
const TRUCK_TOP_SPEED: Record<Speed, number> = { creep: 0.5, slow: 1.5, fast: 4 }
const TRUCK_ACCEL = 2.5 // how fast it picks up speed (m/s every second)
const TRUCK_BRAKE = 5 // how fast it slows down when you let go
// How fast Q and E turn the truck, in degrees per second, for each speed.
const TRUCK_TURN_RATE: Record<Speed, number> = {
  creep: THREE.MathUtils.degToRad(12),
  slow: THREE.MathUtils.degToRad(30),
  fast: THREE.MathUtils.degToRad(45),
}
const TRUCK_TURN_ACCEL = THREE.MathUtils.degToRad(120) // how fast turning starts and stops

const WALK_SPEED = 1.6 // a normal walking pace
const WALK_ACCEL = 10 // people start and stop quickly

/** W A S D as a direction on the ground. W is forward. Length is 1, or 0 if nothing is held. */
function wasd() {
  const v = new THREE.Vector2(
    (isHeld('d') ? 1 : 0) - (isHeld('a') ? 1 : 0),
    (isHeld('s') ? 1 : 0) - (isHeld('w') ? 1 : 0),
  )
  return v.lengthSq() > 0 ? v.normalize() : v
}

/** Moves `vel` toward `target`, by at most `rate * dt`. Gives a smooth speed-up and slow-down. */
function approach(vel: THREE.Vector2, target: THREE.Vector2, rate: number, dt: number) {
  const diff = target.clone().sub(vel)
  const step = rate * dt
  if (diff.length() <= step) vel.copy(target)
  else vel.add(diff.setLength(step))
}

function Truck() {
  const pose = useSim((s) => s.machinePose)
  const ref = useRef<THREE.Group>(null)
  // Speed in the truck's own directions: x = to its right, y = backward.
  const vel = useRef(new THREE.Vector2())
  const turnVel = useRef(0) // radians per second, + is left
  const alongVel = useRef(0) // speed along the wire, meters per second

  useFrame((_, dt) => {
    const truck = ref.current
    if (!truck) return
    // Off, starting up or idle, the machine is locked in place (docs/CONTEXT.md "Power on, idle and off").
    const on = useSim.getState().power === 'on'
    if (on) {
      // Ascend and Retract move the boom while the joystick is held; otherwise Operate mode keys move the cab.
      tickOutriggers(dt)
      tickLift(dt)
      tickPickBoom(dt)
      tickMachine(dt)
      tickLmi(dt)
      tickForks(dt)
      // Alerts from the real tilt and load (uneven ground, overweight).
      tickAlerts()
    }
    const { mode, speed, truck: at, truckHeading, setTruck, setTruckHeading, wire, wireS, wireDir, setWire } = useSim.getState()
    // The truck drives only in Drive mode, folded, and not while Ascend or Retract uses the joystick (W).
    const { machineRaised, lift } = useSim.getState()
    const liftBusy = lift.flow !== 'none' && lift.phase !== 'tooFar'
    const { outriggers } = useSim.getState()
    // No driving while the outriggers are down: trying to drive stops the machine and asks to retract them.
    const wantsToDrive = mode === 'drive' && !machineRaised && !liftBusy
    if (wantsToDrive && outriggers.state === 'down' && ['w', 's', 'q', 'e'].some(isHeld)) askRetract()
    const driving = wantsToDrive && outriggers.state === 'up' && !movementLocked()
    // Creep speed while an alert restricts it (uneven ground or an overweight load).
    const eff: Speed = restrictions().creep ? 'creep' : speed
    const place = (x: number, z: number, h: number) => {
      truck.position.set(x, groundHeight(x, z), z)
      truck.rotation.y = h
      const tilt = Math.round(groundTiltDeg(x, z))
      if (tilt !== useSim.getState().tiltDeg) useSim.getState().setTilt(tilt)
    }
    if (!on) {
      vel.current.set(0, 0)
      turnVel.current = 0
      alongVel.current = 0
      place(at.x, at.z, truckHeading)
      return
    }

    // Wire flow: the truck holds still while searching, slides onto the wire while connecting,
    // and rides the wire once connected.
    if (wire !== 'off') {
      vel.current.set(0, 0)
      turnVel.current = 0
      if (wire === 'acquiring') {
        const p = acquiringPose()
        setTruck({ x: p.x, z: p.z })
        setTruckHeading(p.heading)
        place(p.x, p.z, p.heading)
      } else if (wire === 'connected') {
        // Pick a spot and the Material run drive the machine themselves while the joystick is held.
        const ran = tickMaterialRun()
        const picked = tickPickASpot() ?? ran
        // On the branch to the materials: the truck rides the branch instead of the house wire.
        const bt = useSim.getState().branchT
        if (bt !== null && picked === null) {
          const flowMoving = pickIsMoving(useSim.getState().pick.phase) || runIsMoving(useSim.getState().run.phase)
          let t = bt
          if (!flowMoving) {
            // By hand (Drive mode): W rides out toward the materials, S back toward the house wire.
            const input = driving ? (isHeld('w') ? 1 : 0) - (isHeld('s') ? 1 : 0) : 0
            const target = input * TRUCK_TOP_SPEED[eff]
            const rate = Math.abs(target) < Math.abs(alongVel.current) ? TRUCK_BRAKE : TRUCK_ACCEL
            alongVel.current += THREE.MathUtils.clamp(target - alongVel.current, -rate * dt, rate * dt)
            t = Math.min(BRANCH_LENGTH, bt + alongVel.current * dt)
            if (t !== bt) {
              if (t <= 0) {
                // Back on the house wire.
                alongVel.current = 0
                const p = poseOnWire(JUNCTION_S, wireDir)
                useSim.setState({ branchT: null, wireS: JUNCTION_S, truck: { x: p.x, z: p.z }, truckHeading: p.heading })
                place(p.x, p.z, p.heading)
                return
              }
              if (t >= BRANCH_LENGTH) alongVel.current = 0
              useSim.setState({ branchT: t })
            }
          }
          const p = poseOnBranch(t, wireDir)
          if (p.x !== at.x || p.z !== at.z || p.heading !== truckHeading) useSim.setState({ truck: { x: p.x, z: p.z }, truckHeading: p.heading })
          place(p.x, p.z, p.heading)
          return
        }
        if (picked !== null) {
          alongVel.current = 0
          const p = poseOnWire(picked, wireDir)
          // One update, so the map redraws once per frame.
          useSim.setState({ wireS: picked, truck: { x: p.x, z: p.z }, truckHeading: p.heading })
          place(p.x, p.z, p.heading)
          return
        }
        // Otherwise W slides forward along the wire, S slides back. Drive mode only, at the chosen speed.
        // Not while Pick a spot or the material run is going: then W is their joystick (it can start in Drive mode).
        const flowBusy = pickIsMoving(useSim.getState().pick.phase) || runIsMoving(useSim.getState().run.phase)
        const input = driving && !flowBusy ? (isHeld('w') ? 1 : 0) - (isHeld('s') ? 1 : 0) : 0
        const target = input * TRUCK_TOP_SPEED[eff]
        const rate = Math.abs(target) < Math.abs(alongVel.current) ? TRUCK_BRAKE : TRUCK_ACCEL
        alongVel.current += THREE.MathUtils.clamp(target - alongVel.current, -rate * dt, rate * dt)
        let s = wireS
        if (alongVel.current !== 0) {
          const next = wireS + wireDir * alongVel.current * dt
          const p = poseOnWire(next, wireDir)
          // Part of the wire runs down the steep slope. The truck can't follow it there.
          if (groundTiltDeg(p.x, p.z) > MAX_TILT_DEG || blockedByObject(at, p, truckHeading, p.heading)) alongVel.current = 0
          else s = next
        }
        const p = poseOnWire(s, wireDir)
        if (s !== wireS || p.x !== at.x || p.z !== at.z || p.heading !== truckHeading)
          useSim.setState({ wireS: s, truck: { x: p.x, z: p.z }, truckHeading: p.heading })
        place(p.x, p.z, p.heading)
      } else {
        place(at.x, at.z, truckHeading)
      }
      return
    }
    alongVel.current = 0

    // The truck only drives in Drive mode. Leaving Drive mode stops it in place.
    if (!driving) {
      vel.current.set(0, 0)
      turnVel.current = 0
    }

    // Turning: Q turns left, E turns right, around the middle of the truck.
    const turnInput = driving ? (isHeld('q') ? 1 : 0) - (isHeld('e') ? 1 : 0) : 0
    const turnTarget = turnInput * TRUCK_TURN_RATE[eff]
    const turnStep = TRUCK_TURN_ACCEL * dt
    turnVel.current += THREE.MathUtils.clamp(turnTarget - turnVel.current, -turnStep, turnStep)
    let heading = truckHeading
    if (turnVel.current !== 0) {
      const next = heading + turnVel.current * dt
      if (isBlocked(truckCircles(at, next)) || blockedByObject(at, at, heading, next)) turnVel.current = 0
      else {
        heading = next
        setTruckHeading(heading)
      }
    }

    // Driving: W is always the way the forks point. A and D slide sideways (multi-directional wheels).
    const input = driving ? wasd() : new THREE.Vector2()
    const target = input.clone().multiplyScalar(TRUCK_TOP_SPEED[eff])
    // Speed up gently, brake harder. Switching to a lower speed counts as braking.
    const braking = target.length() < vel.current.length()
    approach(vel.current, target, braking ? TRUCK_BRAKE : TRUCK_ACCEL, dt)

    let now = at
    if (vel.current.lengthSq() > 0 && dt > 0) {
      const move = truckLocalToWorld({ x: 0, z: 0 }, heading, vel.current.x * dt, vel.current.y * dt)
      now = slideMove(at, move.x, move.z, (s) => isBlocked(truckCircles(s, heading)) || blockedByObject(at, s, heading, heading))
      // Keep only the speed we actually moved at, so we slide along things instead of pushing into them.
      const moved = { x: now.x - at.x, z: now.z - at.z }
      const c = Math.cos(heading)
      const s = Math.sin(heading)
      vel.current.set((moved.x * c - moved.z * s) / dt, (moved.x * s + moved.z * c) / dt)
      if (now !== at) setTruck(now)
    }

    place(now.x, now.z, heading)

    // Close enough and lined up to connect to the wire?
    updateWireAvailability()
  })

  return (
    <group ref={ref} position={TRUCK_START}>
      <Machine pose={pose} />
    </group>
  )
}

// The operator: a blank, soft figure (a bit like a Smiski). Only shows when out of the truck.
function Operator() {
  const ref = useRef<THREE.Group>(null)
  const vel = useRef(new THREE.Vector2())
  const facing = useRef(0)
  const walk = useRef<WalkState>({ stride: 0, moving: 0 })
  const mode = useSim((s) => s.mode)
  // Carrying the dismounted tablet in both hands.
  const holding = useSim((s) => isDismounted(s.tablet))

  useFrame(({ camera }, dt) => {
    const g = ref.current
    if (!g || mode !== 'walking') return
    const { operator: at, truck, truckHeading, setOperator, operatorOnRoof } = useSim.getState()

    // W walks away from the camera, whichever way the camera faces.
    const look = camera.getWorldDirection(new THREE.Vector3())
    const camYaw = Math.atan2(-look.x, -look.z)
    const input = wasd()
    const dir = truckLocalToWorld({ x: 0, z: 0 }, camYaw, input.x, input.y)
    approach(vel.current, new THREE.Vector2(dir.x, dir.z).multiplyScalar(WALK_SPEED), WALK_ACCEL, dt)

    let now = at
    if (vel.current.lengthSq() > 0) {
      if (operatorOnRoof) {
        // On the roof: the edge is a force field, and the cab is in the way.
        now = roofMove(at, vel.current.x * dt, vel.current.y * dt)
      } else {
        const truckBody = truckCircles(truck, truckHeading)
        now = slideMove(at, vel.current.x * dt, vel.current.y * dt, (s) => isBlocked([operatorCircle(s)], truckBody))
      }
      if (now !== at) setOperator(now)
    }

    // Turn to face the way they're walking.
    if (input.lengthSq() > 0) {
      const want = Math.atan2(dir.x, dir.z)
      let diff = want - facing.current
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      facing.current += diff * (1 - Math.exp(-12 * dt))
    }
    // Walking: the figure steps and bobs with the stride.
    const moving = vel.current.length() / WALK_SPEED
    walk.current.moving = moving
    walk.current.stride += dt * 9 * moving

    g.position.set(now.x, operatorHeight(now, operatorOnRoof), now.z)
    g.rotation.y = facing.current
  })

  if (mode !== 'walking') return null
  const { operator, operatorOnRoof } = useSim.getState()
  return (
    <group ref={ref} position={[operator.x, operatorHeight(operator, operatorOnRoof), operator.z]}>
      <OperatorFigure walk={walk} tablet={holding} />
    </group>
  )
}

// Follows the truck from behind while driving, and swings around with it when it turns.
// While walking it moves in closer and keeps facing the same way, so W A S D stay steady.
function CameraRig() {
  const target = useRef(new THREE.Vector3())
  const yaw = useRef(0)
  const first = useRef(true)
  // Hold and drag / scroll on the 3D view to look around (cameraView.ts).
  const gl = useThree((s) => s.gl)
  useEffect(() => attachViewControls(gl.domElement), [gl])

  useFrame(({ camera }, dt) => {
    const { mode, truck, truckHeading, operator, operatorOnRoof } = useSim.getState()
    const walking = mode === 'walking'
    const who = walking ? operator : truck
    const feet = walking ? operatorHeight(operator, operatorOnRoof) : groundHeight(who.x, who.z)
    const ground = new THREE.Vector3(who.x, feet, who.z)

    // Swing smoothly toward the truck's heading (the short way around).
    if (!walking) {
      const diff = Math.atan2(Math.sin(truckHeading - yaw.current), Math.cos(truckHeading - yaw.current))
      yaw.current += first.current ? diff : diff * (1 - Math.exp(-3 * dt))
    }

    // The normal view: this high and this far behind, looking at a point a little ahead.
    const [up, far, lookUp, lookAhead] = walking ? [3.5, 9, 1, 4] : [5, 16, 1.5, 6]
    // Dragging turns and tilts that view around the truck, and scrolling zooms it.
    const turn = yaw.current + view.turn
    const dist = Math.hypot(far, up) * view.zoom
    const tilt = Math.max(0.05, Math.min(1.45, Math.atan2(up, far) + view.tilt))
    const back = dist * Math.cos(tilt)
    const high = dist * Math.sin(tilt)
    // Move in closer when the house would be in the way (the camera would end up inside it).
    let k = 1
    for (; k > 0.2; k -= 0.04) {
      const p = truckLocalToWorld({ x: 0, z: 0 }, turn, 0, back * k)
      const x = ground.x + p.x
      const z = ground.z + p.z
      // Clear of the roof by a couple of meters all around, so the overhang doesn't fill the view.
      const clear = [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].every(([dx, dz]) => houseHeightAt(x + dx, z + dz) < ground.y + high * k - 0.5)
      if (clear) break
    }
    const behind = truckLocalToWorld({ x: 0, z: 0 }, turn, 0, back * k)
    const ahead = truckLocalToWorld({ x: 0, z: 0 }, turn, 0, -lookAhead * Math.min(1, view.zoom))
    const desiredPos = ground.clone().add(new THREE.Vector3(behind.x, high * k, behind.z))
    const desiredLook = ground.clone().add(new THREE.Vector3(ahead.x, lookUp, ahead.z))

    if (first.current) {
      camera.position.copy(desiredPos)
      target.current.copy(desiredLook)
      first.current = false
    }
    camera.position.lerp(desiredPos, 1 - Math.exp(-6 * dt))
    target.current.lerp(desiredLook, 1 - Math.exp(-8 * dt))
    camera.lookAt(target.current)
  })
  return null
}

export function World() {
  return (
    <>
      {/* Hazy autumn sky, warm at the horizon; the fog fades distant things into that warm haze */}
      <primitive attach="background" object={skyGradient} />
      <fog attach="fog" args={[scene.skyHorizon, 55, 150]} />
      {/* Warm afternoon sun, lower in the sky, with warm light bouncing up from the grass */}
      <hemisphereLight args={[scene.skyLight, scene.groundLight, 0.85]} />
      <directionalLight
        position={[30, 26, 22]}
        color={scene.sun}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />

      <Site />
      <Truck />
      <Operator />
      <CameraRig />
    </>
  )
}
