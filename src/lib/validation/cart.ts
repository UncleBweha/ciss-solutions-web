import { z } from 'zod'

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
})

export const cartItemsSchema = z.array(cartItemSchema).max(100)

export type CartItemInput = z.infer<typeof cartItemSchema>
