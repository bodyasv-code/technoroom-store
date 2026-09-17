-- Live catalog and image storage. Run after commerce-upgrade.sql.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public product image read" on storage.objects;
drop policy if exists "admins manage product images" on storage.objects;
create policy "public product image read" on storage.objects
for select to public using (bucket_id = 'product-images');
create policy "admins manage product images" on storage.objects
for all to authenticated using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

