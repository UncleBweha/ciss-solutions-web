import Link from 'next/link'
import { saveContentPageAction } from '@/actions/admin/settings'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { readSettings } from '@/lib/admin/settings'
import { CONTENT_PAGES, type ContentPage } from '@/lib/content'
import { cn, param } from '@/lib/utils'

export const metadata = { title: 'Content pages' }

export default async function ContentPagesSettings({ searchParams }: PageProps<'/admin/settings/pages'>) {
  await requireStaff('content.manage')
  const slug = param((await searchParams).page) ?? 'about'
  const pages = await readSettings<ContentPage>(CONTENT_PAGES.map((p) => `page:${p}`))
  const page = pages[`page:${slug}`]
  return (
    <div className="grid gap-4 xl:grid-cols-[16rem_1fr]">
      <Panel padded={false}>
        <ul className="p-2">
          {CONTENT_PAGES.map((p) => {
            const pg = pages[`page:${p}`]
            return (
              <li key={p}>
                <Link href={`/admin/settings/pages?page=${p}`} className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm', p === slug ? 'bg-primary/15' : 'hover:bg-surface')}>
                  {pg?.title ?? p}
                  {!pg?.reviewed ? <Badge tone="warning">Draft</Badge> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </Panel>
      <Panel title={`Edit /${slug}`} actions={<Link href={`/${slug}`} target="_blank" className="text-xs text-primary-light">View page →</Link>}>
        {page && !page.reviewed ? (
          <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-amber-200">
            This is starter text. Review it (for legal pages, with your advisor) and tick “Reviewed” before launch.
          </p>
        ) : null}
        <AdminForm key={slug} action={saveContentPageAction} className="space-y-3" submitLabel="Save page">
          <input type="hidden" name="slug" value={slug} />
          <Field label="Title" htmlFor="cp-title" required><Input id="cp-title" name="title" defaultValue={page?.title} required /></Field>
          <Field label="Meta description" htmlFor="cp-desc"><Input id="cp-desc" name="description" defaultValue={page?.description} maxLength={200} /></Field>
          <Field label="Content" htmlFor="cp-body" hint="Formatting: blank line between paragraphs, ## Heading, - list item, **bold**, [link text](/path)">
            <Textarea id="cp-body" name="body" rows={18} defaultValue={page?.body} className="font-mono text-xs" />
          </Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="reviewed" defaultChecked={page?.reviewed} /> Reviewed and ready to publish</label>
        </AdminForm>
      </Panel>
    </div>
  )
}
