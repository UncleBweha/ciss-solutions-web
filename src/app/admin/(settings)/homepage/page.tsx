import Link from 'next/link'
import { deleteBannerAction, moveBannerAction, moveSectionAction, saveBannerAction, saveSectionAction } from '@/actions/admin/content'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { MoveButtons } from '@/components/admin/small-actions'
import { ProductImage } from '@/components/product/product-image'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'
import { nowMs } from '@/lib/utils/time'

export const metadata = { title: 'Homepage' }

const sectionNames: Record<string, string> = {
  hero: 'Hero slider', trust: 'Trust bar', categories: 'Categories', featured: 'Featured products', part_finder: 'Spare-part finder',
  deals: 'Deals', bestsellers: 'Best sellers', brands: 'Brands', cta: 'Call to action',
}
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16) : '')

export default async function HomepageAdmin({ searchParams }: PageProps<'/admin/homepage'>) {
  await requireStaff('content.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: sections }, { data: banners }, { data: products }] = await Promise.all([
    supabase.from('homepage_sections').select('*').order('sort_order'),
    supabase.from('homepage_banners').select('*').order('sort_order'),
    supabase.from('products').select('id, name').eq('status', 'active').order('name').limit(1000),
  ])
  const editingSlide = (banners ?? []).find((b) => b.id === param(sp.slide))
  const editingSection = (sections ?? []).find((s) => s.id === param(sp.section))
  const now = nowMs()

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-secondary">
        Turn sections on or off, reorder them and manage hero slides. Changes go live immediately.
        <Link href="/" target="_blank" className="font-semibold text-primary-light">Preview homepage →</Link>
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sections (top to bottom)">
          <ul className="divide-y divide-border">
            {(sections ?? []).map((s, i, arr) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <MoveButtons up={moveSectionAction.bind(null, s.id, -1)} down={moveSectionAction.bind(null, s.id, 1)} first={i === 0} last={i === arr.length - 1} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{sectionNames[s.key] ?? s.key}</p>
                  {s.title ? <p className="truncate text-xs text-fg-muted">“{s.title}”</p> : null}
                </div>
                <Badge tone={s.is_enabled ? 'success' : 'neutral'}>{s.is_enabled ? 'On' : 'Off'}</Badge>
                <Link href={`/admin/homepage?section=${s.id}`} className="text-sm font-semibold text-primary-light">Edit</Link>
              </li>
            ))}
          </ul>
          {editingSection ? (
            <div className="mt-4 rounded-lg border border-primary/40 p-4">
              <h3 className="mb-3 font-semibold">Edit: {sectionNames[editingSection.key]}</h3>
              <AdminForm key={editingSection.id} action={saveSectionAction} className="space-y-3">
                <input type="hidden" name="id" value={editingSection.id} />
                <label className="flex items-center gap-2 text-sm"><Checkbox name="isEnabled" defaultChecked={editingSection.is_enabled} /> Show this section</label>
                {editingSection.key !== 'hero' && editingSection.key !== 'trust' ? (
                  <>
                    <Field label="Title" htmlFor="sec-title"><Input id="sec-title" name="title" defaultValue={editingSection.title ?? ''} /></Field>
                    <Field label="Subtitle" htmlFor="sec-sub"><Input id="sec-sub" name="subtitle" defaultValue={editingSection.subtitle ?? ''} /></Field>
                  </>
                ) : null}
                {['featured', 'deals', 'bestsellers', 'categories'].includes(editingSection.key) ? (
                  <Field label="Number of items" htmlFor="sec-limit"><Input id="sec-limit" name="limit" type="number" min={1} max={20} defaultValue={String((editingSection.config as { limit?: number })?.limit ?? '')} /></Field>
                ) : null}
                {editingSection.key === 'cta' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Button text" htmlFor="sec-cta"><Input id="sec-cta" name="ctaText" defaultValue={(editingSection.config as { cta_text?: string })?.cta_text ?? ''} /></Field>
                    <Field label="Button link" htmlFor="sec-url"><Input id="sec-url" name="ctaUrl" defaultValue={(editingSection.config as { cta_url?: string })?.cta_url ?? ''} /></Field>
                  </div>
                ) : null}
              </AdminForm>
            </div>
          ) : null}
        </Panel>

        <Panel title="Hero slides" actions={editingSlide ? <Link href="/admin/homepage" className="text-xs text-primary-light">+ New slide</Link> : null}>
          <ul className="mb-4 divide-y divide-border">
            {(banners ?? []).map((b, i, arr) => {
              const live = b.is_active && (!b.starts_at || new Date(b.starts_at).getTime() <= now) && (!b.ends_at || new Date(b.ends_at).getTime() > now)
              return (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <MoveButtons up={moveBannerAction.bind(null, b.id, -1)} down={moveBannerAction.bind(null, b.id, 1)} first={i === 0} last={i === arr.length - 1} />
                  <span className="product-stage relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><ProductImage src={b.image_url} alt="" fill sizes="48px" className="object-contain p-1" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.title} {b.highlight}</p>
                    <p className="text-xs text-fg-muted">{b.starts_at || b.ends_at ? `${b.starts_at ? formatDateTime(b.starts_at) : '…'} → ${b.ends_at ? formatDateTime(b.ends_at) : '…'}` : 'Always'}</p>
                  </div>
                  <Badge tone={live ? 'success' : 'neutral'}>{live ? 'Live' : b.is_active ? 'Scheduled' : 'Off'}</Badge>
                  <Link href={`/admin/homepage?slide=${b.id}`} className="text-sm font-semibold text-primary-light">Edit</Link>
                  <ConfirmAction action={deleteBannerAction.bind(null, b.id)} label="Delete" title="Delete this slide?" description="The slide is removed from the homepage." />
                </li>
              )
            })}
          </ul>
          <h3 className="mb-3 font-semibold">{editingSlide ? 'Edit slide' : 'New slide'}</h3>
          <AdminForm key={editingSlide?.id ?? 'new'} action={saveBannerAction} resetOnSuccess={!editingSlide} submitLabel={editingSlide ? 'Save slide' : 'Add slide'} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={editingSlide?.id ?? ''} />
            <Field label="Eyebrow" htmlFor="b-eyebrow"><Input id="b-eyebrow" name="eyebrow" defaultValue={editingSlide?.eyebrow ?? ''} placeholder="PRINT SMARTER. SHOP BETTER." /></Field>
            <Field label="Title" htmlFor="b-title" required><Input id="b-title" name="title" defaultValue={editingSlide?.title ?? ''} required /></Field>
            <Field label="Highlighted line" htmlFor="b-highlight"><Input id="b-highlight" name="highlight" defaultValue={editingSlide?.highlight ?? ''} /></Field>
            <Field label="Featured product card" htmlFor="b-product">
              <Select id="b-product" name="featuredProductId" defaultValue={editingSlide?.featured_product_id ?? ''}>
                <option value="">None</option>
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Subtitle" htmlFor="b-sub" className="sm:col-span-2"><Textarea id="b-sub" name="subtitle" rows={2} className="min-h-0" defaultValue={editingSlide?.subtitle ?? ''} /></Field>
            <Field label="Image URL" htmlFor="b-img"><Input id="b-img" name="imageUrl" defaultValue={editingSlide?.image_url ?? ''} /></Field>
            <Field label="…or upload image" htmlFor="b-file"><Input id="b-file" name="image" type="file" accept="image/*" className="h-auto py-2" /></Field>
            <Field label="Image alt text" htmlFor="b-alt"><Input id="b-alt" name="imageAlt" defaultValue={editingSlide?.image_alt ?? ''} /></Field>
            <Field label="Background (CSS, optional)" htmlFor="b-bg"><Input id="b-bg" name="background" defaultValue={editingSlide?.background ?? ''} /></Field>
            <Field label="Button text" htmlFor="b-cta"><Input id="b-cta" name="ctaText" defaultValue={editingSlide?.cta_text ?? 'Shop Now'} /></Field>
            <Field label="Button link" htmlFor="b-ctaurl"><Input id="b-ctaurl" name="ctaUrl" defaultValue={editingSlide?.cta_url ?? '/shop'} /></Field>
            <Field label="Second button text" htmlFor="b-cta2"><Input id="b-cta2" name="secondaryCtaText" defaultValue={editingSlide?.secondary_cta_text ?? ''} /></Field>
            <Field label="Second button link" htmlFor="b-cta2url"><Input id="b-cta2url" name="secondaryCtaUrl" defaultValue={editingSlide?.secondary_cta_url ?? ''} /></Field>
            <Field label="Start (EAT)" htmlFor="b-start"><Input id="b-start" name="startsAt" type="datetime-local" defaultValue={local(editingSlide?.starts_at ?? null)} /></Field>
            <Field label="End (EAT)" htmlFor="b-end"><Input id="b-end" name="endsAt" type="datetime-local" defaultValue={local(editingSlide?.ends_at ?? null)} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox name="isActive" defaultChecked={editingSlide?.is_active ?? true} /> Active</label>
          </AdminForm>
        </Panel>
      </div>
    </div>
  )
}
