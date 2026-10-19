'use client'

import { useEffect, useState } from 'react'

/* ===========================================================================
   Countdown to midnight, Nairobi time, New Year's Day — mounted only inside
   the New Year occasion banner (occasion-banner.tsx). Ticks client-side
   (this genuinely needs real interactivity, unlike every other occasion
   decoration in this app, which is deliberately static CSS) but the target
   time is computed from Africa/Nairobi's UTC+3 offset directly, not the
   visitor's own browser timezone — a shopper checking this from anywhere
   should see Kenya's own New Year, not their own.
   ========================================================================= */

const NAIROBI_UTC_OFFSET_HOURS = 3

function millisUntilNairobiNewYear(): number {
  const now = new Date()
  const nairobiNow = new Date(now.getTime() + NAIROBI_UTC_OFFSET_HOURS * 3600_000)
  const nairobiYear = nairobiNow.getUTCFullYear()
  // The target instant, expressed as a UTC timestamp that corresponds to
  // 00:00:00 on 1 Jan in Nairobi (i.e. 21:00 UTC on 31 Dec).
  const target = Date.UTC(nairobiYear, 0, 1, -NAIROBI_UTC_OFFSET_HOURS, 0, 0)
  let diff = target - now.getTime()
  if (diff < 0) {
    // Already past this Nairobi New Year — count to next year's instead,
    // so the component never shows a negative countdown.
    diff = Date.UTC(nairobiYear + 1, 0, 1, -NAIROBI_UTC_OFFSET_HOURS, 0, 0) - now.getTime()
  }
  return diff
}

function partsFromMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function NewYearCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setRemaining(millisUntilNairobiNewYear())
    const first = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [])

  // Nothing on first server-rendered paint — avoids a hydration mismatch
  // between the server's render time and the client's, and it's a one-tick
  // flash at most before the client's own interval kicks in.
  if (remaining === null) return null

  const { days, hours, minutes, seconds } = partsFromMillis(remaining)
  const isNewYearMoment = remaining <= 0

  if (isNewYearMoment) {
    return <p className="mt-3 text-[18px] font-extrabold text-white">🎉 It&apos;s here, Happy New Year! 🎉</p>
  }

  return (
    <div className="mt-3 flex gap-3" role="timer" aria-label="Countdown to Nairobi New Year">
      {[
        ['Days', days],
        ['Hrs', hours],
        ['Min', minutes],
        ['Sec', seconds],
      ].map(([label, value]) => (
        <div key={label as string} className="rounded-[10px] bg-white/15 px-3 py-1.5 text-center backdrop-blur-sm">
          <div className="font-mono text-[20px] font-extrabold tabular-nums text-white">{pad(value as number)}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</div>
        </div>
      ))}
    </div>
  )
}
