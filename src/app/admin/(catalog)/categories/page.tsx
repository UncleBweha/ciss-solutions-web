import Link from 'next/link'
import { deleteCategoryAction, saveCategoryAction } from '@/actions/admin/catalog'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { DirectImageUpload } from '@/components/admin/direct-image-upload'
import { AdminPageHeader, Panel } from '@/components/admin/admin-ui'
import { MoveCategory, QuickAddCategory } from '@/components/admin/category-tools'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { param } from '@/lib/utils'

export const metadata = { title: 'Categories' }

export default async function CategoriesPage({ searchParams }: PageProps<'/admin/categories'>) {
  await requireStaff('catalog.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: cats }, { data: counts }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('product_counts_by_category').select('category_id, product_count'),
  ])
  const all = cats ?? []
  type Cat = (typeof all)[number]
  const countOf = (id: string) => (counts ?? []).find((c) => c.category_id === id)?.product_count ?? 0
  const childrenOf = (parent: string | null) => all.filter((c) => c.parent_id === parent)
  // Everything under a main category, in menu order, with its depth and place among its siblings.
  const branch = (parent: string, depth = 1): { cat: Cat; depth: number; first: boolean; last: boolean }[] =>
    childrenOf(parent).flatMap((cat, i, list) => [{ cat, depth, first: i === 0, last: i === list.length - 1 }, ...branch(cat.id, depth + 1)])
  const tops = childrenOf(null)
  // A category's products including everything in its subcategories.
  const totalOf = (id: string): number => countOf(id) + childrenOf(id).reduce((n, c) => n + totalOf(c.id), 0)
  const products = (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`
  const ordered: (Cat & { depth: number })[] = tops.flatMap((t) => [{ ...t, depth: 0 }, ...branch(t.id).map((b) => ({ ...b.cat, depth: b.depth }))])
  const editing = all.find((c) => c.id === param(sp.edit))
  // "Add with more details" under a given parent: /admin/categories?parent=<id>
  const newParent = editing ? null : all.find((c) => c.id === param(sp.parent)) ?? null

  const actions = (c: Cat, first: boolean, last: boolean) => (
    <span className="flex shrink-0 items-center gap-1">
      <MoveCategory id={c.id} name={c.name} first={first} last={last} />
      <Link href={`/admin/categories?edit=${c.id}#category-form`} className="px-2 text-sm font-semibold text-primary-light">Edit</Link>
      <ConfirmAction action={deleteCategoryAction.bind(null, c.id)} label="Delete" title={`Delete ${c.name}?`} description="Only empty categories can be deleted. Subcategories move to the top level." />
    </span>
  )
  const status = (c: Cat) => (c.is_active ? null : <Badge tone="neutral">Hidden</Badge>)

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Main categories show in the shop menu; subcategories sit under them. Type a name and press Add: the web address and position are filled in for you. Use the arrows to change the order."
      />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <Panel title="Add a main category">
            <QuickAddCategory parentId={null} label="New main category name" placeholder="e.g. Printer Accessories" />
          </Panel>

          {tops.map((top, i) => (
            <Panel
              key={top.id}
              className={editing?.id === top.id ? 'ring-2 ring-primary/40' : undefined}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base">{top.name}</span>
                  <span className="text-xs font-normal text-fg-muted">{products(totalOf(top.id))} · /c/{top.slug}</span>
                  {status(top)}
                </span>
              }
              actions={actions(top, i === 0, i === tops.length - 1)}
            >
              {branch(top.id).length ? (
                <ul className="mb-3 divide-y divide-border">
                  {branch(top.id).map(({ cat, depth, first, last }) => (
                    <li key={cat.id} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 ${editing?.id === cat.id ? 'bg-primary/10' : ''}`}>
                      <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: (depth - 1) * 20 }}>
                        <span className="text-fg-muted" aria-hidden="true">└</span>
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-xs text-fg-muted">{products(totalOf(cat.id))}</span>
                        {status(cat)}
                      </span>
                      {actions(cat, first, last)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-fg-muted">No subcategories yet.</p>
              )}
              <QuickAddCategory parentId={top.id} label={`New subcategory in ${top.name}`} placeholder={`Add a subcategory to ${top.name}`} />
            </Panel>
          ))}
        </div>

        <Panel
          title={editing ? `Edit ${editing.name}` : newParent ? `New subcategory in ${newParent.name}` : 'New category with details'}
          actions={editing || newParent ? <Link href="/admin/categories" className="text-xs text-primary-light">Cancel</Link> : null}
          className="xl:sticky xl:top-20"
        >
          <div id="category-form" className="scroll-mt-24" />
          <AdminForm key={editing?.id ?? newParent?.id ?? 'new'} action={saveCategoryAction} resetOnSuccess={!editing} redirectTo={editing ? '/admin/categories' : undefined} submitLabel={editing ? 'Save category' : 'Create category'} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <Field label="Name" htmlFor="name" required><Input id="name" name="name" defaultValue={editing?.name} required /></Field>
            <Field label="Inside" htmlFor="parentId" hint="Leave as “Main category” for a top-level category in the shop menu.">
              <Select id="parentId" name="parentId" defaultValue={editing?.parent_id ?? newParent?.id ?? ''}>
                <option value="">Main category</option>
                {ordered.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{'— '.repeat(c.depth)}{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={3} defaultValue={editing?.description ?? ''} /></Field>
            <Field label="Image" htmlFor="image"><DirectImageUpload id="image" name="image" bucket="category-images" prefix="categories" accept="image/*" /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={editing?.is_active ?? true} /> Show in the shop</label>
            <details className="rounded-md border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-fg-secondary">More options (web address, SEO, order)</summary>
              <div className="mt-3 space-y-3">
                <Field label="Web address (slug)" htmlFor="slug" hint="Filled in from the name when left empty"><Input id="slug" name="slug" defaultValue={editing?.slug} /></Field>
                <Field label="Image URL" htmlFor="imageUrl" hint="Instead of uploading"><Input id="imageUrl" name="imageUrl" defaultValue={editing?.image_url ?? ''} /></Field>
                <Field label="SEO title" htmlFor="seoTitle"><Input id="seoTitle" name="seoTitle" defaultValue={editing?.seo_title ?? ''} maxLength={70} /></Field>
                <Field label="SEO description" htmlFor="seoDescription"><Textarea id="seoDescription" name="seoDescription" rows={2} className="min-h-0" defaultValue={editing?.seo_description ?? ''} maxLength={170} /></Field>
                <Field label="Sort order" htmlFor="sortOrder" hint="Lower comes first. Empty puts a new category at the end." className="w-48"><Input id="sortOrder" name="sortOrder" type="number" defaultValue={editing?.sort_order ?? ''} /></Field>
              </div>
            </details>
          </AdminForm>
        </Panel>
      </div>
    </div>
  )
}
