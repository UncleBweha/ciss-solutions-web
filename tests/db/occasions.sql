-- Occasions: the public sees enabled occasions and the theme mode but cannot change
-- them; staff with content.manage can. Runs inside a transaction that is rolled back.
-- Usage: npm run test:db
\set ON_ERROR_STOP on
begin;

-- A disabled occasion to hide from the public.
update occasions set is_enabled = false where slug = 'halloween';

-- 1. Anonymous visitors: enabled occasions only, read-only ---------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare v_count int;
begin
  assert (select count(*) from occasions) > 15, 'public reads the enabled occasions';
  assert not exists (select 1 from occasions where slug = 'halloween'), 'public cannot see a disabled occasion';
  assert (select mode from site_theme_override) = 'auto', 'public reads the theme mode';
  begin
    insert into occasions (slug, name, kind, start_month, start_day, end_month, end_day, banner_headline)
    values ('anon-day', 'Anon Day', 'international', 1, 1, 1, 1, 'Hi');
    raise exception 'anon could add an occasion';
  exception when insufficient_privilege then null;
  end;
  update site_theme_override set mode = 'off';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'anon cannot change the theme mode';
end $$;
reset role;

-- 2. A signed-in customer: no writes either ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true);
do $$
declare v_count int;
begin
  update occasions set banner_headline = 'Hacked' where slug = 'christmas';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'customer cannot edit an occasion';
  update site_theme_override set mode = 'off';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'customer cannot change the theme mode';
  assert not exists (select 1 from occasions where slug = 'halloween'), 'customer cannot see a disabled occasion';
end $$;
reset role;

-- 3. Staff (super admin, has content.manage): full control ---------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true);
do $$
begin
  assert exists (select 1 from occasions where slug = 'halloween'), 'staff see disabled occasions';
  insert into occasions (slug, name, kind, start_month, start_day, end_month, end_day, banner_headline)
  values ('shop-anniversary', 'Shop Anniversary', 'international', 3, 1, 3, 1, 'Happy Anniversary');
  update site_theme_override set mode = 'forced', forced_occasion_slug = 'shop-anniversary';
  assert (select mode from site_theme_override) = 'forced', 'staff can force an occasion on';
  delete from occasions where slug = 'shop-anniversary';
  assert (select forced_occasion_slug from site_theme_override) is null, 'deleting the forced occasion clears it';
  begin
    insert into occasions (slug, name, kind, start_month, start_day, end_month, end_day, banner_headline, accent_color)
    values ('bad-colour', 'Bad Colour', 'international', 1, 1, 1, 1, 'Hi', 'red');
    raise exception 'an invalid colour was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;

do $$ begin raise notice 'occasions: all assertions passed'; end $$;
rollback;
