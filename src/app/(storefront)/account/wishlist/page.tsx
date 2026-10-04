import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { LinkButton } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { requireUser } from '@/lib/auth'
import { getCardsByIds } from '@/lib/catalog'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My wishlist', robots: { index: false } }

export default async function WishlistPage() {
  const user = await requireUser('/account/wishlist')
  const supabase = await createClient()
  const { data } = await supabase.from('wishlist_items').select('product_id, created_at, wishlists!inner(user_id)').eq('wishlists.user_id', user.id).order('created_at', { ascending: false })
  const ids = (data ?? []).map((r) => r.product_id)
  const cards = await getCardsByIds(ids)
  const ordered = ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">My wishlist</h1>
      {ordered.length ? (
        <ProductGrid products={ordered} layout="sidebar" />
      ) : (
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it for later."
          action={<LinkButton href="/shop">Browse products</LinkButton>}
        />
      )}
    </div>
  )
}
