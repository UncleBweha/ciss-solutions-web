import { CreditCard, Headphones, ShieldCheck, Truck } from 'lucide-react'

const items = [
  { icon: Truck, title: 'Nationwide delivery', text: 'Anywhere in Kenya' },
  { icon: ShieldCheck, title: 'Genuine products', text: 'Original and quality parts' },
  { icon: Headphones, title: 'Expert support', text: 'Talk to a technician' },
  { icon: CreditCard, title: 'M-Pesa, cards & bank', text: 'Pay the way you prefer' },
]

export function TrustBar() {
  return (
    <section aria-label="Why shop with us" className="container-page">
      <ul className="grid grid-cols-2 border-y border-border lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => (
          <li
            key={title}
            className={`flex items-start gap-3 px-1 py-4 sm:px-4 ${i % 2 ? 'border-l border-border pl-4' : ''} ${i > 1 ? 'border-t border-border lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l lg:pl-4' : ''}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-light" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-fg-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
