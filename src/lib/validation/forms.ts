import { z } from 'zod'
import { normalizeKenyanPhone } from '@/lib/ecommerce/kenya'

export const kenyanPhone = z
  .string()
  .trim()
  .min(1, 'Enter your phone number')
  .transform((v, ctx) => {
    const n = normalizeKenyanPhone(v)
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan mobile number, e.g. 0712345678' })
      return z.NEVER
    }
    return n
  })

export const optionalKenyanPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined
    const n = normalizeKenyanPhone(v)
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan mobile number' })
      return z.NEVER
    }
    return n
  })

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10, 'Tell other customers a little more (at least 10 characters)').max(2000),
})

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(200),
  phone: optionalKenyanPhone,
  subject: z.string().trim().min(2, 'Enter a subject').max(150),
  message: z.string().trim().min(10, 'Please write a little more').max(4000),
  website: z.string().max(0).optional(), // honeypot
})

export const partRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  phone: kenyanPhone,
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]).optional(),
  printerBrand: z.string().trim().min(1, 'Enter the printer brand').max(60),
  printerModel: z.string().trim().min(1, 'Enter the printer model').max(80),
  message: z.string().trim().min(5, 'Describe the problem or the part you need').max(4000),
  website: z.string().max(0).optional(),
})

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> }

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}
