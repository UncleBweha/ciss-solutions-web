import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Analytics } from '@/components/analytics'
import { CartProvider } from '@/components/cart/cart-provider'
import { ToastProvider } from '@/components/ui/toast'
import { getSettings } from '@/lib/catalog'
import { siteUrl } from '@/lib/env'
import './globals.css'

// IBM Plex: a technical, engineered face that suits a printer and parts catalogue;
// the mono cut sets SKUs, part numbers and order numbers.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-plex-sans', weight: ['400', '500', '600', '700'], display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500', '600'], display: 'swap' })

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
  themeColor: '#ffffff',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <ToastProvider>
          <CartProvider>{children}</CartProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
