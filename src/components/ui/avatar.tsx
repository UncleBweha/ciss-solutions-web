'use client'
import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A person's picture; falls back to their initial, then to a generic icon. Size it with className. */
export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) {
    // Pictures come from Supabase storage or Google, already small: no optimiser needed.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(src)} className={cn('shrink-0 rounded-full object-cover', className)} />
  }
  const initial = name?.trim().charAt(0).toUpperCase()
  if (initial) {
    return (
      <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full bg-primary/15 text-[0.8em] font-bold text-primary-light', className)}>
        {initial}
      </span>
    )
  }
  return <User className={cn('shrink-0', className)} aria-hidden="true" />
}

export const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || null
