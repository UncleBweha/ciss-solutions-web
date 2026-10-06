# Payments

Supported methods (each can be switched on or off in Admin, Settings, Payments):

| Method | How it is confirmed |
| --- | --- |
| M-Pesa (STK Push via Safaricom Daraja) | Automatically, by Safaricom's callback or a server-side status query |
| M-Pesa Paybill (manual, no Daraja) | By staff, after checking the Paybill statement (order status → Paid). The customer pays to the Paybill themselves with the order number as the account. Only offered once a Paybill number is saved |
| Bank transfer | By staff, after checking the bank account (order status → Paid) |
| Cash on delivery (chosen counties only) | By staff, on delivery |
| Card | Not implemented; the toggle exists but stays off until a card provider is integrated |

**Rule:** an order is never marked paid because of anything the browser says. The order page
only displays the state stored in the database.

## M-Pesa flow

```
Customer          Next.js server                       Postgres                 Safaricom
   │ Place order ───►│ placeOrderAction                     │                        │
   │                 │  validate input, rate limit          │                        │
   │                 │  place_order() ─────────────────────►│ price, reserve stock,  │
   │                 │                                      │ order PAYMENT_PENDING, │
   │                 │                                      │ outbox: STK push task  │
   │                 │  run outbox task → initiateMpesaPayment()                     │
   │                 │   payments row (PENDING) ───────────►│                        │
   │                 │   STK Push ──────────────────────────┼───────────────────────►│
   │                 │   save MerchantRequestID,            │                        │
   │                 │   CheckoutRequestID (PROCESSING) ───►│                        │
   │◄── redirect to /order/<number>?t=<token>               │                        │
   │ enters PIN on phone ───────────────────────────────────┼───────────────────────►│
   │                 │◄─────── POST /api/mpesa/callback?secret=… ─────────────────────│
   │                 │  verify secret (+ IP), match request ids, receipt unused      │
   │                 │  confirm_payment() ─────────────────►│ amount ≥ total? PAID,  │
   │                 │                                      │ deduct stock           │
   │ page polls /api/orders/<n>/status every few seconds    │                        │
   │                 │  no callback after 15 s? STK Query ──┼───────────────────────►│
   │◄── "Payment received" (read from the database)         │                        │
```

Key code: `src/actions/checkout.ts`, `src/lib/payments/service.ts`, `src/lib/payments/daraja.ts`,
`src/app/api/mpesa/callback/route.ts`, SQL functions `place_order`, `confirm_payment`,
`fail_payment`, `expire_stale_orders`.

### What the callback checks

1. `?secret=` equals `MPESA_CALLBACK_SECRET` (constant-time compare). In production a missing
   secret means every callback is rejected, and the Daraja provider refuses to start without one.
2. Optional source IP allow-list (`MPESA_ALLOWED_IPS`). Only enable it behind a proxy that
   overwrites `X-Forwarded-For` (Caddy does by default; Vercel does).
3. The `CheckoutRequestID` belongs to a payment we created, and its `MerchantRequestID` matches.
4. The M-Pesa receipt number has not already confirmed a different payment.
5. Inside `confirm_payment()`: the paid amount is at least the order total (otherwise the attempt
   is failed and staff are alerted), and the payment isn't already paid (idempotent; Safaricom
   may retry).

The endpoint answers `ResultCode: 0` once processed, including for unknown or invalid payloads, so
Safaricom stops retrying, and returns HTTP 500 only when our own processing failed (for example the
database is unreachable), so Safaricom retries later.

### Failures, retries and expiry

- Result codes such as 1032 (cancelled), 1 (insufficient balance), 1037 (phone unreachable) and
  2001 (wrong PIN) are shown to the customer in plain language (`describeResultCode`). They can
  retry from the order page, up to a rate limit, with the same or a different number.
- If neither a callback nor a query answer arrives within 3 minutes, the attempt is marked failed
  (code 1019) and the customer can retry.
- If the server stops between saving the order and sending the STK push, the push is still in
  the outbox (committed with the order); the cron sweep sends it within 10 minutes of the order,
  and never sends a second prompt if one was already attempted.
- A lost callback doesn't strand a paid order: the order page queries Safaricom (STK Query)
  after 15 seconds without a result, and the cron job does the same for every push still
  awaiting a result, so it works even if the customer closed the page.
- Stock stays reserved for `checkout.mpesa_reservation_minutes` (default 30). After that,
  `expire_stale_orders()` cancels the order and releases the stock. If money still arrives for a
  cancelled order, the payment is accepted and recorded, the order becomes Paid, and a stock
  shortage is flagged for staff to resolve.

## Configuration

| Variable | Notes |
| --- | --- |
| `MPESA_ENV` | `mock`, `sandbox` (sandbox.safaricom.co.ke) or `production` (api.safaricom.co.ke) |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` | From your Daraja app |
| `MPESA_SHORTCODE` | Paybill or Till (Business Short Code). Sandbox: 174379 |
| `MPESA_PASSKEY` | Lipa na M-Pesa Online passkey |
| `MPESA_TRANSACTION_TYPE` | `CustomerPayBillOnline` (Paybill) or `CustomerBuyGoodsOnline` (Till) |
| `MPESA_PARTY_B` | Till only, when the till number differs from the store number; blank for Paybill |
| `MPESA_CALLBACK_URL` | Public HTTPS URL of `/api/mpesa/callback` |
| `MPESA_CALLBACK_SECRET` | Long random string, required in production (`openssl rand -hex 32`) |
| `MPESA_ALLOWED_IPS` | Optional comma-separated allow-list |
| `MPESA_ALLOW_MOCK` | `true` lets a production build use the mock (staging and CI only) |

All of these are server-only: they are read in `src/lib/server-env.ts`, which is marked
`server-only`, and none has a `NEXT_PUBLIC_` prefix. Never put them in client code or commit
them; production values belong in the host's environment (`/opt/ciss-store/.env` on the VPS, or
the Vercel project settings).

## Mock provider (development)

With `MPESA_ENV=mock` the app uses `MockMpesaProvider`. It never contacts Safaricom and never moves
money. It accepts the STK request, then about 4 seconds later posts a realistic callback to
`/api/mpesa/callback` and answers status queries the same way, so the whole flow (including
the callback checks) runs locally.

| Phone ends in | Result |
| --- | --- |
| 1 | 1032 cancelled by user |
| 2 | 1 insufficient balance |
| anything else | success with a generated receipt |

A production build (`NODE_ENV=production`) refuses the mock unless `MPESA_ALLOW_MOCK=true`, so a
misconfigured live site fails loudly instead of "accepting" fake payments.

## Going live checklist

1. Create an app on the [Daraja portal](https://developer.safaricom.co.ke), test the whole flow
   with `MPESA_ENV=sandbox` and the sandbox shortcode on a staging URL.
2. Apply for Lipa na M-Pesa Online on your Paybill/Till and get production credentials and passkey.
3. Set the production variables above on the server, with `MPESA_ENV=production` and the live
   `MPESA_CALLBACK_URL` (https://cisssolutions.co.ke/api/mpesa/callback).
4. Make sure `MPESA_ALLOW_MOCK` is unset or `false`.
5. Place a small real order (for example KSh 10 with a test product) and confirm the order turns
   Paid, the receipt appears in Admin, Orders, and the stock moves.
6. Make sure the cron job is running (see [DEPLOYMENT.md](DEPLOYMENT.md)) so abandoned orders
   release stock.

## Reconciliation

- Every attempt is a row in `payments`, with result code, receipt and the raw callback.
- Admin, Orders shows payment status per order. The CSV export (Admin, Reports) includes a
  `payment_reference` column holding the M-Pesa receipt of the attempt that paid.
- Compare the M-Pesa statement with the export. Each receipt on the statement should match exactly
  one order. Staff cannot mark an M-Pesa order as paid by hand (only Safaricom's confirmation
  can). If money arrived for an order that shows unpaid, check the cron job is running; a
  confirmed STK query or late callback will update it. Otherwise refund the customer, or have
  them place the order again and pay by bank transfer, and note the receipt on the order.
