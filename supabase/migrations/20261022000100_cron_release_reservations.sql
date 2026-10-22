-- Calls /api/cron/release-reservations every 5 minutes from the database: Vercel's Hobby
-- plan runs its own crons at most once a day (vercel.json keeps the daily occasion sync).
-- The job sends the site's CRON_SECRET, read from Vault at run time so it is never stored
-- in this file or in cron.job. Store it once (before or after running this):
--   select vault.create_secret('<CRON_SECRET from Vercel>', 'cron_secret');
-- To change it later:
--   select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new>');
-- Until the secret exists the endpoint answers 401 and nothing happens.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running replaces the job instead of adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'ciss-release-reservations';

select cron.schedule(
  'ciss-release-reservations',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://cisssolutions.co.ke/api/cron/release-reservations',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
