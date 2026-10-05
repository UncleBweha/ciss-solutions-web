'use client'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  label = 'Quantity',
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  label?: string
  disabled?: boolean
}) {
  const h = size === 'sm' ? 'h-9' : 'h-11'
  const btn = cn('grid place-items-center text-fg-secondary transition-colors hover:text-fg disabled:opacity-40', size === 'sm' ? 'w-8' : 'w-10')
  return (
    <div className={cn('inline-flex items-center rounded-full border border-border-strong bg-white/80', h)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-10 bg-transparent text-center text-sm font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
