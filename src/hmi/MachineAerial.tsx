// Figma: "Machine · Aerial", Style=Filled, State=Folded.
// A top-down render of the lift, cut to shape and tinted with the primary teal (keeps its 3D shading).
import machineMask from '../assets/hmi/machine-mask.png'
import machineRender from '../assets/hmi/machine-render.png'

export function MachineAerial({ className = '' }: { className?: string }) {
  const mask = { maskImage: `url("${machineMask}")`, WebkitMaskImage: `url("${machineMask}")` }
  return (
    <div className={`hmi-aerial ${className}`}>
      {/* The render files have the forks at the bottom; the screen shows them pointing up. */}
      <div className="hmi-aerial__flip" style={mask}>
        <div className="hmi-aerial__render">
          <img src={machineRender} alt="" />
        </div>
        <div className="hmi-aerial__tint hmi-aerial__tint--color" />
        <div className="hmi-aerial__tint hmi-aerial__tint--multiply" />
      </div>
    </div>
  )
}
