-- Occasions: the store dressed for Kenyan national days, holidays and seasons
-- (Christmas, Mashujaa Day, Eid, Back to School...). Ported from the Toolsman
-- store. Admin, Settings, Occasions edits them; src/lib/occasions reads them.
--
-- Dates recur every year as month/day pairs. Fixed-date occasions never need
-- upkeep. Movable ones are re-dated by the daily sync (/api/cron/sync-occasion-dates):
--   calendar_source + calendar_*_event_name: read from Google's public holiday
--     calendars (Kenya, India) - Easter, Ramadan, both Eids, Diwali, Mazingira Day;
--   date_formula: worked out by rule - Mother's Day (2nd Sunday of May), Father's
--     Day (3rd Sunday of June), Customer Service Week (first full week of October).
--
-- site_theme_override is a single row: follow the calendar (auto), force one
-- occasion on for everyone (also how staff preview one), or switch theming off.

create table public.occasions (
  id                         uuid primary key default gen_random_uuid(),
  slug                       text not null unique,
  name                       text not null check (char_length(name) between 2 and 80),
  kind                       text not null check (kind in ('kenyan_national', 'international', 'religious')),
  start_month                int not null check (start_month between 1 and 12),
  start_day                  int not null check (start_day between 1 and 31),
  end_month                  int not null check (end_month between 1 and 12),
  end_day                    int not null check (end_day between 1 and 31),
  decoration                 text not null default 'none' check (decoration in (
                               'snow_lights_tree', 'fireworks_confetti', 'flag_bunting', 'hearts',
                               'flowers_hearts', 'crescent_lanterns', 'diwali_lights', 'none')),
  accent_color               text not null default '#1d6fd8' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  banner_headline            text not null check (char_length(banner_headline) between 2 and 120),
  banner_subhead             text check (char_length(banner_subhead) <= 300),
  -- A word or two matched in product names and categories to put those products
  -- first among the occasion's picks (for example "photo" or "toner").
  pick_keyword               text check (char_length(pick_keyword) <= 60),
  is_enabled                 boolean not null default true,
  sort_order                 int not null default 0,
  calendar_source            text check (calendar_source in ('kenya', 'indian')),
  calendar_start_event_name  text,
  calendar_end_event_name    text,
  date_formula               text check (date_formula in ('mothers_day', 'fathers_day', 'customer_service_week')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger occasions_updated_at before update on public.occasions
  for each row execute function public.set_updated_at();

create table public.site_theme_override (
  id                    boolean primary key default true check (id),
  mode                  text not null default 'auto' check (mode in ('auto', 'forced', 'off')),
  forced_occasion_slug  text references public.occasions (slug) on update cascade on delete set null,
  updated_at            timestamptz not null default now()
);

create trigger site_theme_override_updated_at before update on public.site_theme_override
  for each row execute function public.set_updated_at();

alter table public.occasions enable row level security;
alter table public.site_theme_override enable row level security;

create policy "occasions: public read enabled" on public.occasions
  for select using (is_enabled or public.has_permission('content.manage'));
create policy "occasions: staff write" on public.occasions
  for all using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy "site_theme_override: public read" on public.site_theme_override
  for select using (true);
create policy "site_theme_override: staff update" on public.site_theme_override
  for update using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

grant select on public.occasions, public.site_theme_override to anon, authenticated;
grant insert, update, delete on public.occasions to authenticated;
grant update on public.site_theme_override to authenticated;

insert into public.site_theme_override (id, mode) values (true, 'auto');

-- ---- The occasions -------------------------------------------------------------
-- Subheads are left empty where the theme's own message reads better on the poster.

insert into public.occasions
  (slug, name, kind, start_month, start_day, end_month, end_day, decoration, accent_color,
   banner_headline, banner_subhead, pick_keyword, sort_order,
   calendar_source, calendar_start_event_name, calendar_end_event_name, date_formula)
values
  -- Kenyan national days
  ('labour-day', 'Labour Day', 'kenyan_national', 5, 1, 5, 1, 'flag_bunting', '#1a1a1a',
   'Happy Labour Day', null, null, 60, null, null, null, null),
  ('madaraka-day', 'Madaraka Day', 'kenyan_national', 6, 1, 6, 1, 'flag_bunting', '#1a1a1a',
   'Happy Madaraka Day', null, null, 60, null, null, null, null),
  ('mazingira-day', 'Mazingira Day', 'kenyan_national', 10, 10, 10, 10, 'flag_bunting', '#1f5a24',
   'Happy Mazingira Day', null, null, 60, 'kenya', 'Mazingira Day', null, null),
  ('mashujaa-day', 'Mashujaa Day', 'kenyan_national', 10, 20, 10, 20, 'flag_bunting', '#1a1a1a',
   'Happy Mashujaa Day', null, null, 60, null, null, null, null),
  ('jamhuri-day', 'Jamhuri Day', 'kenyan_national', 12, 12, 12, 12, 'flag_bunting', '#1a1a1a',
   'Happy Jamhuri Day', null, null, 60, null, null, null, null),

  -- International and widely celebrated
  ('christmas', 'Christmas', 'international', 12, 15, 12, 30, 'snow_lights_tree', '#c8102e',
   'Merry Christmas', null, null, 100, null, null, null, null),
  ('new-year', 'New Year', 'international', 12, 31, 1, 2, 'fireworks_confetti', '#1d6fd8',
   'Happy New Year!', null, null, 90, null, null, null, null),
  ('back-to-school', 'Back to School', 'international', 1, 3, 1, 10, 'none', '#173a7a',
   'Welcome Back to School', null, null, 60, null, null, null, null),
  ('valentines-day', 'Valentine''s Day', 'international', 2, 12, 2, 14, 'hearts', '#e0342a',
   'Happy Valentine''s Day', null, 'photo', 80, null, null, null, null),
  ('international-womens-day', 'International Women''s Day', 'international', 3, 8, 3, 8, 'none', '#7b2cbf',
   'Happy International Women''s Day', null, null, 45, null, null, null, null),
  ('mothers-day', 'Mother''s Day', 'international', 5, 10, 5, 10, 'flowers_hearts', '#c2185b',
   'Happy Mother''s Day', null, 'photo', 70, null, null, null, 'mothers_day'),
  ('fathers-day', 'Father''s Day', 'international', 6, 21, 6, 21, 'flowers_hearts', '#173562',
   'Happy Father''s Day', null, null, 70, null, null, null, 'fathers_day'),
  ('girlfriends-day', 'Girlfriend''s Day', 'international', 8, 1, 8, 1, 'hearts', '#d6336c',
   'Happy Girlfriend''s Day', null, 'photo', 45, null, null, null, null),
  ('customer-service-week', 'Customer Service Week', 'international', 10, 5, 10, 9, 'none', '#1d6fd8',
   'Customer Service Week: thank you for shopping with us', null, null, 0, null, null, null, 'customer_service_week'),
  ('halloween', 'Halloween', 'international', 10, 31, 10, 31, 'none', '#f26100',
   'Happy Halloween', null, null, 40, null, null, null, null),

  -- Religious observances (movable dates follow Google's holiday calendars)
  ('ramadan', 'Ramadan', 'religious', 2, 17, 3, 18, 'crescent_lanterns', '#0f6b3f',
   'Ramadan Kareem', null, null, 50, 'kenya', 'Ramadan Start', 'Idd ul-Fitr', null),
  ('eid-al-fitr', 'Eid al-Fitr', 'religious', 3, 20, 3, 20, 'crescent_lanterns', '#c9a227',
   'Eid Mubarak', null, null, 55, 'kenya', 'Idd ul-Fitr', null, null),
  ('eid-al-adha', 'Eid al-Adha', 'religious', 5, 27, 5, 27, 'crescent_lanterns', '#c9a227',
   'Eid Mubarak', null, null, 55, 'kenya', 'Eid al-Adha', null, null),
  ('easter', 'Easter', 'religious', 4, 3, 4, 6, 'none', '#7c3aed',
   'Happy Easter', null, null, 55, 'kenya', 'Good Friday', 'Easter Monday', null),
  ('diwali', 'Diwali', 'religious', 11, 8, 11, 8, 'diwali_lights', '#c9a227',
   'Happy Diwali', null, null, 55, 'indian', 'Diwali', null, null);
