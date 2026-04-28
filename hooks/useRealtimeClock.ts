/**
 * useRealtimeClock — returns a live Date that updates every second
 */
import { useEffect, useState } from 'react'

export function useRealtimeClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
