// All money is KES. Arithmetic is done in integer cents to avoid float drift.

export const CURRENCY = 'KES'

export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100)
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

const formatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 })
const formatterCents = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** KSh 32,999 (shows cents only when present). */
export function formatKES(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0)
  const whole = Number.isInteger(Math.round(value * 100) / 100) && Math.round(value * 100) % 100 === 0
  // Non-breaking space keeps "KSh" and the amount on one line.
  return `KSh\u00a0${(whole ? formatter : formatterCents).format(value)}`
}

export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price || compareAt <= 0) return 0
  return Math.floor(((compareAt - price) / compareAt) * 100)
}

export function savings(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0
  return fromCents(toCents(compareAt) - toCents(price))
}
