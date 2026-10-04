# CISS Solutions store

Online store for CISS Solutions (Nairobi): printers, spare parts, ink and toner, scanners,
paper and accessories, with M-Pesa checkout, a spare-part compatibility finder and a staff admin.

- **Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Supabase
  (Postgres + Auth + Storage, Row Level Security), M-Pesa Daraja STK Push.
- **Currency:** KES. **Locale:** en-KE.

The repository also still contains the static coming-soon page (`index.html`, `assets/`) and the
scripts that deploy it (`deploy/deploy.sh`, `.github/workflows/deploy.yml`). Those are untouched;
the store deploys separately (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Documentation

| Doc | What's in it |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layout, rendering and caching, security model |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, database functions, RLS, migrations and seed data |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | M-Pesa flow, callback security, mock provider, going live |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase project, VPS (Docker + Caddy), Vercel, cron, CI |
| [docs/ADMIN.md](docs/ADMIN.md) | Staff guide: roles, products, stock, orders, content, settings |

## Run it locally

Needs Node.js 20.9+ and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start            # Postgres, Auth, Storage, Studio on 5432x ports
npx supabase db reset         # applies supabase/migrations and supabase/seed.sql
cp .env.example .env.local    # then paste the keys printed by `npx supabase status`
npm run dev                   # http://localhost:3000
```

`.env.local` needs at least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. With `MPESA_ENV=mock`, checkout simulates M-Pesa: no money moves.

### Demo accounts (local seed only)

| Email | Password | Role |
| --- | --- | --- |
| admin@ciss.local | Admin12345! | super_admin (open `/admin`) |
| customer@ciss.local | Customer12345! | customer |
| brian@ciss.local, amina@ciss.local | Customer12345! | customers |

These exist only in `supabase/seed.sql`, which is never applied to production
(`supabase db push` runs migrations only).

Mock M-Pesa test numbers: a phone ending in **1** simulates "cancelled by user", **2**
simulates "insufficient balance", anything else succeeds after about 4 seconds.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build (standalone output) and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm run test:unit` | Pricing, coupons, delivery, inventory, M-Pesa parsing (no services needed) |
| `npm run test:integration` | Payment service and callback endpoint against local Supabase (skips if it isn't running) |
| `npm run test:db` | Resets the local DB, then runs SQL tests for the order lifecycle and RLS |
| `npm run test:e2e` | Playwright: browse, cart, checkout, M-Pesa, account, admin (desktop + mobile) |
| `npm run check` | lint + typecheck + unit tests + build |
| `npm run db:types` | Regenerates `src/types/database.ts` from the local schema |
| `npm run db:seed:generate` | Regenerates `supabase/seed.sql` and placeholder product art |

### End-to-end tests

E2E runs against a running server backed by local Supabase. For a production-like run:

```bash
npm run build
set -a; . ./.env.local; set +a
MPESA_ALLOW_MOCK=true node .next/standalone/server.js &   # mock payments in a production build
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Without `E2E_BASE_URL`, Playwright starts `npm run dev` itself. If Chromium lives somewhere
non-standard, set `PLAYWRIGHT_CHROMIUM_PATH`.

## Things to fill in before launch

The seed and reference data deliberately leave these blank rather than invent them:

- Business phone, WhatsApp, email and street address (Admin, Settings, Business), and
  `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- M-Pesa Paybill/Till and Daraja credentials (see [docs/PAYMENTS.md](docs/PAYMENTS.md)).
- Bank transfer details, if you offer it (Admin, Settings, Payments).
- Delivery fees: the seeded zones are examples (Admin, Settings, Delivery zones).
- Legal pages (privacy, terms, returns, warranty, delivery): the seeded text is a neutral draft.
  Until someone ticks "Reviewed" in Admin, Settings, Content pages, each page is `noindex` and
  left out of the sitemap. Have them written or checked by someone qualified first.
- Real product photos. The seeded catalogue uses original placeholder drawings; do not use
  manufacturer images unless you have the rights to them.
