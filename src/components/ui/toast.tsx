'use client'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; tone: ToastTone; message: ReactNode }

const ToastContext = createContext<(message: ReactNode, tone?: ToastTone) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const show = useCallback(
    (message: ReactNode, tone: ToastTone = 'success') => {
      const id = nextId++
      setToasts((t) => [...t.slice(-2), { id, tone, message }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )
  const value = useMemo(() => show, [show])
  const icons = { success: CheckCircle2, error: TriangleAlert, info: Info }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6 lg:bottom-6">
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="glass-strong animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-card)] p-4 text-sm"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' ? 'text-success' : t.tone === 'error' ? 'text-danger' : 'text-primary-light')} aria-hidden="true" />
              <div className="flex-1">{t.message}</div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-fg-muted hover:text-fg" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
