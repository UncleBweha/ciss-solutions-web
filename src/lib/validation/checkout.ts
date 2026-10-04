import { z } from 'zod'
import { isCounty } from '@/lib/ecommerce/kenya'
import { cartItemsSchema } from './cart'
import { kenyanPhone } from './forms'

/** Fields the customer fills in (validated in the browser and again on the server). */
export const checkoutFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  phone: kenyanPhone,
  county: z.string().refine(isCounty, 'Choose your county'),
  town: z.string().trim().min(2, 'Enter your town or city').max(80),
  address: z.string().trim().min(5, 'Enter a delivery address (building, street, landmark)').max(300),
  instructions: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['mpesa', 'card', 'bank_transfer', 'cash_on_delivery'], { message: 'Choose a payment method' }),
  mpesaPhone: z.string().trim().optional(),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  saveAddress: z.boolean().optional(),
})

export const checkoutSchema = checkoutFormSchema
  .extend({ items: cartItemsSchema.min(1, 'Your cart is empty') })
  .superRefine((v, ctx) => {
    if (v.paymentMethod === 'mpesa' && v.mpesaPhone) {
      const r = kenyanPhone.safeParse(v.mpesaPhone)
      if (!r.success) ctx.addIssue({ code: 'custom', path: ['mpesaPhone'], message: 'Enter a valid Safaricom number' })
    }
  })

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>
export type CheckoutInput = z.input<typeof checkoutSchema>
