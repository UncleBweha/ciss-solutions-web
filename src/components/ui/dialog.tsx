'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  /** 'modal' is centred; 'drawer-left' / 'drawer-right' / 'drawer-bottom' slide from an edge. */
  variant?: 'modal' | 'drawer-left' | 'drawer-right' | 'drawer-bottom'
  hideTitle?: boolean
}

/**
 * Accessible modal/drawer on the native <dialog> element: focus trapping, Escape to
 * close, inert background and focus restoration come from the browser.
 */
export function Dialog({ open, onClose, title, children, className, variant = 'modal', hideTitle }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const placement = {
    modal: 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-[var(--radius-card)]',
    'drawer-left': 'my-0 ml-0 mr-auto h-dvh max-h-dvh w-[min(22rem,88vw)] rounded-r-[var(--radius-card)]',
    'drawer-right': 'my-0 ml-auto mr-0 h-dvh max-h-dvh w-[min(26rem,92vw)] rounded-l-[var(--radius-card)]',
    'drawer-bottom': 'mx-0 mb-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[var(--radius-card)]',
  }[variant]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-label={title}
      className={cn(
        'border border-border bg-background-secondary/95 p-0 text-fg shadow-[var(--shadow-lift)] backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        placement,
        className,
      )}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className={cn('flex items-center justify-between gap-4 px-5 pt-5', hideTitle && 'sr-only')}>
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-fg-secondary hover:bg-surface hover:text-fg" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  )
}

export const Modal = (props: Omit<DialogProps, 'variant'>) => <Dialog variant="modal" {...props} />
export const Drawer = ({ side = 'right', ...props }: Omit<DialogProps, 'variant'> & { side?: 'left' | 'right' | 'bottom' }) => (
  <Dialog variant={`drawer-${side}`} {...props} />
)
