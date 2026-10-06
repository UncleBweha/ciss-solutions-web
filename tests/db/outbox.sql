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
  v_mpesa uuid;
  v_bank uuid;
  v_payment uuid;
  v_task outbox;
  v_count int;
  v_outcome text;
  v_base jsonb;
begin
  select id into v_product from products where sku = 'BRO-TN2420';
  update products set stock_quantity = 20, reserved_quantity = 0 where id = v_product;
  v_base := jsonb_build_object(
    'customer_name', 'Outbox Test', 'customer_email', 'outbox@example.com', 'customer_phone', '254712000001',
    'subtotal', 9800, 'total', 10000, 'delivery_fee', 200, 'delivery_zone_name', 'Nairobi',
    'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'TN-2420', 'sku', 'BRO-TN2420', 'quantity', 1, 'unit_price', 9800)));

  -- 1. An M-Pesa order commits its follow-up tasks with it -----------------------------
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'mpesa', 'payment_phone', '254799000002'));
  v_mpesa := (v_order ->> 'id')::uuid;
  assert (select count(*) from outbox where order_id = v_mpesa and kind = 'order_placed' and status = 'pending') = 1, 'order_placed queued';
  assert (select payload ->> 'phone' from outbox where order_id = v_mpesa and kind = 'mpesa_stk_push') = '254799000002',
    'STK task uses the M-Pesa number from checkout';

  -- Manual methods get no STK task; the contact phone is the fallback for M-Pesa.
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'bank_transfer'));
  v_bank := (v_order ->> 'id')::uuid;
  assert (select count(*) from outbox where order_id = v_bank) = 1, 'bank transfer: only order_placed';
  v_order := place_order(v_base || jsonb_build_object('payment_method', 'mpesa'));
  assert (select payload ->> 'phone' from outbox where order_id = (v_order ->> 'id')::uuid and kind = 'mpesa_stk_push') = '254712000001',
    'STK task falls back to the contact phone';

  -- 2. A failed order leaves no tasks (same transaction) --------------------------------
  v_count := (select count(*) from outbox);
  begin
    perform place_order(v_base || jsonb_build_object('payment_method', 'mpesa', 'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'TN-2420', 'sku', 'BRO-TN2420', 'quantity', 999, 'unit_price', 9800))));
  exception when others then null;
  end;
  assert (select count(*) from outbox) = v_count, 'rolled-back order queued nothing';

  -- 3. Claiming is exclusive; only due tasks are returned ---------------------------------
  select * into v_task from claim_outbox(10, v_mpesa, array['order_placed']);
  assert v_task.status = 'processing' and v_task.attempts = 1, 'claimed and counted';
  assert not exists (select 1 from claim_outbox(10, v_mpesa, array['order_placed'])), 'not claimed twice while locked';

  -- 4. Failure backs off, then dies with a staff notification -----------------------------
  v_outcome := fail_outbox(v_task.id, 'smtp down');
  assert v_outcome = 'retry', 'first failure retries';
  assert (select status from outbox where id = v_task.id) = 'failed', 'marked failed';
  assert (select next_attempt_at from outbox where id = v_task.id) > now() + interval '50 seconds', 'backed off ~1 minute';
  assert not exists (select 1 from claim_outbox(10, v_mpesa, array['order_placed'])), 'not due yet';

  update outbox set attempts = max_attempts, next_attempt_at = now() where id = v_task.id;
  v_outcome := fail_outbox(v_task.id, 'smtp still down');
  assert v_outcome = 'dead', 'gives up after max attempts';
  assert exists (select 1 from notifications where channel = 'admin' and kind = 'outbox_dead' and order_id = v_mpesa),
    'staff notified about the dead task';

  -- A lock that expired (worker crashed) is reclaimed.
  select * into v_task from claim_outbox(10, v_mpesa, array['mpesa_stk_push']);
  update outbox set locked_until = now() - interval '1 second' where id = v_task.id;
  select * into v_task from claim_outbox(10, v_mpesa, array['mpesa_stk_push']);
  assert v_task.attempts = 2, 'stuck task reclaimed';
  perform complete_outbox(v_task.id, 'sent');
  assert (select status from outbox where id = v_task.id) = 'done', 'completed';

  -- 5. Online payment confirmed -> receipt task in the same transaction -------------------
  insert into payments (order_id, method, provider, amount, phone_number, checkout_request_id, status)
  values (v_mpesa, 'mpesa', 'mpesa_mock', 10000, '254799000002', 'ws_CO_OUTBOX_TEST', 'PROCESSING')
  returning id into v_payment;
  perform confirm_payment(v_payment, 'OUTBOXTEST1', 10000, '{}'::jsonb);
  assert (select count(*) from outbox where order_id = v_mpesa and kind = 'payment_confirmed') = 1, 'payment_confirmed queued';
  perform confirm_payment(v_payment, 'OUTBOXTEST1', 10000, '{}'::jsonb);
  assert (select count(*) from outbox where order_id = v_mpesa and kind = 'payment_confirmed') = 1, 'repeat callback queues nothing';

  -- 6. Status emails only for changes made by staff, not by automatic expiry ---------------
  update orders set reservation_expires_at = now() - interval '1 minute'
   where id = (select order_id from outbox where kind = 'mpesa_stk_push' and payload ->> 'phone' = '254712000001' limit 1);
  perform expire_stale_orders();
  assert not exists (select 1 from outbox where kind = 'order_status'), 'expiry sends no status email';

  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform update_order_status(v_mpesa, 'PROCESSING', null);
  assert (select payload ->> 'status' from outbox where order_id = v_mpesa and kind = 'order_status') = 'PROCESSING',
    'staff status change queued an email';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Bank transfer marked paid by staff: no receipt task (staff were alerted at placement).
  assert not exists (select 1 from outbox where order_id = v_bank and kind = 'payment_confirmed'), 'manual method: no receipt task';
end $$;

-- 7. Customers and anonymous users cannot see or run the outbox -------------------------
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
