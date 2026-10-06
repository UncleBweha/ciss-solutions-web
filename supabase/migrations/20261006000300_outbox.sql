-- Transactional outbox for order follow-up work (emails, M-Pesa STK push).
--
-- Tasks are written in the same transaction as the change that causes them:
--   order_placed     place_order()                         -> order confirmation + staff alert
--   mpesa_stk_push   place_order() for M-Pesa orders        -> STK push to the checkout phone
--   payment_confirmed orders.payment_status -> PAID (online) -> payment receipt + staff alert
--   order_status     staff status change (processing ... refunded) -> customer update
-- The app runs tasks straight away and the cron job sweeps up anything left over
-- (claim_outbox / complete_outbox / fail_outbox). Failed tasks back off and retry;
-- after max_attempts they are marked 'dead' and staff get an admin notification.

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('order_placed', 'mpesa_stk_push', 'payment_confirmed', 'order_status')),
  order_id uuid references public.orders (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'done', 'dead')),
  attempts int not null default 0,
  max_attempts int not null default 6,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index outbox_due_idx on public.outbox (next_attempt_at) where status in ('pending', 'failed');
create index outbox_processing_idx on public.outbox (locked_until) where status = 'processing';
create index outbox_order_idx on public.outbox (order_id);

alter table public.outbox enable row level security;
-- Written and processed by the server (service role). Staff may read it.
create policy "outbox: staff read" on public.outbox
  for select using (public.has_permission('orders.manage'));

create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_access_token uuid;
  v_item jsonb;
  v_qty int;
  v_updated int;
  v_coupon coupons%rowtype;
  v_customer_uses int;
  v_minutes int := nullif(p_order ->> 'reservation_minutes', '')::int;
  v_method payment_method := (p_order ->> 'payment_method')::payment_method;
begin
  if jsonb_array_length(coalesce(p_order -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_order_number := public.generate_order_number();

  insert into orders (
    order_number, user_id, customer_name, customer_email, customer_phone,
    subtotal, discount, delivery_fee, total, payment_method, payment_status, order_status,
    stock_state, reservation_expires_at, coupon_id, coupon_code, delivery_zone_id, delivery_zone_name,
    delivery_county, delivery_town, delivery_address, delivery_instructions, customer_notes
  ) values (
    v_order_number,
    nullif(p_order ->> 'user_id', '')::uuid,
    p_order ->> 'customer_name',
    lower(p_order ->> 'customer_email'),
    p_order ->> 'customer_phone',
    (p_order ->> 'subtotal')::numeric,
    coalesce((p_order ->> 'discount')::numeric, 0),
    coalesce((p_order ->> 'delivery_fee')::numeric, 0),
    (p_order ->> 'total')::numeric,
    v_method,
    'PENDING',
    (case when v_method in ('mpesa', 'card') then 'PAYMENT_PENDING' else 'PENDING' end)::order_status,
    'reserved',
    case when v_minutes is null then null else now() + make_interval(mins => v_minutes) end,
    nullif(p_order ->> 'coupon_id', '')::uuid,
    nullif(p_order ->> 'coupon_code', ''),
    nullif(p_order ->> 'delivery_zone_id', '')::uuid,
    p_order ->> 'delivery_zone_name',
    p_order ->> 'delivery_county',
    p_order ->> 'delivery_town',
    p_order ->> 'delivery_address',
    nullif(p_order ->> 'delivery_instructions', ''),
    nullif(p_order ->> 'customer_notes', '')
  )
  returning id, access_token into v_order_id, v_access_token;

  for v_item in select * from jsonb_array_elements(p_order -> 'items') loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    if nullif(v_item ->> 'variant_id', '') is not null then
      update product_variants
         set reserved_quantity = reserved_quantity + v_qty
       where id = (v_item ->> 'variant_id')::uuid
         and product_id = (v_item ->> 'product_id')::uuid
         and is_active
         and stock_quantity - reserved_quantity >= v_qty;
    else
      update products
         set reserved_quantity = reserved_quantity + v_qty
       where id = (v_item ->> 'product_id')::uuid
         and status = 'active'
         and stock_quantity - reserved_quantity >= v_qty;
    end if;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'INSUFFICIENT_STOCK:%', v_item ->> 'product_name';
    end if;

    insert into order_items (order_id, product_id, variant_id, product_name, variant_name, sku, image_url,
                             quantity, unit_price, total_price)
    values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      nullif(v_item ->> 'variant_id', '')::uuid,
      v_item ->> 'product_name',
      nullif(v_item ->> 'variant_name', ''),
      v_item ->> 'sku',
      nullif(v_item ->> 'image_url', ''),
      v_qty,
      (v_item ->> 'unit_price')::numeric,
      round((v_item ->> 'unit_price')::numeric * v_qty, 2)
    );
  end loop;

  if nullif(p_order ->> 'coupon_id', '') is not null then
    select * into v_coupon from coupons where id = (p_order ->> 'coupon_id')::uuid for update;
    if not found or not v_coupon.is_active then
      raise exception 'COUPON_INVALID';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
      raise exception 'COUPON_EXHAUSTED';
    end if;
    if v_coupon.per_customer_limit is not null then
      select count(*) into v_customer_uses
        from coupon_usage u
       where u.coupon_id = v_coupon.id
         and (
           (nullif(p_order ->> 'user_id', '') is not null and u.user_id = (p_order ->> 'user_id')::uuid)
           or u.customer_phone = p_order ->> 'customer_phone'
           or u.customer_email = lower(p_order ->> 'customer_email')
         );
      if v_customer_uses >= v_coupon.per_customer_limit then
        raise exception 'COUPON_CUSTOMER_LIMIT';
      end if;
    end if;
    insert into coupon_usage (coupon_id, order_id, user_id, customer_phone, customer_email, discount_amount)
    values (v_coupon.id, v_order_id, nullif(p_order ->> 'user_id', '')::uuid, p_order ->> 'customer_phone',
            lower(p_order ->> 'customer_email'), coalesce((p_order ->> 'discount')::numeric, 0));
    update coupons set usage_count = usage_count + 1 where id = v_coupon.id;
  end if;

  insert into order_status_history (order_id, status, note)
  values (v_order_id, case when v_method in ('mpesa', 'card') then 'PAYMENT_PENDING'::order_status else 'PENDING'::order_status end,
          'Order placed');

  perform public.notify_admin('new_order', 'New order ' || v_order_number,
    jsonb_build_object('order_number', v_order_number, 'total', p_order ->> 'total',
                       'payment_method', v_method, 'customer', p_order ->> 'customer_name'),
    v_order_id);

  -- Transactional outbox: follow-up work is committed with the order, so it can't be
  -- lost if the app stops between saving the order and doing the work.
  insert into outbox (kind, order_id) values ('order_placed', v_order_id);
  if v_method = 'mpesa' then
    insert into outbox (kind, order_id, payload)
    values ('mpesa_stk_push', v_order_id,
            jsonb_build_object('phone', coalesce(nullif(p_order ->> 'payment_phone', ''), p_order ->> 'customer_phone')));
  end if;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'access_token', v_access_token);
end;
$$;

-- Payment confirmed (online methods only: manual methods already alerted staff at placement).
create or replace function public.outbox_on_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID'
     and new.payment_method in ('mpesa', 'card') then
    insert into outbox (kind, order_id) values ('payment_confirmed', new.id);
  end if;
  -- Customer emails for status changes made by staff (not automatic expiry).
  if new.order_status is distinct from old.order_status
     and new.order_status in ('PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')
     and public.is_staff() then
    insert into outbox (kind, order_id, payload)
    values ('order_status', new.id, jsonb_build_object('status', new.order_status));
  end if;
  return new;
end;
$$;

create trigger orders_outbox
  after update of payment_status, order_status on public.orders
  for each row execute function public.outbox_on_order_update();

-- Claim due tasks (optionally for one order and/or some kinds). Stuck 'processing'
-- tasks are reclaimed once their lock expires. SKIP LOCKED lets several workers run.
create or replace function public.claim_outbox(p_limit int default 20, p_order_id uuid default null, p_kinds text[] default null)
returns setof public.outbox
language sql
security definer
set search_path = public
as $$
  update outbox o
     set status = 'processing', attempts = o.attempts + 1,
         locked_until = now() + interval '2 minutes', updated_at = now()
   where o.id in (
     select id from outbox
      where ((status in ('pending', 'failed') and next_attempt_at <= now())
             or (status = 'processing' and locked_until < now()))
        and (p_order_id is null or order_id = p_order_id)
        and (p_kinds is null or kind = any (p_kinds))
      order by created_at
      limit greatest(1, least(p_limit, 100))
      for update skip locked)
  returning o.*;
$$;

create or replace function public.complete_outbox(p_id uuid, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update outbox
     set status = 'done', processed_at = now(), locked_until = null, updated_at = now(),
         last_error = coalesce(p_note, last_error)
   where id = p_id;
$$;

-- Back-off: 1, 4, 16, 60, 60 ... minutes. After max_attempts: dead + staff notification.
create or replace function public.fail_outbox(p_id uuid, p_error text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v outbox;
  v_order_number text;
begin
  select * into v from outbox where id = p_id for update;
  if not found then return 'missing'; end if;
  if v.attempts >= v.max_attempts then
    update outbox set status = 'dead', locked_until = null, last_error = left(p_error, 1000), updated_at = now()
     where id = p_id;
    select order_number into v_order_number from orders where id = v.order_id;
    perform notify_admin('outbox_dead',
      'Background task failed: ' || v.kind || coalesce(' for ' || v_order_number, ''),
      jsonb_build_object('task_id', v.id, 'kind', v.kind, 'order_number', v_order_number,
                         'attempts', v.attempts, 'error', left(p_error, 500)),
      v.order_id);
    return 'dead';
  end if;
  update outbox
     set status = 'failed', locked_until = null, last_error = left(p_error, 1000), updated_at = now(),
         next_attempt_at = now() + least(interval '60 minutes', interval '1 minute' * power(4, v.attempts - 1))
   where id = p_id;
  return 'retry';
end;
$$;

revoke execute on function public.claim_outbox(int, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.complete_outbox(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_outbox(uuid, text) from public, anon, authenticated;
revoke execute on function public.outbox_on_order_update() from public, anon, authenticated;
grant execute on function public.claim_outbox(int, uuid, text[]) to service_role;
grant execute on function public.complete_outbox(uuid, text) to service_role;
grant execute on function public.fail_outbox(uuid, text) to service_role;
grant select on public.outbox to authenticated;

-- Changes made after the first migrations: idempotent, for databases created earlier.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.settings set value = jsonb_set(value, '{email}', '"info@cisssolutions.co.ke"')
 where key = 'business' and coalesce(value ->> 'email', '') = '';
update public.settings set value = jsonb_set(value, '{admin_emails}', '["info@cisssolutions.co.ke"]')
 where key = 'notifications' and coalesce(jsonb_array_length(value -> 'admin_emails'), 0) = 0;
