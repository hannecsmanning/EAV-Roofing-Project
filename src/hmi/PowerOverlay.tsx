// Power on and idle, over the machine view (Figma "Power On, Idle and Off").
//   PIN: the Map lock dim with the PIN keypad in the middle (no lock badge).
//   Start-up check: the Map lock dim with a card listing Outriggers and LMI, each with a spinner until it passes.
//   Idle: a white 50% dim over the map (the Load badge stays on top).
import { useSim } from '../store'
import { MapLock, PinKeypad } from './parts'
import { unlockPower } from '../flows/power'
import circleCheck from '../assets/hmi/circle-check.svg'
import spinner from '../assets/hmi/spinner.svg'

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="hmi-startup__row">
      <img src={ok ? circleCheck : spinner} width={36} height={36} alt="" className={ok ? undefined : 'hmi-spin'} />
      <span className="hmi-label">{label} · {ok ? 'OK' : 'Checking...'}</span>
    </div>
  )
}

export function PowerOverlay() {
  const power = useSim((s) => s.power)
  const check = useSim((s) => s.startupCheck)
  if (power === 'pin') {
    return (
      <MapLock label="Locked">
        <PinKeypad onUnlock={unlockPower} />
      </MapLock>
    )
  }
  if (power === 'checking' || power === 'ready') {
    return (
      <MapLock label="Start-up check">
        <div className="hmi-startup">
          <p className="hmi-startup__title">Start-up check</p>
          <CheckRow label="Outriggers" ok={check.outriggers} />
          <CheckRow label="LMI" ok={check.lmi} />
        </div>
      </MapLock>
    )
  }
  if (power === 'idle') return <div className="hmi-idle-dim" />
  return null
}
