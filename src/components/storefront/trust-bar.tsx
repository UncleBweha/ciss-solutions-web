import { CreditCard, Headphones, ShieldCheck, Truck } from 'lucide-react'

const items = [
  { icon: Truck, title: 'Nationwide Delivery', text: 'Get your order anywhere in Kenya' },
  { icon: ShieldCheck, title: 'Genuine Products', text: 'Original and quality products' },
  { icon: Headphones, title: 'Expert Support', text: "We're here to help" },
  { icon: CreditCard, title: 'Multiple Payment Options', text: 'M-Pesa, cards & bank transfer' },
]

export function TrustBar() {
  return (
    <section aria-label="Why shop with us" className="container-page">
      <ul className="glass grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-light sm:h-12 sm:w-12">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold sm:text-base">{title}</p>
              <p className="text-xs text-fg-muted sm:text-sm">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
