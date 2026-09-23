-- Fix Technoroom admin product DELETE permissions.
-- Safe to run repeatedly.
begin;

alter table public.products enable row level security;

drop policy if exists "admins delete products" on public.products;
create policy "admins delete products"
on public.products
for delete
to authenticated
using (public.is_admin());

grant delete on public.products to authenticated;

commit;

-- Diagnostic: run while logged into Supabase SQL Editor only to inspect policies.
select policyname, cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='products'
order by policyname, cmd;
