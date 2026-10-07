# Architecture

## Overview

```
Browser ──► Caddy / Vercel ──► Next.js 16 (App Router, Node runtime)
                                   │  Server Components, Server Actions, Route Handlers
                                   ├──► Supabase Postgres (PostgREST) ── RLS + SECURITY DEFINER functions
                                   ├──► Supabase Auth (cookies via @supabase/ssr)
                                   ├──► Supabase Storage (product, brand, category, banner images)
                                   ├──► Safaricom Daraja (OAuth, STK Push, STK Query)
                                   └──► POS (separate Supabase project): paid orders become sales
Safaricom ──► POST /api/mpesa/callback?secret=…
Cron      ──► GET  /api/cron/release-reservations (Bearer CRON_SECRET)
```

The store is a single Next.js app. There is no separate API server: reads happen in Server
Components, writes go through Server Actions, and the few machine-to-machine endpoints are Route
Handlers under `src/app/api`. All business rules that involve money or stock live in Postgres
functions, so they are atomic and cannot be bypassed by a crafted request.

## Code layout

```
src/
  app/
    (storefront)/        public pages: home, shop, c/[...slug], b/[slug], p/[slug], search,
                         deals, parts-finder, cart, checkout, order/[number], account/*, ...
    (storefront)/(content)/[page]   about, faqs, privacy, terms, refund/shipping policy, warranty
    admin/               staff area (every page calls requireStaff(permission))
    api/                 search, mpesa/callback, cron/release-reservations,
                         orders/[number]/status|invoice, admin/orders-export
    sitemap.ts, robots.ts, opengraph-image.tsx, icon.tsx
  proxy.ts               refreshes the Supabase session cookie; gates /account, /admin, /checkout
  actions/               Server Actions ('use server'): cart, wishlist, checkout, auth, account,
                         reviews, support, orders; admin/* for staff
  components/            ui/ (primitives), storefront/, product/, cart/, checkout/, account/, admin/
  lib/
    ecommerce/           pure, unit-tested logic: money, pricing, coupons, delivery, inventory, orders
    payments/            provider interface, Daraja client, mock provider, callback/status service
    supabase/            server (cookie session), client (browser), admin (service role), public (cached reads)
    catalog.ts           cached catalogue reads (settings, categories, products, facets, homepage)
    auth.ts              getSessionUser, requireStaff, can()
    admin/               staffAction wrapper, audit log, cache revalidation helpers
    notifications/       email (log or Resend) + templates, sent after the response with after()
    seo/                 metadata helpers and JSON-LD (Organization, WebSite, Product, Breadcrumb)
    server-env.ts        server-only secrets (importing it from client code fails the build)
  types/database.ts      generated from the schema (npm run db:types)
supabase/migrations      schema, functions, RLS, storage, reference data, content drafts
tests/                   unit, integration, db (SQL), e2e (Playwright)
```

## Rendering and caching

- Catalogue pages (home, listings, product pages, content pages) are server-rendered and cached.
  Catalogue reads go through `publicClient(tags, revalidate)` in `lib/supabase/public.ts`, an
  anonymous Supabase client whose `fetch` is tagged for Next's data cache.
- Time-based revalidation is a safety net (home 1 h, content pages 24 h). Staff edits invalidate
  immediately: admin actions call `updateTag(...)` for the affected tags (`lib/admin/revalidate.ts`),
  so a price or stock change shows on the storefront on the next request.
- Personal pages (cart, checkout, account, order pages, admin) read with the user's session and
  are never cached.
- The cart lives in `localStorage` for guests and in the `carts` table for signed-in users; on
  sign-in the two are merged (`syncCartAction`). Prices shown in the cart are refreshed from the
  database (`quoteCart`); the browser's numbers are never used.
- Images use `next/image`. Seeded product art is local SVG; uploaded images come from Supabase
  Storage (`remotePatterns` in `next.config.ts`).
- Fonts: IBM Plex Sans and IBM Plex Mono through `next/font` (self-hosted at build time).

## Security model

**Trust boundaries**

- The browser sends only identifiers and quantities. Prices, discounts, delivery fees, stock and
  totals are computed on the server (`lib/ecommerce/quote.ts`, `pricing.ts`) and again inside
  `place_order()` in the database, which also reserves stock under a row lock.
- An order becomes paid only through `confirm_payment()`, called from the M-Pesa callback or a
  server-side STK query, after checking the amount and request ids. See [PAYMENTS.md](PAYMENTS.md).
- Order status changes go through `update_order_status()`, which enforces allowed transitions
  and permissions.

**Database access**

- Row Level Security is enabled on every table. Customers can read and write only their own
  profile, addresses, cart, wishlist, orders and reviews. Public catalogue data is readable by
  anyone; drafts and costs are not.
- Staff permissions are data (`role_permissions`) checked by `has_permission()` in SQL and by
  `requireStaff()` / `staffAction()` in the app. `super_admin` implicitly has every permission.
  A trigger stops users from changing their own role.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server code (`lib/supabase/admin.ts`, `server-only`)
  for payment callbacks, cron, order lookups by token and notifications.
- Column-level grants restrict what even an allowed update may touch (for example staff can edit
  only `orders.admin_notes` directly; everything else goes through functions).

**Other controls**

- Secrets: only `NEXT_PUBLIC_*` values reach the browser. M-Pesa, Supabase service role, email
  and cron secrets are read in `server-env.ts`, which is `server-only`.
- Rate limits (database-backed `check_rate_limit()`): sign-in, registration, password reset,
  checkout, payment retries, order tracking, status polling, contact and part-request forms.
  Reviews require a signed-in account. Mobile networks share one address between thousands of
  customers, so the per-IP limits are loose flood ceilings; the tight limits are keyed on the
  email, phone or order number being tried.
- Staff accounts manage the store and cannot buy from it: sign-in and `/account` send them to
  `/admin`, and checkout refuses them (page and `placeOrderAction`).
- The logger (`lib/logger.ts`) redacts values under keys that look like passwords, PINs, tokens,
  secrets, API keys, cookies and authorisation headers.
- Security headers in `next.config.ts`: `X-Frame-Options: SAMEORIGIN`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, and HSTS when `NEXT_PUBLIC_SITE_URL` is https.
- Guests view their order through an unguessable per-order token (`/order/<number>?t=<uuid>`).
- Every staff write is recorded in `audit_logs` with actor, action and resource.
- `robots.ts` blocks indexing on any host that isn't `cisssolutions.co.ke` (unless
  `ALLOW_INDEXING=true`), so staging copies don't compete with the live site.

## Background work

- **Transactional outbox** (`outbox` table, `src/lib/outbox.ts`). Follow-up work is written in
  the same database transaction as the change that causes it, so it can't be lost between
  "order saved" and "work done":
  - `place_order()` queues `order_placed` (confirmation and staff alert) and, for M-Pesa,
    `mpesa_stk_push` with the number entered at checkout;
  - a trigger on `orders` queues `payment_confirmed` when an online payment is confirmed,
    `order_status` when staff change an order's status, `pos_sale` when an order becomes paid
    (by any method) and `pos_void` when a paid order is refunded.
- The request that created a task runs it straight away (the STK push before the response, so
  the prompt reaches the phone immediately; emails after it with Next's `after()`). The cron
  endpoint sweeps up anything left: a crash, a deploy, or an email or M-Pesa outage.
- Failed tasks retry with back-off (1, 4, 16, 60 minutes …). After 6 attempts a task is marked
  dead and staff see a "Task failed" entry in Admin → Notifications.
- Handlers are safe to repeat: an email already sent for an order is never re-sent, the STK
  push is skipped if the order already has a payment attempt or is more than 10 minutes old,
  and the POS keeps one sale per order number.
- **POS sales** (`src/lib/pos`). The shop's POS is a separate Supabase project with its own
  catalogue and stock. A paid order is registered there as a sale of its "Website" shop
  (`register_web_sale()` in the POS database; `void_web_sale()` on refund): lines by name,
  the delivery fee as a line of its own, no stock moved. Each line carries the product's cost
  price (`product_costs`), from which the POS works out the profit; a product with no cost
  price is recorded with no profit. The
  store calls with the POS's public key plus `POS_SYNC_SECRET`, whose hash the POS stores, so
  it can do nothing else there. With the `POS_*` variables unset the tasks complete as skipped.
- `expire_stale_orders()` cancels unpaid orders after their payment window
  (`checkout.mpesa_reservation_minutes`, default 30) and releases their reserved stock. It runs
  from the cron endpoint and opportunistically when an order page polls for status.

## Design system

Tokens and surface classes live in `src/app/globals.css` (`@theme inline`). The UI is light
glassmorphism over a fixed backdrop (`.site-backdrop`): soft cyan, magenta and yellow light from
the logo's inks behind every page, including admin.

- `.glass-flat` / `.glass-card`: translucent white with a bright edge and soft shadow, **no**
  blur filter. Used for product cards, tiles, panels, forms and the footer. Over the smooth
  backdrop they read as frosted glass and stay cheap in long product grids.
- `.glass` / `.glass-strong`: real `backdrop-filter` blur. Reserved for surfaces with something
  worth blurring: the homepage hero and parts finder (over CMYK halftone screens,
  `InkBackdrop`), menus, drawers, dialogs, toasts and the mobile buy bar. The sticky header
  switches its blur on only after the page scrolls, so no blur layer is on screen during first
  paint.
- Write `backdrop-filter` without the `-webkit-` prefix: the CSS optimiser adds the prefix,
  and declaring both makes it drop the standard property.
- Menus inside the header are near-opaque: a nested blur inside a blurred header is unreliable
  in Chromium.

Layout follows a retail store: info bar, header with logo, search, account and cart, a category
bar (category chips on mobile), compact product cards and horizontally scrolling homepage
shelves. Controls are pill-shaped (`rounded-full` buttons, `--radius-control` inputs). Text stays
dark on near-white glass, and Lighthouse accessibility is 100 on the storefront pages.
