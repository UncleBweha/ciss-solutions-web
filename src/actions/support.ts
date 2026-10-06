'use server'
import { getSessionUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { clientIp, rateLimit } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'
import { contactSchema, fieldErrors, partRequestSchema, type FormState } from '@/lib/validation/forms'

const MAX_UPLOAD = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

async function guard(kind: string): Promise<string | null> {
  const ip = await clientIp()
  return (await rateLimit(`${kind}:${ip}`, 40, 3600)) ? null : 'You have sent several messages already. Please try again later or contact us on WhatsApp.'
}

export async function submitContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const limited = await guard('contact')
  if (limited) return { message: limited }
  const parsed = contactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (parsed.data.website) return { ok: true, message: 'Thank you. We will get back to you shortly.' } // bot

  const user = await getSessionUser()
  const db = createAdminClient()
  const { error } = await db.from('support_requests').insert({
    kind: 'contact',
    user_id: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    subject: parsed.data.subject,
    message: parsed.data.message,
  })
  if (error) {
    logger.error('support.contact_failed', { error: error.message })
    return { message: 'We could not send your message. Please try WhatsApp or call us.' }
  }
  await db.rpc('notify_admin', { p_kind: 'new_support_request', p_subject: `Message: ${parsed.data.subject}`, p_payload: { name: parsed.data.name } })
  return { ok: true, message: 'Thank you. We will get back to you shortly.' }
}

export async function submitPartRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const limited = await guard('part-request')
  if (limited) return { message: limited }
  const parsed = partRequestSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (parsed.data.website) return { ok: true, message: 'Request received.' }

  const db = createAdminClient()
  let attachmentPath: string | null = null
  const file = formData.get('attachment')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD) return { errors: { attachment: 'The file must be 5 MB or smaller.' } }
    if (!ALLOWED.has(file.type)) return { errors: { attachment: 'Upload a JPG, PNG, WebP or PDF.' } }
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
    attachmentPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const { error } = await db.storage.from('support-attachments').upload(attachmentPath, file, { contentType: file.type })
    if (error) {
      logger.error('support.upload_failed', { error: error.message })
      attachmentPath = null
    }
  }

  const user = await getSessionUser()
  const { error } = await db.from('support_requests').insert({
    kind: 'part_request',
    user_id: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone,
    subject: `Part request: ${parsed.data.printerBrand} ${parsed.data.printerModel}`,
    printer_brand: parsed.data.printerBrand,
    printer_model: parsed.data.printerModel,
    message: parsed.data.message,
    attachment_path: attachmentPath,
  })
  if (error) {
    logger.error('support.part_request_failed', { error: error.message })
    return { message: 'We could not send your request. Please try WhatsApp or call us.' }
  }
  await db.rpc('notify_admin', {
    p_kind: 'new_support_request',
    p_subject: `Part request: ${parsed.data.printerBrand} ${parsed.data.printerModel}`,
    p_payload: { name: parsed.data.name },
  })
  return { ok: true, message: 'Request received. A technician will contact you, usually within one business day.' }
}
