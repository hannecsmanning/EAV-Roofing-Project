// A review page with every toast type and content option, laid out like the Figma "Toast" component sheet.
// Open the site with ?toasts at the end of the address to see it.
import { Toast } from './Toast'
import type { ToastType } from '../store'
import './hmi.css'

const TYPES: ToastType[] = ['Action', 'Step', 'Loading', 'Success', 'Warning', 'Danger']
const SAMPLE = { title: 'Allow move?', message: 'Machine will configure to new location. Allow?' }
const CONTENTS = [
  { name: 'Message', title: undefined, message: SAMPLE.message },
  { name: 'Title + message', title: SAMPLE.title, message: SAMPLE.message },
  { name: 'Title', title: SAMPLE.title, message: undefined },
]

export function ToastGallery() {
  return (
    <div className="toast-gallery">
      <h1>Toasts</h1>
      <div className="toast-gallery__grid">
        {CONTENTS.map((c) => (
          <p key={c.name} className="toast-gallery__label">{c.name}</p>
        ))}
        {TYPES.map((type) =>
          CONTENTS.map((c) => (
            <Toast
              key={type + c.name}
              type={type}
              title={c.title}
              message={c.message}
              action={type === 'Action' ? { label: 'Allow', onPress: () => {} } : undefined}
            />
          )),
        )}
      </div>
    </div>
  )
}
