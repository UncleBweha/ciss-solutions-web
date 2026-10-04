import Link from 'next/link'
import { deleteBrandAction, saveBrandAction } from '@/actions/admin/catalog'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { AdminPageHeader, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { param } from '@/lib/utils'

export const metadata = { title: 'Brands' }

export default async function BrandsAdminPage({ searchParams }: PageProps<'/admin/brands'>) {
  await requireStaff('catalog.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: brands }, { data: products }] = await Promise.all([
    supabase.from('brands').select('*').order('sort_order').order('name'),
    supabase.from('product_counts_by_brand').select('brand_id, product_count'),
  ])
  const editing = (brands ?? []).find((b) => b.id === param(sp.edit))
  return (
    <div>
      <AdminPageHeader title="Brands" description="Brands appear in navigation, filters and brand pages (/b/...)." />
      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel padded={false}>
          <Table>
            <thead><tr><Th>Brand</Th><Th>Slug</Th><Th className="text-right">Products</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {(brands ?? []).map((b) => (
                <tr key={b.id} className={editing?.id === b.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td className="font-mono text-xs text-fg-muted">{b.slug}</Td>
                  <Td className="text-right">{(products ?? []).find((p) => p.brand_id === b.id)?.product_count ?? 0}</Td>
                  <Td><Badge tone={b.is_active ? 'success' : 'neutral'}>{b.is_active ? 'Active' : 'Hidden'}</Badge></Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`/admin/brands?edit=${b.id}`} className="mr-2 text-sm font-semibold text-primary-light">Edit</Link>
                    <ConfirmAction action={deleteBrandAction.bind(null, b.id)} label="Delete" title={`Delete ${b.name}?`} description="Brands with products cannot be deleted; hide them instead." />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel title={editing ? `Edit ${editing.name}` : 'New brand'} actions={editing ? <Link href="/admin/brands" className="text-xs text-primary-light">+ New instead</Link> : null}>
          <AdminForm key={editing?.id ?? 'new'} action={saveBrandAction} resetOnSuccess={!editing} submitLabel={editing ? 'Save brand' : 'Create brand'} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <Field label="Name" htmlFor="name" required><Input id="name" name="name" defaultValue={editing?.name} required /></Field>
            <Field label="Slug" htmlFor="slug" hint="Leave empty to generate"><Input id="slug" name="slug" defaultValue={editing?.slug} /></Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={3} defaultValue={editing?.description ?? ''} /></Field>
            <Field label="Website" htmlFor="website"><Input id="website" name="website" type="url" defaultValue={editing?.website ?? ''} /></Field>
            <Field label="Logo URL" htmlFor="logoUrl"><Input id="logoUrl" name="logoUrl" defaultValue={editing?.logo_url ?? ''} /></Field>
            <Field label="…or upload logo" htmlFor="logo"><Input id="logo" name="logo" type="file" accept="image/*" className="h-auto py-2" /></Field>
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
