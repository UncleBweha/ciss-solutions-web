import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Logo with its off-white background removed (public/logo-transparent.webp), cropped to the mark. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="CISS Solutions home" className={cn('block w-fit shrink-0', className)}>
      <span className="relative block aspect-[1115/570] w-[96px] overflow-hidden sm:w-[120px]">
        <Image
          src="/logo-transparent.webp"
          alt="CISS Solutions"
          width={1254}
          height={1254}
          loading={priority ? 'eager' : undefined}
          sizes="140px"
          className="absolute max-w-none"
          style={{ width: '112.47%', height: 'auto', left: '-6.28%', top: '-58.8%' }}
        />
      </span>
    </Link>
  )
}
