-- The M-Pesa STK push (KCB Buni) is removed. Customers pay by M-Pesa Paybill, bank transfer
-- or cash on delivery, and staff mark those orders paid.
--
-- 1. place_order() no longer accepts M-Pesa (STK) or card orders and no longer queues an STK
--    push. Every new order starts PENDING.
-- 2. STK push tasks still waiting in the outbox are closed without sending anything.
-- 3. confirm_payment() and fail_payment() existed only for the STK callback: dropped.
-- 4. The M-Pesa (STK) toggle and its payment window are removed from the settings.
-- 5. The FAQ stops offering the phone prompt.
--
-- Kept on purpose: the 'mpesa' payment_method value, the 'mpesa_stk_push' outbox kind and
-- the payments table, because earlier orders and their M-Pesa receipts use them.

-- 1. ---------------------------------------------------------------------------------------
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
  if v_method in ('mpesa', 'card') then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE:%', v_method;
  end if;
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
    'PENDING',
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

  -- Reserve: products first (by id), then variants (by id).
  for v_item in
    select e.value
      from jsonb_array_elements(p_order -> 'items') as e(value)
     order by (nullif(e.value ->> 'variant_id', '') is not null),
              coalesce(nullif(e.value ->> 'variant_id', ''), e.value ->> 'product_id')::uuid
  loop
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
  end loop;

  for v_item in select * from jsonb_array_elements(p_order -> 'items') loop
    v_qty := (v_item ->> 'quantity')::int;
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
  values (v_order_id, 'PENDING', 'Order placed');

  perform public.notify_admin('new_order', 'New order ' || v_order_number,
    jsonb_build_object('order_number', v_order_number, 'total', p_order ->> 'total',
                       'payment_method', v_method, 'customer', p_order ->> 'customer_name'),
    v_order_id);

  -- Transactional outbox: follow-up work is committed with the order, so it can't be
  -- lost if the app stops between saving the order and doing the work.
  insert into outbox (kind, order_id) values ('order_placed', v_order_id);

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'access_token', v_access_token);
end;
$$;

-- 2. ---------------------------------------------------------------------------------------
update public.outbox
   set status = 'done', processed_at = now(), locked_until = null, updated_at = now(),
       last_error = 'skipped: M-Pesa STK push removed'
 where kind = 'mpesa_stk_push' and status in ('pending', 'processing', 'failed');

-- 3. ---------------------------------------------------------------------------------------
drop function if exists public.confirm_payment(uuid, text, numeric, jsonb, uuid);
drop function if exists public.fail_payment(uuid, text, text, jsonb);

-- 4. ---------------------------------------------------------------------------------------
update public.settings set value = value - 'mpesa' where key = 'payment_methods';
update public.settings set value = value - 'mpesa_reservation_minutes' where key = 'checkout';

-- 5. ---------------------------------------------------------------------------------------
-- The FAQ no longer offers the phone prompt. Only the original wording is replaced: a page
-- staff have rewritten is left alone.
update public.settings
   set value = jsonb_set(value, '{body}', to_jsonb(replace(regexp_replace(value ->> 'body',
     '- \*\*M-Pesa\.\*\* You get a prompt on your phone and enter your M-Pesa PIN\.[^\n]*\n', ''),
     'Give it a few minutes first. Sometimes the confirmation from Safaricom arrives late. If the status has not changed after 15 minutes, send',
     'We check Paybill payments by hand during working hours, so it can take a little while. If the status has not changed by the next working day, send')))
 where key = 'page:faqs';
