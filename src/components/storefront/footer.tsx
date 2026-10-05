import Link from 'next/link'
import { ChevronDown, Clock, Mail, MapPin, Phone } from 'lucide-react'
import type { BusinessSettings } from '@/types/catalog'
import { whatsappLink } from '@/lib/contact'
import { Logo } from './logo'

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [
      ['Printers', '/c/printers'],
      ['Spare Parts', '/c/spare-parts'],
      ['Ink & Toner', '/c/ink-toner'],
      ['Scanners', '/c/scanners'],
      ['Accessories', '/c/accessories'],
      ['Paper & Media', '/c/paper-media'],
      ['Deals', '/deals'],
    ],
  },
  {
    title: 'Customer Service',
    links: [
      ['Contact', '/contact'],
      ['Track your order', '/track-order'],
      ['Find a spare part', '/parts-finder'],
      ['Delivery information', '/shipping-policy'],
      ['Returns & refunds', '/refund-policy'],
      ['Warranty', '/warranty'],
      ['FAQs', '/faqs'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Brands', '/brands'],
      ['Privacy Policy', '/privacy'],
      ['Terms', '/terms'],
      ['Refund Policy', '/refund-policy'],
    ],
  },
]

function SocialIcon({ name }: { name: string }) {
  // Simple monochrome glyphs (lucide does not ship brand logos).
  const paths: Record<string, string> = {
    instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8Z',
    tiktok: 'M16 3c.3 2.3 1.7 3.9 4 4v3.2a7.4 7.4 0 0 1-4-1.2V15a6 6 0 1 1-6-6h.5v3.3A2.8 2.8 0 1 0 13 15V3h3Z',
    youtube: 'M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8ZM10 15V9l5.2 3L10 15Z',
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

export function Footer({ business }: { business: BusinessSettings }) {
  const socials = Object.entries(business.socials ?? {}).filter(([, url]) => url)
  const year = new Date().getFullYear()
  return (
    <footer className="glass-flat mt-10 rounded-t-[1.75rem] border-x-0 border-b-0 lg:mt-14">
      <div className="container-page grid gap-x-8 gap-y-5 py-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-y-8 lg:py-10">
        <div className="space-y-3 lg:space-y-5">
          <Logo />
          <p className="hidden max-w-sm text-sm text-fg-secondary lg:block">{business.tagline}.</p>
          <ul className="space-y-1.5 text-sm text-fg-secondary lg:space-y-2.5">
            {business.phone ? (
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="hover:text-fg">
                  {business.phone}
                </a>
              </li>
            ) : null}
            {business.email ? (
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <a href={`mailto:${business.email}`} className="break-all hover:text-fg">
                  {business.email}
                </a>
              </li>
            ) : null}
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
              {business.address || business.location}
            </li>
            {business.business_hours ? (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                {business.business_hours}
              </li>
            ) : null}
          </ul>
          {whatsappLink(business.whatsapp) ? (
            <a
              href={whatsappLink(business.whatsapp, 'Hello CISS Solutions, I have a question.')!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-4 py-2 text-sm font-semibold text-success shadow-sm hover:bg-white"
            >
              Chat on WhatsApp
            </a>
          ) : null}
        </div>

        {/* Phones and tablets: link groups fold away so the footer stays short. */}
        <div className="divide-y divide-border border-y border-border md:self-start lg:hidden">
          {columns.map((col) => (
            <details key={col.title} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
                {col.title}
                <ChevronDown className="h-4 w-4 text-fg-muted transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2 pb-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-fg-secondary hover:text-fg">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="hidden lg:block">
            <h2 className="mb-3 text-sm font-bold">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-fg-secondary hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center gap-3 py-4 text-sm text-fg-muted lg:py-5">
          <div className="text-center">
            <p>
              © {year} {business.name}. All rights reserved.
            </p>
            <p className="mt-0.5 text-xs">Developed By: Neurospark Technologies</p>
          </div>
          {socials.length ? (
            <div className="flex items-center gap-2">
              <span className="mr-1">Follow us</span>
              {socials.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name} className="grid h-9 w-9 place-items-center rounded-full border border-white bg-white/70 text-fg-secondary hover:text-fg">
                  <SocialIcon name={name} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
