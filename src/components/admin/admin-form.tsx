'use client'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { FormMessage } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import type { ActionResult } from '@/lib/admin/action'

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>

/** Submits FormData to a staff server action; shows field errors and a toast. */
export function AdminForm({
  action,
  children,
  submitLabel = 'Save',
  className,
  resetOnSuccess,
  redirectTo,
}: {
  action: FormAction
  children: ReactNode
  submitLabel?: string
  className?: string
  resetOnSuccess?: boolean
  redirectTo?: string
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const toast = useToast()
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast(state.message ?? 'Saved')
      if (resetOnSuccess) ref.current?.reset()
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <div className="mt-3">
          <FormMessage>
            {state.message}
            {state.errors ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {Object.entries(state.errors).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
            ) : null}
          </FormMessage>
        </div>
      ) : null}
      <Button type="submit" loading={pending} className="mt-4">
        {submitLabel}
      </Button>
    </form>
  )
}

/** Button that runs a staff action after a confirmation dialog. */
export function ConfirmAction({
  action,
  label,
  title,
  description,
  variant = 'danger',
  size = 'sm',
  redirectTo,
}: {
  action: () => Promise<ActionResult>
  label: ReactNode
  title: string
  description: ReactNode
  variant?: 'danger' | 'primary' | 'glass' | 'ghost'
  size?: 'sm' | 'md'
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  return (
    <>
      <Button variant={variant === 'danger' ? 'ghost' : variant} size={size} className={variant === 'danger' ? 'text-red-300' : undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-sm text-fg-secondary">{description}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await action()
                toast(r.ok ? r.message ?? 'Done' : r.message, r.ok ? 'success' : 'error')
                if (r.ok) {
                  setOpen(false)
                  if (redirectTo) router.push(redirectTo)
                  else router.refresh()
                }
              })
            }
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  )
}
