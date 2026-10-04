// Cache tags shared by catalogue reads (lib/catalog) and admin revalidation.
export const tags = {
  catalog: 'catalog',
  product: (slug: string) => `product:${slug}`,
  category: (slug: string) => `category:${slug}`,
  brand: (slug: string) => `brand:${slug}`,
  categories: 'categories',
  brands: 'brands',
  homepage: 'homepage',
  settings: 'settings',
  delivery: 'delivery',
  printerModels: 'printer-models',
} as const
