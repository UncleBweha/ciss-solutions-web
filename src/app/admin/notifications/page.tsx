import Link from 'next/link'
import { AdminPageHeader, EmptyRow, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { markAllNotificationsReadAction } from '@/actions/admin/notifications'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Notifications' }

const kindLabels: Record<string, string> = {
  new_order: 'New order',
  low_stock: 'Low stock',
  payment_failed: 'Payment failed',
  new_review: 'New review',
  new_support_request: 'Support request',
  stock_shortage: 'Stock shortage',
  outbox_dead: 'Task failed',
}

export default async function NotificationsPage() {
  await requireStaff()
  const supabase = await createClient()
  const { data } = await supabase.from('notifications').select('*').eq('channel', 'admin').order('created_at', { ascending: false }).limit(200)
  const link = (n: NonNullable<typeof data>[number]) =>
    n.order_id ? `/admin/orders/${n.order_id}` : n.kind === 'low_stock' ? '/admin/inventory?low=1' : n.kind === 'new_review' ? '/admin/reviews' : n.kind === 'new_support_request' ? '/admin/support' : null
  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        actions={
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="glass" size="sm">Mark all as read</Button>
          </form>
        }
      />
      <Panel padded={false}>
        <Table>
          <thead><tr><Th>Type</Th><Th>Message</Th><Th>When</Th></tr></thead>
          <tbody>
            {(data ?? []).map((n) => {
              const href = link(n)
              return (
                <tr key={n.id}>
                  <Td><Badge tone={n.kind === 'outbox_dead' ? 'danger' : n.kind === 'low_stock' || n.kind === 'payment_failed' || n.kind === 'stock_shortage' ? 'warning' : 'info'}>{kindLabels[n.kind] ?? n.kind}</Badge></Td>
                  <Td className={n.read_at ? 'text-fg-secondary' : 'font-semibold'}>{href ? <Link href={href} className="hover:text-primary-light">{n.subject}</Link> : n.subject}</Td>
                  <Td className="whitespace-nowrap text-fg-muted">{formatDateTime(n.created_at)}</Td>
                </tr>
              )
            })}
            {!data?.length ? <EmptyRow colSpan={3}>No notifications.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}
