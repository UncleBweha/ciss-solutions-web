-- "Compatible with", typed by staff on the product page: one printer model (or range) per
-- entry, e.g. 'Epson L3250'. It replaces ticking models in a list. Entries that match a
-- printer model by name are still linked in product_compatibility by the app, so the parts
-- finder keeps working; the text itself is shown on the product page and is searchable.

alter table public.products add column if not exists compatible_with text[] not null default '{}';

-- Same function as before, plus the new column.
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
    (select string_agg(v.sku || ' ' || v.name, ' ') from product_variants v where v.product_id = p.id),
    nullif(array_to_string(p.compatible_with, ' '), '')
  );
$$;

drop trigger if exists products_search_text on public.products;
create trigger products_search_text
  before insert or update of name, sku, part_number, oem_number, barcode, short_description,
    brand_id, category_id, printer_model_id, compatible_with, search_text
  on public.products
  for each row execute function public.products_set_search_text();
