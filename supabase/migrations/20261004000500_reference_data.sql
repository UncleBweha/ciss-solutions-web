-- CISS Solutions: reference data required in every environment.
-- Values here are starting points; staff edit them from /admin.

-- Role permissions ---------------------------------------------------------------
-- super_admin implicitly has every permission (see has_permission()).
insert into public.role_permissions (role, permission) values
  ('admin', 'products.manage'), ('admin', 'inventory.manage'), ('admin', 'catalog.manage'),
  ('admin', 'orders.manage'), ('admin', 'orders.refund'), ('admin', 'customers.view'),
  ('admin', 'coupons.manage'), ('admin', 'content.manage'), ('admin', 'reviews.moderate'),
  ('admin', 'support.manage'), ('admin', 'settings.manage'), ('admin', 'payments.settings'),
  ('admin', 'reports.view'), ('admin', 'admins.manage'),

  ('manager', 'products.manage'), ('manager', 'inventory.manage'), ('manager', 'catalog.manage'),
  ('manager', 'orders.manage'), ('manager', 'orders.refund'), ('manager', 'customers.view'),
  ('manager', 'coupons.manage'), ('manager', 'content.manage'), ('manager', 'reviews.moderate'),
  ('manager', 'support.manage'), ('manager', 'reports.view'),

  ('inventory_manager', 'products.manage'), ('inventory_manager', 'inventory.manage'),

  ('order_manager', 'orders.manage'), ('order_manager', 'customers.view'),

  ('content_manager', 'content.manage'), ('content_manager', 'catalog.manage'),
  ('content_manager', 'reviews.moderate'),

  ('support_agent', 'support.manage'), ('support_agent', 'customers.view')
on conflict do nothing;

-- Settings -----------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
  ('business', jsonb_build_object(
     'name', 'CISS Solutions',
     'tagline', 'Printers, spare parts, ink & toner in Kenya',
     'phone', '',
     'whatsapp', '',
     'email', '',
     'location', 'Nairobi, Kenya',
     'address', '',
     'business_hours', 'Mon – Fri 8:00 – 18:00, Sat 9:00 – 15:00',
     'mpesa_paybill', '',
     'mpesa_account_hint', 'Your order number',
     'socials', jsonb_build_object('instagram', '', 'facebook', '', 'tiktok', '', 'youtube', '')
   ), true),
  ('payment_methods', jsonb_build_object(
     'mpesa', jsonb_build_object('enabled', true, 'label', 'M-Pesa'),
     'card', jsonb_build_object('enabled', false, 'label', 'Card'),
     'bank_transfer', jsonb_build_object('enabled', true, 'label', 'Bank transfer',
        'bank_name', '', 'account_name', '', 'account_number', '', 'branch', '',
        'instructions', 'Use your order number as the payment reference. We confirm transfers within one business day.'),
     'cash_on_delivery', jsonb_build_object('enabled', true, 'label', 'Cash on delivery',
        'counties', jsonb_build_array('Nairobi'))
   ), true),
  ('checkout', jsonb_build_object(
     'mpesa_reservation_minutes', 30,
     'bank_transfer_reservation_minutes', 2880,
     'max_quantity_per_item', 20
   ), true),
  ('seo', jsonb_build_object(
     'default_title', 'CISS Solutions | Printers, Spare Parts, Ink & Toner in Kenya',
     'default_description', 'Shop genuine printers, printer spare parts, ink, toner, scanners and accessories from top brands with nationwide delivery across Kenya.'
   ), true),
  ('notifications', jsonb_build_object('admin_emails', jsonb_build_array(), 'from_email', ''), false)
on conflict (key) do nothing;

-- Homepage sections --------------------------------------------------------------
insert into public.homepage_sections (key, title, subtitle, is_enabled, sort_order, config) values
  ('hero', null, null, true, 10, '{}'),
  ('trust', null, null, true, 20, '{}'),
  ('categories', 'Shop by category', 'Everything you need to keep printing', true, 30, '{"limit": 6}'),
  ('featured', 'Featured products', null, true, 40, '{"limit": 10}'),
  ('part_finder', 'Find the right spare part', 'Search by printer model or part number', true, 50, '{}'),
  ('deals', 'Deals', 'Limited-time savings on printers and supplies', true, 60, '{"limit": 5}'),
  ('bestsellers', 'Best sellers', null, true, 70, '{"limit": 5}'),
  ('brands', 'Shop by brand', null, true, 80, '{}'),
  ('cta', 'Not sure which part you need?', 'Send us your printer model and the problem. Our technicians will find the right part.', true, 90,
   '{"cta_text": "Get help finding a part", "cta_url": "/support/part-request"}')
on conflict (key) do nothing;

-- Delivery zones (example fees; configure in Admin -> Settings -> Delivery) -----------
insert into public.delivery_zones (name, counties, fee, estimated_days_min, estimated_days_max, estimate_label, is_default, sort_order) values
  ('Nairobi', array['Nairobi'], 200, 0, 1, 'Same day / next day', false, 10),
  ('Nairobi metro', array['Kiambu', 'Machakos', 'Kajiado'], 300, 1, 2, '1–2 business days', false, 20),
  ('Major towns', array['Mombasa', 'Kisumu', 'Nakuru', 'Uasin Gishu', 'Nyeri', 'Kilifi', 'Meru'], 500, 1, 3, '1–3 business days', false, 30),
  ('Other locations', array[]::text[], 600, 2, 5, 'Courier, 2–5 business days', true, 40);
