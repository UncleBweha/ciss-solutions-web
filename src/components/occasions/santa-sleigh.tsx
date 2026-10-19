'use client'

import { useEffect, useState } from 'react'

/* ===========================================================================
   Order-success celebration, Christmas only — src/components/checkout/payment-status.tsx mounts this exactly once, on the same transition into "paid" that
   already fires fireConfetti(). Composed from emoji rather than a custom
   illustration: reliable cross-platform rendering, zero asset weight, no
   dependency on an image-generation pipeline that might not land a "Santa's
   sleigh and eight reindeer" scene well on the first try. The flight path
   and duration live in globals.css's occasion-sleigh-flight keyframe — one
   pass, bottom-left to top-right, then gone (fill-mode: forwards holds the
   end state, so nothing needs to animate back).
   ========================================================================= */

const REINDEER_COUNT = 4

export function SantaSleighCelebration() {
  // Unmounts itself once the 4.5s flight (see globals.css) has finished —
  // the element is invisible by then anyway (animation ends at opacity: 0),
  // this just keeps it out of the DOM afterward instead of sitting there
  // inert for the rest of the page's life.
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="animate-occasion-sleigh-flight pointer-events-none fixed left-0 top-1/2 z-50 flex -translate-y-1/2 items-center gap-0.5 text-4xl sm:text-5xl"
      aria-hidden
    >
      <span>✨</span>
      {Array.from({ length: REINDEER_COUNT }, (_, i) => (
        <span key={i} className="scale-x-[-1]">
          🦌
        </span>
      ))}
      <span className="scale-x-[-1]">🛷</span>
      <span>🎅</span>
      <span className="text-2xl sm:text-3xl">🎁</span>
    </div>
  )
}

/** Announced to screen readers once, separately from the purely decorative
    flying scene above (which stays aria-hidden) — the actual information
    ("order on its way") belongs in text, not in an emoji animation. */
export function SantaCelebrationAnnouncement() {
  return (
    <p role="status" className="sr-only">
      Your order is confirmed and on its way, happy holidays from CISS Solutions!
    </p>
  )
}
