-- Run in Supabase SQL Editor BEFORE publishing the matching API/UI update.
-- Adds a column and a service-role-only function. Existing orders are untouched.
begin;
alter table public.orders add column if not exists checkout_details jsonb;

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
    if not found or not v_product.in_stock or v_product.stock_quantity<v_quantity then
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
    update public.products set stock_quantity=stock_quantity-(v_item->>'quantity')::integer
      where id=(v_item->>'productId')::bigint;
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.create_store_order_v2(jsonb) from public,anon,authenticated;
grant execute on function public.create_store_order_v2(jsonb) to service_role;
commit;
