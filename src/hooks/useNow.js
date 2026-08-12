import { useState, useEffect } from 'react'

/**
 * Re-renders the consumer on an interval so time-dependent UI (the now-line,
 * "today" highlighting, exam countdowns) doesn't freeze at mount time.
 *
 * The visibilitychange listener matters more than the interval: mobile
 * browsers throttle or suspend timers, so returning to a backgrounded PWA is
 * the common way to end up looking at a stale day.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, intervalMs)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [intervalMs])

  return now
}
