'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { revalidateProducts } from '@/lib/admin/revalidate'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  mode: z.enum(['add', 'remove', 'set']),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.enum(['purchase', 'manual_adjustment', 'return', 'damage', 'correction']),
  note: z.string().trim().max(300).optional(),
})

export type AdjustInput = z.input<typeof schema>

/** Stock adjustments go through adjust_stock(), which writes the inventory history. */
export async function adjustStockAction(input: AdjustInput): Promise<ActionResult<{ stock: number }>> {
  return staffAction('inventory.manage', async (user) => {
    const d = schema.parse(input)
    const supabase = await createClient()
    const { data: current } = d.variantId
      ? await supabase.from('product_variants').select('stock_quantity').eq('id', d.variantId).single()
      : await supabase.from('products').select('stock_quantity').eq('id', d.productId).single()
    if (!current) return { ok: false, message: 'Item not found.' }
    const change = d.mode === 'add' ? d.quantity : d.mode === 'remove' ? -d.quantity : d.quantity - current.stock_quantity
    if (change === 0) return { ok: true, message: 'No change.' }
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: d.productId,
      p_variant_id: d.variantId as string,
      p_change: change,
      p_reason: d.reason,
      p_note: d.note || undefined,
    })
    if (error) {
      const reserved = error.message.match(/STOCK_BELOW_RESERVED:(\d+)/)?.[1]
      return { ok: false, message: reserved ? `Stock cannot go below the ${reserved} units reserved for open orders.` : error.message }
    }
    await audit(user, 'inventory.adjusted', 'products', d.productId, {
      before: { stock: current.stock_quantity },
      after: { stock: data, change, reason: d.reason, variant: d.variantId, note: d.note },
    })
    const { data: p } = await supabase.from('products').select('slug').eq('id', d.productId).single()
    revalidateProducts([p?.slug])
    revalidatePath('/admin/inventory')
    return { ok: true, message: `Stock updated to ${data}.`, data: { stock: data as number } }
  })
}
