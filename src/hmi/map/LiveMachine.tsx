// The machine drawn live on the Operate map when the boom is raised (top-down, true to size).
// The Figma Machine · Aerial renders only come in fixed poses, so while raised the map draws the real pose:
// body and turret cover, the boom from the turret to its tip, and the cab with its forks where the cab really is.
// Drawn in the machine's own units (the renders' size); the caller places it with machineTransform().
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { color } from '../../tokens/tokens'
import { MACHINE_SCALE, MACHINE_DESIGN, TURRET, CAB_HALF, fromBack, type MachinePose } from '../../scene/machineSpec'
import { cabCenter } from '../../flows/machineControl'

const W = MACHINE_DESIGN.width
const BOOM_W = 0.42
const rad2deg = (r: number) => (r * 180) / Math.PI

/** Place the machine drawing on the map: at the truck, turned with it, scaled to real size. */
export const machineTransform = (x: number, z: number, heading: number) =>
  `translate(${x} ${z}) rotate(${-rad2deg(heading)}) scale(${MACHINE_SCALE})`

export type LiveMachineHandle = { update: (tip: { x: number; y: number; z: number }, pose: MachinePose) => void }

export const LiveMachine = forwardRef<LiveMachineHandle, { gRef: React.Ref<SVGGElement> }>(function LiveMachine({ gRef }, ref) {
  const boom = useRef<SVGRectElement>(null)
  const cab = useRef<SVGGElement>(null)

  useImperativeHandle(ref, () => ({
    update(tip, pose) {
      // Boom: a bar from the turret to the tip, seen from above.
      const dx = tip.x - TURRET.x
      const dz = tip.z - TURRET.z
      const len = Math.hypot(dx, dz)
      boom.current?.setAttribute('width', String(len))
      boom.current?.setAttribute('transform', `translate(${TURRET.x} ${TURRET.z}) rotate(${rad2deg(Math.atan2(dz, dx))})`)
      // Cab: at its real spot, turned with the turret.
      const c = cabCenter(tip, pose)
      cab.current?.setAttribute('transform', `translate(${c.x} ${c.z}) rotate(${-rad2deg(pose.turretYaw)})`)
    },
  }))

  return (
    <g ref={gRef} display="none">
      {/* Body and rear deck */}
      <rect x={-(W - 0.3) / 2} y={fromBack(5.9)} width={W - 0.3} height={2.4} fill={color.interactiveAction} opacity={0.5} rx={0.1} />
      <rect x={-W / 2} y={fromBack(3.5)} width={W} height={3.5} fill={color.interactiveAction} rx={0.35} />
      {/* Rounded turret cover */}
      <rect x={-W / 2 + 0.1} y={fromBack(3.35)} width={W - 0.2} height={3.3} fill={color.interactiveFocus} rx={0.5} />
      {/* Boom (width and angle set from the pose) */}
      <rect ref={boom} x={0} y={-BOOM_W / 2} height={BOOM_W} fill={color.interactiveAction} stroke={color.surfaceCanvas} strokeWidth={0.06} />
      {/* Cab with its roof, and the forks out front */}
      <g ref={cab}>
        {[-0.4, 0.4].map((x) => (
          <rect key={x} x={x - 0.075} y={-CAB_HALF.z - 1.7} width={0.15} height={1.7} fill={color.interactiveAction} />
        ))}
        <rect x={-CAB_HALF.x} y={-CAB_HALF.z} width={CAB_HALF.x * 2} height={CAB_HALF.z * 2} fill={color.interactiveAction} stroke={color.surfaceCanvas} strokeWidth={0.06} rx={0.1} />
        <rect x={-CAB_HALF.x + 0.12} y={-CAB_HALF.z + 0.12} width={CAB_HALF.x * 2 - 0.24} height={CAB_HALF.z * 2 - 0.24} fill={color.interactiveFocus} rx={0.08} />
      </g>
    </g>
  )
})
