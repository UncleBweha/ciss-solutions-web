'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Star } from 'lucide-react'
import { submitReviewAction } from '@/actions/reviews'
import { useCart } from '@/components/cart/cart-provider'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input, Textarea } from '@/components/ui/form'
import { cn } from '@/lib/utils'

export function ReviewForm({ productId, slug }: { productId: string; slug: string }) {
  const { signedIn } = useCart()
  const [state, action, pending] = useActionState(submitReviewAction, {})
  const [rating, setRating] = useState(0)

  if (!signedIn) {
    return (
      <p className="text-sm text-fg-secondary">
        <Link href={`/login?next=/p/${slug}`} className="font-semibold text-primary-light underline">
          Sign in
        </Link>{' '}
        to review this product. Reviews from customers who bought it are marked “Verified Purchase”.
      </p>
    )
  }
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>

  return (
    <form action={action} className="glass-flat space-y-4 rounded-[var(--radius-card)] p-5">
      <h3 className="font-bold">Write a review</h3>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ''} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-fg-secondary">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`} aria-pressed={rating === i} className="p-0.5">
              <Star className={cn('h-7 w-7', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-white/25 hover:text-amber-300')} />
            </button>
          ))}
        </div>
        {state.errors?.rating ? <p className="mt-1 text-xs text-red-300">{state.errors.rating}</p> : null}
      </fieldset>
      <Field label="Title" htmlFor="review-title" error={state.errors?.title}>
        <Input id="review-title" name="title" maxLength={120} />
      </Field>
      <Field label="Your review" htmlFor="review-comment" error={state.errors?.comment} required>
        <Textarea id="review-comment" name="comment" required maxLength={2000} aria-invalid={Boolean(state.errors?.comment)} />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" loading={pending}>
        Submit review
      </Button>
    </form>
  )
}
