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
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 bg-white px-3 py-3 sm:px-4">
            <Icon className="h-6 w-6 shrink-0 text-fg-secondary" strokeWidth={1.6} aria-hidden="true" />
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
