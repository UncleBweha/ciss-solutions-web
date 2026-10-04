import Link from 'next/link'
import { BadgeCheck, Check } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { RatingStars } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import type { ProductDetail } from '@/types/catalog'
import { formatDate } from '@/lib/utils'
import { ReviewForm } from './review-form'

function Specs({ product }: { product: ProductDetail }) {
  const rows = [...product.specifications]
  if (product.part_number && !rows.some((r) => r.label === 'Part Number')) rows.unshift({ label: 'Part Number', value: product.part_number })
  if (!rows.some((r) => r.label === 'SKU')) rows.push({ label: 'SKU', value: product.sku })
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Specifications</caption>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="w-2/5 py-3 pr-4 text-left font-medium text-fg-muted">
              {r.label}
            </th>
            <td className="py-3 text-fg">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Compatibility({ product }: { product: ProductDetail }) {
  if (product.printerModel) {
    return (
      <p className="text-fg-secondary">
        Compatible ink, toner and spare parts for the {product.printerModel.name} are listed below.{' '}
        <Link href={`/parts-finder?model=${product.printerModel.slug}`} className="font-semibold text-primary-light underline">
          See all parts for this printer
        </Link>
        .
      </p>
    )
  }
  if (!product.compatibility.length) {
    return <p className="text-fg-secondary">Compatibility information is not listed for this product. Contact us to confirm it fits your printer.</p>
  }
  return (
    <div>
      <h3 className="mb-3 font-bold">Compatible printers</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {product.compatibility.map((m) => (
          <li key={m.id} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>
              <Link href={`/parts-finder?model=${m.slug}`} className="hover:text-primary-light hover:underline">
                {m.name}
              </Link>
              {m.notes ? <span className="block text-xs text-fg-muted">{m.notes}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-fg-muted">Not sure? Send us your printer model on WhatsApp and we will confirm before you buy.</p>
    </div>
  )
}

function Reviews({ product }: { product: ProductDetail }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        {product.rating_count ? (
          <div className="mb-6 flex items-center gap-4">
            <span className="text-4xl font-bold">{product.rating_avg.toFixed(1)}</span>
            <RatingStars rating={product.rating_avg} count={product.rating_count} size="md" />
          </div>
        ) : (
          <p className="mb-6 text-fg-secondary">No reviews yet. Be the first to review this product.</p>
        )}
        <ul className="space-y-5">
          {product.reviews.map((r) => (
            <li key={r.id} className="border-b border-border pb-5 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <RatingStars rating={r.rating} />
                {r.title ? <p className="font-semibold">{r.title}</p> : null}
              </div>
              {r.comment ? <p className="mt-2 text-sm text-fg-secondary">{r.comment}</p> : null}
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                {r.author_name || 'Customer'} · {formatDate(r.created_at)}
                {r.is_verified_purchase ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-300">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified Purchase
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <ReviewForm productId={product.id} slug={product.slug} />
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-fg-secondary">
          <Check className="mt-1 h-4 w-4 shrink-0 text-primary-light" aria-hidden="true" />
          {f}
        </li>
      ))}
    </ul>
  )
}

export function ProductInfo({ product }: { product: ProductDetail }) {
  const sections = [
    {
      id: 'description',
      title: 'Description',
      content: <div className="max-w-3xl whitespace-pre-line leading-relaxed text-fg-secondary">{product.description || product.short_description}</div>,
    },
    { id: 'specifications', title: 'Specifications', content: <Specs product={product} /> },
    product.features.length ? { id: 'features', title: 'Features', content: <List items={product.features} /> } : null,
    { id: 'compatibility', title: 'Compatibility', content: <Compatibility product={product} /> },
    product.whats_included.length ? { id: 'included', title: "What's Included", content: <List items={product.whats_included} /> } : null,
    { id: 'reviews', title: `Reviews (${product.rating_count})`, content: <Reviews product={product} /> },
  ].filter((s): s is { id: string; title: string; content: React.ReactElement } => Boolean(s))

  return (
    <>
      <div className="hidden md:block">
        <Tabs items={sections.map((s) => ({ id: s.id, label: s.title, content: s.content }))} />
      </div>
      <Accordion className="md:hidden" items={sections.map((s, i) => ({ ...s, open: i === 0 }))} />
    </>
  )
}
