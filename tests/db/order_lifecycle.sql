-- Database integration tests: stock reservation, staff payment confirmation, expiry and
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
  v_result jsonb;
  v_failed boolean;
  v_rec record;
begin
  select id, stock_quantity into v_product, v_stock from products where sku = 'HP-M404DN';
  update products set stock_quantity = 5, reserved_quantity = 0 where id = v_product;

  -- 1. Placing an order reserves stock --------------------------------------
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Test Buyer', 'customer_email', 'Buyer@Example.com', 'customer_phone', '254712345678',
    'payment_method', 'bank_transfer', 'subtotal', 105998, 'discount', 0, 'delivery_fee', 200, 'total', 106198,
    'delivery_zone_name', 'Nairobi', 'delivery_county', 'Nairobi', 'delivery_town', 'Westlands',
    'delivery_address', 'Test street', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 2, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  assert (v_order ->> 'order_number') ~ '^CISS-[2-9A-HJ-NP-Z]{8}$', 'order number format';
  assert (select reserved_quantity from products where id = v_product) = 2, 'stock reserved';
  assert (select available_quantity from products where id = v_product) = 3, 'available reduced';
  assert (select order_status from orders where id = v_order_id) = 'PENDING', 'awaiting payment';
  assert (select customer_email from orders where id = v_order_id) = 'buyer@example.com', 'email normalised';

  -- 2. Overselling is impossible -----------------------------------------------
  v_failed := false;
  begin
    perform place_order(jsonb_build_object(
      'customer_name', 'Other', 'customer_email', 'o@example.com', 'customer_phone', '254700000001',
      'payment_method', 'bank_transfer', 'subtotal', 211996, 'total', 211996, 'delivery_zone_name', 'Nairobi',
      'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 4, 'unit_price', 52999))
    ));
  exception when others then
    v_failed := sqlerrm like 'INSUFFICIENT_STOCK%';
  end;
  assert v_failed, 'oversell rejected';
  assert (select reserved_quantity from products where id = v_product) = 2, 'failed order left no reservation';

  -- 3. M-Pesa STK push (removed) and card orders are refused ------------------------
  v_failed := false;
  begin
    perform place_order(jsonb_build_object(
      'customer_name', 'Stk', 'customer_email', 'stk@example.com', 'customer_phone', '254700000001',
      'payment_method', 'mpesa', 'subtotal', 52999, 'total', 52999, 'delivery_zone_name', 'Nairobi',
      'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
    ));
  exception when others then
    v_failed := sqlerrm like 'PAYMENT_METHOD_UNAVAILABLE%';
  end;
  assert v_failed, 'M-Pesa (STK) order rejected';
  assert (select reserved_quantity from products where id = v_product) = 2, 'rejected order left no reservation';

  -- 4. Staff confirm the payment: stock is deducted exactly once --------------------
  perform update_order_status(v_order_id, 'PAID', 'Transfer received');
  v_failed := false;
  begin
    perform update_order_status(v_order_id, 'PAID', 'Again');
  exception when others then
    v_failed := sqlerrm like 'INVALID_TRANSITION%';
  end;
  assert v_failed, 'a paid order cannot be marked paid again';
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
    'payment_method', 'bank_transfer', 'subtotal', 52999, 'total', 52999, 'delivery_zone_name', 'Nairobi',
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
  perform update_order_status(v_order_id, 'PAID', 'Transfer received late');
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

  -- 11. A Paybill order marked paid deducts its stock once -----------------------------------------
  update products set stock_quantity = 5, reserved_quantity = 0 where id = v_product;
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Paid', 'customer_email', 'paid@example.com', 'customer_phone', '254700000005',
    'payment_method', 'mpesa_paybill', 'subtotal', 52999, 'total', 52999, 'delivery_zone_name', 'Nairobi',
    'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  perform update_order_status(v_order_id, 'PAID', 'Paybill payment checked');
  assert (select count(*) from payments where order_id = v_order_id and provider = 'manual' and status = 'PAID') = 1, 'staff payment recorded';
  assert (select stock_quantity from products where id = v_product) = 4, 'stock deducted once for the order';
  assert (select count(*) from order_status_history where order_id = v_order_id and status = 'PAID') = 1, 'one paid entry in the history';

  -- 12. A paid order that was cancelled can be refunded ------------------------------------------
  perform update_order_status(v_order_id, 'CANCELLED', 'Customer cancelled');
  assert (select payment_status from orders where id = v_order_id) = 'PAID', 'cancelling does not unpay';
  perform update_order_status(v_order_id, 'REFUNDED', 'Money returned');
  assert (select payment_status from orders where id = v_order_id) = 'REFUNDED', 'cancelled paid order refunded';

  -- 13. Short stock on a late payment: flagged, and a cancel returns only what was taken ----------
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Short', 'customer_email', 'short@example.com', 'customer_phone', '254700000006',
    'payment_method', 'bank_transfer', 'subtotal', 52999, 'total', 52999, 'delivery_zone_name', 'Nairobi',
    'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x', 'reservation_minutes', 30,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  update orders set reservation_expires_at = now() - interval '1 minute' where id = v_order_id;
  perform expire_stale_orders();
  update products set stock_quantity = 0, reserved_quantity = 0 where id = v_product;
  perform update_order_status(v_order_id, 'PAID', 'Transfer received late');
  assert (select stock_state from orders where id = v_order_id) = 'shortage', 'order marked short';
  assert exists (select 1 from notifications where kind = 'stock_shortage' and order_id = v_order_id), 'staff told about the shortage';
  perform update_order_status(v_order_id, 'CANCELLED', 'No stock');
  assert (select stock_quantity from products where id = v_product) = 0, 'nothing put back that was never taken';
  assert (select stock_state from orders where id = v_order_id) = 'restocked', 'short order closed out';

  -- 14. Money that arrives after a bank transfer order expired can be recorded -------------------
  update products set stock_quantity = 5, reserved_quantity = 0 where id = v_product;
  update coupons set usage_limit = null, usage_count = 0, per_customer_limit = null, is_active = true where code = 'CISS10';
  v_order := place_order(jsonb_build_object(
    'customer_name', 'Bank', 'customer_email', 'bank@example.com', 'customer_phone', '254700000007',
    'payment_method', 'bank_transfer', 'subtotal', 52999, 'discount', 5000, 'total', 47999,
    'coupon_id', (select id from coupons where code = 'CISS10'), 'coupon_code', 'CISS10',
    'delivery_zone_name', 'Nairobi', 'delivery_county', 'Nairobi', 'delivery_town', 'CBD', 'delivery_address', 'x',
    'reservation_minutes', 2880,
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'product_name', 'HP M404dn', 'sku', 'HP-M404DN', 'quantity', 1, 'unit_price', 52999))
  ));
  v_order_id := (v_order ->> 'id')::uuid;
  assert (select usage_count from coupons where code = 'CISS10') = 1, 'coupon used by the order';
  update orders set reservation_expires_at = now() - interval '1 minute' where id = v_order_id;
  perform expire_stale_orders();
  assert (select order_status from orders where id = v_order_id) = 'FAILED', 'bank transfer order expired';
  assert (select usage_count from coupons where code = 'CISS10') = 0, 'coupon use returned on expiry';
  perform update_order_status(v_order_id, 'PAID', 'Transfer received late');
  assert (select payment_status from orders where id = v_order_id) = 'PAID', 'late bank transfer recorded';
  assert (select stock_quantity from products where id = v_product) = 4, 'late bank transfer took stock';
  assert (select usage_count from coupons where code = 'CISS10') = 1, 'coupon counted again once paid';

  -- 15. Categories cannot be arranged in a loop ---------------------------------------------------
  select id, parent_id into v_rec from categories where parent_id is not null order by id limit 1;
  if v_rec.id is not null then
    v_failed := false;
    begin
      update categories set parent_id = v_rec.id where id = v_rec.parent_id;
    exception when others then
      v_failed := sqlstate = '23514';
    end;
    assert v_failed, 'a category cannot move under its own subcategory';
  end if;

  raise notice 'order_lifecycle: all assertions passed';
end;
$$;

rollback;
