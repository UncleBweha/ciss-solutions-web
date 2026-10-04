import { whatsappNumber } from '@/lib/env'

/** wa.me link for the business WhatsApp (settings value, falling back to env). */
export function whatsappLink(number?: string | null, text?: string): string | null {
  const digits = (number || whatsappNumber || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
