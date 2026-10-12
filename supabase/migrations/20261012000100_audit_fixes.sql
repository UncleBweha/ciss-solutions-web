-- Audit of 2026-10-12: fixes that live in the database.
--
-- 1. For one order, locks are now always taken in one order: the order row, then its
--    payment rows, then product rows (by id), then variant rows (by id). Before,
--    confirm_payment() locked the payment and then the order while expiry and staff
--    cancellation did the reverse, and stock rows were locked in whatever order the cart
--    listed them, so two transactions could each wait on the other and one was aborted.
-- 2. A second payment for an order that is already paid is recorded as money received and
--    nothing else: it no longer rewrites paid_at, adds a second "Payment confirmed" entry or
--    revives a cancelled order. confirm_payment() answers duplicate = true for it.
-- 3. A paid order whose stock ran short keeps track of which lines were deducted, so
--    cancelling it puts exactly those back. (Before, nothing was put back.)
-- 4. Staff can record a payment that arrives after a bank transfer or Paybill order expired
--    (FAILED -> PAID), and can refund a paid order that was cancelled (CANCELLED -> REFUNDED),
--    which also voids its sale in the POS.
-- 5. A coupon use is returned when the unpaid order that used it expires or is cancelled.
-- 6. Categories cannot be arranged in a loop, and the search no longer recurses on one.
-- 7. Search treats % and _ as the characters typed, not as wildcards.
-- 8. A background task whose worker died on its last attempt is retired with a staff
--    alert, instead of being picked up again for ever.
-- 9. Indexes for two lookups made on every checkout and every cron run.

-- 3. Which lines of an order have had their stock deducted --------------------------------
alter table public.order_items add column if not exists stock_deducted boolean not null default false;
update public.order_items i set stock_deducted = true
  from public.orders o
 where o.id = i.order_id and o.stock_state = 'deducted' and not i.stock_deducted;

comment on column public.payments.provider is 'mpesa_kcb (KCB Buni), mpesa_mock (development), manual (marked paid by staff). Rows from before 2026-10-09 may say mpesa_daraja.';

-- 1, 5. Orders -----------------------------------------------------------------------------
-- Same as before, except that stock is reserved in a fixed order (products by id, then
-- variants by id) before the lines are saved in the order the customer listed them.
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

-- Return reserved stock to the shelf (order abandoned/cancelled before payment), and give
-- back the coupon use of an order that was never paid.
create or replace function public.release_order_reservation(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
  v_coupon uuid;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.stock_state <> 'reserved' then
    return false;
  end if;
  for v_item in
    select * from order_items where order_id = p_order_id
     order by (variant_id is not null), coalesce(variant_id, product_id)
  loop
    if v_item.variant_id is not null then
      update product_variants set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
       where id = v_item.variant_id;
    elsif v_item.product_id is not null then
      update products set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity)
       where id = v_item.product_id;
    end if;
  end loop;
  update orders set stock_state = 'released' where id = p_order_id;

  if v_order.payment_status <> 'PAID' then
    delete from coupon_usage where order_id = p_order_id returning coupon_id into v_coupon;
    if v_coupon is not null then
      update coupons set usage_count = greatest(0, usage_count - 1) where id = v_coupon;
    end if;
  end if;
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

  -- Every product row this touches (a variant's product too, for its sales count), by id.
  perform 1 from products
    where id in (select product_id from order_items where order_id = p_order_id and product_id is not null)
    order by id
    for update;

  for v_item in
    select * from order_items where order_id = p_order_id
     order by (variant_id is not null), coalesce(variant_id, product_id)
  loop
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
      update order_items set stock_deducted = true where id = v_item.id;
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

-- Put deducted stock back (cancelled after the sale was recorded). After a shortage only
-- the lines that were actually deducted go back.
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
  if v_order.stock_state not in ('deducted', 'shortage') then
    return;
  end if;
  for v_item in
    select * from order_items where order_id = p_order_id and stock_deducted
     order by (variant_id is not null), coalesce(variant_id, product_id)
  loop
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
    update order_items set stock_deducted = false where id = v_item.id;
  end loop;
  update orders set stock_state = 'restocked' where id = p_order_id;
end;
$$;

-- 1, 2. Payments ---------------------------------------------------------------------------
-- Idempotent payment confirmation, called by the server only (the M-Pesa callback).
-- Returns { status: 'confirmed' | 'already_paid' | 'amount_mismatch', order_id, order_number },
-- plus duplicate = true when the order had already been paid by another payment.
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
  v_order_id uuid;
  v_stock stock_state;
begin
  if not public.is_service_role() and not public.has_permission('orders.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- The order first, then the payment: the order every other function locks them in.
  select order_id into v_order_id from payments where id = p_payment_id;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from orders where id = v_order_id for update;
  select * into v_payment from payments where id = p_payment_id for update;

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

  -- The order was already paid by another payment: this money is owed back. It is recorded
  -- on the payment; the order, its stock and its history stay as they are.
  if v_order.payment_status = 'PAID' then
    insert into audit_logs (actor_id, action, resource, resource_id, after)
    values (p_actor, 'payment.duplicate', 'payments', p_payment_id::text,
            jsonb_build_object('order_number', v_order.order_number, 'amount', p_amount,
                               'reference', p_transaction_reference));
    return jsonb_build_object('status', 'confirmed', 'duplicate', true, 'order_id', v_order.id,
                              'order_number', v_order.order_number);
  end if;

  -- A paid order never stays reserved/pending; cancelled or failed orders that get a
  -- late payment are revived so staff can fulfil (or refund) them.
  v_stock := public.deduct_order_stock(v_order.id, p_actor);

  update orders
     set payment_status = 'PAID', paid_at = now(),
         order_status = case when order_status in ('PENDING', 'PAYMENT_PENDING', 'FAILED', 'CANCELLED') then 'PAID'::order_status
                             else order_status end
   where id = v_order.id;

  -- The coupon use was given back when the unpaid order expired: it is used after all.
  if v_order.coupon_id is not null and not exists (select 1 from coupon_usage where order_id = v_order.id) then
    insert into coupon_usage (coupon_id, order_id, user_id, customer_phone, customer_email, discount_amount)
    values (v_order.coupon_id, v_order.id, v_order.user_id, v_order.customer_phone, v_order.customer_email, v_order.discount);
    update coupons set usage_count = usage_count + 1 where id = v_order.coupon_id;
  end if;

  insert into order_status_history (order_id, status, note, changed_by)
  values (v_order.id, 'PAID', 'Payment confirmed' || coalesce(' (' || p_transaction_reference || ')', ''), p_actor);

  insert into audit_logs (actor_id, action, resource, resource_id, after)
  values (p_actor, 'payment.confirmed', 'payments', p_payment_id::text,
          jsonb_build_object('order_number', v_order.order_number, 'amount', p_amount,
                             'reference', p_transaction_reference, 'stock', v_stock));

  return jsonb_build_object('status', 'confirmed', 'duplicate', false, 'order_id', v_order.id,
                            'order_number', v_order.order_number, 'stock', v_stock);
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
  v_order_id uuid;
begin
  -- The order first, then the payment (see confirm_payment).
  select order_id into v_order_id from payments where id = p_payment_id;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  select * into v_order from orders where id = v_order_id for update;
  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED', 'REFUNDED') then
    return jsonb_build_object('status', 'unchanged', 'payment_status', v_payment.status);
  end if;

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

-- 4. Staff order status changes ----------------------------------------------------------------
-- Same function as before, plus two ways out of what were dead ends:
--   FAILED -> PAID        the money for an expired bank transfer, Paybill or cash order arrived
--   CANCELLED -> REFUNDED a paid order was cancelled and the money has been returned
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
    when 'FAILED' then array['CANCELLED', 'PAID']::order_status[]
    else array[]::order_status[]
  end;
  -- A cancelled order that was paid can still be refunded.
  if v_order.order_status = 'CANCELLED' and v_order.payment_status = 'PAID' then
    v_allowed := array['REFUNDED']::order_status[];
  end if;

  if not (p_status = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION:% -> %', v_order.order_status, p_status;
  end if;

  if p_status = 'PAID' and v_order.payment_method not in ('bank_transfer', 'cash_on_delivery', 'mpesa_paybill') then
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

  -- Manual "mark paid" for bank transfer / COD / Paybill.
  if p_status = 'PAID' then
    perform public.deduct_order_stock(p_order_id, v_actor);
    update orders set payment_status = 'PAID', paid_at = now() where id = p_order_id;
    insert into payments (order_id, method, provider, status, amount, paid_at, result_description)
    values (p_order_id, v_order.payment_method, 'manual', 'PAID', v_order.total, now(), coalesce(p_note, 'Marked paid by staff'));
    -- Given back when the unpaid order expired: used after all.
    if v_order.coupon_id is not null and not exists (select 1 from coupon_usage where order_id = p_order_id) then
      insert into coupon_usage (coupon_id, order_id, user_id, customer_phone, customer_email, discount_amount)
      values (v_order.coupon_id, p_order_id, v_order.user_id, v_order.customer_phone, v_order.customer_email, v_order.discount);
      update coupons set usage_count = usage_count + 1 where id = v_order.coupon_id;
    end if;
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

-- 6. Categories ---------------------------------------------------------------------------------
create or replace function public.categories_no_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent uuid := new.parent_id;
  v_steps int := 0;
begin
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'A category cannot sit under one of its own subcategories' using errcode = '23514';
    end if;
    select parent_id into v_parent from categories where id = v_parent;
    v_steps := v_steps + 1;
    exit when v_steps > 100;
  end loop;
  return new;
end;
$$;

drop trigger if exists categories_no_cycle on public.categories;
create trigger categories_no_cycle before insert or update of parent_id on public.categories
  for each row execute function public.categories_no_cycle();

-- UNION (not UNION ALL) drops rows already seen, so a loop that exists anyway ends.
create or replace function public.category_descendant_ids(p_category_id uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  with recursive tree as (
    select id from categories where id = p_category_id
    union
    select c.id from categories c join tree t on c.parent_id = t.id
  )
  select coalesce(array_agg(id), '{}') from tree;
$$;

-- 7. Search -----------------------------------------------------------------------------------------
-- Same function as before; the only change is that \, % and _ in the query are escaped
-- before it is used as a LIKE pattern.
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
  v_like text := '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
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

-- 8. Outbox ---------------------------------------------------------------------------------------------
-- Same claim as before, after first retiring tasks whose last attempt never reported back
-- (fail_outbox() is the only other place a task is marked dead, and a dead worker never calls it).
create or replace function public.claim_outbox(p_limit int default 20, p_order_id uuid default null, p_kinds text[] default null)
returns setof public.outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v outbox;
  v_order_number text;
begin
  for v in
    update outbox
       set status = 'dead', locked_until = null, updated_at = now(),
           last_error = coalesce(last_error, 'The last attempt never reported back')
     where status = 'processing' and locked_until < now() and attempts >= max_attempts
    returning *
  loop
    select order_number into v_order_number from orders where id = v.order_id;
    perform notify_admin('outbox_dead',
      'Background task failed: ' || v.kind || coalesce(' for ' || v_order_number, ''),
      jsonb_build_object('task_id', v.id, 'kind', v.kind, 'order_number', v_order_number,
                         'attempts', v.attempts, 'error', left(v.last_error, 500)),
      v.order_id);
  end loop;

  return query
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
end;
$$;

-- 9. Indexes -----------------------------------------------------------------------------------------------
-- The unpaid-order cap at checkout looks orders up by email as well as by phone.
create index if not exists orders_customer_email_idx on public.orders (customer_email);
-- The cron job lists payments still awaiting a result, oldest first.
create index if not exists payments_open_idx on public.payments (created_at) where status in ('PENDING', 'PROCESSING');
