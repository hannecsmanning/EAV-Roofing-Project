// Shared HMI pieces, built from the Figma components of the same name.
import { color } from '../tokens/tokens'
import lmiWarningOff from '../assets/hmi/lmi-warning-off.svg'
import lmiLightOff from '../assets/hmi/lmi-light-off.svg'
import lockIcon from '../assets/hmi/lock.svg'
import { useLmiLevel } from '../flows/lmi'
import wireStatusOff from '../assets/hmi/wire-status-off.svg'
import wireStatusConnected from '../assets/hmi/wire-status-connected.svg'
import { useSim } from '../store'
import tiltLevel from '../assets/hmi/tilt-level.svg'
import tiltLevelWarning from '../assets/hmi/tilt-level-warning.svg'
import boomRestrictedIcon from '../assets/hmi/boom-restricted.svg'
import creepSpeedIcon from '../assets/hmi/creep-speed.svg'
import { MAX_LOAD_LB } from '../scene/siteLayout'

// ---------- Status bar (Figma: "Status bar", Wire=Off) ----------
// Top bar on every screen: temperature, time, wire status, battery.
// The wire badge turns green when the machine is connected to the wire (Wire=Connected).
export function StatusBar({ temperature = '75°F', time, battery = '60%' }: { temperature?: string; time: string; battery?: string }) {
  const connected = useSim((s) => s.wire === 'connected')
  // Status chips stay on while a restriction lasts (doc: Boom restricted, Creep speed).
  const uneven = useSim((s) => s.alerts.uneven)
  const creep = useSim((s) => s.alerts.uneven || s.alerts.overweight || s.alerts.object || s.alerts.danger)
  return (
    <div className="hmi-status">
      <div className="hmi-status__left hmi-readout">
        <span>{temperature}</span>
        <span>{time}</span>
      </div>
      <div className="hmi-status__right">
        {uneven && <StatusChip icon={boomRestrictedIcon} label="Boom restricted" />}
        {creep && <StatusChip icon={creepSpeedIcon} label="Creep speed" />}
        <div className="hmi-status__wire">
          <img src={connected ? wireStatusConnected : wireStatusOff} width={40} height={40} alt={connected ? 'Wire connected' : 'Wire not connected'} />
        </div>
        <div className="hmi-battery">
          <div className="hmi-battery__body">
            <div className="hmi-battery__fill hmi-label">{battery}</div>
          </div>
          <div className="hmi-battery__nubs">
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- LMI light stack ----------
// Fills from the bottom. Level 1 (green) is the only lit state built so far.
// Levels 3 to 6 (amber, red) and the lit warning icon come with the LMI flow.
// Figma "LMI light stack": fills from the bottom. 1-2 green (safe), 3-4 amber (approaching the limit), 5-6 red (at the limit).
// The warning icon turns amber at 5 and red at 6. Off lights are neutral outlines.
const LIGHT_COLOR = (n: number) => (n <= 2 ? color.feedbackSuccess : n <= 4 ? color.feedbackWarning : color.feedbackError)
export function LmiLightStack() {
  const level = useLmiLevel()
  const lights = [6, 5, 4, 3, 2, 1]
  const warn = level >= 6 ? color.feedbackError : level >= 5 ? color.feedbackWarning : null
  return (
    <div className="hmi-lmi hmi-card">
      {warn ? (
        <svg width={80} height={80} viewBox="0 0 80 80" fill="none" aria-label="LMI warning">
          <path d={`M40 30V43.3333M40 53.3333H40.0333${WARNING_TRIANGLE}`} stroke={warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <img src={lmiWarningOff} width={80} height={80} alt="" />
      )}
      {lights.map((n) =>
        n <= level ? (
          <svg key={n} width={60} height={60} viewBox="0 0 60 60" aria-label={`LMI light ${n} on`}>
            <circle cx={30} cy={30} r={30} fill={LIGHT_COLOR(n)} />
          </svg>
        ) : (
          <img key={n} src={lmiLightOff} width={60} height={60} alt="" />
        ),
      )}
    </div>
  )
}
const WARNING_TRIANGLE =
  'M45.7585 16.6409L69.0919 56.6409C71.6844 61.0852 68.4786 66.6667 63.3333 66.6667H16.6667C11.5214 66.6667 8.3156 61.0852 10.9081 56.6409L34.2415 16.6409C36.814 12.2308 43.186 12.2308 45.7585 16.6409Z'

// ---------- Map lock (Figma "Map lock"): dims the machine view with a lock badge while movement is locked ----------
export function MapLock({ label }: { label: string }) {
  return (
    <div className="hmi-map-lock">
      <div className="hmi-map-lock__badge">
        <div className="hmi-map-lock__circle">
          <img src={lockIcon} width={72} height={72} alt="" />
        </div>
        <p className="hmi-map-lock__label">{label}</p>
      </div>
    </div>
  )
}

// ---------- Status chip (Figma "Boom chip" / "Speed chip"): amber pill in the status bar ----------
function StatusChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="hmi-status-chip">
      <img src={icon} width={28} height={28} alt="" />
      <span className="hmi-label">{label}</span>
    </div>
  )
}

// ---------- Tilt badge: Normal, or Warning (amber) when the ground is too steep ----------
export function TiltBadge({ degrees, warning = false, className = '' }: { degrees: number; warning?: boolean; className?: string }) {
  return (
    <div className={`hmi-tilt hmi-card ${warning ? 'hmi-tilt--warning' : ''} ${className}`}>
      <img src={warning ? tiltLevelWarning : tiltLevel} width={48} height={48} alt="" />
      <span className="hmi-readout hmi-tilt__value">{degrees}°</span>
    </div>
  )
}

// ---------- Button, Type=Icon (Primary or Disabled) ----------
// Glove-friendly: 56 px icon with 24 px padding. Disabled turns gray and does nothing.
export function IconButton({ label, icon, disabled = false, onClick }: { label: string; icon: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="hmi-icon-button" aria-label={label} disabled={disabled} onClick={onClick}>
      <img src={icon} width={56} height={56} alt="" />
    </button>
  )
}

// ---------- Load badge: Normal, or Overweight (amber, with the max under the weight) ----------
export function LoadBadge({ pounds, className = '' }: { pounds: number; className?: string }) {
  const over = pounds > MAX_LOAD_LB
  return (
    <div className={`hmi-load ${over ? 'hmi-load--over' : ''} ${className}`}>
      <span className="hmi-readout">{pounds.toLocaleString('en-US')} LB</span>
      {over && <span className="hmi-load__max">Max {MAX_LOAD_LB.toLocaleString('en-US')} LB</span>}
    </div>
  )
}
