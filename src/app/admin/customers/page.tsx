import Link from 'next/link'
import { AdminPageHeader, EmptyRow, FilterBar, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { Pagination } from '@/components/ui/pagination'
import { requireStaff } from '@/lib/auth'
import { withParams } from '@/lib/catalog-params'
import { formatKES } from '@/lib/ecommerce/money'
import { escapeLike } from '@/lib/ecommerce/quote'
import { createClient } from '@/lib/supabase/server'
import { formatDate, param } from '@/lib/utils'

export const metadata = { title: 'Customers' }
const PER_PAGE = 50

export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  await requireStaff('customers.view')
  const sp = await searchParams
  const q = param(sp.q)?.trim()
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1)
  const supabase = await createClient()
  let query = supabase.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (q) query = query.or(`full_name.ilike.%${escapeLike(q)}%,email.ilike.%${escapeLike(q)}%,phone.ilike.%${escapeLike(q)}%`)
  const { data, count } = await query
  return (
    <div>
      <AdminPageHeader title="Customers" description={`${count ?? 0} registered customers. Guest checkouts appear on their orders.`} />
      <FilterBar>
        <Input name="q" defaultValue={q} placeholder="Name, email or phone" className="h-10 w-full! sm:w-64!" aria-label="Search customers" />
        <Button type="submit" size="sm" className="h-10">Search</Button>
      </FilterBar>
      <Panel padded={false}>
        <Table>
          <thead><tr><Th>Customer</Th><Th>Phone</Th><Th>Joined</Th><Th className="text-right">Orders</Th><Th className="text-right">Total spent</Th><Th>Last order</Th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-surface">
                <Td><Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-primary-light">{c.full_name || '—'}</Link><span className="block text-xs text-fg-muted">{c.email}</span></Td>
                <Td>{c.phone ?? '—'}</Td>
                <Td>{c.created_at ? formatDate(c.created_at) : '—'}</Td>
                <Td className="text-right">{c.orders_count}</Td>
                <Td className="text-right tabular-nums">{formatKES(c.total_spent ?? 0)}</Td>
                <Td>{c.last_order_at ? formatDate(c.last_order_at) : '—'}</Td>
              </tr>
            ))}
            {!data?.length ? <EmptyRow colSpan={6}>No customers found.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => withParams('/admin/customers', sp, { page: String(p) })} />
    </div>
  )
}
