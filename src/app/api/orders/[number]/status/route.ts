import { NextResponse, type NextRequest } from 'next/server'
import { getOrderForViewer } from '@/lib/orders'
import { refreshPaymentStatus } from '@/lib/payments/service'
import { rateLimit } from '@/lib/security'

// Polled by the order page while an M-Pesa payment is in progress.
export async function GET(request: NextRequest, ctx: RouteContext<'/api/orders/[number]/status'>) {
  const { number } = await ctx.params
  const order = await getOrderForViewer(decodeURIComponent(number), request.nextUrl.searchParams.get('t'))
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await rateLimit(`status:${order.id}`, 120, 600))) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const view = await refreshPaymentStatus(order.id)
  return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
}
