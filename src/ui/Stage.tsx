import { useEffect, useState, type ReactNode } from 'react'

// The overlay is designed at 1920 x 1080 (same as the Figma frames).
// It scales to fit any window so the layout always matches Figma.
const W = 1920
const H = 1080

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div className="stage-wrap">
      <div className="stage" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
