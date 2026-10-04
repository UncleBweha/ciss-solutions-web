import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The brand logo has an off-white background and dark lettering, so it sits on a
 * light plate on the dark theme. The source is a padded square; we crop to the mark.
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="CISS Solutions home" className={cn('block shrink-0 rounded-xl bg-[#fbfbfb] px-2 py-1 shadow-sm', className)}>
      <span className="relative block aspect-[1115/570] w-[92px] overflow-hidden sm:w-[108px]">
        <Image
          src="/logo.webp"
          alt="CISS Solutions"
          width={1254}
          height={1254}
          priority={priority}
          sizes="140px"
          className="absolute max-w-none"
          style={{ width: '112.47%', height: 'auto', left: '-6.28%', top: '-58.8%' }}
        />
      </span>
    </Link>
  )
}
