import { AdminPageHeader } from '@/components/admin/admin-ui'
import { ProductForm } from '@/components/admin/product-form'
import { requireStaff } from '@/lib/auth'
import { getAdminCatalogOptions } from '@/lib/admin/options'

export const metadata = { title: 'New product' }

export default async function NewProductPage() {
  await requireStaff('products.manage')
  const options = await getAdminCatalogOptions()
  return (
    <div>
      <AdminPageHeader title="New product" back={{ href: '/admin/products', label: 'Products' }} description="Save the product first, then add images." />
      <ProductForm
        {...options}
        initial={{
          name: '', slug: '', sku: '', barcode: '', brandId: '', categoryId: '', printerModelId: '', productType: 'simple', status: 'draft',
          shortDescription: '', description: '', partNumber: '', oemNumber: '', condition: '', warranty: '', price: '', compareAtPrice: '', costPrice: '',
          initialStock: 0, lowStockThreshold: 5, weightKg: '', dimensions: '', isFeatured: false, isBestseller: false, isNew: true, isOnSale: false,
          specifications: [], features: '', whatsIncluded: '', compatibility: [], variants: [], seoTitle: '', seoDescription: '', canonicalUrl: '',
          ogTitle: '', ogDescription: '', ogImageUrl: '',
        }}
      />
    </div>
  )
}
