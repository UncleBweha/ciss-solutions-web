# Architecture

## Overview

```
Browser ──► Caddy / Vercel ──► Next.js 16 (App Router, Node runtime)
                                   │  Server Components, Server Actions, Route Handlers
                                   ├──► Supabase Postgres (PostgREST) ── RLS + SECURITY DEFINER functions
                                   ├──► Supabase Auth (cookies via @supabase/ssr)
                                   ├──► Supabase Storage (product, brand, category, banner images)
                                   └──► Safaricom Daraja (OAuth, STK Push, STK Query)
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
  Reviews require a signed-in account.
- The logger (`lib/logger.ts`) redacts values under keys that look like passwords, PINs, tokens,
  secrets, API keys, cookies and authorisation headers.
- Security headers in `next.config.ts`: `X-Frame-Options: SAMEORIGIN`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, and HSTS when `NEXT_PUBLIC_SITE_URL` is https.
- Guests view their order through an unguessable per-order token (`/order/<number>?t=<uuid>`).
- Every staff write is recorded in `audit_logs` with actor, action and resource.
- `robots.ts` blocks indexing on any host that isn't `cisssolutions.co.ke` (unless
  `ALLOW_INDEXING=true`), so staging copies don't compete with the live site.

## Background work

- Emails (order received, payment confirmed, status updates, staff alerts) are sent with Next's
  `after()`, so they never delay the response, and failures are logged rather than surfaced.
- `expire_stale_orders()` cancels unpaid orders after their payment window
  (`checkout.mpesa_reservation_minutes`, default 30) and releases their reserved stock. It runs
  from the cron endpoint and opportunistically when an order page polls for status.

## Design system

Tokens live in `src/app/globals.css` (`@theme inline`): a deep navy base, one blue action colour,
CMYK accent stripes taken from the print trade, light "stage" tiles behind product images, and
mono labels for specs, SKUs and counts. Shared primitives are in `src/components/ui`. Contrast
was checked with Lighthouse (accessibility 100) and touch targets are at least 24 px.
