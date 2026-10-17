-- Transactional outbox: tasks are written in the same transaction as the change,
-- claimed once, retried with back-off and marked dead after the last attempt.
-- Runs inside a transaction that is rolled back. Usage: npm run test:db
\set ON_ERROR_STOP on
begin;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_product uuid;
  v_order jsonb;
  v_first uuid;
  v_cod uuid;
  v_bank uuid;
  v_task outbox;
  v_count int;
  v_outcome text;
  v_base jsonb;
  v_failed boolean := false;
begin
  select id into v_product from products where sku = 'BRO-TN2420';
  update products set stock_quantity = 20, reserved_quantity = 0 where id = v_product;
  v_base := jsonb_build_object(
    'customer_name', 'Outbox Test', 'customer_email', 'outbox@example.com', 'customer_phone', '254712000001',
    'subtotal', 9800, 'total', 10000, 'delivery_fee', 200, 'delivery_zone_name', 'Nairobi',
    'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'TN-2420', 'sku', 'BRO-TN2420', 'quantity', 1, 'unit_price', 9800)));

  -- 1. An order commits its follow-up task with it ---------------------------------------
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'mpesa_paybill'));
  v_first := (v_order ->> 'id')::uuid;
  assert (select count(*) from outbox where order_id = v_first and kind = 'order_placed' and status = 'pending') = 1, 'order_placed queued';
  assert (select count(*) from outbox where order_id = v_first) = 1, 'only order_placed';
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'bank_transfer'));
  v_bank := (v_order ->> 'id')::uuid;
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'cash_on_delivery'));
  v_cod := (v_order ->> 'id')::uuid;
  assert not exists (select 1 from outbox where kind = 'mpesa_stk_push' and order_id in (v_first, v_bank, v_cod)), 'no STK push is queued';

  -- 2. A failed order leaves no tasks (same transaction) --------------------------------
  v_count := (select count(*) from outbox);
  begin
    perform place_order(v_base || jsonb_build_object('payment_method', 'bank_transfer', 'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'TN-2420', 'sku', 'BRO-TN2420', 'quantity', 999, 'unit_price', 9800))));
  exception when others then null;
  end;
  begin
    perform place_order(v_base || jsonb_build_object('payment_method', 'mpesa'));
  exception when others then v_failed := sqlerrm like 'PAYMENT_METHOD_UNAVAILABLE%';
  end;
  assert v_failed, 'M-Pesa (STK) order refused';
  assert (select count(*) from outbox) = v_count, 'rolled-back orders queued nothing';

  -- 3. Claiming is exclusive; only due tasks are returned ---------------------------------
  select * into v_task from claim_outbox(10, v_first, array['order_placed']);
  assert v_task.status = 'processing' and v_task.attempts = 1, 'claimed and counted';
  assert not exists (select 1 from claim_outbox(10, v_first, array['order_placed'])), 'not claimed twice while locked';

  -- 4. Failure backs off, then dies with a staff notification -----------------------------
  v_outcome := fail_outbox(v_task.id, 'smtp down');
  assert v_outcome = 'retry', 'first failure retries';
  assert (select status from outbox where id = v_task.id) = 'failed', 'marked failed';
  assert (select next_attempt_at from outbox where id = v_task.id) > now() + interval '50 seconds', 'backed off ~1 minute';
  assert not exists (select 1 from claim_outbox(10, v_first, array['order_placed'])), 'not due yet';

  update outbox set attempts = max_attempts, next_attempt_at = now() where id = v_task.id;
  v_outcome := fail_outbox(v_task.id, 'smtp still down');
  assert v_outcome = 'dead', 'gives up after max attempts';
  assert exists (select 1 from notifications where channel = 'admin' and kind = 'outbox_dead' and order_id = v_first),
    'staff notified about the dead task';

  -- A lock that expired (worker crashed) is reclaimed.
  select * into v_task from claim_outbox(10, v_cod, array['order_placed']);
  update outbox set locked_until = now() - interval '1 second' where id = v_task.id;
  select * into v_task from claim_outbox(10, v_cod, array['order_placed']);
  assert v_task.attempts = 2, 'stuck task reclaimed';
  perform complete_outbox(v_task.id, 'sent');
  assert (select status from outbox where id = v_task.id) = 'done', 'completed';

  -- 5. Status emails only for changes made by staff, not by automatic expiry ---------------
  update orders set reservation_expires_at = now() - interval '1 minute' where id = v_cod;
  perform expire_stale_orders();
  assert not exists (select 1 from outbox where kind = 'order_status'), 'expiry sends no status email';

  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform update_order_status(v_first, 'PROCESSING', null);
  assert (select payload ->> 'status' from outbox where order_id = v_first and kind = 'order_status') = 'PROCESSING',
    'staff status change queued an email';

  -- Bank transfer: nothing says "paid" until staff confirm the money. Marking it Paid queues
  -- the payment emails and the POS sale; a refund voids the sale there.
  assert not exists (select 1 from outbox where order_id = v_bank and kind in ('pos_sale', 'payment_confirmed')), 'unconfirmed payment: no paid email, nothing for the POS';
  perform update_order_status(v_bank, 'PAID', null);
  assert (select count(*) from outbox where order_id = v_bank and kind = 'payment_confirmed') = 1, 'staff-confirmed payment queued the paid emails';
  assert (select count(*) from outbox where order_id = v_bank and kind = 'pos_sale') = 1, 'staff-confirmed payment queued a POS sale';
  assert not exists (select 1 from outbox where order_id = v_bank and kind = 'pos_void'), 'no void while paid';
  perform update_order_status(v_bank, 'REFUNDED', null);
  assert (select count(*) from outbox where order_id = v_bank and kind = 'pos_void') = 1, 'refund queued a POS void';
  assert (select count(*) from outbox where order_id = v_bank and kind = 'pos_sale') = 1, 'refund queued no second sale';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
end $$;

-- 6. Customers and anonymous users cannot see or run the outbox -------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform claim_outbox(1, null, null);
    raise exception 'anon could claim outbox tasks';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true);
do $$
begin
  assert (select count(*) from outbox) = 0, 'customer sees no outbox rows';
  begin
    perform claim_outbox(1, null, null);
    raise exception 'customer could claim outbox tasks';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise notice 'outbox: all assertions passed'; end $$;
rollback;
