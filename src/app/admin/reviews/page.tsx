import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { moderateReviewAction } from '@/actions/admin/content'
import { AdminPageHeader, Panel } from '@/components/admin/admin-ui'
import { ActionButton } from '@/components/admin/small-actions'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/ui/misc'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDateTime, param } from '@/lib/utils'

export const metadata = { title: 'Reviews' }

export default async function ReviewsAdmin({ searchParams }: PageProps<'/admin/reviews'>) {
  await requireStaff('reviews.moderate')
  const status = (param((await searchParams).status) ?? 'pending') as 'pending' | 'approved' | 'rejected'
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id, rating, title, comment, author_name, is_verified_purchase, status, created_at, product:products(name, slug)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)
  return (
    <div>
      <AdminPageHeader title="Reviews" description="Customer reviews appear on product pages after approval." />
      <div className="mb-4 flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold capitalize', s === status ? 'bg-primary/15 text-fg' : 'text-fg-secondary hover:bg-surface')}>{s}</Link>
        ))}
      </div>
      <div className="space-y-3">
        {(data ?? []).map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <RatingStars rating={r.rating} />
                  {r.title ? <span className="font-semibold">{r.title}</span> : null}
                  {r.is_verified_purchase ? <Badge tone="success"><BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified purchase</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-fg-secondary">{r.comment}</p>
                <p className="mt-2 text-xs text-fg-muted">
                  {r.author_name ?? 'Customer'} on <Link href={`/p/${r.product?.slug}`} target="_blank" className="text-primary-light">{r.product?.name}</Link> · {formatDateTime(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                {r.status !== 'approved' ? <ActionButton action={moderateReviewAction.bind(null, r.id, 'approved', undefined)} variant="success">Approve</ActionButton> : null}
                {r.status !== 'rejected' ? <ActionButton action={moderateReviewAction.bind(null, r.id, 'rejected', undefined)} variant="danger">Reject</ActionButton> : null}
              </div>
            </div>
          </Panel>
        ))}
        {!data?.length ? <p className="py-10 text-center text-sm text-fg-muted">No {status} reviews.</p> : null}
      </div>
    </div>
  )
}
