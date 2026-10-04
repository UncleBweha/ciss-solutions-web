import type { Metadata } from 'next'
import { CartView } from '@/components/cart/cart-view'

export const metadata: Metadata = { title: 'Your Cart', robots: { index: false } }

export default function CartPage() {
  return (
    <div className="container-page py-8">
      <h1 className="mb-8 text-3xl font-bold sm:text-4xl">Your cart</h1>
      <CartView />
    </div>
  )
}
