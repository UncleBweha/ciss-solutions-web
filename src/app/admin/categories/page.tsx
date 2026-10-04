import Link from 'next/link'
import { deleteCategoryAction, saveCategoryAction } from '@/actions/admin/catalog'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { AdminPageHeader, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
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
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('product_counts_by_category').select('category_id, product_count'),
  ])
  const all = cats ?? []
  const countOf = (id: string) => (counts ?? []).find((c) => c.category_id === id)?.product_count ?? 0
  const ordered: (typeof all[number] & { depth: number })[] = []
  const walk = (parent: string | null, depth: number) => all.filter((c) => c.parent_id === parent).forEach((c) => { ordered.push({ ...c, depth }); walk(c.id, depth + 1) })
  walk(null, 0)
  const editing = all.find((c) => c.id === param(sp.edit))

  return (
    <div>
      <AdminPageHeader title="Categories" description="Nested categories drive navigation, filters and category pages (/c/...)." />
      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel padded={false}>
          <Table>
            <thead><tr><Th>Name</Th><Th>Slug</Th><Th className="text-right">Products</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id} className={editing?.id === c.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                  <Td><span style={{ paddingLeft: c.depth * 20 }} className="font-medium">{c.depth ? '└ ' : ''}{c.name}</span></Td>
                  <Td className="font-mono text-xs text-fg-muted">{c.slug}</Td>
                  <Td className="text-right">{countOf(c.id)}</Td>
                  <Td><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Hidden'}</Badge></Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`/admin/categories?edit=${c.id}`} className="mr-2 text-sm font-semibold text-primary-light">Edit</Link>
                    <ConfirmAction action={deleteCategoryAction.bind(null, c.id)} label="Delete" title={`Delete ${c.name}?`} description="Only empty categories can be deleted. Subcategories move to the top level." />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel title={editing ? `Edit ${editing.name}` : 'New category'} actions={editing ? <Link href="/admin/categories" className="text-xs text-primary-light">+ New instead</Link> : null}>
          <AdminForm key={editing?.id ?? 'new'} action={saveCategoryAction} resetOnSuccess={!editing} submitLabel={editing ? 'Save category' : 'Create category'} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <Field label="Name" htmlFor="name" required><Input id="name" name="name" defaultValue={editing?.name} required /></Field>
            <Field label="Slug" htmlFor="slug" hint="Leave empty to generate from the name"><Input id="slug" name="slug" defaultValue={editing?.slug} /></Field>
            <Field label="Parent" htmlFor="parentId">
              <Select id="parentId" name="parentId" defaultValue={editing?.parent_id ?? ''}>
                <option value="">— Top level —</option>
                {ordered.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={3} defaultValue={editing?.description ?? ''} /></Field>
            <Field label="Image URL" htmlFor="imageUrl"><Input id="imageUrl" name="imageUrl" defaultValue={editing?.image_url ?? ''} /></Field>
            <Field label="…or upload image" htmlFor="image"><Input id="image" name="image" type="file" accept="image/*" className="h-auto py-2" /></Field>
            <Field label="SEO title" htmlFor="seoTitle"><Input id="seoTitle" name="seoTitle" defaultValue={editing?.seo_title ?? ''} maxLength={70} /></Field>
            <Field label="SEO description" htmlFor="seoDescription"><Textarea id="seoDescription" name="seoDescription" rows={2} className="min-h-0" defaultValue={editing?.seo_description ?? ''} maxLength={170} /></Field>
            <div className="flex items-center gap-4">
              <Field label="Sort order" htmlFor="sortOrder" className="w-28"><Input id="sortOrder" name="sortOrder" type="number" defaultValue={editing?.sort_order ?? 0} /></Field>
              <label className="mt-6 flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={editing?.is_active ?? true} /> Visible in store</label>
            </div>
          </AdminForm>
        </Panel>
      </div>
    </div>
  )
}
