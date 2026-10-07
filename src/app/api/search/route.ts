import { NextResponse, type NextRequest } from 'next/server'
import { categoryHref, flattenTree, getCategoryTree, searchCatalog } from '@/lib/catalog'
import { clientIp, rateLimit } from '@/lib/security'

// Instant search suggestions for the header search box.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ total: 0, items: [], categories: [] })
  // Each suggestion runs a search in the database. A loose ceiling per address (shared
  // mobile addresses carry many shoppers) is enough to stop one client hammering it.
  if (!(await rateLimit(`search:${await clientIp()}`, 300, 60))) return NextResponse.json({ total: 0, items: [], categories: [] }, { status: 429 })

  const [result, tree] = await Promise.all([searchCatalog({ q, perPage: 6, sort: 'relevance' }), getCategoryTree()])
  const needle = q.toLowerCase()
  const categories = flattenTree(tree)
    .filter((c) => c.name.toLowerCase().includes(needle))
    .slice(0, 4)
    .map((c) => ({ name: c.name, href: categoryHref(c) }))

  return NextResponse.json(
    {
      total: result.total,
      items: result.items.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        image_url: p.image_url,
        brand_name: p.brand_name,
        category_name: p.category_name,
      })),
      categories,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
