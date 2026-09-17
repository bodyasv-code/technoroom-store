-- TECHNOROOM admin upgrade: safe to run once in Supabase SQL Editor.
-- It only adds fields; existing products and orders remain unchanged.

alter table public.products add column if not exists sku text;
alter table public.products add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0);

create unique index if not exists products_sku_unique_not_empty
  on public.products (sku) where sku is not null and sku <> '';

-- Preserve the previous availability flag: existing available goods start with 10 units.
update public.products
set stock_quantity = 10
where in_stock = true and stock_quantity = 0;

update public.products
set in_stock = (stock_quantity > 0);

-- Keep `in_stock` correct when a manager changes the numeric stock level.
create or replace function public.sync_product_availability()
returns trigger language plpgsql as $$
begin
  new.in_stock := new.stock_quantity > 0;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_product_availability_before_write on public.products;
create trigger sync_product_availability_before_write
before insert or update of stock_quantity on public.products
for each row execute function public.sync_product_availability();

grant usage, select on all sequences in schema public to authenticated;

