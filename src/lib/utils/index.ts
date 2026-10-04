export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', ...opts }).format(new Date(value))
}

export function formatDateTime(value: string | Date) {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Reads a single string from Next searchParams values. */
export function param(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

export function paramList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return raw.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}
