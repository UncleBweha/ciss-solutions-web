# Deployment

Production is three parts: a Supabase project (database, auth, storage), the Next.js app (a
Docker container on the VPS, or Vercel), and a scheduled job that calls the cron endpoint.

The repo also still deploys the static coming-soon page (`deploy.yml` on every push to `main`).
The store deploys separately and only takes over the domain when you switch it (step 4 below), so
you can stage it on the server first.

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
| `MPESA_*` | See [PAYMENTS.md](PAYMENTS.md). `MPESA_ENV=production`, never `mock` |
| `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`, `ADMIN_ALERT_EMAILS` | Transactional email. Order emails are sent from, and new-order alerts always go to, `orders@cisssolutions.co.ke` (`ORDERS_EMAIL` overrides it) |
| `CRON_SECRET` | Long random string (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | e.g. `2547XXXXXXXX` |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Optional |

`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time, so changing them
needs a rebuild. Everything else is read at runtime.

## 3. VPS with Docker (current server)

The server already runs Caddy (container `toolsman-next-caddy-1`, on a Docker network ending in
`web`) and the coming-soon container `ciss-solutions`. The store runs beside them as `ciss-store`.

**One-time setup on the server:**

```bash
sudo mkdir -p /opt/ciss-store
sudo nano /opt/ciss-store/.env        # production values, KEY=value per line
sudo chmod 600 /opt/ciss-store/.env
```

Write values without surrounding quotes (`EMAIL_FROM=CISS Solutions <orders@cisssolutions.co.ke>`):
Docker's `--env-file` keeps quotes literally.

**Deploy** (from your machine, or GitHub Actions → "Deploy store to VPS" → Run workflow):

```bash
deploy/app-deploy.sh user@server [ssh_key]
```

This ships the committed `HEAD` (not uncommitted changes) over one SSH connection, then, on the
server (`deploy/app-remote.sh`):

1. builds the image `ciss-store:<commit>` with the `NEXT_PUBLIC_*` values from the env file as
   build args (the build reads the catalogue from Supabase, so the project must be reachable);
2. replaces the container: `--restart unless-stopped`, `--env-file /opt/ciss-store/.env`, port
   `127.0.0.1:3100` only, and joins Caddy's `web` network;
3. waits for the health check and **rolls back** to the previous image if it fails;
4. installs `/etc/cron.d/ciss-store`, which calls the cron endpoint every 5 minutes;
5. keeps the three most recent images for manual rollback.

Check it on the server before sending traffic: `curl -I http://127.0.0.1:3100/`.

## 4. Switch the domain to the store

```bash
deploy/app-switch.sh user@server app       # cisssolutions.co.ke -> ciss-store:3000
deploy/app-switch.sh user@server static    # back to the coming-soon page
```

This edits only the upstream inside the `# >>> ciss-solutions` block in Caddy's config (created by
`deploy/caddy-add.sh`), validates the config, reloads Caddy, and restores the backup if validation
fails. Later pushes to `main` still redeploy the static container but leave the switch alone.
The GitHub workflow can do the switch too (tick "Point cisssolutions.co.ke at the store").

Once the store is live:

- Set `MPESA_CALLBACK_URL=https://cisssolutions.co.ke/api/mpesa/callback` and redeploy.
- Indexing turns on automatically: `robots.txt` allows crawling only when `NEXT_PUBLIC_SITE_URL`
  is the real domain. Submit `https://cisssolutions.co.ke/sitemap.xml` in Google Search Console.

**Remove the store** (domain back to the coming-soon page, container and cron removed, env and
images kept): `deploy/app-remove.sh user@server`.

**Roll back by hand:** `docker images ciss-store` on the server, then rerun the last
`docker run` from `deploy/app-remote.sh` with the older tag, or check out the older commit
locally and run `app-deploy.sh` again.

**Logs:** `docker logs -f ciss-store`. The app writes one JSON object per line (secrets redacted).

## 5. Vercel (alternative)

1. Import the repository and set all variables from section 2 for the Production environment.
2. Build command `npm run build`, output is detected automatically.
3. Schedule the cron endpoint. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
   automatically. Add a `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/release-reservations", "schedule": "*/10 * * * *" }] }
   ```
   Sub-daily schedules need a paid Vercel plan. On Hobby, use an external scheduler (for
   example a GitHub Actions `schedule` workflow or cron-job.org) that sends the same header.
4. Point the domain's DNS at Vercel and set `MPESA_CALLBACK_URL` accordingly.

## 6. Scheduled job

`GET /api/cron/release-reservations` with `Authorization: Bearer <CRON_SECRET>`:

- queries Safaricom for M-Pesa pushes still awaiting a result (catches lost callbacks);
- cancels unpaid orders past their payment window and releases reserved stock.

Run it every 5–10 minutes. Without it, abandoned M-Pesa orders hold stock until someone opens them.

## 7. Continuous integration

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | every push and pull request | Starts a throwaway local Supabase, then lint, typecheck, unit + integration tests, SQL tests, production build, and the Playwright E2E suite. Needs no secrets. |
| `deploy-app.yml` | manual | Deploys the store to the VPS (section 3), optionally switches the domain |
| `deploy.yml` | push to `main` | Deploys the static coming-soon page (unchanged) |

The deploy workflows use repository secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` and
`VPS_KNOWN_HOSTS` (`deploy/setup-github-secrets.sh` sets them). Production app secrets stay on
the server in `/opt/ciss-store/.env` and are never stored in GitHub.

## Launch checklist

- [ ] Migrations pushed, first super admin created, SMTP configured, Auth rate limits raised
- [ ] Business details, payment methods, delivery zones and fees set in Admin, Settings
- [ ] Legal pages written or reviewed and marked "Reviewed"
- [ ] Real products, prices, stock and photos loaded (Admin, Products, or CSV import)
- [ ] Daraja production credentials; one small real M-Pesa payment tested end to end
- [ ] `MPESA_ALLOW_MOCK` unset; `MPESA_CALLBACK_SECRET` and `CRON_SECRET` set to random values
- [ ] Cron running (`grep ciss-store /var/log/syslog` or the app log `cron.release_reservations`)
- [ ] Domain switched, HTTPS working, sitemap submitted
- [ ] Database backups enabled
