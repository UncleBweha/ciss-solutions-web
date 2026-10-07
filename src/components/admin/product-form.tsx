'use client'
/* eslint-disable @next/next/no-img-element -- previews of photos not uploaded yet are local blob: URLs */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form'
import { ChevronDown, Copy, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { quickAddBrandAction } from '@/actions/admin/catalog'
import { deleteProductAction, duplicateProductAction, saveProductAction } from '@/actions/admin/products'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { PRODUCT_IMAGE_ACCEPT, productImageProblem, uploadProductImage } from '@/lib/admin/product-image-upload'
import { productTypeLabels } from '@/lib/catalog-params'
import { slugify } from '@/lib/utils'
import { productTypes, type ProductInput } from '@/lib/validation/product'
import { Panel } from './admin-ui'

type Option = { id: string; name: string }
type ModelOption = { id: string; name: string; brand: string }
type ListField = 'features' | 'whatsIncluded' | 'compatibleWith'

/** The lists are typed one entry per line. */
export type ProductFormValues = Omit<ProductInput, ListField> & Record<ListField, string>

const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean)

/** Fields under "More options": a server error on one of them opens the section. */
const MORE = ['slug', 'productType', 'shortDescription', 'compareAtPrice', 'lowStockThreshold', 'weightKg', 'dimensions', 'partNumber', 'oemNumber', 'condition', 'warranty', 'printerModelId', 'variants', 'seoTitle', 'seoDescription', 'canonicalUrl', 'ogTitle', 'ogDescription', 'ogImageUrl']

/**
 * Add / edit a product, top to bottom in the order staff fill it: photos, what it is,
 * its details, prices and quantity, then Publish. A new product goes live straight away.
 * Everything else (variants, SEO, labels ...) is optional and folded away at the bottom;
 * the store fills the SEO from the name and description when those are left empty.
 */
export function ProductForm({
  initial,
  brands: initialBrands,
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [brands, setBrands] = useState(initialBrands)
  const [addingBrand, setAddingBrand] = useState(false)
  const [addedBrandId, setAddedBrandId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const isNew = !initial.id

  const form = useForm<ProductFormValues>({ defaultValues: initial })
  const { register, handleSubmit, watch, setValue, setError, formState } = form
  const err = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], formState.errors) as { message?: string } | undefined
  const msg = (path: string) => err(path)?.message
  const specs = useFieldArray({ control: form.control, name: 'specifications' })
  const variants = useFieldArray({ control: form.control, name: 'variants' })
  const hasVariants = variants.fields.length > 0
  const live = watch('status') === 'active'

  // Select a brand added from here once its <option> is on the page: a <select> can't
  // take a value it has no option for yet.
  useEffect(() => {
    if (addedBrandId) setValue('brandId', addedBrandId, { shouldDirty: true, shouldValidate: true })
  }, [addedBrandId, setValue])

  // Free the previews' memory when the form goes away.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const addPhotos = (files: FileList | null) => {
    const picked: { file: File; url: string }[] = []
    for (const file of Array.from(files ?? [])) {
      const problem = productImageProblem(file)
      if (problem) toast(problem, 'error')
      else picked.push({ file, url: URL.createObjectURL(file) })
    }
    if (picked.length) setPhotos((p) => [...p, ...picked])
  }
  const removePhoto = (url: string) => {
    URL.revokeObjectURL(url)
    setPhotos((p) => p.filter((x) => x.url !== url))
  }

  const submit = handleSubmit(
    (values) => {
      setMessage(null)
      start(async () => {
        const result = await saveProductAction({
          ...values,
          // A new product's address comes from its name.
          slug: values.slug || slugify(values.name),
          features: lines(values.features),
          whatsIncluded: lines(values.whatsIncluded),
          compatibleWith: lines(values.compatibleWith),
        })
        if (!result.ok) {
          setMessage(result.message)
          const paths = Object.keys(result.errors ?? {})
          for (const path of paths) setError(path as FieldPath<ProductFormValues>, { message: result.errors![path] })
          if (paths.some((p) => MORE.includes(p.split('.')[0]))) setMoreOpen(true)
          return
        }
        if (isNew && result.data) {
          // The product exists now: attach the photos chosen above (the first one is the main photo).
          const failed: string[] = []
          for (const p of photos) {
            const problem = await uploadProductImage(result.data.id, p.file, values.name)
            if (problem) failed.push(problem)
          }
          if (failed.length) toast(`Product published, but ${failed.length} photo${failed.length > 1 ? 's' : ''} did not upload. Add them again below. (${failed[0]})`, 'error')
          else toast('Product published. It is live in the shop.')
          router.push(`/admin/products/${result.data.id}`)
        } else {
          toast(result.message ?? 'Saved')
          router.refresh()
        }
      })
    },
    () => setMessage('Please fill in the highlighted fields.'),
  )

  return (
    <form onSubmit={submit} noValidate className="max-w-4xl space-y-4">
      {isNew ? (
        <Panel
          title={`Photos (${photos.length})`}
          actions={
            <>
              <input type="file" accept={PRODUCT_IMAGE_ACCEPT} multiple className="sr-only" id="new-photos" onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
              <label htmlFor="new-photos" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-sm font-semibold hover:bg-surface">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> Add photos
              </label>
            </>
          }
        >
          {photos.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.url} className={`relative rounded-lg border p-2 ${i === 0 ? 'border-primary' : 'border-border'}`}>
                  <div className="product-stage relative aspect-square overflow-hidden rounded-md">
                    <img src={p.url} alt="" className="h-full w-full object-contain p-2" />
                    {i === 0 ? <span className="absolute left-1.5 top-1.5 rounded bg-primary-strong px-1.5 text-[10px] font-bold text-white">MAIN</span> : null}
                  </div>
                  <button type="button" onClick={() => removePhoto(p.url)} aria-label={`Remove ${p.file.name}`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-danger shadow hover:bg-surface">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <label htmlFor="new-photos" className="grid cursor-pointer place-items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center text-sm text-fg-muted hover:bg-surface">
              <ImagePlus className="h-8 w-8" aria-hidden="true" />
              <span><span className="font-semibold text-fg">Add the product photos first.</span> Clear photos on a plain background work best; square is ideal. The first photo is the main one.</span>
            </label>
          )}
        </Panel>
      ) : null}

      <Panel title="Product">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" error={msg('name')} required className="sm:col-span-2">
            <Input id="name" aria-invalid={Boolean(err('name'))} {...register('name', { required: 'Enter the product name' })} />
          </Field>
          <Field label="Category" htmlFor="categoryId" error={msg('categoryId')} required>
            <Select id="categoryId" aria-invalid={Boolean(err('categoryId'))} {...register('categoryId', { required: 'Choose a category' })}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Brand" htmlFor="brandId" error={msg('brandId')} required>
            <div className="flex gap-2">
              <Select id="brandId" aria-invalid={Boolean(err('brandId'))} {...register('brandId', { required: 'Choose a brand, or add it' })}>
                <option value="">Choose a brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Button variant="glass" className="h-11" onClick={() => setAddingBrand(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add brand
              </Button>
            </div>
          </Field>
          <Field label="SKU" htmlFor="sku" error={msg('sku')} hint="Your own code for this product. Each product needs a different one." required>
            <Input id="sku" aria-invalid={Boolean(err('sku'))} {...register('sku', { required: 'Enter a SKU' })} />
          </Field>
          <Field label="Description" htmlFor="description" error={msg('description')} className="sm:col-span-2">
            <Textarea id="description" rows={6} {...register('description')} />
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

      <Panel title="Features, compatibility and what's in the box">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Features" htmlFor="features" error={msg('features')} hint="One per line">
            <Textarea id="features" rows={5} {...register('features')} />
          </Field>
          <Field label="What's in the box" htmlFor="whatsIncluded" error={msg('whatsIncluded')} hint="One per line">
            <Textarea id="whatsIncluded" rows={5} {...register('whatsIncluded')} />
          </Field>
          <Field label="Compatibility" htmlFor="compatibleWith" error={msg('compatibleWith')} hint="The printers this fits, one per line (e.g. Epson L3250). Fill this in for spare parts, ink and toner: customers search by their printer model." className="md:col-span-2">
            <Textarea id="compatibleWith" rows={4} {...register('compatibleWith')} />
          </Field>
        </div>
      </Panel>

      <Panel title="Prices and quantity">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Buying price (KES)" htmlFor="costPrice" error={msg('costPrice')} hint="What you pay for it. Never shown to customers." required>
            <Input id="costPrice" inputMode="decimal" aria-invalid={Boolean(err('costPrice'))} {...register('costPrice', { required: 'Enter the buying price' })} />
          </Field>
          <Field label="Selling price (KES)" htmlFor="price" error={msg('price')} required>
            <Input id="price" inputMode="decimal" aria-invalid={Boolean(err('price'))} {...register('price', { required: 'Enter the selling price' })} />
          </Field>
          {hasVariants ? (
            <div className="text-sm">
              <p className="mb-1.5 font-medium text-fg-secondary">Quantity in stock</p>
              <p className="text-fg-muted">This product has variants: set the quantity of each one {isNew ? 'under More options.' : 'in Inventory.'}</p>
            </div>
          ) : isNew ? (
            <Field label="Quantity in stock" htmlFor="initialStock" error={msg('initialStock')} required>
              <Input id="initialStock" inputMode="numeric" aria-invalid={Boolean(err('initialStock'))} {...register('initialStock', { required: 'Enter the quantity' })} />
            </Field>
          ) : (
            <Field label="Quantity in stock" htmlFor="stockQuantity" error={msg('stockQuantity')} hint={stock?.reserved ? `${stock.reserved} held by orders not yet paid` : undefined} required>
              <Input id="stockQuantity" inputMode="numeric" aria-invalid={Boolean(err('stockQuantity'))} {...register('stockQuantity', { required: 'Enter the quantity' })} />
            </Field>
          )}
        </div>
      </Panel>

      <section className="min-w-0 rounded-xl border border-border bg-admin-panel">
        <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-controls="more-options" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span>
            <span className="block text-sm font-semibold">More options</span>
            <span className="block text-xs text-fg-muted">Optional: variants, labels, part numbers, shipping size and SEO. SEO is filled in from the details above when left empty.</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-fg-muted transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div id="more-options" hidden={!moreOpen} className="space-y-6 border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Product type" htmlFor="productType">
              <Select id="productType" {...register('productType')}>
                {productTypes.map((t) => <option key={t} value={t}>{productTypeLabels[t]}</option>)}
              </Select>
            </Field>
            <Field label="Old price (KES)" htmlFor="compareAtPrice" error={msg('compareAtPrice')} hint="Shows crossed out, with the discount">
              <Input id="compareAtPrice" inputMode="decimal" {...register('compareAtPrice')} />
            </Field>
            <Field label="Low stock alert at" htmlFor="lowStockThreshold" error={msg('lowStockThreshold')}>
              <Input id="lowStockThreshold" inputMode="numeric" {...register('lowStockThreshold')} />
            </Field>
            <Field label="Short description" htmlFor="shortDescription" error={msg('shortDescription')} hint="Shown on product cards, e.g. Print • Scan • Copy • Wi-Fi" className="sm:col-span-3">
              <Input id="shortDescription" {...register('shortDescription')} />
            </Field>
            {watch('productType') === 'printer' ? (
              <Field label="This printer is model" htmlFor="printerModelId" hint="Links compatible ink and parts on the product page" className="sm:col-span-3">
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
            <Field label="Weight (kg)" htmlFor="weightKg" error={msg('weightKg')}>
              <Input id="weightKg" inputMode="decimal" {...register('weightKg')} />
            </Field>
            <Field label="Dimensions" htmlFor="dimensions" error={msg('dimensions')}>
              <Input id="dimensions" placeholder="375 × 347 × 179 mm" {...register('dimensions')} />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Labels</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><Checkbox {...register('isFeatured')} /> Featured</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isBestseller')} /> Best seller</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isNew')} /> New</label>
              <label className="flex items-center gap-2"><Checkbox {...register('isOnSale')} /> On sale</label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Variants</p>
              <Button size="sm" variant="ghost" onClick={() => variants.append({ name: '', sku: '', price: watch('price') ?? 0, compareAtPrice: '', optionName: 'Colour', stock: 0, imageUrl: '', isActive: true })}><Plus className="h-4 w-4" aria-hidden="true" /> Add variant</Button>
            </div>
            {hasVariants ? (
              <div className="space-y-3">
                {variants.fields.map((f, i) => (
                  <div key={f.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                    <Input aria-label="Option name" placeholder="Option (Colour)" {...register(`variants.${i}.optionName`)} className="h-10" />
                    <Input aria-label="Variant name" placeholder="Value (Black)" {...register(`variants.${i}.name`)} className="h-10" />
                    <Input aria-label="Variant SKU" placeholder="SKU" {...register(`variants.${i}.sku`)} className="h-10" aria-invalid={Boolean(err(`variants.${i}.sku`))} />
                    <Input aria-label="Variant price" placeholder="Price" inputMode="decimal" {...register(`variants.${i}.price`)} className="h-10" />
                    {(initial.variants ?? [])[i]?.id ? (
                      <span className="self-center text-xs text-fg-muted">Stock via Inventory</span>
                    ) : (
                      <Input aria-label="Opening stock" placeholder="Stock" inputMode="numeric" {...register(`variants.${i}.stock`)} className="h-10" />
                    )}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs"><Checkbox {...register(`variants.${i}.isActive`)} /> Active</label>
                      <Button size="icon" variant="ghost" onClick={() => variants.remove(i)} aria-label="Remove variant"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Input aria-label="Variant image URL" placeholder="Image URL (optional)" {...register(`variants.${i}.imageUrl`)} className="h-10 sm:col-span-6" />
                    {msg(`variants.${i}.sku`) ? <p className="text-xs text-danger sm:col-span-6">{msg(`variants.${i}.sku`)}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">No variants. Add variants for options like ink colour or paper size; each has its own SKU, price and stock.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">SEO</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {isNew ? null : (
                <Field label="Page address" htmlFor="slug" error={msg('slug')} hint={`/p/${watch('slug') || '…'}`}>
                  <Input id="slug" {...register('slug')} />
                </Field>
              )}
              <Field label="Meta title" htmlFor="seoTitle" error={msg('seoTitle')} hint="Empty: “<name> Price in Kenya”">
                <Input id="seoTitle" maxLength={70} {...register('seoTitle')} />
              </Field>
              <Field label="Meta description" htmlFor="seoDescription" error={msg('seoDescription')} hint="Empty: taken from the description" className="sm:col-span-2">
                <Textarea id="seoDescription" rows={2} maxLength={170} className="min-h-0" {...register('seoDescription')} />
              </Field>
              <Field label="Canonical URL" htmlFor="canonicalUrl" error={msg('canonicalUrl')} hint="Empty: the product's own address">
                <Input id="canonicalUrl" {...register('canonicalUrl')} />
              </Field>
              <Field label="Social title (Open Graph)" htmlFor="ogTitle" error={msg('ogTitle')}>
                <Input id="ogTitle" {...register('ogTitle')} />
              </Field>
              <Field label="Social image URL" htmlFor="ogImageUrl" error={msg('ogImageUrl')} hint="Empty: the main photo">
                <Input id="ogImageUrl" {...register('ogImageUrl')} />
              </Field>
              <Field label="Social description" htmlFor="ogDescription" error={msg('ogDescription')}>
                <Input id="ogDescription" {...register('ogDescription')} />
              </Field>
            </div>
          </div>
        </div>
      </section>

      <Panel>
        <div className="space-y-4">
          {isNew ? (
            <p className="text-sm text-fg-secondary">Publishing puts the product in the shop straight away.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={live} onChange={(e) => setValue('status', e.target.checked ? 'active' : 'draft', { shouldDirty: true })} />
              <span><span className="font-semibold">Show in the shop.</span> Untick to hide this product from customers without deleting it.</span>
            </label>
          )}
          {message ? <FormMessage>{message}</FormMessage> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" size="lg" loading={pending}>{isNew ? 'Publish product' : 'Save changes'}</Button>
            {isNew ? (
              <Link href="/admin/products" className="text-sm font-semibold text-fg-secondary hover:text-fg">Cancel</Link>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => start(async () => void (await duplicateProductAction(initial.id!)))}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <AddBrand
        open={addingBrand}
        onClose={() => setAddingBrand(false)}
        onAdded={(brand) => {
          setBrands((list) => (list.some((b) => b.id === brand.id) ? list : [...list, brand].sort((a, b) => a.name.localeCompare(b.name))))
          setAddedBrandId(brand.id)
          setAddingBrand(false)
        }}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this product?">
        <p className="text-sm text-fg-secondary">The product and its photos are removed permanently. Orders keep their item details. To hide it instead, untick “Show in the shop”.</p>
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

/** "Add brand" beside the brand list: a name is all it needs. The new brand is selected. */
function AddBrand({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (brand: Option) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const add = () =>
    start(async () => {
      setError(null)
      const result = await quickAddBrandAction(name)
      if (!result.ok || !result.data) {
        setError(result.ok ? 'The brand was not added.' : result.message)
        return
      }
      toast(result.message ?? 'Brand added')
      setName('')
      onAdded(result.data)
    })

  return (
    <Modal open={open} onClose={onClose} title="Add a brand">
      <Field label="Brand name" htmlFor="new-brand" error={error ?? undefined} hint="A logo and description can be added later under Brands.">
        <Input
          id="new-brand"
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Inside the product form: Enter adds the brand instead of publishing the product.
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (name.trim()) add()
          }}
        />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={pending} disabled={!name.trim()} onClick={add}>Add brand</Button>
      </div>
    </Modal>
  )
}
