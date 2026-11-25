import { useEffect, useState } from 'react'

const format = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** The real time, like "10:45 AM". Updates every few seconds. */
export function useClock() {
  const [time, setTime] = useState(() => format(new Date()))
  useEffect(() => {
    const id = setInterval(() => setTime(format(new Date())), 5000)
    return () => clearInterval(id)
  }, [])
  return time
}
