import { NextResponse, type NextRequest } from 'next/server'
import { getSettings } from '@/lib/catalog'
import { renderInvoicePdf } from '@/lib/invoice'
import { getOrderForViewer } from '@/lib/orders'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, ctx: RouteContext<'/api/orders/[number]/invoice'>) {
  const { number } = await ctx.params
  const order = await getOrderForViewer(decodeURIComponent(number), request.nextUrl.searchParams.get('t'))
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [settings, { data: payment }] = await Promise.all([
    getSettings(),
    createAdminClient().from('payments').select('transaction_reference').eq('order_id', order.id).eq('status', 'PAID').maybeSingle(),
  ])
  const bytes = await renderInvoicePdf(order, settings.business, payment?.transaction_reference ?? null)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${order.order_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
