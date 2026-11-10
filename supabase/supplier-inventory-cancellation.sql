-- Track allocations for new orders only. Old orders are not restocked implicitly.
begin;
create table if not exists public.order_inventory_allocations(
 order_id bigint not null references orders(id) on delete cascade,
 product_id bigint not null references products(id),
 base_quantity integer not null check(base_quantity>=0),
 supplier_quantity integer not null check(supplier_quantity>=0),
 released boolean not null default false,
 primary key(order_id,product_id)
);
alter table public.order_inventory_allocations enable row level security;
revoke all on public.order_inventory_allocations from public,anon,authenticated;
create or replace function public.release_cancelled_order_inventory()
returns trigger language plpgsql security definer set search_path=public as $$
declare allocation record;
begin
 if OLD.status='cancelled' and NEW.status<>'cancelled' and exists(select 1 from order_inventory_allocations where order_id=NEW.id and released) then
  raise exception 'Cancelled order inventory was released. Create a new order to reserve stock again.';
 end if;
 if NEW.status='cancelled' and OLD.status is distinct from NEW.status then
  for allocation in select * from order_inventory_allocations where order_id=NEW.id and not released order by product_id for update loop
   perform 1 from products where id=allocation.product_id for update;
   update products p set stock_quantity=p.stock_quantity+allocation.base_quantity,
    supplier_reserved_quantity=greatest(0,p.supplier_reserved_quantity-allocation.supplier_quantity),
    supplier_available_quantity=greatest(0,coalesce((select max(o.stock_quantity) from supplier_offers o where o.product_id=p.id and o.stock_kind='exact'),0)-greatest(0,p.supplier_reserved_quantity-allocation.supplier_quantity))
    where p.id=allocation.product_id;
   update order_inventory_allocations set released=true where order_id=NEW.id and product_id=allocation.product_id;
  end loop;
 end if;
 return NEW;
end $$;
revoke all on function public.release_cancelled_order_inventory() from public,anon,authenticated;
create or replace trigger release_cancelled_order_inventory before update of status on public.orders for each row execute function public.release_cancelled_order_inventory();
commit;

begin;
create or replace function public.create_store_order_v2(p_payload jsonb)
returns bigint language plpgsql security definer set search_path=public as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_promo public.promotions%rowtype;
  v_quantity integer;
  v_price numeric(12,2);
  v_total numeric(12,2):=0;
  v_lines jsonb:='[]'::jsonb;
  v_order_id bigint;
  v_now timestamptz:=now();
begin
  if coalesce(p_payload->>'consent','false')<>'true'
    or coalesce(p_payload#>>'{customer,phone}','') !~ '^\+380[0-9]{9}$'
    or coalesce(trim(p_payload#>>'{customer,name}'),'')=''
    or coalesce(trim(p_payload#>>'{customer,lastName}'),'')='' then
    raise exception 'Invalid order data';
  end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' then
    raise exception 'Invalid items';
  end if;
  if jsonb_array_length(p_payload->'items') not between 1 and 100 then
    raise exception 'Invalid items';
  end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'items') x
      group by x->>'productId' having count(*)>1) then
    raise exception 'Duplicate products';
  end if;
  -- Ordered locks avoid deadlocks. All checked prices are stored in v_lines;
  -- totals and order_items never recalculate different prices on a second pass.
  for v_item in select value from jsonb_array_elements(p_payload->'items')
    order by (value->>'productId')::bigint loop
    if coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then raise exception 'Invalid quantity'; end if;
    v_quantity:=(v_item->>'quantity')::integer;
    if v_quantity not between 1 and 99 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products
      where id=(v_item->>'productId')::bigint and is_active=true for update;
    if not found or greatest(case when v_product.in_stock then v_product.stock_quantity else 0 end,v_product.supplier_available_quantity)<v_quantity then
      raise exception 'Product % is unavailable',v_item->>'productId';
    end if;
    select p.* into v_promo from public.promotions p
      where p.is_active=true and (p.starts_at is null or p.starts_at<=v_now)
      and (p.ends_at is null or p.ends_at>=v_now)
      and (p.target_type='all'
        or (p.target_type='category' and p.target_value=v_product.category)
        or (p.target_type='brand' and p.target_value=v_product.brand_id::text)
        or (p.target_type='products' and exists (
          select 1 from public.promotion_products pp where pp.promotion_id=p.id
            and (pp.product_id=v_product.id or pp.product_id=v_product.parent_product_id))))
      order by p.id limit 1;
    v_price:=round(greatest(0,case when v_promo.id is null then v_product.price
      when v_promo.discount_type='percent' then v_product.price*(1-v_promo.discount_value/100)
      else v_product.price-v_promo.discount_value end),2);
    if v_item->>'expectedUnitPrice' is null
      or round((v_item->>'expectedUnitPrice')::numeric,2)<>v_price then
      raise exception 'Price changed for product %',v_product.id;
    end if;
    v_total:=v_total+v_price*v_quantity;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('productId',v_product.id,
      'name',v_product.name,'quantity',v_quantity,'unitPrice',v_price,'promotionId',v_promo.id));
  end loop;
  insert into public.orders(customer_name,customer_phone,customer_email,city,address,comment,total,checkout_details)
    values(concat_ws(' ',p_payload#>>'{customer,name}',p_payload#>>'{customer,lastName}'),
      p_payload#>>'{customer,phone}',nullif(p_payload#>>'{customer,email}',''),
      p_payload#>>'{delivery,city}',p_payload#>>'{delivery,address}',p_payload#>>'{delivery,comment}',v_total,
      (p_payload-'items')||jsonb_build_object('lines',v_lines)) returning id into v_order_id;
  for v_item in select value from jsonb_array_elements(v_lines) loop
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
      values(v_order_id,(v_item->>'productId')::bigint,v_item->>'name',
        (v_item->>'unitPrice')::numeric,(v_item->>'quantity')::integer);
    insert into public.order_inventory_allocations(order_id,product_id,base_quantity,supplier_quantity)
      select v_order_id,id,least(stock_quantity,(v_item->>'quantity')::integer),(v_item->>'quantity')::integer
      from public.products where id=(v_item->>'productId')::bigint;
    update public.products set stock_quantity=greatest(0,stock_quantity-(v_item->>'quantity')::integer),
      supplier_reserved_quantity=supplier_reserved_quantity+(v_item->>'quantity')::integer,
      supplier_available_quantity=greatest(0,supplier_available_quantity-(v_item->>'quantity')::integer)
      where id=(v_item->>'productId')::bigint;
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.create_store_order_v2(jsonb) from public,anon,authenticated;
grant execute on function public.create_store_order_v2(jsonb) to service_role;

commit;
