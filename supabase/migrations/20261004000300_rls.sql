-- CISS Solutions: Row Level Security
-- Customers see only their own data; staff access is granted per permission
-- (see role_permissions). The server's service-role client bypasses RLS and is
-- used only for checkout, payment callbacks and other verified server work.

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.printer_models enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_compatibility enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usage enable row level security;
alter table public.order_number_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.reviews enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.support_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Profiles ------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: staff read" on public.profiles
  for select using (public.has_permission('customers.view') or public.has_permission('admins.manage'));
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admins manage" on public.profiles
  for update using (public.has_permission('admins.manage')) with check (public.has_permission('admins.manage'));

create policy "role_permissions: staff read" on public.role_permissions
  for select using (public.is_staff());

-- Catalogue (public read of active rows, staff write) ------------------------
create policy "brands: public read" on public.brands
  for select using (is_active or public.has_permission('catalog.manage'));
create policy "brands: staff write" on public.brands
  for all using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy "categories: public read" on public.categories
  for select using (is_active or public.has_permission('catalog.manage'));
create policy "categories: staff write" on public.categories
  for all using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy "printer_models: public read" on public.printer_models
  for select using (true);
create policy "printer_models: staff write" on public.printer_models
  for all using (public.has_permission('catalog.manage') or public.has_permission('products.manage'))
  with check (public.has_permission('catalog.manage') or public.has_permission('products.manage'));

create policy "products: public read active" on public.products
  for select using (status = 'active' or public.has_permission('products.manage') or public.has_permission('inventory.manage'));
create policy "products: staff insert" on public.products
  for insert with check (public.has_permission('products.manage'));
create policy "products: staff update" on public.products
  for update using (public.has_permission('products.manage') or public.has_permission('inventory.manage'))
  with check (public.has_permission('products.manage') or public.has_permission('inventory.manage'));
create policy "products: staff delete" on public.products
  for delete using (public.has_permission('products.manage'));

create policy "product_costs: staff" on public.product_costs
  for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy "product_variants: public read" on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or public.has_permission('products.manage') or public.has_permission('inventory.manage')
  );
create policy "product_variants: staff write" on public.product_variants
  for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy "product_images: public read" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
    or public.has_permission('products.manage')
  );
create policy "product_images: staff write" on public.product_images
  for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy "product_compatibility: public read" on public.product_compatibility
  for select using (true);
create policy "product_compatibility: staff write" on public.product_compatibility
  for all using (public.has_permission('products.manage') or public.has_permission('catalog.manage'))
  with check (public.has_permission('products.manage') or public.has_permission('catalog.manage'));

create policy "inventory_transactions: staff read" on public.inventory_transactions
  for select using (public.has_permission('inventory.manage') or public.has_permission('products.manage'));

-- Delivery & coupons ------------------------------------------------------------
create policy "delivery_zones: public read" on public.delivery_zones
  for select using (is_active or public.has_permission('settings.manage'));
create policy "delivery_zones: staff write" on public.delivery_zones
  for all using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- No public read: coupon codes are validated by the server.
create policy "coupons: staff" on public.coupons
  for all using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));
create policy "coupon_usage: staff read" on public.coupon_usage
  for select using (public.has_permission('coupons.manage'));

-- Orders ------------------------------------------------------------------------
-- Customers read their own orders; nobody but the server creates or edits them.
create policy "orders: read own" on public.orders
  for select using (user_id = auth.uid());
create policy "orders: staff read" on public.orders
  for select using (public.has_permission('orders.manage') or public.has_permission('customers.view'));
create policy "orders: staff notes" on public.orders
  for update using (public.has_permission('orders.manage')) with check (public.has_permission('orders.manage'));

create policy "order_items: read own" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_items: staff read" on public.order_items
  for select using (public.has_permission('orders.manage') or public.has_permission('customers.view'));

create policy "order_status_history: read own" on public.order_status_history
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_status_history: staff read" on public.order_status_history
  for select using (public.has_permission('orders.manage'));

-- Payment rows (raw provider responses) are staff-only.
create policy "payments: staff read" on public.payments
  for select using (public.has_permission('orders.manage'));

-- Staff may only change order notes directly; status goes through update_order_status().
revoke update on public.orders from authenticated;
grant update (admin_notes) on public.orders to authenticated;

-- Customer-owned data -----------------------------------------------------------
create policy "addresses: own" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "carts: own" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart_items: own" on public.cart_items
  for all using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy "wishlists: own" on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wishlist_items: own" on public.wishlist_items
  for all using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

create policy "reviews: public read approved" on public.reviews
  for select using (status = 'approved' or user_id = auth.uid() or public.has_permission('reviews.moderate'));
create policy "reviews: insert own" on public.reviews
  for insert with check (user_id = auth.uid());
create policy "reviews: update own" on public.reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: delete own" on public.reviews
  for delete using (user_id = auth.uid());
create policy "reviews: moderate" on public.reviews
  for all using (public.has_permission('reviews.moderate')) with check (public.has_permission('reviews.moderate'));

-- Content ------------------------------------------------------------------------
create policy "homepage_banners: public read" on public.homepage_banners
  for select using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or public.has_permission('content.manage')
  );
create policy "homepage_banners: staff write" on public.homepage_banners
  for all using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy "homepage_sections: public read" on public.homepage_sections
  for select using (true);
create policy "homepage_sections: staff write" on public.homepage_sections
  for all using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

-- Support: created by the server (rate limited); customers read their own.
create policy "support_requests: read own" on public.support_requests
  for select using (user_id = auth.uid());
create policy "support_requests: staff" on public.support_requests
  for all using (public.has_permission('support.manage')) with check (public.has_permission('support.manage'));

create policy "notifications: staff read admin feed" on public.notifications
  for select using (channel = 'admin' and public.is_staff());
create policy "notifications: staff mark read" on public.notifications
  for update using (channel = 'admin' and public.is_staff()) with check (channel = 'admin' and public.is_staff());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Settings: public business info readable by all; payment settings need their own permission.
create policy "settings: public read" on public.settings
  for select using (is_public or public.has_permission('settings.manage'));
create policy "settings: staff write" on public.settings
  for all using (
    public.has_permission(case when key like 'payment%' then 'payments.settings' else 'settings.manage' end)
  ) with check (
    public.has_permission(case when key like 'payment%' then 'payments.settings' else 'settings.manage' end)
  );

create policy "audit_logs: staff read" on public.audit_logs
  for select using (public.has_permission('reports.view') or public.has_permission('admins.manage'));

-- rate_limits and order_number_counters: no policies -> service role only.

-- Views are security invoker; make sure the API roles can read them.
grant select on public.product_cards, public.inventory, public.customers to anon, authenticated;
