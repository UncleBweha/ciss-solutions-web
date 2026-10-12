-- Security review of 2026-10-07: four gaps that live in the database.
--
-- 1. Staff notes on orders were readable by the customer who owns the order (RLS works
--    per row, and "orders: read own" returns every column). They move to a staff-only
--    table; orders.admin_notes stays as an empty, unwritable column.
-- 2. Moderators' notes on reviews were readable by anyone for approved reviews. Nothing
--    in the app reads them: they are cleared, and the note now goes to the audit log.
-- 3. A customer could change the email on their own profile, which the app uses to find
--    an account (staff promotion, password reset). The email now follows the sign-in
--    account only.
-- 4. Staff with orders.manage could call confirm_payment() themselves and mark an M-Pesa
--    order paid with no money received. Only the server (service role) calls it.

-- 1. Order notes ----------------------------------------------------------------------
create table if not exists public.order_admin_notes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  notes text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.order_admin_notes enable row level security;
drop policy if exists "order_admin_notes: staff" on public.order_admin_notes;
create policy "order_admin_notes: staff" on public.order_admin_notes
  for all using (public.has_permission('orders.manage')) with check (public.has_permission('orders.manage'));
revoke all on public.order_admin_notes from anon;

insert into public.order_admin_notes (order_id, notes)
select id, admin_notes from public.orders where coalesce(admin_notes, '') <> ''
on conflict (order_id) do nothing;

update public.orders set admin_notes = null where admin_notes is not null;
-- The notes were the only column staff could write on orders directly.
revoke update (admin_notes) on public.orders from authenticated;
drop policy if exists "orders: staff notes" on public.orders;
comment on column public.orders.admin_notes is 'Unused since 2026-10-07: staff notes are in order_admin_notes (customers can read their own orders row).';

-- 2. Review notes -----------------------------------------------------------------------
update public.reviews set admin_note = null where admin_note is not null;
comment on column public.reviews.admin_note is 'Unused since 2026-10-07: approved reviews are public rows; the moderation note is in audit_logs.';

-- 3. Profile email ------------------------------------------------------------------------
-- Same function as before, plus: only the server may change a profile's email.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_service_role()
     and not public.has_permission('admins.manage') then
    raise exception 'Not allowed to change roles' using errcode = '42501';
  end if;
  -- Only a super admin can create or demote another super admin.
  if (new.role = 'super_admin' or old.role = 'super_admin')
     and new.role is distinct from old.role
     and not public.is_service_role()
     and public.current_role_name() <> 'super_admin' then
    raise exception 'Only a super admin can change super admin roles' using errcode = '42501';
  end if;
  -- The email identifies the account (staff promotion, password reset): it is whatever the
  -- person signs in with, never something they or staff type into the profile.
  if new.email is distinct from old.email and not public.is_service_role() then
    raise exception 'Not allowed to change the profile email' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4. Payments are confirmed by the server only ----------------------------------------------
revoke execute on function public.confirm_payment(uuid, text, numeric, jsonb, uuid) from authenticated;
