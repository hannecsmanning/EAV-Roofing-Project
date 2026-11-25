import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens/tokens.css'
import './styles.css'
import './keys'
import App from './App'
import { ToastGallery } from './hmi/ToastGallery'

// ?toasts opens the toast review page instead of the simulator.
const reviewToasts = new URLSearchParams(location.search).has('toasts')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {reviewToasts ? <ToastGallery /> : <App />}
  </StrictMode>,
)
