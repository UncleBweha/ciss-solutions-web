# Payments

Supported methods (each can be switched on or off in Admin, Settings, Payments):

| Method | How it is confirmed |
| --- | --- |
| M-Pesa Paybill (manual) | By staff, after checking the Paybill statement (order status → Paid). The customer pays to the Paybill themselves using the business number and account number saved in Admin → Settings → Payments. Only offered once both are saved |
| Bank transfer | By staff, after checking the bank account (order status → Paid) |
| Cash on delivery (chosen counties only) | By staff, on delivery |
| Card | Not implemented; the toggle exists but stays off until a card provider is integrated |

Paybill and bank transfer orders are **placed, awaiting payment confirmation** until staff mark
them Paid: the order page and the emails sent at placement (customer and staff) say exactly that.
The "order confirmed & paid" email to the customer, the "payment confirmed" alert to staff and
the POS sale all happen when staff mark the order Paid, never before.

**Rule:** an order is never marked paid because of anything the browser says. Only a staff
status change (`update_order_status()`, permission `orders.manage`) marks it paid.

## Flow

```
Customer          Next.js server                       Postgres
   │ Place order ───►│ placeOrderAction                     │
   │                 │  validate input, rate limit          │
   │                 │  place_order() ─────────────────────►│ price, reserve stock,
   │                 │                                      │ order PENDING,
   │                 │                                      │ outbox: order_placed
   │◄── redirect to /order/<number>?t=<token>               │
   │ pays by Paybill / bank (shown on the order page)       │
Staff                │                                      │
   │ Admin → Orders → Paid ───────────────────────────────►│ update_order_status():
   │                 │                                      │ PAID, deduct stock,
   │                 │                                      │ payments row (manual),
   │                 │                                      │ outbox: payment_confirmed, pos_sale
```

Key code: `src/actions/checkout.ts`, `src/app/(storefront)/order/[number]/page.tsx`, SQL functions
`place_order`, `update_order_status`, `expire_stale_orders`.

## Payment window

An unpaid order holds its stock for `checkout.bank_transfer_reservation_minutes` (default 2880,
two days; Admin → Settings → Checkout → Payment window). After that, `expire_stale_orders()`
(run by the cron job) marks the order Failed and releases the stock. Money that arrives later can
still be recorded: staff mark the order Paid, which takes the stock again, or flags a shortage if
there is none left.

## Reconciliation

- Every confirmed payment is a row in `payments` (provider `manual`, with the staff note).
- Admin, Orders shows payment status per order. The CSV export (Admin, Reports) has a
  `payment_reference` column.
- Compare the Paybill and bank statements with the orders awaiting confirmation; the order
  number is the account number or reference the customer used.

## M-Pesa STK push (removed)

The automatic M-Pesa prompt (STK push through KCB Buni) was removed on 2026-10-17
(migration `20261017000100_remove_stk_push.sql`). `place_order()` now refuses the `mpesa` method.
Earlier M-Pesa orders and their receipts are still in the database and show as "M-Pesa" in the
admin; the `MPESA_*` and `KCB_*` environment variables are no longer read and can be deleted
from the server's `.env`.
