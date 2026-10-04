'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { isCounty } from '@/lib/ecommerce/kenya'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, kenyanPhone, optionalKenyanPhone, type FormState } from '@/lib/validation/forms'

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const parsed = z
    .object({ fullName: z.string().trim().min(2, 'Enter your name').max(100), phone: optionalKenyanPhone })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null }).eq('id', user.id)
  if (error) return { message: 'Could not save your profile.' }
  revalidatePath('/account', 'layout')
  return { ok: true, message: 'Profile saved.' }
}

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2, 'Enter a name').max(100),
  phone: kenyanPhone,
  county: z.string().refine(isCounty, 'Choose a county'),
  town: z.string().trim().min(2, 'Enter a town').max(80),
  addressLine: z.string().trim().min(5, 'Enter the address').max(300),
  instructions: z.string().trim().max(500).optional(),
  isDefault: z.literal('on').optional(),
})

export async function addAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  const parsed = addressSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const supabase = await createClient()
  const isDefault = parsed.data.isDefault === 'on'
  if (isDefault) await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
  const { error } = await supabase.from('addresses').insert({
    user_id: user.id,
    label: parsed.data.label || null,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    county: parsed.data.county,
    town: parsed.data.town,
    address_line: parsed.data.addressLine,
    instructions: parsed.data.instructions || null,
    is_default: isDefault,
  })
  if (error) return { message: 'Could not save the address.' }
  revalidatePath('/account/addresses')
  return { ok: true, message: 'Address saved.' }
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser()
  const id = z.string().uuid().parse(formData.get('id'))
  const supabase = await createClient()
  await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/account/addresses')
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser()
  const id = z.string().uuid().parse(formData.get('id'))
  const supabase = await createClient()
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
  await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', user.id)
  revalidatePath('/account/addresses')
}
