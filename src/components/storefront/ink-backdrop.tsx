import { cn } from '@/lib/utils'

/**
 * Print-trade backdrop: cyan, magenta and yellow halftone screens, each fading in
 * a different corner. Glass panels placed on top blur it into soft ink colour.
 */
export function InkBackdrop({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <span className="halftone-c" />
        <span className="halftone-m" />
        <span className="halftone-y" />
      </div>
      {children}
    </div>
  )
}
