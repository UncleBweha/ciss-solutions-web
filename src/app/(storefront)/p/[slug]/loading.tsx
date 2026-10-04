import { Skeleton } from '@/components/ui/misc'

export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading product">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square rounded-[var(--radius-card)]" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
