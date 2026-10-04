'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { bulkProductsAction, type BulkInput } from '@/actions/admin/products'
import { ProductImage } from '@/components/product/product-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { formatKES } from '@/lib/ecommerce/money'
import { Table, Td, Th, EmptyRow } from './admin-ui'

export type AdminProductRow = {
  id: string
  name: string
  sku: string
  slug: string
  status: string
  price: number
  stock: number
  available: number
  lowThreshold: number
  brand: string | null
  category: string | null
  image: string | null
  variants: number
}

type Op = BulkInput['op']
const opLabels: Record<Op, string> = {
  activate: 'Activate',
  deactivate: 'Deactivate',
  price_percent: 'Change price by %',
  stock_set: 'Set stock',
  category: 'Assign category',
  brand: 'Assign brand',
  delete: 'Delete',
}

export function ProductsTable({ rows, categories, brands }: { rows: AdminProductRow[]; categories: { id: string; name: string }[]; brands: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [op, setOp] = useState<Op | null>(null)
  const [value, setValue] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  const all = rows.length > 0 && selected.size === rows.length

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const run = () => {
    if (!op) return
    const ids = [...selected]
    const input = (op === 'delete' ? { op, ids, confirm: confirmText } : op === 'activate' || op === 'deactivate' ? { op, ids } : { op, ids, value }) as BulkInput
    start(async () => {
      const r = await bulkProductsAction(input)
      toast(r.ok ? r.message ?? 'Done' : r.message, r.ok ? 'success' : 'error')
      if (r.ok) {
        setSelected(new Set())
        setOp(null)
        setValue('')
        setConfirmText('')
        router.refresh()
      }
    })
  }

  return (
    <>
      {selected.size ? (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-admin-panel p-3">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          {(Object.keys(opLabels) as Op[]).map((o) => (
            <Button key={o} size="sm" variant={o === 'delete' ? 'danger' : 'glass'} onClick={() => setOp(o)}>
              {opLabels[o]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      <Table>
        <thead>
          <tr>
            <Th className="w-8"><Checkbox aria-label="Select all" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} /></Th>
            <Th>Product</Th><Th>Category</Th><Th>Status</Th><Th className="text-right">Price</Th><Th className="text-right">Stock</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-surface">
              <Td><Checkbox aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></Td>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="product-stage relative h-10 w-10 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.image} alt="" fill sizes="40px" className="object-contain p-1" /></span>
                  <span className="min-w-0">
                    <Link href={`/admin/products/${p.id}`} className="block max-w-md truncate font-medium hover:text-primary-light">{p.name}</Link>
                    <span className="text-xs text-fg-muted">{p.sku}{p.brand ? ` · ${p.brand}` : ''}{p.variants ? ` · ${p.variants} variants` : ''}</span>
                  </span>
                </div>
              </Td>
              <Td className="text-fg-secondary">{p.category ?? '—'}</Td>
              <Td><Badge tone={p.status === 'active' ? 'success' : p.status === 'draft' ? 'warning' : 'neutral'}>{p.status}</Badge></Td>
              <Td className="text-right tabular-nums">{formatKES(p.price)}</Td>
              <Td className="text-right tabular-nums">
                <span className={p.available <= 0 ? 'text-red-300' : p.available <= p.lowThreshold ? 'text-amber-300' : ''}>{p.available}</span>
                {p.stock !== p.available ? <span className="block text-xs text-fg-muted">{p.stock} on hand</span> : null}
              </Td>
            </tr>
          ))}
          {!rows.length ? <EmptyRow colSpan={6}>No products match.</EmptyRow> : null}
        </tbody>
      </Table>

      <Modal open={op !== null} onClose={() => setOp(null)} title={op ? `${opLabels[op]} – ${selected.size} products` : ''}>
        <div className="space-y-4">
          {op === 'price_percent' ? (
            <label className="block text-sm">Percentage change (e.g. 10 or -5)<Input className="mt-1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          ) : null}
          {op === 'stock_set' ? (
            <label className="block text-sm">New stock quantity (products without variants)<Input className="mt-1" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          ) : null}
          {op === 'category' || op === 'brand' ? (
            <Select aria-label={op} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Choose…</option>
              {(op === 'category' ? categories : brands).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          ) : null}
          {op === 'delete' ? (
            <div className="space-y-2 text-sm">
              <p className="text-red-200">This permanently deletes the selected products and their images. Past orders keep their item details. Consider deactivating instead.</p>
              <label className="block">Type DELETE to confirm<Input className="mt-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></label>
            </div>
          ) : null}
          {op === 'activate' || op === 'deactivate' ? <p className="text-sm text-fg-secondary">{op === 'activate' ? 'Products become visible in the store.' : 'Products are hidden from the store (set to draft).'}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOp(null)}>Cancel</Button>
            <Button variant={op === 'delete' ? 'danger' : 'primary'} loading={pending} disabled={(op === 'delete' && confirmText !== 'DELETE') || ((op === 'price_percent' || op === 'stock_set' || op === 'category' || op === 'brand') && !value)} onClick={run}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
