import { z } from 'zod'
import { isCounty } from '@/lib/ecommerce/kenya'
import { cartItemsSchema } from './cart'
import { kenyanPhone } from './forms'

/** Fields the customer fills in (validated in the browser and again on the server). */
const checkoutFields = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  phone: kenyanPhone,
  deliveryMethod: z.enum(['pickup', 'delivery'], { message: 'Choose store pickup or delivery' }),
  // Required for parcel delivery only (see requireAddress); ignored for store pickup.
  county: z.string().max(60),
  town: z.string().trim().max(80),
  address: z.string().trim().max(300),
  instructions: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['mpesa', 'card', 'bank_transfer', 'cash_on_delivery', 'mpesa_paybill'], { message: 'Choose a payment method' }),
  mpesaPhone: z.string().trim().optional(),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  saveAddress: z.boolean().optional(),
})

function requireAddress(v: { deliveryMethod: 'pickup' | 'delivery'; county: string; town: string; address: string }, ctx: z.RefinementCtx) {
  if (v.deliveryMethod !== 'delivery') return
  if (!isCounty(v.county)) ctx.addIssue({ code: 'custom', path: ['county'], message: 'Choose your county' })
  if (v.town.length < 2) ctx.addIssue({ code: 'custom', path: ['town'], message: 'Enter your town or city' })
  if (v.address.length < 5) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Enter a delivery address (building, street, landmark)' })
}

export const checkoutFormSchema = checkoutFields.superRefine(requireAddress)

export const checkoutSchema = checkoutFields
  .extend({ items: cartItemsSchema.min(1, 'Your cart is empty') })
  .superRefine((v, ctx) => {
    requireAddress(v, ctx)
    if (v.paymentMethod === 'mpesa' && v.mpesaPhone) {
      const r = kenyanPhone.safeParse(v.mpesaPhone)
      if (!r.success) ctx.addIssue({ code: 'custom', path: ['mpesaPhone'], message: 'Enter a valid Safaricom number' })
    }
  })

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>
export type CheckoutInput = z.input<typeof checkoutSchema>
