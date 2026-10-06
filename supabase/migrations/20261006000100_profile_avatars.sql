-- CISS Solutions: customer profile pictures
-- A customer may upload a picture; without one the store shows their Google picture.

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Customers keep their picture in a folder named after their user id.
create policy "avatars: own folder insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: own folder delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
