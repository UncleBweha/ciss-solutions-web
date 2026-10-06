-- Database integration tests: stock reservation, payment confirmation, expiry and
-- cancellation. Runs inside a transaction that is rolled back.
-- Usage: npm run test:db   (needs `supabase start`)
\set ON_ERROR_STOP on
begin;

-- Act as the server's service-role client.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table t_ctx (key text primary key, val text);

do $$
declare
  v_product uuid;
  v_stock int;
  v_order jsonb;
  v_order_id uuid;
  v_payment uuid;
  v_result jsonb;
  v_failed boolean;
  v_rec record;
begin
  select id, stock_quantity into v_product, v_stock from products where sku = 'HP-M404DN';
  update products set stock_quantity = 5, reserved_quantity = 0 where id = v_product;

  -- 1. Placing an order reserves stock --------------------------------------
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Test Buyer', 'customer_email', 'Buyer@Example.com', 'customer_phone', '254712345678',
    'payment_method', 'mpesa', 'subtotal', 105998, 'discount', 0, 'delivery_fee', 200, 'total', 106198,
    'delivery_zone_name', 'Nairobi', 'delivery_county', 'Nairobi', 'delivery_town', 'Westlands',
    'delivery_address', 'Test street', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 2, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  assert (v_order ->> 'order_number') ~ '^CISS-[2-9A-HJ-NP-Z]{8}$', 'order number format';
  assert (select reserved_quantity from products where id = v_product) = 2, 'stock reserved';
  assert (select available_quantity from products where id = v_product) = 3, 'available reduced';
  assert (select order_status from orders where id = v_order_id) = 'PAYMENT_PENDING', 'awaiting payment';
  assert (select customer_email from orders where id = v_order_id) = 'buyer@example.com', 'email normalised';

  -- 2. Overselling is impossible -----------------------------------------------
  v_failed := false;
  begin
    perform place_order(jsonb_build_object(
      'customer_name', 'Other', 'customer_email', 'o@example.com', 'customer_phone', '254700000001',
      'payment_method', 'mpesa', 'subtotal', 211996, 'total', 211996, 'delivery_zone_name', 'Nairobi',
      'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 4, 'unit_price', 52999))
    ));
  exception when others then
    v_failed := sqlerrm like 'INSUFFICIENT_STOCK%';
  end;
  assert v_failed, 'oversell rejected';
  assert (select reserved_quantity from products where id = v_product) = 2, 'failed order left no reservation';

  -- 3. Short payment is rejected ---------------------------------------------------
  insert into payments (order_id, method, provider, amount, phone_number, checkout_request_id)
  values (v_order_id, 'mpesa', 'mpesa_mock', 106198, '254712345678', 'ws_CO_test_1') returning id into v_payment;
  v_result := confirm_payment(v_payment, 'QAB1CD2EF3', 100, '{}'::jsonb);
  assert v_result ->> 'status' = 'amount_mismatch', 'amount mismatch detected';
  assert (select payment_status from orders where id = v_order_id) = 'PENDING', 'order not paid on mismatch';

  -- 4. Correct payment confirms and deducts stock exactly once ----------------------
  insert into payments (order_id, method, provider, amount, phone_number, checkout_request_id)
  values (v_order_id, 'mpesa', 'mpesa_mock', 106198, '254712345678', 'ws_CO_test_2') returning id into v_payment;
  v_result := confirm_payment(v_payment, 'QAB1CD2EF4', 106198, '{}'::jsonb);
  assert v_result ->> 'status' = 'confirmed', 'payment confirmed';
  v_result := confirm_payment(v_payment, 'QAB1CD2EF4', 106198, '{}'::jsonb);
  assert v_result ->> 'status' = 'already_paid', 'duplicate callback is idempotent';
  select * into v_rec from products where id = v_product;
  assert v_rec.stock_quantity = 3 and v_rec.reserved_quantity = 0, 'stock deducted once';
  assert (select order_status from orders where id = v_order_id) = 'PAID', 'order paid';
  assert (select stock_state from orders where id = v_order_id) = 'deducted', 'stock state deducted';
  assert (select count(*) from inventory_transactions where reference = v_order ->> 'order_number' and reason = 'sale') = 1,
    'one inventory sale record';

  -- 5. Cancelling a paid order restocks ----------------------------------------------
  v_result := update_order_status(v_order_id, 'CANCELLED', 'Customer cancelled');
  assert (select stock_quantity from products where id = v_product) = 5, 'cancellation restocked';
  assert (select stock_state from orders where id = v_order_id) = 'restocked', 'stock state restocked';

  -- 6. Unpaid orders expire and release their reservation ---------------------------
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Late Payer', 'customer_email', 'late@example.com', 'customer_phone', '254700000002',
    'payment_method', 'mpesa', 'subtotal', 52999, 'total', 52999, 'delivery_zone_name', 'Nairobi',
    'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  assert (select reserved_quantity from products where id = v_product) = 1, 'reserved for late payer';
  update orders set reservation_expires_at = now() - interval '1 minute' where id = v_order_id;
  assert expire_stale_orders() >= 1, 'expired one order';
  assert (select reserved_quantity from products where id = v_product) = 0, 'reservation released';
  assert (select order_status from orders where id = v_order_id) = 'FAILED', 'expired order failed';

  -- 7. A late payment after expiry still records the sale (re-takes stock) ------------
  insert into payments (order_id, method, provider, amount, checkout_request_id)
  values (v_order_id, 'mpesa', 'mpesa_mock', 52999, 'ws_CO_test_3') returning id into v_payment;
  v_result := confirm_payment(v_payment, 'QAB1CD2EF5', 52999, null);
  assert v_result ->> 'status' = 'confirmed', 'late payment confirmed';
  assert (select stock_quantity from products where id = v_product) = 4, 'late payment deducted stock';
  assert (select order_status from orders where id = v_order_id) = 'PAID', 'late order revived as paid';

  -- 8. Coupon usage limits are enforced atomically -----------------------------------------
  update coupons set usage_limit = 1, usage_count = 1 where code = 'CISS10';
  v_failed := false;
  begin
    perform place_order(jsonb_build_object(
      'customer_name', 'Coupon', 'customer_email', 'c@example.com', 'customer_phone', '254700000003',
      'payment_method', 'cash_on_delivery', 'subtotal', 52999, 'discount', 5000, 'total', 47999,
      'coupon_id', (select id from coupons where code = 'CISS10'), 'coupon_code', 'CISS10',
      'delivery_zone_name', 'Nairobi', 'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
    ));
  exception when others then
    v_failed := sqlerrm = 'COUPON_EXHAUSTED';
  end;
  assert v_failed, 'exhausted coupon rejected';

  -- 9. Cash on delivery: delivered marks paid and deducts stock -------------------------------
  update coupons set usage_limit = null, usage_count = 0 where code = 'CISS10';
  v_order := place_order(jsonb_build_object(
    'customer_name', 'COD', 'customer_email', 'cod@example.com', 'customer_phone', '254700000004',
    'payment_method', 'cash_on_delivery', 'subtotal', 52999, 'total', 53199, 'delivery_fee', 200,
    'delivery_zone_name', 'Nairobi', 'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  assert (select order_status from orders where id = v_order_id) = 'PENDING', 'COD starts pending';
  perform update_order_status(v_order_id, 'PROCESSING', null);
  assert (select stock_quantity from products where id = v_product) = 3, 'processing deducted COD stock';
  perform update_order_status(v_order_id, 'SHIPPED', null);
  perform update_order_status(v_order_id, 'DELIVERED', null);
  assert (select payment_status from orders where id = v_order_id) = 'PAID', 'COD paid on delivery';

  -- 10. Invalid transitions are rejected ---------------------------------------------------
  v_failed := false;
  begin
    perform update_order_status(v_order_id, 'PROCESSING', null);
  exception when others then
    v_failed := sqlerrm like 'INVALID_TRANSITION%';
  end;
  assert v_failed, 'delivered -> processing rejected';

  raise notice 'order_lifecycle: all assertions passed';
end;
$$;

rollback;
