-- Apply after admin-upgrade.sql. Keeps numeric stock and status consistent.
-- Does not convert supplier stock into catalog stock.
begin;
create or replace function public.sync_product_availability()
returns trigger language plpgsql as $$
begin
  new.in_stock := new.stock_quantity > 0;
  if new.stock_quantity > 0 then
    if new.availability_status is distinct from 'limited_stock' then
      new.availability_status := 'in_stock';
    end if;
  elsif new.availability_status is distinct from 'under_order' then
    new.availability_status := 'out_of_stock';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists sync_product_availability_before_write on public.products;
create trigger sync_product_availability_before_write
before insert or update of stock_quantity,in_stock,availability_status on public.products
for each row execute function public.sync_product_availability();
-- Normalize existing contradictory labels without changing quantities.
update public.products set stock_quantity=stock_quantity
where in_stock is distinct from (stock_quantity>0)
 or (stock_quantity>0 and availability_status not in ('in_stock','limited_stock'))
 or (stock_quantity=0 and availability_status in ('in_stock','limited_stock'));
commit;
