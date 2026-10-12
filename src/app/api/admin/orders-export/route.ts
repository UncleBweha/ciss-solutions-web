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

const PAGE_SIZE = 1000
const MAX_ROWS = 20000

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user || !can(user, 'reports.view') || !can(user, 'orders.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const from = request.nextUrl.searchParams.get('from') ?? '2000-01-01'
  const to = request.nextUrl.searchParams.get('to') ?? '2999-12-31'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: 'Bad dates' }, { status: 400 })
  const start = new Date(`${from}T00:00:00+03:00`)
  const end = new Date(`${to}T23:59:59.999+03:00`)
  // Shaped like a date but not one (month 13).
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return NextResponse.json({ error: 'Bad dates' }, { status: 400 })
  const supabase = await createClient()
  // The API returns at most 1,000 rows per request whatever limit is asked for, so read in pages.
  const page = (offset: number) =>
    supabase
      .from('orders')
      .select('order_number, created_at, customer_name, customer_phone, customer_email, delivery_county, delivery_town, payment_method, payment_status, order_status, subtotal, discount, delivery_fee, total, coupon_code, payments(status, transaction_reference)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at')
      .order('order_number')
      .range(offset, offset + PAGE_SIZE - 1)
  const data: NonNullable<Awaited<ReturnType<typeof page>>['data']> = []
  while (data.length < MAX_ROWS) {
    const { data: rows, error } = await page(data.length)
    if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    data.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  const columns = ['order_number', 'created_at', 'customer_name', 'customer_phone', 'customer_email', 'delivery_county', 'delivery_town', 'payment_method', 'payment_status', 'order_status', 'subtotal', 'discount', 'delivery_fee', 'total', 'coupon_code', 'payment_reference'] as const
  const rows = data.map(({ payments, ...order }) => ({
    ...order,
    // M-Pesa receipt (or other reference) of the attempt that paid, for reconciliation.
    payment_reference: payments.find((p) => p.status === 'PAID' || p.status === 'REFUNDED')?.transaction_reference ?? null,
  }))
  // A cut-off file must say so: it is used to reconcile payments.
  const cutOff = data.length >= MAX_ROWS ? [cell(`INCOMPLETE: only the first ${MAX_ROWS} orders are listed. Export a shorter date range.`)] : []
  const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(',')), ...cutOff].join('\n')
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${from}-to-${to}.csv"`, 'Cache-Control': 'no-store' },
  })
}
