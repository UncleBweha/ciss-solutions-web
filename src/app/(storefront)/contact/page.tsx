import type { Metadata } from 'next'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { ContactForm } from '@/components/storefront/support-forms'
import { Breadcrumbs } from '@/components/ui/misc'
import { getSettings } from '@/lib/catalog'
import { whatsappLink } from '@/lib/contact'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Contact CISS Solutions',
  description: 'Call, WhatsApp, email or visit CISS Solutions for printers, spare parts, ink and toner in Kenya.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage() {
  const { business } = await getSettings()
  const wa = whatsappLink(business.whatsapp, 'Hello CISS Solutions, I have a question.')
  const items = [
    business.phone ? { icon: Phone, label: 'Phone', value: business.phone, href: `tel:${business.phone.replace(/\s/g, '')}` } : null,
    wa ? { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us', href: wa } : null,
    business.email ? { icon: Mail, label: 'Email', value: business.email, href: `mailto:${business.email}` } : null,
    { icon: MapPin, label: 'Location', value: business.address || business.location },
    business.business_hours ? { icon: Clock, label: 'Business hours', value: business.business_hours } : null,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x))

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Contact', href: '/contact' }]} />
      <h1 className="mb-8 mt-3 text-3xl font-bold sm:text-4xl">Contact {business.name}</h1>
      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-3">
          {items.map(({ icon: Icon, label, value, ...rest }) => {
            const href = 'href' in rest ? rest.href : undefined
            const content = (
              <>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-fg-muted">{label}</span>
                  <span className="font-semibold">{value}</span>
                </span>
              </>
            )
            return href ? (
              <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="glass-flat flex items-center gap-4 rounded-[var(--radius-card)] p-4 hover:border-primary/50">
                {content}
              </a>
            ) : (
              <div key={label} className="glass-flat flex items-center gap-4 rounded-[var(--radius-card)] p-4">
                {content}
              </div>
            )
          })}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#25D366] font-semibold text-[#06290f] hover:brightness-110">
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> Chat on WhatsApp
            </a>
          ) : null}
        </aside>
        <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-8" aria-labelledby="contact-form">
          <h2 id="contact-form" className="mb-5 text-xl font-bold">
            Send us a message
          </h2>
          <ContactForm />
        </section>
      </div>
    </div>
  )
}
