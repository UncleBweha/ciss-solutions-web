import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/content/markdown'
import { Breadcrumbs } from '@/components/ui/misc'
import { CONTENT_PAGES, getContentPage } from '@/lib/content'

// /about, /faqs, /privacy, /terms, /refund-policy, /shipping-policy, /warranty
// Unknown slugs render notFound() (a clean 404).
export const revalidate = 86400

export function generateStaticParams() {
  return CONTENT_PAGES.map((page) => ({ page }))
}

export async function generateMetadata({ params }: PageProps<'/[page]'>): Promise<Metadata> {
  const { page } = await params
  const content = await getContentPage(page)
  if (!content) return {}
  return {
    title: content.title,
    description: content.description,
    alternates: { canonical: `/${page}` },
    // Drafts nobody has signed off yet stay out of search results.
    robots: content.reviewed ? undefined : { index: false, follow: true },
  }
}

export default async function ContentPage({ params }: PageProps<'/[page]'>) {
  const { page } = await params
  const content = await getContentPage(page)
  if (!content) notFound()

  return (
    <div className="container-page max-w-3xl py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: content.title, href: `/${page}` }]} />
      <article className="glass-flat mt-6 rounded-[var(--radius-card)] p-6 sm:p-10">
        <h1 className="mb-6 text-3xl font-bold">{content.title}</h1>
        <Markdown source={content.body} />
      </article>
    </div>
  )
}
