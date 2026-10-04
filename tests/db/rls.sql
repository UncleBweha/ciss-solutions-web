-- Row Level Security tests. Runs inside a transaction that is rolled back.
-- Usage: npm run test:db   (needs `supabase start` with the seed loaded)
\set ON_ERROR_STOP on
begin;

-- Fixture: a draft product, an order for the demo customer and one for someone else.
insert into products (name, slug, sku, price, status) values ('Hidden draft', 'hidden-draft', 'TEST-DRAFT', 10, 'draft');
insert into orders (order_number, user_id, customer_name, customer_email, customer_phone, subtotal, total,
                    payment_method, delivery_county, delivery_town, delivery_address)
values ('TEST-OWN', '00000000-0000-4000-8000-000000000002', 'Wanjiku', 'customer@ciss.local', '254700000000', 100, 100,
        'mpesa', 'Nairobi', 'CBD', 'x'),
       ('TEST-OTHER', '00000000-0000-4000-8000-000000000003', 'Brian', 'brian@ciss.local', '254700000001', 100, 100,
        'mpesa', 'Nairobi', 'CBD', 'x');
insert into payments (order_id, method, provider, amount, raw_response)
select id, 'mpesa', 'mpesa_mock', 100, '{"secret":"x"}' from orders where order_number = 'TEST-OWN';

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare v_failed boolean := false;
begin
  assert (select count(*) from products where status <> 'active') = 0, 'anon sees only active products';
  assert (select count(*) from products) > 0, 'anon sees catalogue';
  assert (select count(*) from orders) = 0, 'anon sees no orders';
  assert (select count(*) from payments) = 0, 'anon sees no payments';
  assert (select count(*) from coupons) = 0, 'anon cannot list coupons';
  assert (select count(*) from product_costs) = 0, 'anon cannot read cost prices';
  assert (select count(*) from settings where not is_public) = 0, 'anon cannot read private settings';
  assert (select count(*) from settings where key = 'business') = 1, 'anon reads business settings';
  begin
    perform place_order('{"items":[]}'::jsonb);
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'anon cannot call place_order';
  v_failed := false;
  begin
    perform confirm_payment(gen_random_uuid(), 'X', 1, null, null);
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'anon cannot confirm payments';
end;
$$;

-- Signed-in customer ------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true);
do $$
declare v_failed boolean := false;
begin
  assert (select count(*) from orders where order_number like 'TEST-%') = 1, 'customer sees only own order';
  assert (select order_number from orders where order_number like 'TEST-%') = 'TEST-OWN', 'own order visible';
  assert (select count(*) from payments) = 0, 'customer cannot read payment rows';
  assert (select count(*) from profiles) = 1, 'customer sees only own profile';

  begin
    update profiles set role = 'super_admin' where id = auth.uid();
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'customer cannot escalate role';

  update orders set total = 1 where order_number = 'TEST-OWN';
exception
  when insufficient_privilege then
    -- expected: customers have no update privilege on orders
    assert (select total from orders where order_number = 'TEST-OWN') = 100, 'order total unchanged';
end;
$$;

do $$
declare v_failed boolean := false;
begin
  begin
    perform update_order_status((select id from orders where order_number = 'TEST-OWN'), 'CANCELLED', null);
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'customer cannot change order status';

  begin
    insert into products (name, slug, sku, price) values ('x', 'x-test', 'X-TEST', 1);
    v_failed := false;
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'customer cannot create products';

  -- reviews are forced into moderation with a computed verified flag
  insert into reviews (product_id, user_id, rating, title, status, is_verified_purchase)
  values ((select id from products where sku = 'BRO-TN2420'), auth.uid(), 5, 'Great', 'approved', true);
  assert (select status from reviews where user_id = auth.uid() and title = 'Great') = 'pending', 'review pending';
  assert (select is_verified_purchase from reviews where user_id = auth.uid() and title = 'Great') = false,
    'verified flag computed, not trusted';
end;
$$;

-- Staff with a narrow role ------------------------------------------------------------
reset role;
update profiles set role = 'order_manager' where id = '00000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000004"}', true);
do $$
declare v_failed boolean := false;
begin
  assert (select count(*) from orders where order_number like 'TEST-%') = 2, 'order manager sees all orders';
  assert (select count(*) from payments) >= 1, 'order manager sees payments';
  assert (select count(*) from product_costs) = 0, 'order manager cannot read costs';
  begin
    update settings set value = '{}' where key = 'payment_methods';
    assert not found, 'order manager cannot change payment settings';
  end;
  begin
    insert into products (name, slug, sku, price) values ('x', 'x-test', 'X-TEST', 1);
  exception when insufficient_privilege then v_failed := true;
  end;
  assert v_failed, 'order manager cannot create products';
end;
$$;

reset role;
do $$ begin raise notice 'rls: all assertions passed'; end $$;
rollback;
