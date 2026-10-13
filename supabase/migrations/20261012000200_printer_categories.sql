-- "Printer Spare Parts" and "Printer Accessories" as main categories.
-- Existing "Spare Parts" / "Accessories" categories are renamed in place: their slugs
-- (/c/spare-parts, /c/accessories), subcategories and products stay. A name staff have
-- already changed is left alone. Missing ones are created in a store that already has
-- categories (a fresh database gets them from seed.sql). Safe to run more than once.

update public.categories
   set name = 'Printer Spare Parts',
       seo_title = case when seo_title is null or seo_title = 'Spare Parts in Kenya | CISS Solutions' then 'Printer Spare Parts in Kenya | CISS Solutions' else seo_title end
 where slug = 'spare-parts' and name = 'Spare Parts';

update public.categories
   set name = 'Printer Accessories',
       description = case when description is null or description = 'Cables and printer accessories.'
                          then 'USB and network cables, power cords, paper trays, cleaning kits and other printer accessories.' else description end,
       seo_title = case when seo_title is null or seo_title = 'Accessories in Kenya | CISS Solutions' then 'Printer Accessories in Kenya | CISS Solutions' else seo_title end
 where slug = 'accessories' and name = 'Accessories';

insert into public.categories (name, slug, parent_id, description, image_url, sort_order, seo_title, seo_description, is_active)
select 'Printer Spare Parts', 'spare-parts', null,
       'Genuine and compatible printer spare parts: rollers, printheads, fusers and maintenance kits.',
       '/images/products/printhead.svg', 80,
       'Printer Spare Parts in Kenya | CISS Solutions',
       'Genuine and compatible printer spare parts: rollers, printheads, fusers and maintenance kits.', true
 where exists (select 1 from public.categories)
   and not exists (select 1 from public.categories where slug = 'spare-parts' or lower(name) = 'printer spare parts');

insert into public.categories (name, slug, parent_id, description, image_url, sort_order, seo_title, seo_description, is_active)
select 'Printer Accessories', 'accessories', null,
       'USB and network cables, power cords, paper trays, cleaning kits and other printer accessories.',
       '/images/products/usb-cable.svg',
       coalesce((select max(sort_order) from public.categories where parent_id is null), 0) + 10,
       'Printer Accessories in Kenya | CISS Solutions',
       'USB and network cables, power cords, paper trays, cleaning kits and other printer accessories.', true
 where exists (select 1 from public.categories)
   and not exists (select 1 from public.categories where slug = 'accessories' or lower(name) = 'printer accessories');
