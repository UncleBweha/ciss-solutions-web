import { ProductGridSkeleton } from '@/components/product/product-card'
import { Skeleton } from '@/components/ui/misc'

export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="mb-8 h-10 w-72" />
      <ProductGridSkeleton count={10} />
    </div>
  )
}
