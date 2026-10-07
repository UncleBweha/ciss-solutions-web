import { NextResponse, type NextRequest } from 'next/server'
import { can, getSessionUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Quote, and neutralise spreadsheet formula injection (a leading tab, return or space
  // is skipped by spreadsheets, so it can hide the = that follows).
  const safe = /^\s*[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user || !can(user, 'reports.view') || !can(user, 'orders.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const from = request.nextUrl.searchParams.get('from') ?? '2000-01-01'
  const to = request.nextUrl.searchParams.get('to') ?? '2999-12-31'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: 'Bad dates' }, { status: 400 })
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('order_number, created_at, customer_name, customer_phone, customer_email, delivery_county, delivery_town, payment_method, payment_status, order_status, subtotal, discount, delivery_fee, total, coupon_code, payments(status, transaction_reference)')
    .gte('created_at', new Date(`${from}T00:00:00+03:00`).toISOString())
    .lte('created_at', new Date(`${to}T23:59:59.999+03:00`).toISOString())
    .order('created_at')
    .limit(20000)
  const columns = ['order_number', 'created_at', 'customer_name', 'customer_phone', 'customer_email', 'delivery_county', 'delivery_town', 'payment_method', 'payment_status', 'order_status', 'subtotal', 'discount', 'delivery_fee', 'total', 'coupon_code', 'payment_reference'] as const
  const rows = (data ?? []).map(({ payments, ...order }) => ({
    ...order,
    // M-Pesa receipt (or other reference) of the attempt that paid, for reconciliation.
    payment_reference: payments.find((p) => p.status === 'PAID' || p.status === 'REFUNDED')?.transaction_reference ?? null,
  }))
  const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${from}-to-${to}.csv"`, 'Cache-Control': 'no-store' },
  })
}
