import { Banknote, MessageCircle, Smartphone, Truck } from 'lucide-react'

// Concrete promises that match the store's actual settings (delivery zones,
// enabled payment methods). Update alongside Admin -> Settings.
const items = [
  { icon: Truck, title: 'Delivery across Kenya', text: 'Same or next day in Nairobi' },
  { icon: Smartphone, title: 'Pay with M-Pesa', text: 'STK push to your phone' },
  { icon: Banknote, title: 'Cash on delivery', text: 'Available in Nairobi' },
  { icon: MessageCircle, title: 'Ask a technician', text: 'Help choosing the right part' },
]

export function TrustBar() {
  return (
    <section aria-label="Shopping with us" className="container-page">
      <ul className="glass-flat grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 px-3 py-3.5 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80 text-primary-light shadow-sm"><Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{title}</p>
              <p className="text-xs text-fg-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
