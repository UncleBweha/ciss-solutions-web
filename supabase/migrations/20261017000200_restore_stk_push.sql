-- Restores the M-Pesa STK push (KCB Buni) after 20261017000100_remove_stk_push.sql, which was
-- applied to the database while the app still used it. Everything here is copied from
-- 20261012000100_audit_fixes.sql, the last migration that defined these functions.
--
-- 1. place_order() accepts M-Pesa again (PAYMENT_PENDING + an STK push task in the outbox).
-- 2. confirm_payment() and fail_payment() are recreated, executable by the server only.
-- 3. The M-Pesa toggle (enabled) and its 30-minute payment window return to the settings
--    when missing.
-- 4. The FAQ gets its M-Pesa answers back when it still has the replacement wording.
--
-- Not undone: STK push tasks the removal closed as "skipped". They were for orders whose
-- prompt was already sent or too old to send (the worker drops prompts over 10 minutes old).

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

-- 2. ---------------------------------------------------------------------------------------
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

revoke execute on function public.confirm_payment(uuid, text, numeric, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.fail_payment(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, numeric, jsonb, uuid) to service_role;
grant execute on function public.fail_payment(uuid, text, text, jsonb) to service_role;

-- 3. ---------------------------------------------------------------------------------------
update public.settings
   set value = value || jsonb_build_object('mpesa', jsonb_build_object('enabled', true, 'label', 'M-Pesa'))
 where key = 'payment_methods' and not (value ? 'mpesa');
update public.settings
   set value = value || jsonb_build_object('mpesa_reservation_minutes', 30)
 where key = 'checkout' and not (value ? 'mpesa_reservation_minutes');

-- 4. ---------------------------------------------------------------------------------------
update public.settings
   set value = jsonb_set(value, '{body}', to_jsonb(replace(replace(value ->> 'body',
     'We check Paybill payments by hand during working hours, so it can take a little while. If the status has not changed by the next working day, send',
     'Give it a few minutes first. Sometimes the confirmation from Safaricom arrives late. If the status has not changed after 15 minutes, send'),
     '- **M-Pesa Paybill.**',
     E'- **M-Pesa.** You get a prompt on your phone and enter your M-Pesa PIN. The order is confirmed as soon as Safaricom tells us the payment went through.\n- **M-Pesa Paybill.**')))
 where key = 'page:faqs'
   and value ->> 'body' like '%We check Paybill payments by hand during working hours%'
   and value ->> 'body' not like '%You get a prompt on your phone%';
