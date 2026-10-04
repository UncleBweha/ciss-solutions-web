import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary-strong text-white hover:bg-primary-strong-hover disabled:bg-primary-strong/50',
  secondary: 'bg-white text-background hover:bg-white/90 disabled:bg-white/50',
  glass: 'border border-border-strong bg-transparent text-fg hover:bg-surface',
  ghost: 'text-fg-secondary hover:text-fg hover:bg-surface',
  danger: 'bg-danger-strong text-white hover:bg-red-700',
  success: 'bg-green-700 text-white hover:bg-green-800',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-5 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-md',
  icon: 'h-10 w-10 rounded-md',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer',
    variants[variant],
    sizes[size],
    className,
  )
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size; loading?: boolean }

export function Button({ variant, size, loading, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

export const PrimaryButton = (props: ButtonProps) => <Button variant="primary" {...props} />
export const SecondaryButton = (props: ButtonProps) => <Button variant="secondary" {...props} />
export const GlassButton = (props: ButtonProps) => <Button variant="glass" {...props} />

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
