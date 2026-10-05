-- CISS Solutions: core ecommerce schema
-- Tables, enums, indexes and maintenance triggers. Business functions live in
-- 20261004000200_functions.sql and Row Level Security in 20261004000300_rls.sql.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'customer', 'super_admin', 'admin', 'manager', 'inventory_manager',
  'order_manager', 'content_manager', 'support_agent'
);

create type public.product_status as enum ('draft', 'active', 'archived');

create type public.product_type as enum (
  'simple', 'variable', 'printer', 'spare_part', 'accessory', 'ink_toner', 'scanner', 'paper'
);

create type public.order_status as enum (
  'PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'READY_FOR_DISPATCH',
  'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED'
);

create type public.payment_status as enum (
  'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'
);

create type public.payment_method as enum ('mpesa', 'card', 'bank_transfer', 'cash_on_delivery');

-- reserved: stock held for the order; deducted: sale confirmed; released: hold returned;
-- restocked: deducted stock returned (cancellation); shortage: paid after the hold lapsed
-- and stock was no longer available, needs staff attention.
create type public.stock_state as enum ('reserved', 'deducted', 'released', 'restocked', 'shortage');

create type public.review_status as enum ('pending', 'approved', 'rejected');

create type public.discount_type as enum ('percentage', 'fixed');

create type public.inventory_reason as enum (
  'purchase', 'sale', 'manual_adjustment', 'return', 'damage', 'correction', 'order_cancellation'
);

create type public.support_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role public.user_role not null,
  permission text not null,
  primary key (role, permission)
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  website text,
  seo_title text,
  seo_description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete set null,
  description text,
  image_url text,
  seo_title text,
  seo_description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);
create index categories_parent_idx on public.categories (parent_id);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.printer_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  name text not null,
  model_number text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, model_number)
);
create index printer_models_brand_idx on public.printer_models (brand_id);
create index printer_models_model_trgm on public.printer_models
  using gin (model_number extensions.gin_trgm_ops);
create trigger printer_models_updated_at before update on public.printer_models
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text not null unique,
  barcode text,
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  -- the printer model this product *is* (printers only); drives "compatible parts" cross-sell
  printer_model_id uuid references public.printer_models (id) on delete set null,
  product_type public.product_type not null default 'simple',
  short_description text,
  description text,
  part_number text,
  oem_number text,
  condition text,
  specifications jsonb not null default '[]'::jsonb, -- [{ "label": "Print Speed", "value": "33 ppm" }]
  features text[] not null default '{}',
  whats_included text[] not null default '{}',
  warranty text,
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  available_quantity int generated always as (stock_quantity - reserved_quantity) stored,
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  weight_kg numeric(8, 3),
  dimensions text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  is_new boolean not null default false,
  is_on_sale boolean not null default false,
  discount_percent int generated always as (
    case when compare_at_price is not null and compare_at_price > price and compare_at_price > 0
      then floor((compare_at_price - price) / compare_at_price * 100)::int
      else 0 end
  ) stored,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  sales_count int not null default 0,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image_url text,
  -- denormalised text maintained by trigger: brand, category, part numbers, compatible models
  search_text text not null default '',
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(search_text, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_reserved_le_stock check (reserved_quantity <= stock_quantity)
);
create index products_brand_idx on public.products (brand_id);
create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_price_idx on public.products (price);
create index products_created_idx on public.products (created_at desc);
create index products_printer_model_idx on public.products (printer_model_id);
create index products_featured_idx on public.products (is_featured) where is_featured;
create index products_search_vector_idx on public.products using gin (search_vector);
create index products_search_trgm_idx on public.products
  using gin ((lower(name || ' ' || sku || ' ' || search_text)) extensions.gin_trgm_ops);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Cost price is internal; kept out of the public products row entirely.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  sku text not null unique,
  option_values jsonb not null default '{}'::jsonb, -- { "Colour": "Cyan" }
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  available_quantity int generated always as (stock_quantity - reserved_quantity) stored,
  low_stock_threshold int not null default 5,
  image_url text,
  weight_kg numeric(8, 3),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_reserved_le_stock check (reserved_quantity <= stock_quantity)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  url text not null,
  storage_path text, -- set when the file lives in the product-images bucket
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

create table public.product_compatibility (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  printer_model_id uuid not null references public.printer_models (id) on delete cascade,
  compatibility_notes text,
  created_at timestamptz not null default now(),
  unique (product_id, printer_model_id)
);
create index product_compatibility_product_idx on public.product_compatibility (product_id);
create index product_compatibility_model_idx on public.product_compatibility (printer_model_id);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  previous_quantity int not null,
  change int not null,
  new_quantity int not null,
  reason public.inventory_reason not null,
  reference text, -- order number, purchase order, etc.
  note text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_transactions_product_idx on public.inventory_transactions (product_id, created_at desc);

-- One row per stock-keeping unit: products without variants, plus each variant.
create view public.inventory with (security_invoker = on) as
  select p.id as product_id, null::uuid as variant_id, p.name, p.sku,
         p.stock_quantity, p.reserved_quantity, p.available_quantity, p.low_stock_threshold,
         p.status, (p.available_quantity <= p.low_stock_threshold) as is_low_stock
    from public.products p
   where not exists (select 1 from public.product_variants v where v.product_id = p.id)
  union all
  select v.product_id, v.id, p.name || ' — ' || v.name, v.sku,
         v.stock_quantity, v.reserved_quantity, v.available_quantity, v.low_stock_threshold,
         p.status, (v.available_quantity <= v.low_stock_threshold)
    from public.product_variants v
    join public.products p on p.id = v.product_id;

-- ---------------------------------------------------------------------------
-- Delivery, coupons
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  counties text[] not null default '{}',
  fee numeric(12, 2) not null check (fee >= 0),
  free_delivery_threshold numeric(12, 2),
  estimated_days_min int not null default 1,
  estimated_days_max int not null default 3,
  estimate_label text, -- e.g. "Same day / next day"
  is_default boolean not null default false, -- fallback zone for counties not listed elsewhere
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index delivery_zones_one_default on public.delivery_zones (is_default) where is_default;
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  discount_type public.discount_type not null,
  value numeric(12, 2) not null check (value > 0),
  minimum_order numeric(12, 2) not null default 0,
  maximum_discount numeric(12, 2),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int,
  per_customer_limit int,
  usage_count int not null default 0,
  applicable_product_ids uuid[] not null default '{}',
  applicable_category_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percentage_range check (discount_type <> 'percentage' or value <= 100)
);
create unique index coupons_code_idx on public.coupons (upper(code));
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders & payments
-- ---------------------------------------------------------------------------
create table public.order_number_counters (
  day date primary key,
  last_value int not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  -- lets a guest view their own confirmation page without an account
  access_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  subtotal numeric(12, 2) not null,
  delivery_fee numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  currency text not null default 'KES',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'PENDING',
  order_status public.order_status not null default 'PENDING',
  stock_state public.stock_state not null default 'reserved',
  reservation_expires_at timestamptz,
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name text,
  delivery_county text not null,
  delivery_town text not null,
  delivery_address text not null,
  delivery_instructions text,
  customer_notes text,
  admin_notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_check check (total >= 0 and subtotal >= 0 and discount >= 0 and delivery_fee >= 0)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_order_status_idx on public.orders (order_status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (customer_phone);
create index orders_reservation_idx on public.orders (reservation_expires_at)
  where stock_state = 'reserved';
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- snapshots: the order must not change when the catalogue does
  product_name text not null,
  variant_name text,
  sku text not null,
  image_url text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) not null check (total_price >= 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  customer_phone text,
  customer_email text,
  discount_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index coupon_usage_coupon_idx on public.coupon_usage (coupon_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method public.payment_method not null,
  provider text not null, -- 'mpesa_daraja', 'mpesa_mock', 'manual'
  status public.payment_status not null default 'PENDING',
  amount numeric(12, 2) not null,
  phone_number text,
  transaction_reference text, -- e.g. M-Pesa receipt number
  merchant_request_id text,
  checkout_request_id text,
  result_code text,
  result_description text,
  raw_response jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, created_at desc);
create unique index payments_checkout_request_idx on public.payments (checkout_request_id)
  where checkout_request_id is not null;
create unique index payments_transaction_reference_idx on public.payments (transaction_reference)
  where transaction_reference is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Customers: addresses, carts, wishlists, reviews
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  county text not null,
  town text not null,
  address_line text not null,
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default now(),
  unique nulls not distinct (cart_id, product_id, variant_id)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wishlist_id, product_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text,
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  photos text[] not null default '{}',
  status public.review_status not null default 'pending',
  is_verified_purchase boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, status);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content, support, notifications, settings, audit
-- ---------------------------------------------------------------------------
create table public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  eyebrow text,
  title text not null,
  highlight text, -- second title line rendered in the accent gradient
  subtitle text,
  image_url text,
  image_alt text,
  cta_text text,
  cta_url text,
  secondary_cta_text text,
  secondary_cta_url text,
  background text, -- optional CSS colour/gradient override
  featured_product_id uuid references public.products (id) on delete set null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger homepage_banners_updated_at before update on public.homepage_banners
  for each row execute function public.set_updated_at();

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- hero, trust, categories, featured, bestsellers, deals, part_finder, brands, cta
  title text,
  subtitle text,
  is_enabled boolean not null default true,
  sort_order int not null default 0,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger homepage_sections_updated_at before update on public.homepage_sections
  for each row execute function public.set_updated_at();

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('contact', 'part_request')),
  name text not null,
  email text,
  phone text,
  subject text,
  printer_brand text,
  printer_model text,
  message text not null,
  attachment_path text, -- support-attachments bucket (private)
  status public.support_status not null default 'open',
  admin_response text,
  responded_at timestamptz,
  responded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_status_idx on public.support_requests (status, created_at desc);
create trigger support_requests_updated_at before update on public.support_requests
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'admin')),
  kind text not null, -- order_confirmation, new_order, low_stock, payment_failed, new_review, new_support_request, ...
  recipient text,
  subject text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  order_id uuid references public.orders (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_admin_idx on public.notifications (channel, read_at, created_at desc);

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  resource text not null,
  resource_id text,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_resource_idx on public.audit_logs (resource, resource_id);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

-- Customers: profile plus purchase stats. Visibility follows profiles/orders RLS.
create view public.customers with (security_invoker = on) as
  select p.id, p.full_name, p.email, p.phone, p.created_at,
         count(o.id)::int as orders_count,
         coalesce(sum(o.total) filter (where o.payment_status = 'PAID'), 0)::numeric(12, 2) as total_spent,
         max(o.created_at) as last_order_at
    from public.profiles p
    left join public.orders o on o.user_id = p.id
   where p.role = 'customer'
   group by p.id;

-- ---------------------------------------------------------------------------
-- Maintenance triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Product search text: brand, category, identifiers and compatible printer models.
create or replace function public.build_product_search_text(p public.products)
returns text
language sql
stable
set search_path = public
as $$
  select concat_ws(' ',
    p.sku, p.part_number, p.oem_number, p.barcode, p.short_description,
    (select b.name from brands b where b.id = p.brand_id),
    (select c.name from categories c where c.id = p.category_id),
    (select concat_ws(' ', pm.name, pm.model_number) from printer_models pm where pm.id = p.printer_model_id),
    (select string_agg(concat_ws(' ', pm.name, pm.model_number), ' ')
       from product_compatibility pc
       join printer_models pm on pm.id = pc.printer_model_id
      where pc.product_id = p.id),
    (select string_agg(v.sku || ' ' || v.name, ' ') from product_variants v where v.product_id = p.id)
  );
$$;

create or replace function public.products_set_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text = coalesce(public.build_product_search_text(new), '');
  return new;
end;
$$;

create trigger products_search_text
  before insert or update of name, sku, part_number, oem_number, barcode, short_description,
    brand_id, category_id, printer_model_id, search_text
  on public.products
  for each row execute function public.products_set_search_text();

-- Touching search_text re-runs the trigger above.
create or replace function public.refresh_product_search(p_product_id uuid)
returns void
language sql
set search_path = public
as $$
  update products set search_text = search_text where id = p_product_id;
$$;

create or replace function public.compatibility_refresh_search()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_product_search(coalesce(new.product_id, old.product_id));
  return null;
end;
$$;

create trigger product_compatibility_search
  after insert or update or delete on public.product_compatibility
  for each row execute function public.compatibility_refresh_search();

create or replace function public.variants_refresh_search()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.sku = old.sku and new.name = old.name then
    return null;
  end if;
  perform public.refresh_product_search(coalesce(new.product_id, old.product_id));
  return null;
end;
$$;

create trigger product_variants_search
  after insert or update or delete on public.product_variants
  for each row execute function public.variants_refresh_search();

create or replace function public.catalog_names_refresh_search()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name
     or (to_jsonb(new) ->> 'model_number') is distinct from (to_jsonb(old) ->> 'model_number') then
    if tg_table_name = 'brands' then
      update products set search_text = search_text where brand_id = new.id;
    elsif tg_table_name = 'categories' then
      update products set search_text = search_text where category_id = new.id;
    elsif tg_table_name = 'printer_models' then
      update products set search_text = search_text
       where printer_model_id = new.id
          or id in (select product_id from product_compatibility where printer_model_id = new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger brands_refresh_search after update on public.brands
  for each row execute function public.catalog_names_refresh_search();
create trigger categories_refresh_search after update on public.categories
  for each row execute function public.catalog_names_refresh_search();
create trigger printer_models_refresh_search after update on public.printer_models
  for each row execute function public.catalog_names_refresh_search();
