'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { background, notifyOrderStatus, notifyPaymentConfirmed } from '@/lib/notifications'
import { runOutbox, runTaskNow } from '@/lib/outbox'
import { createClient } from '@/lib/supabase/server'
import { awaitsPaymentConfirmation } from '@/lib/ecommerce/orders'

const statuses = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED'] as const

/** Status changes run through update_order_status(), which enforces transitions and stock effects. */
export async function updateOrderStatusAction(orderId: string, status: (typeof statuses)[number], note?: string): Promise<ActionResult> {
  return staffAction(status === 'REFUNDED' ? 'orders.refund' : 'orders.manage', async (user) => {
    const input = z.object({ orderId: z.string().uuid(), status: z.enum(statuses), note: z.string().max(500).optional() }).parse({ orderId, status, note })
    const supabase = await createClient()
    const { error } = await supabase.rpc('update_order_status', { p_order_id: input.orderId, p_status: input.status, p_note: input.note || undefined })
    if (error) {
      const msg = error.message.includes('INVALID_TRANSITION') ? 'That status change is not allowed from the current status.' : error.message
      return { ok: false, message: msg }
    }
    await audit(user, `order.${input.status.toLowerCase()}`, 'orders', input.orderId, { after: { status: input.status, note: input.note } })
    // The status email was queued by the database with the change; send it after the response.
    background('outbox:order_status', () => runTaskNow(input.orderId, 'order_status', () => notifyOrderStatus(input.orderId, input.status)))
    // Staff confirmed a Paybill or bank transfer payment: only now are the customer and staff
    // told the order is paid (queued by the database with the change; sent after the response).
    if (input.status === 'PAID') {
      const { data: order } = await supabase.from('orders').select('payment_method').eq('id', input.orderId).maybeSingle()
      if (order && awaitsPaymentConfirmation(order.payment_method)) {
        background('outbox:payment_confirmed', () => runTaskNow(input.orderId, 'payment_confirmed', () => notifyPaymentConfirmed(input.orderId)))
      }
    }
    // Marking an order paid (or refunded) also queued its sale (or void) for the POS.
    background('outbox:pos', () => runOutbox({ orderId: input.orderId, kinds: ['pos_sale', 'pos_void'] }))
    revalidatePath(`/admin/orders/${input.orderId}`)
    revalidatePath('/admin/orders')
    return { ok: true, message: 'Order updated.' }
  })
}

export async function updateOrderNotesAction(orderId: string, notes: string): Promise<ActionResult> {
  return staffAction('orders.manage', async (user) => {
    const id = z.string().uuid().parse(orderId)
    const supabase = await createClient()
    const { error } = await supabase.from('orders').update({ admin_notes: z.string().max(2000).parse(notes) }).eq('id', id)
    if (error) return { ok: false, message: error.message }
    await audit(user, 'order.notes_updated', 'orders', id)
    revalidatePath(`/admin/orders/${id}`)
    return { ok: true, message: 'Notes saved.' }
  })
}
