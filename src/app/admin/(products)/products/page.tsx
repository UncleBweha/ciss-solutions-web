import { Plus, Upload } from 'lucide-react'
import { AdminPageHeader, FilterBar, Panel } from '@/components/admin/admin-ui'
import { ProductsTable, type AdminProductRow } from '@/components/admin/products-table'
import { Button, LinkButton } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { Pagination } from '@/components/ui/pagination'
import { requireStaff } from '@/lib/auth'
import { withParams } from '@/lib/catalog-params'
import { escapeLike } from '@/lib/ecommerce/quote'
import { createClient } from '@/lib/supabase/server'
import { param } from '@/lib/utils'

export const metadata = { title: 'Products' }
const PER_PAGE = 50

export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  await requireStaff('products.manage')
  const sp = await searchParams
  const q = param(sp.q)?.trim()
  const status = param(sp.status)
  const category = param(sp.category)
  const brand = param(sp.brand)
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1)
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('id, name, sku, slug, status, price, stock_quantity, available_quantity, low_stock_threshold, brand:brands(name), category:categories(name), images:product_images(url, is_primary, sort_order), variants:product_variants(id)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (q) {
    const like = `%${escapeLike(q)}%`
    query = query.or(`name.ilike.${like},sku.ilike.${like},part_number.ilike.${like}`)
  }
  if (status === 'draft' || status === 'active' || status === 'archived') query = query.eq('status', status)
  if (category) query = query.eq('category_id', category)
  if (brand) query = query.eq('brand_id', brand)

  const [{ data, count }, { data: categories }, { data: brands }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('brands').select('id, name').order('name'),
  ])
  const rows: AdminProductRow[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    slug: p.slug,
    status: p.status,
    price: Number(p.price),
    stock: p.stock_quantity,
    available: p.available_quantity ?? 0,
    lowThreshold: p.low_stock_threshold,
    brand: p.brand?.name ?? null,
    category: p.category?.name ?? null,
    image: [...p.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]?.url ?? null,
    variants: p.variants.length,
  }))

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={`${count ?? 0} products`}
        actions={
          <>
            <LinkButton href="/admin/products/import" variant="glass" size="sm"><Upload className="h-4 w-4" aria-hidden="true" /> Import CSV</LinkButton>
            <LinkButton href="/admin/products/new" size="sm"><Plus className="h-4 w-4" aria-hidden="true" /> New product</LinkButton>
          </>
        }
      />
      <FilterBar>
        <Input name="q" defaultValue={q} placeholder="Name, SKU or part number" className="h-10 w-full! sm:w-64!" aria-label="Search products" />
        <Select name="status" defaultValue={status ?? ''} className="h-10 w-36!" aria-label="Status">
          <option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
        </Select>
        <Select name="category" defaultValue={category ?? ''} className="h-10 w-full! sm:w-48!" aria-label="Category">
          <option value="">All categories</option>
          {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="brand" defaultValue={brand ?? ''} className="h-10 w-40!" aria-label="Brand">
          <option value="">All brands</option>
          {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Button type="submit" size="sm" className="h-10">Filter</Button>
      </FilterBar>
      <Panel padded={false}>
        <ProductsTable rows={rows} categories={categories ?? []} brands={brands ?? []} />
      </Panel>
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => withParams('/admin/products', sp, { page: String(p) })} />
    </div>
  )
}
