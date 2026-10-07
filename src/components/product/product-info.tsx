import Link from 'next/link'
import { Check } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { Tabs } from '@/components/ui/tabs'
import type { ProductDetail } from '@/types/catalog'

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
  // Typed by staff on the product page. Entries that name a printer model we list are
  // already among the linked models, so they are shown once, as the link.
  const linked = new Set(product.compatibility.flatMap((m) => [m.name.toLowerCase(), m.model_number.toLowerCase()]))
  const typed = product.compatible_with.filter((entry) => !linked.has(entry.toLowerCase()))
  if (!product.compatibility.length && !typed.length) {
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
        {typed.map((entry) => (
          <li key={entry} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-fg-muted">Not sure? Send us your printer model on WhatsApp and we will confirm before you buy.</p>
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
