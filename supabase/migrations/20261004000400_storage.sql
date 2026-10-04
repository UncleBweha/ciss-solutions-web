-- CISS Solutions: storage buckets and policies
-- Public buckets serve catalogue/marketing images; support attachments are private
-- and served to staff through signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brand-logos', 'brand-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('category-images', 'category-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('banners', 'banners', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('review-images', 'review-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('support-attachments', 'support-attachments', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "public buckets: read" on storage.objects
  for select using (bucket_id in ('product-images', 'brand-logos', 'category-images', 'banners', 'review-images'));

create policy "product images: staff write" on storage.objects
  for all using (bucket_id = 'product-images' and public.has_permission('products.manage'))
  with check (bucket_id = 'product-images' and public.has_permission('products.manage'));

create policy "catalog images: staff write" on storage.objects
  for all using (bucket_id in ('brand-logos', 'category-images') and public.has_permission('catalog.manage'))
  with check (bucket_id in ('brand-logos', 'category-images') and public.has_permission('catalog.manage'));

create policy "banners: staff write" on storage.objects
  for all using (bucket_id = 'banners' and public.has_permission('content.manage'))
  with check (bucket_id = 'banners' and public.has_permission('content.manage'));

-- Customers upload review photos into a folder named after their user id.
create policy "review images: own folder" on storage.objects
  for insert with check (
    bucket_id = 'review-images' and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "support attachments: staff read" on storage.objects
  for select using (bucket_id = 'support-attachments' and public.has_permission('support.manage'));
