import Link from 'next/link'
import { respondSupportAction, supportAttachmentUrlAction } from '@/actions/admin/content'
import { AdminForm } from '@/components/admin/admin-form'
import { AdminPageHeader, EmptyRow, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { AttachmentLink } from '@/components/admin/small-actions'
import { Badge } from '@/components/ui/badge'
import { Field, Select, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { whatsappLink } from '@/lib/contact'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'

export const metadata = { title: 'Support requests' }
const tone = { open: 'warning', in_progress: 'info', resolved: 'success', closed: 'neutral' } as const

export default async function SupportAdmin({ searchParams }: PageProps<'/admin/support'>) {
  await requireStaff('support.manage')
  const sp = await searchParams
  const status = param(sp.status)
  const supabase = await createClient()
  let q = supabase.from('support_requests').select('*').order('created_at', { ascending: false }).limit(200)
  if (status === 'open' || status === 'in_progress' || status === 'resolved' || status === 'closed') q = q.eq('status', status)
  const { data } = await q
  const current = (data ?? []).find((r) => r.id === param(sp.id))

  return (
    <div>
      <AdminPageHeader title="Support requests" description="Contact messages and “find a part” requests from customers." />
      <div className="grid gap-4 xl:grid-cols-[1fr_28rem]">
        <Panel padded={false}>
          <div className="flex gap-1 border-b border-border p-2 text-sm">
            {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
              <Link key={s} href={s ? `/admin/support?status=${s}` : '/admin/support'} className={`rounded-lg px-3 py-1.5 font-semibold ${(status ?? '') === s ? 'bg-primary/15' : 'text-fg-secondary hover:bg-surface'}`}>{s ? s.replace('_', ' ') : 'all'}</Link>
            ))}
          </div>
          <Table>
            <thead><tr><Th>Request</Th><Th>From</Th><Th>Status</Th><Th>Received</Th></tr></thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className={current?.id === r.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                  <Td><Link href={`/admin/support?id=${r.id}${status ? `&status=${status}` : ''}`} className="font-medium hover:text-primary-light">{r.subject ?? r.kind}</Link><span className="block text-xs text-fg-muted">{r.kind === 'part_request' ? 'Part request' : 'Contact form'}</span></Td>
                  <Td>{r.name}<span className="block text-xs text-fg-muted">{r.phone ?? r.email}</span></Td>
                  <Td><Badge tone={tone[r.status]}>{r.status.replace('_', ' ')}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</Td>
                </tr>
              ))}
              {!data?.length ? <EmptyRow colSpan={4}>No requests.</EmptyRow> : null}
            </tbody>
          </Table>
        </Panel>
        {current ? (
          <Panel title={current.subject ?? 'Request'}>
            <dl className="mb-3 space-y-1 text-sm">
              <dd><strong>{current.name}</strong></dd>
              {current.phone ? <dd><a href={`tel:+${current.phone}`} className="text-primary-light">{current.phone}</a>{whatsappLink(current.phone) ? <> · <a href={whatsappLink(current.phone, `Hello ${current.name}, this is CISS Solutions about your request.`)!} target="_blank" rel="noopener noreferrer" className="text-primary-light">WhatsApp</a></> : null}</dd> : null}
              {current.email ? <dd><a href={`mailto:${current.email}`} className="text-primary-light">{current.email}</a></dd> : null}
              {current.printer_brand ? <dd>Printer: {current.printer_brand} {current.printer_model}</dd> : null}
            </dl>
            <p className="whitespace-pre-line rounded-lg bg-surface p-3 text-sm">{current.message}</p>
            {current.attachment_path ? <div className="mt-2"><AttachmentLink action={supportAttachmentUrlAction.bind(null, current.attachment_path)} /></div> : null}
            <AdminForm key={current.id} action={respondSupportAction} className="mt-4 space-y-3" submitLabel="Update request">
              <input type="hidden" name="id" value={current.id} />
              <Field label="Status" htmlFor="sr-status">
                <Select id="sr-status" name="status" defaultValue={current.status}>
                  <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </Select>
              </Field>
              <Field label="Response / internal notes" htmlFor="sr-response" hint="Record what was offered (e.g. part SKU and price). Reply to the customer by phone, WhatsApp or email.">
                <Textarea id="sr-response" name="response" rows={4} defaultValue={current.admin_response ?? ''} />
              </Field>
            </AdminForm>
          </Panel>
        ) : (
          <Panel><p className="text-sm text-fg-muted">Select a request to view and respond.</p></Panel>
        )}
      </div>
    </div>
  )
}
