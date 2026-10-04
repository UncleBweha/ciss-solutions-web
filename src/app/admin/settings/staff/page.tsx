import { setStaffRoleAction } from '@/actions/admin/settings'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Field, Input, Select } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Staff & roles' }

const roleInfo: Record<string, string> = {
  super_admin: 'Everything, including other super admins',
  admin: 'Everything except managing super admins',
  manager: 'Catalogue, orders, refunds, customers, content, coupons, reports',
  inventory_manager: 'Products and inventory',
  order_manager: 'Orders and customers',
  content_manager: 'Homepage, categories, brands, reviews, content pages',
  support_agent: 'Support requests and customer lookup',
  customer: 'No admin access (removes staff access)',
}

export default async function StaffSettings() {
  await requireStaff('admins.manage')
  const supabase = await createClient()
  const { data: staff } = await supabase.from('profiles').select('id, email, full_name, role, updated_at').neq('role', 'customer').order('role')
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <Panel title="Staff accounts" padded={false}>
        <Table>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Access</Th></tr></thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.full_name ?? '—'}</Td>
                <Td>{s.email}</Td>
                <Td><Badge tone="info">{s.role.replace(/_/g, ' ')}</Badge></Td>
                <Td className="text-xs text-fg-muted">{roleInfo[s.role]}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel title="Grant or change a role">
        <p className="mb-3 text-sm text-fg-secondary">The person must first create a customer account with their email. Changes are recorded in the audit log.</p>
        <AdminForm action={setStaffRoleAction} resetOnSuccess className="space-y-3" submitLabel="Apply role">
          <Field label="Email" htmlFor="st-email" required><Input id="st-email" name="email" type="email" required /></Field>
          <Field label="Role" htmlFor="st-role">
            <Select id="st-role" name="role" defaultValue="order_manager">
              {Object.entries(roleInfo).map(([r, info]) => <option key={r} value={r}>{r.replace(/_/g, ' ')} – {info}</option>)}
            </Select>
          </Field>
        </AdminForm>
      </Panel>
    </div>
  )
}
