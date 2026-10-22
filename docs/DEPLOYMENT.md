# Deployment

Production is three parts: a Supabase project (database, auth, storage), the Next.js app on
Vercel (Hobby plan, team `ciss-solutions`, project `ciss-solutions-web`), and two scheduled jobs
that call the cron endpoints. The POS is a separate Vercel project (`ciss-solutions-pos`) built
from its own repo and served at `pos.cisssolutions.co.ke`.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to Kenya
   (e.g. `eu-west` or Mumbai `ap-south-1`) and save the database password.
2. Apply the schema (migrations only; the demo seed is never pushed):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. **Authentication → URL configuration**: Site URL `https://cisssolutions.co.ke`; redirect URL
   `https://cisssolutions.co.ke/auth/callback`.
4. **Authentication → Emails**: configure custom SMTP (for example Resend) so sign-up and
   password-reset emails come from your domain and aren't subject to Supabase's low default limit.
   **Authentication → Rate limits**: raise "token refreshes" to 3000 and "sign-ups and sign-ins"
   to 600 per 5 minutes. Auth is called from the store's server, so Supabase sees every customer
   as one IP address; the defaults (150 and 30) lock customers out once a few hundred are signed
   in. The store applies its own per-customer limits.
   **Authentication → Sign In / Providers → Google** (optional): enable it and enter the client
   ID of a Google Cloud OAuth client (type "Web application"). In Google Cloud, set the client's
   authorised JavaScript origin to `https://cisssolutions.co.ke` and its authorised redirect URI
   to `https://cisssolutions.co.ke/auth/google/callback`. The store runs the Google exchange
   itself so that Google's screen says "continue to cisssolutions.co.ke"; put the same client's
   ID and secret in the env file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The
   "Continue with Google" button only appears when both are set.
5. **Project settings → API**: copy the URL, the anon key and the service role key into the env
   file (next section). The service role key is a server secret.
6. Create the first staff account: register on the live site (or **Authentication → Users → Add
   user**), then in the **SQL editor** run:
   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'owner@example.com');
   ```
   Add further staff from Admin, Settings, Staff & roles.
7. Turn on Point-in-Time Recovery or at least daily backups (Pro plan) before taking real orders.

## 2. Environment variables

Every variable is described in [`.env.example`](../.env.example). Production needs:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://cisssolutions.co.ke` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From the Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | From the Supabase project (secret) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional: Google sign-in (section 1, step 4). The secret is a server secret |
| `MPESA_*`, `KCB_*` | See [PAYMENTS.md](PAYMENTS.md). `MPESA_ENV=production`, never `mock`. The `KCB_*` values (including `KCB_BASE_URL` and `KCB_INVOICE_PREFIX`) must be set on Vercel before the code that uses KCB is deployed: without them every M-Pesa checkout fails |
| `TRUSTED_PROXY_HOPS` | Optional, default `1` (Vercel's edge). Set `2` if Cloudflare is put in front of Vercel: rate limits and `MPESA_ALLOWED_IPS` read the visitor's address that many entries from the end of `X-Forwarded-For` |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `ADMIN_ALERT_EMAILS` | Transactional email. `EMAIL_PROVIDER=smtp` sends through a mailbox and needs `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASSWORD`; `EMAIL_PROVIDER=resend` needs `EMAIL_API_KEY`; `log` only writes emails to the server log. Order emails are sent from, and new-order alerts always go to, `orders@cisssolutions.co.ke` (`ORDERS_EMAIL` overrides it) |
| `POS_SUPABASE_URL`, `POS_SUPABASE_KEY`, `POS_SYNC_SECRET` | Optional: registers paid orders as sales in the POS (see [ARCHITECTURE.md](ARCHITECTURE.md), Background work). URL and public (anon / publishable) key of the POS project, and a long random secret (`openssl rand -hex 32`) whose SHA-256 hash is stored in the POS table `integration_keys` under the name `website` |
| `CRON_SECRET` | Long random string (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | e.g. `2547XXXXXXXX` |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Optional |

`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time, so changing them
needs a rebuild. Everything else is read at runtime, but Vercel only applies changed values to new deployments.

## 3. Vercel

The project builds from GitHub: every push to `main` is a production deployment, other branches
get preview deployments. There is nothing to run by hand.

1. **Settings → Environment Variables**: every variable from section 2, for Production (and
   Preview if previews should work). After changing a `NEXT_PUBLIC_*` value, redeploy without the
   build cache.
2. **Settings → Domains**: `cisssolutions.co.ke` serves Production, with no redirect of its own.
   `www.cisssolutions.co.ke` also serves Production; the app's `next.config.ts` redirects it to
   the canonical host from `NEXT_PUBLIC_SITE_URL`. Do not also set a Vercel redirect from the apex
   to `www`: the two redirects loop.
3. **DNS** is at Olitt (app.olitt.com): `@` A `216.198.79.1`, `www` and `pos` CNAME to the values
   Vercel shows (`cname.vercel-dns.com` keeps working). Leave the MX, SPF, DKIM and DMARC records
   alone: they carry the domain's email.
4. Uploads (product images, banners, part-request files) go from the browser straight to Supabase
   Storage, so they are not limited by Vercel's 4.5 MB request body cap.

Once a deployment is live, `robots.txt` allows crawling (only when `NEXT_PUBLIC_SITE_URL` is the
real domain). Submit `https://cisssolutions.co.ke/sitemap.xml` in Google Search Console.

**Roll back:** Deployments → an older production deployment → Promote to Production (or
`vercel promote <url>`).

**Logs:** the project's Logs tab, or `vercel logs`. The app writes one JSON object per line
(secrets redacted).

**`deploy/edge`** is the shared Caddy proxy on the old VPS (169.58.35.158). CISS no longer runs
there; the proxy stays because other sites on that server use it.

## 4. Scheduled jobs

`GET /api/cron/release-reservations` with `Authorization: Bearer <CRON_SECRET>`:

- times out M-Pesa pushes that got no callback, so the customer can retry;
- marks unpaid orders past their payment window Failed and releases reserved stock;
- sends any emails, M-Pesa prompts and POS sales left over in the outbox;
- emails staff the alerts that cannot wait (a payment nobody could match, a customer who paid
  twice, a prompt that never got an answer, a paid order short of stock, a task that gave up).

It runs every 5 minutes from Supabase `pg_cron` (migration
`20261022000100_cron_release_reservations.sql`), because Vercel Hobby crons run at most once a
day. The job reads the secret from Vault; store it once in the SQL editor, with the same value as
`CRON_SECRET` on Vercel:

```sql
select vault.create_secret('<CRON_SECRET from Vercel>', 'cron_secret');
```

Until it matches, the endpoint answers 401 and abandoned M-Pesa orders hold stock until someone
opens them. It answers 500 when one of its steps failed.

`GET /api/cron/sync-occasion-dates` (same header), once a day at 03:17 UTC from Vercel Cron
(`vercel.json`; Vercel sends the header itself): re-dates the movable occasions (Easter, Ramadan,
both Eids, Diwali and Mazingira Day from Google's public holiday calendars; Mother's Day, Father's
Day and Customer Service Week by rule). Without it, staff can press "Sync movable dates now"
under Admin, Settings, Occasions.

**Watching it.** `GET /api/health` answers 200 while the database is reachable, the job above ran
in the last 15 minutes, no background task is overdue or has given up in the last day, and no
M-Pesa prompt has waited more than 15 minutes for a result; otherwise 503, naming the check that
failed. Point an uptime monitor at `https://cisssolutions.co.ke/api/health`: nothing else notices
when the cron job stops.

## 5. Continuous integration

`ci.yml` runs on every push and pull request: it starts a throwaway local Supabase, then lint,
typecheck, unit + integration tests, SQL tests, production build, and the Playwright E2E suite.
It needs no secrets. Deploying is Vercel's job (section 3); production secrets live only in the
Vercel project.

## Launch checklist

- [ ] Migrations pushed, first super admin created, SMTP configured, Auth rate limits raised
- [ ] Business details, payment methods, delivery zones and fees set in Admin, Settings
- [ ] Legal pages written or reviewed and marked "Reviewed"
- [ ] Real products, prices, stock and photos loaded (Admin, Products, or CSV import)
- [ ] KCB Buni production credentials and live host; one small real M-Pesa payment tested end to end
- [ ] `MPESA_ALLOW_MOCK` unset; `MPESA_CALLBACK_SECRET` and `CRON_SECRET` set to random values
- [ ] Vercel has the `KCB_*` values before the KCB code is merged to `main`
- [ ] New migrations applied (`supabase db push`) before the code that needs them is deployed
- [ ] Cron running (`cron_secret` in Vault matches `CRON_SECRET`; `select * from cron.job_run_details order by start_time desc limit 5`)
- [ ] An uptime monitor watches `/api/health`
- [ ] A copy of the production secrets is kept somewhere safe outside Vercel
- [ ] Domain switched, HTTPS working, sitemap submitted
- [ ] Database backups enabled

## Password reset codes

"Forgot password" has three steps on one page: email, the emailed code, then the new password.
Supabase creates the code and checks it; the store emails it through its own mailbox from
`no-reply@cisssolutions.co.ke` (`EMAIL_FROM_NOREPLY` overrides the address). The store refuses a
code older than 15 minutes. Nothing needs to be set in the Supabase dashboard for this.
