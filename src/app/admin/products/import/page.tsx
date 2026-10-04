import { AdminPageHeader } from '@/components/admin/admin-ui'
import { CsvImport } from '@/components/admin/csv-import'
import { requireStaff } from '@/lib/auth'

export const metadata = { title: 'Import products' }

export default async function ImportPage() {
  await requireStaff('products.manage')
  return (
    <div className="max-w-5xl">
      <AdminPageHeader title="Import products from CSV" back={{ href: '/admin/products', label: 'Products' }} />
      <CsvImport />
    </div>
  )
}
