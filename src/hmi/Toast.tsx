// Figma: "Toast" component (node 40000014:1961). One toast for every bottom-of-screen message.
//   Action  = teal bar + Allow button: the operator must approve.
//   Step    = teal bar: a heads up.
//   Loading = moving teal stripes: the machine is busy, keep working.
//   Success = green: it worked.
//   Warning = amber + icon: a limit is close.
//   Danger  = red + icon: the machine stopped, act now.
// Content follows what's filled in: a title, a message, or both.
import type { ToastData } from '../store'
import { useSim } from '../store'
import warningIcon from '../assets/hmi/toast-warning.svg'
import dangerIcon from '../assets/hmi/toast-danger.svg'

export function Toast({ type, title, message, action, picture, className = '' }: ToastData & { className?: string }) {
  const icon = type === 'Warning' ? warningIcon : type === 'Danger' ? dangerIcon : null
  return (
    <div className={`hmi-toast hmi-toast--${type.toLowerCase()} ${className}`} role={type === 'Danger' || type === 'Warning' ? 'alert' : 'status'}>
      {type === 'Loading' && <div className="hmi-toast__stripes" />}
      {icon && <img src={icon} width={65} height={65} alt="" className="hmi-toast__icon" />}
      <div className="hmi-toast__text">
        {title && <p className="hmi-toast__title">{title}</p>}
        {message && <p className="hmi-toast__message">{message}</p>}
      </div>
      {picture && (
        <div className="hmi-toast__picture">
          <img src={picture} width={160} height={128} alt="" />
        </div>
      )}
      {action && (
        <button type="button" className="hmi-toast__button" onClick={action.onPress}>
          {action.label}
        </button>
      )}
    </div>
  )
}

/** The toast slot on an HMI screen: bottom of the machine view (Figma "Toast slot"). */
export function ToastSlot() {
  const toast = useSim((s) => s.toast)
  if (!toast) return null
  return <Toast {...toast} className="hmi-toast-slot" />
}
