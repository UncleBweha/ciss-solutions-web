'use server'
import { getSessionUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { clientIp, rateLimit } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'
import { contactSchema, fieldErrors, partRequestSchema, type FormState } from '@/lib/validation/forms'

const MAX_UPLOAD = 5 * 1024 * 1024
const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const ATTACHMENT_PATH = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(jpeg|png|webp|pdf)$/

async function guard(kind: string): Promise<string | null> {
  const ip = await clientIp()
  return (await rateLimit(`${kind}:${ip}`, 40, 3600)) ? null : 'You have sent several messages already. Please try again later or contact us on WhatsApp.'
}

/** The request is saved either way; without this entry staff would only find it by opening Support. */
async function alertStaff(subject: string, name: string) {
  const { error } = await createAdminClient().rpc('notify_admin', { p_kind: 'new_support_request', p_subject: subject, p_payload: { name } })
  if (error) logger.error('support.alert_not_saved', { subject, error: error.message })
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
  await alertStaff(`Message: ${parsed.data.subject}`, parsed.data.name)
  return { ok: true, message: 'Thank you. We will get back to you shortly.' }
}

/**
 * A one-time signed URL the browser uploads a part-request photo to (the private bucket
 * caps its size and type too). Files go straight to storage because hosting caps a server
 * action's request body (4.5 MB on Vercel). The form then sends only the returned path.
 */
export async function startAttachmentUploadAction(type: string, size: number): Promise<{ path: string; token: string } | { error: string }> {
  const ext = ALLOWED[type]
  if (!ext) return { error: 'Upload a JPG, PNG, WebP or PDF.' }
  if (!(size > 0 && size <= MAX_UPLOAD)) return { error: 'The file must be 5 MB or smaller.' }
  const ip = await clientIp()
  if (!(await rateLimit(`attachment:${ip}`, 40, 3600))) return { error: 'Too many uploads. Please try again later or send the photo on WhatsApp.' }
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await createAdminClient().storage.from('support-attachments').createSignedUploadUrl(path)
  if (error || !data) {
    logger.error('support.upload_url_failed', { error: error?.message })
    return { error: 'We could not upload the file. You can still send the request without it.' }
  }
  return { path: data.path, token: data.token }
}

export async function submitPartRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const limited = await guard('part-request')
  if (limited) return { message: limited }
  const parsed = partRequestSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  if (parsed.data.website) return { ok: true, message: 'Request received.' }

  const db = createAdminClient()
  // The browser uploaded the file already (startAttachmentUploadAction); keep the path only if it is there.
  let attachmentPath: string | null = null
  const sent = formData.get('attachment')
  if (typeof sent === 'string' && ATTACHMENT_PATH.test(sent)) {
    const { data: found, error } = await db.storage.from('support-attachments').exists(sent)
    if (found) attachmentPath = sent
    else logger.error('support.attachment_missing', { path: sent, error: error?.message })
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
  await alertStaff(`Part request: ${parsed.data.printerBrand} ${parsed.data.printerModel}`, parsed.data.name)
  return { ok: true, message: 'Request received. A technician will contact you, usually within one business day.' }
}
