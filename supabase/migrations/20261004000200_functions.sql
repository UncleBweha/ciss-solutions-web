-- CISS Solutions: business functions
-- Everything that must be atomic (stock reservation, payment confirmation, order
-- status transitions) lives here so it runs inside a single transaction.

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()), 'customer'::user_role);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role <> 'customer');
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles pr
     where pr.id = auth.uid()
       and (
         pr.role = 'super_admin'
         or exists (
           select 1 from role_permissions rp
            where rp.role = pr.role and rp.permission = p_permission
         )
       )
  );
$$;

-- True for the server's service-role client (webhooks, checkout) and for direct
-- admin database sessions that have not assumed an API role (migrations, seed).
-- Uses the JWT role, session_user and the role GUC, never current_user, which is
-- the function owner inside SECURITY DEFINER code.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (session_user in ('postgres', 'supabase_admin')
          and coalesce(current_setting('role', true), 'none') in ('none', 'postgres', 'supabase_admin'));
$$;

-- Customers may edit their own profile but never their role.
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
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Catalogue helpers
-- ---------------------------------------------------------------------------
create or replace function public.category_descendant_ids(p_category_id uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  with recursive tree as (
    select id from categories where id = p_category_id
    union all
    select c.id from categories c join tree t on c.parent_id = t.id
  )
  select coalesce(array_agg(id), '{}') from tree;
$$;

-- Product cards for listings (security invoker: RLS hides inactive products).
create view public.product_cards with (security_invoker = on) as
  select p.id, p.name, p.slug, p.sku, p.product_type, p.short_description, p.part_number,
         p.price, p.compare_at_price, p.discount_percent,
         -- products sold by variant: availability is the sum over active variants
         case when v.variant_count > 0 then v.available else p.available_quantity end as available_quantity,
         p.low_stock_threshold,
         p.is_featured, p.is_bestseller, p.is_new, p.is_on_sale, p.rating_avg, p.rating_count,
         p.sales_count, p.created_at, p.status, p.brand_id, p.category_id,
         b.name as brand_name, b.slug as brand_slug,
         c.name as category_name, c.slug as category_slug,
         img.url as image_url, img.alt_text as image_alt,
         v.variant_count > 0 as has_variants
    from products p
    left join lateral (
      select count(*)::int as variant_count, coalesce(sum(greatest(pv.available_quantity, 0)), 0)::int as available
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ) v on true
    left join brands b on b.id = p.brand_id
    left join categories c on c.id = p.category_id
    left join lateral (
      select i.url, i.alt_text from product_images i
       where i.product_id = p.id
       order by i.is_primary desc, i.sort_order
       limit 1
    ) img on true;

-- Turn free text into a prefix tsquery: "hp m404" -> 'hp':* & 'm404':*
create or replace function public.to_prefix_tsquery(p_query text)
returns tsquery
language sql
immutable
as $$
  select case
    when coalesce(trim(p_query), '') = '' then null
    else to_tsquery('simple',
      array_to_string(
        array(
          select quote_literal(t) || ':*'
            from unnest(regexp_split_to_array(lower(regexp_replace(p_query, '[^[:alnum:]]+', ' ', 'g')), '\s+')) t
           where t <> ''
        ), ' & '))
  end;
$$;

-- Catalogue search/filter used by /shop, /search, category and brand pages.
-- Returns { total, items: [...product_cards] }.
create or replace function public.catalog_search(
  p_query text default null,
  p_category_slug text default null,
  p_brand_slugs text[] default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_in_stock boolean default false,
  p_min_rating numeric default null,
  p_on_sale boolean default false,
  p_product_types public.product_type[] default null,
  p_printer_model_id uuid default null,
  p_sort text default 'featured',
  p_limit int default 24,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_category_ids uuid[];
  v_tsquery tsquery := public.to_prefix_tsquery(p_query);
  v_like text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
  v_result jsonb;
begin
  if p_category_slug is not null then
    select public.category_descendant_ids(id) into v_category_ids from categories where slug = p_category_slug;
    if v_category_ids is null then
      return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
    end if;
  end if;

  with matched as (
    select pc.*,
           case when v_tsquery is null then 0
                else ts_rank(p.search_vector, v_tsquery)
                     + case when lower(p.sku) = lower(trim(p_query))
                              or lower(coalesce(p.part_number, '')) = lower(trim(p_query)) then 10 else 0 end
           end as rank
      from product_cards pc
      join products p on p.id = pc.id
     where pc.status = 'active'
       and (v_tsquery is null
            or p.search_vector @@ v_tsquery
            or lower(p.name || ' ' || p.sku || ' ' || p.search_text) like v_like)
       and (v_category_ids is null or pc.category_id = any (v_category_ids))
       and (p_brand_slugs is null or cardinality(p_brand_slugs) = 0 or pc.brand_slug = any (p_brand_slugs))
       and (p_min_price is null or pc.price >= p_min_price)
       and (p_max_price is null or pc.price <= p_max_price)
       and (not p_in_stock or pc.available_quantity > 0)
       and (p_min_rating is null or pc.rating_avg >= p_min_rating)
       and (not p_on_sale or pc.discount_percent > 0 or pc.is_on_sale)
       and (p_product_types is null or cardinality(p_product_types) = 0 or pc.product_type = any (p_product_types))
       and (p_printer_model_id is null
            or exists (select 1 from product_compatibility c
                        where c.product_id = pc.id and c.printer_model_id = p_printer_model_id)
            or p.printer_model_id = p_printer_model_id)
  ),
  page as (
    select m.*, row_number() over (
             order by
               case when p_sort = 'relevance' or (p_sort = 'featured' and v_tsquery is not null) then m.rank end desc nulls last,
               case when p_sort = 'featured' then m.is_featured end desc,
               case when p_sort = 'featured' then m.is_bestseller end desc,
               case when p_sort = 'price-asc' then m.price end asc,
               case when p_sort = 'price-desc' then m.price end desc,
               case when p_sort = 'best-selling' then m.sales_count end desc,
               case when p_sort = 'rating' then m.rating_avg end desc,
               case when p_sort = 'discount' then m.discount_percent end desc,
               m.created_at desc,
               m.id
           ) as rn
      from matched m
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'items', coalesce((
      select jsonb_agg(to_jsonb(pg) - 'rn' - 'rank' - 'status' order by pg.rn)
        from page pg
       where pg.rn > greatest(0, p_offset)
         and pg.rn <= greatest(0, p_offset) + greatest(1, least(p_limit, 100))
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Called by the server with the service role.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits int;
begin
  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Africa/Nairobi')::date;
  v_next int;
begin
  insert into order_number_counters as c (day, last_value) values (v_day, 1)
  on conflict (day) do update set last_value = c.last_value + 1
  returning last_value into v_next;
  return 'CISS-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.notify_admin(p_kind text, p_subject text, p_payload jsonb, p_order_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (channel, kind, subject, payload, status, order_id)
  values ('admin', p_kind, p_subject, coalesce(p_payload, '{}'::jsonb), 'sent', p_order_id);
$$;

-- Place an order. Amounts are calculated by the server (src/lib/ecommerce) from
-- database prices; this function re-checks stock and coupon limits atomically and
-- reserves stock. Raises INSUFFICIENT_STOCK / COUPON_* errors that the server maps
-- to customer-facing messages.
--
-- p_order: { user_id, customer_name, customer_email, customer_phone, payment_method,
--   subtotal, discount, delivery_fee, total, coupon_id, coupon_code, delivery_zone_id,
--   delivery_zone_name, delivery_county, delivery_town, delivery_address,
--   delivery_instructions, customer_notes, reservation_minutes,
--   items: [{ product_id, variant_id, product_name, variant_name, sku, image_url, quantity, unit_price }] }
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

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'access_token', v_access_token);
end;
$$;

-- Return reserved stock to the shelf (order abandoned/cancelled before payment).
create or replace function public.release_order_reservation(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.stock_state <> 'reserved' then
    return false;
  end if;
  for v_item in select * from order_items where order_id = p_order_id loop
    if v_item.variant_id is not null then
      update product_variants set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
       where id = v_item.variant_id;
    elsif v_item.product_id is not null then
      update products set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
       where id = v_item.product_id;
    end if;
  end loop;
  update orders set stock_state = 'released' where id = p_order_id;
  return true;
end;
$$;

-- Convert the order's stock into a sale: deduct stock (from the reservation when it
-- is still held, otherwise from available stock) and record inventory history.
create or replace function public.deduct_order_stock(p_order_id uuid, p_actor uuid default null)
returns public.stock_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
  v_prev int;
  v_from_reservation boolean;
  v_ok boolean;
  v_shortage boolean := false;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.stock_state in ('deducted', 'shortage') then
    return v_order.stock_state;
  end if;
  v_from_reservation := v_order.stock_state = 'reserved';

  for v_item in select * from order_items where order_id = p_order_id loop
    v_ok := true;
    if v_item.variant_id is not null then
      select stock_quantity into v_prev from product_variants where id = v_item.variant_id for update;
      if v_from_reservation then
        update product_variants
           set stock_quantity = stock_quantity - v_item.quantity,
               reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
         where id = v_item.variant_id;
      else
        update product_variants set stock_quantity = stock_quantity - v_item.quantity
         where id = v_item.variant_id and stock_quantity - reserved_quantity >= v_item.quantity;
        v_ok := found;
      end if;
    elsif v_item.product_id is not null then
      select stock_quantity into v_prev from products where id = v_item.product_id for update;
      if v_from_reservation then
        update products
           set stock_quantity = stock_quantity - v_item.quantity,
               reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
         where id = v_item.product_id;
      else
        update products set stock_quantity = stock_quantity - v_item.quantity
         where id = v_item.product_id and stock_quantity - reserved_quantity >= v_item.quantity;
        v_ok := found;
      end if;
    else
      continue; -- product deleted since the order was placed
    end if;

    if v_ok then
      insert into inventory_transactions (product_id, variant_id, previous_quantity, change, new_quantity,
                                          reason, reference, user_id)
      values (v_item.product_id, v_item.variant_id, v_prev, -v_item.quantity, v_prev - v_item.quantity,
              'sale', v_order.order_number, p_actor);
      update products set sales_count = sales_count + v_item.quantity where id = v_item.product_id;
    else
      v_shortage := true;
    end if;
  end loop;

  update orders set stock_state = case when v_shortage then 'shortage'::stock_state else 'deducted'::stock_state end,
                    reservation_expires_at = null
   where id = p_order_id;

  if v_shortage then
    perform public.notify_admin('stock_shortage', 'Paid order ' || v_order.order_number || ' has a stock shortage',
      jsonb_build_object('order_number', v_order.order_number), p_order_id);
    return 'shortage';
  end if;
  return 'deducted';
end;
$$;

-- Put deducted stock back (cancelled after the sale was recorded).
create or replace function public.restock_order(p_order_id uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
  v_prev int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.stock_state <> 'deducted' then
    return;
  end if;
  for v_item in select * from order_items where order_id = p_order_id loop
    if v_item.variant_id is not null then
      select stock_quantity into v_prev from product_variants where id = v_item.variant_id for update;
      update product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
    elsif v_item.product_id is not null then
      select stock_quantity into v_prev from products where id = v_item.product_id for update;
      update products set stock_quantity = stock_quantity + v_item.quantity,
                          sales_count = greatest(0, sales_count - v_item.quantity)
       where id = v_item.product_id;
    else
      continue;
    end if;
    insert into inventory_transactions (product_id, variant_id, previous_quantity, change, new_quantity,
                                        reason, reference, user_id)
    values (v_item.product_id, v_item.variant_id, v_prev, v_item.quantity, v_prev + v_item.quantity,
            'order_cancellation', v_order.order_number, p_actor);
  end loop;
  update orders set stock_state = 'restocked' where id = p_order_id;
end;
$$;

-- Idempotent payment confirmation. Called by the M-Pesa callback / status check
-- (service role) and by staff marking a manual payment as received.
-- Returns { status: 'confirmed' | 'already_paid' | 'amount_mismatch', order_id, order_number }.
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_transaction_reference text,
  p_amount numeric,
  p_raw jsonb default null,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments%rowtype;
  v_order orders%rowtype;
  v_stock stock_state;
begin
  if not public.is_service_role() and not public.has_permission('orders.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from orders where id = v_payment.order_id for update;

  if v_payment.status = 'PAID' then
    return jsonb_build_object('status', 'already_paid', 'order_id', v_order.id, 'order_number', v_order.order_number);
  end if;

  -- Amount must cover the order total; a short payment is recorded but not accepted.
  if p_amount is null or p_amount < v_order.total then
    update payments
       set status = 'FAILED', result_description = 'Amount mismatch: received ' || coalesce(p_amount::text, 'null'),
           transaction_reference = coalesce(p_transaction_reference, transaction_reference),
           raw_response = coalesce(p_raw, raw_response)
     where id = p_payment_id;
    perform public.notify_admin('payment_failed', 'Payment amount mismatch on ' || v_order.order_number,
      jsonb_build_object('order_number', v_order.order_number, 'expected', v_order.total, 'received', p_amount),
      v_order.id);
    insert into audit_logs (actor_id, action, resource, resource_id, after)
    values (p_actor, 'payment.amount_mismatch', 'payments', p_payment_id::text,
            jsonb_build_object('expected', v_order.total, 'received', p_amount, 'reference', p_transaction_reference));
    return jsonb_build_object('status', 'amount_mismatch', 'order_id', v_order.id, 'order_number', v_order.order_number);
  end if;

  update payments
     set status = 'PAID', transaction_reference = coalesce(p_transaction_reference, transaction_reference),
         amount = p_amount, raw_response = coalesce(p_raw, raw_response), paid_at = now(),
         result_code = coalesce(result_code, '0')
   where id = p_payment_id;

  -- A paid order never stays reserved/pending; cancelled or failed orders that get a
  -- late payment are revived so staff can fulfil (or refund) them.
  v_stock := public.deduct_order_stock(v_order.id, p_actor);

  update orders
     set payment_status = 'PAID', paid_at = now(),
         order_status = case when order_status in ('PENDING', 'PAYMENT_PENDING', 'FAILED', 'CANCELLED') then 'PAID'::order_status
                             else order_status end
   where id = v_order.id;

  insert into order_status_history (order_id, status, note, changed_by)
  values (v_order.id, 'PAID', 'Payment confirmed' || coalesce(' (' || p_transaction_reference || ')', ''), p_actor);

  insert into audit_logs (actor_id, action, resource, resource_id, after)
  values (p_actor, 'payment.confirmed', 'payments', p_payment_id::text,
          jsonb_build_object('order_number', v_order.order_number, 'amount', p_amount,
                             'reference', p_transaction_reference, 'stock', v_stock));

  return jsonb_build_object('status', 'confirmed', 'order_id', v_order.id, 'order_number', v_order.order_number,
                            'stock', v_stock);
end;
$$;

-- Idempotent payment failure. The order stays PAYMENT_PENDING so the customer can
-- retry until the reservation expires.
create or replace function public.fail_payment(
  p_payment_id uuid,
  p_result_code text,
  p_description text,
  p_raw jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments%rowtype;
  v_order orders%rowtype;
begin
  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED', 'REFUNDED') then
    return jsonb_build_object('status', 'unchanged', 'payment_status', v_payment.status);
  end if;
  select * into v_order from orders where id = v_payment.order_id;

  update payments
     set status = case when p_result_code = '1032' then 'CANCELLED'::payment_status else 'FAILED'::payment_status end,
         result_code = p_result_code, result_description = p_description, raw_response = coalesce(p_raw, raw_response)
   where id = p_payment_id;

  update orders set payment_status = 'FAILED'
   where id = v_order.id and payment_status <> 'PAID';

  perform public.notify_admin('payment_failed', 'Payment failed for ' || v_order.order_number,
    jsonb_build_object('order_number', v_order.order_number, 'code', p_result_code, 'reason', p_description),
    v_order.id);

  return jsonb_build_object('status', 'failed', 'order_id', v_order.id);
end;
$$;

-- Release holds on unpaid orders whose reservation window has passed.
create or replace function public.expire_stale_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count int := 0;
begin
  for v_order in
    select id from orders
     where stock_state = 'reserved'
       and payment_status <> 'PAID'
       and reservation_expires_at is not null
       and reservation_expires_at < now()
     for update skip locked
  loop
    perform public.release_order_reservation(v_order.id);
    update orders set order_status = 'FAILED',
                      payment_status = case when payment_status in ('PENDING', 'PROCESSING') then 'CANCELLED'::payment_status else payment_status end
     where id = v_order.id;
    update payments set status = 'CANCELLED', result_description = coalesce(result_description, 'Expired')
     where order_id = v_order.id and status in ('PENDING', 'PROCESSING');
    insert into order_status_history (order_id, status, note)
    values (v_order.id, 'FAILED', 'Payment not completed in time; stock released');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Staff order status changes with transition rules and stock side effects.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_actor uuid := auth.uid();
  v_allowed order_status[];
begin
  if not public.is_service_role() and not public.has_permission('orders.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status = 'REFUNDED' and not public.is_service_role() and not public.has_permission('orders.refund') then
    raise exception 'Not allowed to refund' using errcode = '42501';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_allowed := case v_order.order_status
    when 'PENDING' then array['PROCESSING', 'CANCELLED', 'PAID']::order_status[]
    when 'PAYMENT_PENDING' then array['CANCELLED', 'FAILED']::order_status[]
    when 'PAID' then array['PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'PROCESSING' then array['READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'READY_FOR_DISPATCH' then array['SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'SHIPPED' then array['DELIVERED', 'REFUNDED']::order_status[]
    when 'DELIVERED' then array['REFUNDED']::order_status[]
    when 'FAILED' then array['CANCELLED']::order_status[]
    else array[]::order_status[]
  end;

  if not (p_status = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION:% -> %', v_order.order_status, p_status;
  end if;

  if p_status = 'PAID' and v_order.payment_method not in ('bank_transfer', 'cash_on_delivery') then
    raise exception 'INVALID_TRANSITION:online payments are confirmed by the payment provider';
  end if;

  if p_status in ('CANCELLED', 'FAILED') then
    perform public.release_order_reservation(p_order_id);
    perform public.restock_order(p_order_id, v_actor);
    update payments set status = 'CANCELLED' where order_id = p_order_id and status in ('PENDING', 'PROCESSING');
    update orders set payment_status = case when payment_status = 'PAID' then payment_status else 'CANCELLED'::payment_status end
     where id = p_order_id;
  end if;

  if p_status = 'REFUNDED' then
    update orders set payment_status = 'REFUNDED' where id = p_order_id;
    update payments set status = 'REFUNDED' where order_id = p_order_id and status = 'PAID';
  end if;

  -- Fulfilment moves stock from reserved to sold for manual payment methods.
  if p_status in ('PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED') and v_order.stock_state = 'reserved' then
    perform public.deduct_order_stock(p_order_id, v_actor);
  end if;

  -- Cash on delivery is paid on delivery.
  if p_status = 'DELIVERED' and v_order.payment_method = 'cash_on_delivery' and v_order.payment_status <> 'PAID' then
    update orders set payment_status = 'PAID', paid_at = now() where id = p_order_id;
  end if;

  update orders set order_status = p_status where id = p_order_id;

  -- Manual "mark paid" for bank transfer / COD.
  if p_status = 'PAID' then
    perform public.deduct_order_stock(p_order_id, v_actor);
    update orders set payment_status = 'PAID', paid_at = now() where id = p_order_id;
    insert into payments (order_id, method, provider, status, amount, paid_at, result_description)
    values (p_order_id, v_order.payment_method, 'manual', 'PAID', v_order.total, now(), coalesce(p_note, 'Marked paid by staff'));
  end if;

  insert into order_status_history (order_id, status, note, changed_by)
  values (p_order_id, p_status, p_note, v_actor);

  insert into audit_logs (actor_id, action, resource, resource_id, before, after)
  values (v_actor, 'order.status_changed', 'orders', p_order_id::text,
          jsonb_build_object('order_status', v_order.order_status, 'payment_status', v_order.payment_status),
          jsonb_build_object('order_status', p_status, 'note', p_note));

  return jsonb_build_object('order_id', p_order_id, 'from', v_order.order_status, 'to', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventory adjustments (staff)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_variant_id uuid,
  p_change int,
  p_reason public.inventory_reason,
  p_note text default null,
  p_reference text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev int;
  v_reserved int;
  v_new int;
begin
  if not public.is_service_role()
     and not public.has_permission('inventory.manage')
     and not public.has_permission('products.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_reason in ('sale', 'order_cancellation') then
    raise exception 'Use order workflows for sales and cancellations';
  end if;

  if p_variant_id is not null then
    select stock_quantity, reserved_quantity into v_prev, v_reserved
      from product_variants where id = p_variant_id and product_id = p_product_id for update;
  else
    select stock_quantity, reserved_quantity into v_prev, v_reserved
      from products where id = p_product_id for update;
  end if;
  if v_prev is null then
    raise exception 'NOT_FOUND';
  end if;

  v_new := v_prev + p_change;
  if v_new < v_reserved then
    raise exception 'STOCK_BELOW_RESERVED:%', v_reserved;
  end if;

  if p_variant_id is not null then
    update product_variants set stock_quantity = v_new where id = p_variant_id;
  else
    update products set stock_quantity = v_new where id = p_product_id;
  end if;

  insert into inventory_transactions (product_id, variant_id, previous_quantity, change, new_quantity,
                                      reason, reference, note, user_id)
  values (p_product_id, p_variant_id, v_prev, p_change, v_new, p_reason, p_reference, p_note, auth.uid());

  return v_new;
end;
$$;

-- Low stock alert when available stock crosses the threshold.
create or replace function public.products_low_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.available_quantity <= new.low_stock_threshold
     and old.available_quantity > old.low_stock_threshold
     and new.status = 'active' then
    perform public.notify_admin('low_stock', 'Low stock: ' || new.name,
      jsonb_build_object('product_id', new.id, 'sku', new.sku, 'available', new.available_quantity));
  end if;
  return null;
end;
$$;

create trigger products_low_stock after update of stock_quantity, reserved_quantity on public.products
  for each row execute function public.products_low_stock_alert();

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create or replace function public.reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role() or public.has_permission('reviews.moderate') then
    return new;
  end if;
  -- Customer writes: always back to moderation, verified flag computed here.
  new.status := 'pending';
  new.admin_note := case when tg_op = 'UPDATE' then old.admin_note else null end;
  new.is_verified_purchase := exists (
    select 1 from orders o join order_items i on i.order_id = o.id
     where o.user_id = new.user_id and i.product_id = new.product_id and o.payment_status = 'PAID'
  );
  if tg_op = 'INSERT' then
    new.author_name := coalesce(nullif(new.author_name, ''),
                                (select split_part(coalesce(full_name, 'Customer'), ' ', 1) from profiles where id = new.user_id));
    perform public.notify_admin('new_review', 'New review awaiting moderation',
      jsonb_build_object('product_id', new.product_id, 'rating', new.rating));
  end if;
  return new;
end;
$$;

create trigger reviews_before_write before insert or update on public.reviews
  for each row execute function public.reviews_before_write();

create or replace function public.reviews_refresh_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update products p
     set rating_avg = coalesce(s.avg, 0), rating_count = coalesce(s.cnt, 0)
    from (select round(avg(rating)::numeric, 2) as avg, count(*)::int as cnt
            from reviews where product_id = v_product and status = 'approved') s
   where p.id = v_product;
  return null;
end;
$$;

create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_rating();

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'today_sales', (select coalesce(sum(total), 0) from orders
                     where payment_status = 'PAID' and (paid_at at time zone 'Africa/Nairobi')::date = v_today),
    'today_orders', (select count(*) from orders where (created_at at time zone 'Africa/Nairobi')::date = v_today),
    'open_orders', (select count(*) from orders where order_status in ('PENDING', 'PAID', 'PROCESSING', 'READY_FOR_DISPATCH')),
    'customers', (select count(*) from profiles where role = 'customer'),
    'products', (select count(*) from products where status = 'active'),
    'low_stock', (select count(*) from inventory where is_low_stock and status = 'active'),
    'pending_payments', (select count(*) from orders where order_status = 'PAYMENT_PENDING'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'sales', coalesce(s.sales, 0), 'orders', coalesce(s.orders, 0)) order by d.day), '[]')
        from generate_series(v_today - (p_days - 1), v_today, interval '1 day') as d(day)
        left join (
          select (created_at at time zone 'Africa/Nairobi')::date as day,
                 sum(total) filter (where payment_status = 'PAID') as sales,
                 count(*) as orders
            from orders
           where created_at >= (v_today - p_days)
           group by 1
        ) s on s.day = d.day::date
    ),
    'top_products', (
      select coalesce(jsonb_agg(t), '[]') from (
        select i.product_name as name, sum(i.quantity)::int as quantity, sum(i.total_price) as revenue
          from order_items i join orders o on o.id = i.order_id
         where o.payment_status = 'PAID' and o.created_at >= now() - make_interval(days => p_days)
         group by i.product_name order by revenue desc limit 5
      ) t
    ),
    'top_categories', (
      select coalesce(jsonb_agg(t), '[]') from (
        select coalesce(c.name, 'Uncategorised') as name, sum(i.total_price) as revenue
          from order_items i
          join orders o on o.id = i.order_id
          left join products p on p.id = i.product_id
          left join categories c on c.id = p.category_id
         where o.payment_status = 'PAID' and o.created_at >= now() - make_interval(days => p_days)
         group by 1 order by revenue desc limit 5
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: server-only functions are not callable from the browser.
-- ---------------------------------------------------------------------------
revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
revoke execute on function public.release_order_reservation(uuid) from public, anon, authenticated;
revoke execute on function public.deduct_order_stock(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.restock_order(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fail_payment(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.generate_order_number() from public, anon, authenticated;
revoke execute on function public.notify_admin(text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid, text, numeric, jsonb, uuid) from public, anon;
revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, uuid, int, public.inventory_reason, text, text) from public, anon;
revoke execute on function public.admin_dashboard_stats(int) from public, anon;

grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.release_order_reservation(uuid) to service_role;
grant execute on function public.deduct_order_stock(uuid, uuid) to service_role;
grant execute on function public.restock_order(uuid, uuid) to service_role;
grant execute on function public.fail_payment(uuid, text, text, jsonb) to service_role;
grant execute on function public.expire_stale_orders() to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.generate_order_number() to service_role;
grant execute on function public.notify_admin(text, text, jsonb, uuid) to service_role;
grant execute on function public.confirm_payment(uuid, text, numeric, jsonb, uuid) to authenticated, service_role;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated, service_role;
grant execute on function public.adjust_stock(uuid, uuid, int, public.inventory_reason, text, text) to authenticated, service_role;
grant execute on function public.admin_dashboard_stats(int) to authenticated, service_role;

-- Active product counts per category (subtree totals are summed in the app).
create view public.category_product_counts with (security_invoker = on) as
  select category_id, count(*)::int as product_count
    from public.products
   where status = 'active' and category_id is not null
   group by category_id;
grant select on public.category_product_counts to anon, authenticated;
