'use server'
import { getSessionUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, reviewSchema, type FormState } from '@/lib/validation/forms'

/** Customer review. The database forces it into moderation and computes "verified purchase". */
export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser()
  if (!user) return { message: 'Please sign in to write a review.' }
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.from('reviews').upsert(
    {
      product_id: parsed.data.productId,
      user_id: user.id,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      comment: parsed.data.comment,
      author_name: user.fullName?.split(' ')[0] ?? null,
    },
    { onConflict: 'product_id,user_id' },
  )
  if (error) {
    logger.error('review.submit_failed', { userId: user.id, error: error.message })
    return { message: 'We could not save your review. Please try again.' }
  }
  return { ok: true, message: 'Thank you! Your review will appear once it has been approved.' }
}
