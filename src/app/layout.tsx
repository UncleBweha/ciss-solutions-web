import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import { Analytics } from '@/components/analytics'
import { CartProvider } from '@/components/cart/cart-provider'
import { ToastProvider } from '@/components/ui/toast'
import { getSettings } from '@/lib/catalog'
import { siteUrl } from '@/lib/env'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['600', '700', '800'], display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const { seo, business } = await getSettings()
  return {
    metadataBase: new URL(siteUrl),
    title: { default: seo.default_title, template: `%s | ${business.name}` },
    description: seo.default_description,
    applicationName: business.name,
    icons: { apple: '/logo.webp' },
    openGraph: {
      type: 'website',
      siteName: business.name,
      locale: 'en_KE',
      title: seo.default_title,
      description: seo.default_description,
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: true },
  }
}

export const viewport: Viewport = {
  themeColor: '#07152f',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <div className="ambient" aria-hidden="true" />
        <ToastProvider>
          <CartProvider>{children}</CartProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
