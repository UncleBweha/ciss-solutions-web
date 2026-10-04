'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { deleteProductAction, duplicateProductAction, saveProductAction } from '@/actions/admin/products'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { productTypeLabels } from '@/lib/catalog-params'
import { slugify } from '@/lib/utils'
import { productStatuses, productTypes, type ProductInput } from '@/lib/validation/product'
import { Panel } from './admin-ui'

type Option = { id: string; name: string }
type ModelOption = { id: string; name: string; brand: string }

export type ProductFormValues = Omit<ProductInput, 'features' | 'whatsIncluded'> & { features: string; whatsIncluded: string }

export function ProductForm({
  initial,
  brands,
  categories,
  models,
  stock,
}: {
  initial: ProductFormValues
  brands: Option[]
  categories: (Option & { depth: number })[]
  models: ModelOption[]
  stock?: { onHand: number; reserved: number }
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [compatFilter, setCompatFilter] = useState('')
  const isNew = !initial.id

  const form = useForm<ProductFormValues>({ defaultValues: initial })
  const { register, handleSubmit, watch, setValue, setError, formState } = form
  const errors = formState.errors as Record<string, { message?: string } | undefined>
  const err = (path: string) => (formState.errors as unknown as Record<string, { message?: string }>)[path]?.message ?? errors[path]?.message
  const specs = useFieldArray({ control: form.control, name: 'specifications' })
  const variants = useFieldArray({ control: form.control, name: 'variants' })
  const compatibility = watch('compatibility') ?? []
  const filteredModels = useMemo(() => {
    const q = compatFilter.toLowerCase()
    return models.filter((m) => !q || m.name.toLowerCase().includes(q) || m.brand.toLowerCase().includes(q))
  }, [models, compatFilter])

  const submit = handleSubmit((values) => {
    setMessage(null)
    start(async () => {
      const result = await saveProductAction({
        ...values,
        features: values.features.split('\n').map((s) => s.trim()).filter(Boolean),
        whatsIncluded: values.whatsIncluded.split('\n').map((s) => s.trim()).filter(Boolean),
      })
      if (!result.ok) {
        setMessage(result.message)
        for (const [path, msg] of Object.entries(result.errors ?? {})) setError(path as FieldPath<ProductFormValues>, { message: msg })
        return
      }
      toast(result.message ?? 'Saved')
      if (isNew && result.data) router.push(`/admin/products/${result.data.id}`)
      else router.refresh()
    })
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <Panel title="Basic information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="name" error={err('name')} required className="sm:col-span-2">
              <Input
                id="name"
                {...register('name', {
                  onChange: (e) => {
                    if (isNew && !formState.dirtyFields.slug) setValue('slug', slugify(e.target.value))
                  },
                })}
              />
            </Field>
            <Field label="URL slug" htmlFor="slug" error={err('slug')} hint={`/p/${watch('slug') || '…'}`} required>
              <Input id="slug" {...register('slug')} />
            </Field>
            <Field label="SKU" htmlFor="sku" error={err('sku')} required>
              <Input id="sku" {...register('sku')} />
            </Field>
            <Field label="Short description" htmlFor="shortDescription" error={err('shortDescription')} hint="Shown on product cards, e.g. Print • Scan • Copy • Wi-Fi" className="sm:col-span-2">
              <Input id="shortDescription" {...register('shortDescription')} />
            </Field>
            <Field label="Description" htmlFor="description" error={err('description')} className="sm:col-span-2">
              <Textarea id="description" rows={6} {...register('description')} />
            </Field>
          </div>
        </Panel>

        <Panel title="Pricing & stock">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (KES)" htmlFor="price" error={err('price')} required>
              <Input id="price" inputMode="decimal" {...register('price')} />
            </Field>
            <Field label="Compare-at price" htmlFor="compareAtPrice" error={err('compareAtPrice')} hint="Previous price; shows a discount">
              <Input id="compareAtPrice" inputMode="decimal" {...register('compareAtPrice')} />
            </Field>
            <Field label="Cost price (internal)" htmlFor="costPrice" error={err('costPrice')}>
              <Input id="costPrice" inputMode="decimal" {...register('costPrice')} />
            </Field>
            {isNew ? (
              <Field label="Opening stock" htmlFor="initialStock" error={err('initialStock')} hint="Products with variants: set stock per variant">
                <Input id="initialStock" inputMode="numeric" {...register('initialStock')} />
              </Field>
            ) : (
              <div className="text-sm">
                <p className="mb-1.5 font-medium text-fg-secondary">Stock</p>
                <p>{stock?.onHand ?? 0} on hand · {stock?.reserved ?? 0} reserved</p>
                <Link href={`/admin/inventory?q=${encodeURIComponent(initial.sku)}`} className="text-xs text-primary-light">Adjust in Inventory →</Link>
              </div>
            )}
            <Field label="Low stock alert at" htmlFor="lowStockThreshold" error={err('lowStockThreshold')}>
              <Input id="lowStockThreshold" inputMode="numeric" {...register('lowStockThreshold')} />
            </Field>
            <Field label="Barcode" htmlFor="barcode" error={err('barcode')}>
              <Input id="barcode" {...register('barcode')} />
            </Field>
            <Field label="Weight (kg)" htmlFor="weightKg" error={err('weightKg')}>
              <Input id="weightKg" inputMode="decimal" {...register('weightKg')} />
            </Field>
            <Field label="Dimensions" htmlFor="dimensions" error={err('dimensions')} className="sm:col-span-2">
              <Input id="dimensions" placeholder="375 × 347 × 179 mm" {...register('dimensions')} />
            </Field>
          </div>
        </Panel>

        <Panel title="Specifications" actions={<Button size="sm" variant="ghost" onClick={() => specs.append({ label: '', value: '' })}><Plus className="h-4 w-4" aria-hidden="true" /> Add row</Button>}>
          <div className="space-y-2">
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label="Specification name" placeholder="e.g. Print Speed" {...register(`specifications.${i}.label`)} className="h-10" />
                <Input aria-label="Specification value" placeholder="e.g. 33 ppm" {...register(`specifications.${i}.value`)} className="h-10" />
                <Button size="icon" variant="ghost" onClick={() => specs.remove(i)} aria-label="Remove row"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {!specs.fields.length ? <p className="text-sm text-fg-muted">No specifications yet. Printers: technology, speed, resolution, connectivity… Parts: part number, part type, condition…</p> : null}
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Features (one per line)">
            <Textarea aria-label="Features" rows={5} {...register('features')} />
          </Panel>
          <Panel title="What's included (one per line)">
            <Textarea aria-label="What's included" rows={5} {...register('whatsIncluded')} />
          </Panel>
        </div>

        <Panel title={`Compatible printers (${compatibility.length})`}>
          <Input placeholder="Filter printer models…" value={compatFilter} onChange={(e) => setCompatFilter(e.target.value)} className="mb-3 h-10" aria-label="Filter printer models" />
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {filteredModels.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                <Checkbox
                  checked={compatibility.includes(m.id)}
                  onChange={(e) => setValue('compatibility', e.target.checked ? [...compatibility, m.id] : compatibility.filter((x) => x !== m.id), { shouldDirty: true })}
                />
                {m.name}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-muted">Missing a model? Add it under Printer models.</p>
        </Panel>

        <Panel title="Variants" actions={<Button size="sm" variant="ghost" onClick={() => variants.append({ name: '', sku: '', price: watch('price') ?? 0, compareAtPrice: '', optionName: 'Colour', stock: 0, imageUrl: '', isActive: true })}><Plus className="h-4 w-4" aria-hidden="true" /> Add variant</Button>}>
          {variants.fields.length ? (
            <div className="space-y-3">
              {variants.fields.map((f, i) => (
                <div key={f.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                  <Input aria-label="Option name" placeholder="Option (Colour)" {...register(`variants.${i}.optionName`)} className="h-10" />
                  <Input aria-label="Variant name" placeholder="Value (Black)" {...register(`variants.${i}.name`)} className="h-10" />
                  <Input aria-label="Variant SKU" placeholder="SKU" {...register(`variants.${i}.sku`)} className="h-10" aria-invalid={Boolean(err(`variants.${i}.sku`))} />
                  <Input aria-label="Variant price" placeholder="Price" inputMode="decimal" {...register(`variants.${i}.price`)} className="h-10" />
                  {f.id && (initial.variants ?? [])[i]?.id ? (
                    <span className="self-center text-xs text-fg-muted">Stock via Inventory</span>
                  ) : (
                    <Input aria-label="Opening stock" placeholder="Stock" inputMode="numeric" {...register(`variants.${i}.stock`)} className="h-10" />
                  )}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs"><Checkbox {...register(`variants.${i}.isActive`)} /> Active</label>
                    <Button size="icon" variant="ghost" onClick={() => variants.remove(i)} aria-label="Remove variant"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input aria-label="Variant image URL" placeholder="Image URL (optional)" {...register(`variants.${i}.imageUrl`)} className="h-10 sm:col-span-6" />
                  {err(`variants.${i}.sku`) ? <p className="text-xs text-red-300 sm:col-span-6">{err(`variants.${i}.sku`)}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No variants. Add variants for options like ink colour or paper size; each has its own SKU, price and stock.</p>
          )}
        </Panel>

        <Panel title="SEO">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta title" htmlFor="seoTitle" error={err('seoTitle')} hint="Defaults to “<name> Price in Kenya”">
              <Input id="seoTitle" maxLength={70} {...register('seoTitle')} />
            </Field>
            <Field label="Canonical URL" htmlFor="canonicalUrl" error={err('canonicalUrl')} hint="Leave empty to use the product URL">
              <Input id="canonicalUrl" {...register('canonicalUrl')} />
            </Field>
            <Field label="Meta description" htmlFor="seoDescription" error={err('seoDescription')} className="sm:col-span-2">
              <Textarea id="seoDescription" rows={2} maxLength={170} className="min-h-0" {...register('seoDescription')} />
            </Field>
            <Field label="Social title (Open Graph)" htmlFor="ogTitle" error={err('ogTitle')}>
              <Input id="ogTitle" {...register('ogTitle')} />
            </Field>
            <Field label="Social image URL" htmlFor="ogImageUrl" error={err('ogImageUrl')}>
              <Input id="ogImageUrl" {...register('ogImageUrl')} />
            </Field>
            <Field label="Social description" htmlFor="ogDescription" error={err('ogDescription')} className="sm:col-span-2">
              <Input id="ogDescription" {...register('ogDescription')} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel title="Publish">
          <div className="space-y-4">
            <Field label="Status" htmlFor="status">
              <Select id="status" {...register('status')}>
                {productStatuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2"><Checkbox {...register('isFeatured')} /> Featured</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isBestseller')} /> Best seller</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isNew')} /> New</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isOnSale')} /> On sale</label>
            </div>
            {message ? <FormMessage>{message}</FormMessage> : null}
            <Button type="submit" className="w-full" loading={pending}>{isNew ? 'Create product' : 'Save changes'}</Button>
            {!isNew ? (
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => start(async () => void (await duplicateProductAction(initial.id!)))}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
                </Button>
                <Button size="sm" variant="ghost" className="text-red-300" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                </Button>
              </div>
            ) : null}
          </div>
        </Panel>
        <Panel title="Organisation">
          <div className="space-y-4">
            <Field label="Product type" htmlFor="productType">
              <Select id="productType" {...register('productType')}>
                {productTypes.map((t) => <option key={t} value={t}>{productTypeLabels[t]}</option>)}
              </Select>
            </Field>
            <Field label="Brand" htmlFor="brandId">
              <Select id="brandId" {...register('brandId')}>
                <option value="">No brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Category" htmlFor="categoryId">
              <Select id="categoryId" {...register('categoryId')}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
              </Select>
            </Field>
            {watch('productType') === 'printer' ? (
              <Field label="This printer is model" htmlFor="printerModelId" hint="Links compatible ink and parts on the product page">
                <Select id="printerModelId" {...register('printerModelId')}>
                  <option value="">—</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Part number" htmlFor="partNumber"><Input id="partNumber" {...register('partNumber')} /></Field>
                <Field label="OEM number" htmlFor="oemNumber"><Input id="oemNumber" {...register('oemNumber')} /></Field>
                <Field label="Condition" htmlFor="condition"><Input id="condition" placeholder="New / Compatible / Refurbished" {...register('condition')} /></Field>
              </>
            )}
            <Field label="Warranty" htmlFor="warranty"><Input id="warranty" placeholder="1 year" {...register('warranty')} /></Field>
          </div>
        </Panel>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this product?">
        <p className="text-sm text-fg-secondary">The product and its images are removed permanently. Orders keep their item details. To hide it instead, set the status to Draft or Archived.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteProductAction(initial.id!)
                toast(r.ok ? 'Product deleted' : r.message, r.ok ? 'success' : 'error')
                if (r.ok) router.push('/admin/products')
              })
            }
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </form>
  )
}
