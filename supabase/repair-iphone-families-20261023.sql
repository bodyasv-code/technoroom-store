-- Approved scope: 3 cases detached, 7 generated parent cards repaired,
-- 4 parents without active variants hidden. No deletion, price/stock/SKU changes.
begin;
create schema if not exists technoroom_maintenance;
create table if not exists technoroom_maintenance.product_repair_backup (
  operation text not null, product_id bigint not null, before_row jsonb not null,
  backed_up_at timestamptz not null default now(), primary key(operation,product_id)
);
alter table technoroom_maintenance.product_repair_backup enable row level security;
-- This schema is not an API-exposed schema and no grants/policies are added.
select id from public.products where id between 4294 and 4304 or id in (3887,3888,3889) order by id for update;
do $$
declare n integer;
begin
  select count(*) into n from public.products where id between 4294 and 4304 and slug like 'apple-family-iphone-%';
  if n<>11 then raise exception 'Unexpected family scope: %',n; end if;
  select count(*) into n from public.products where id in (3887,3888,3889) and parent_product_id=4294 and name ~* '(case|чохол|чехол)';
  if n<>3 then raise exception 'Case links changed: %',n; end if;
  if exists(select 1 from public.products c where c.parent_product_id in (4297,4298,4302,4303) and c.is_active) then raise exception 'A hidden-scope family now has an active child'; end if;
end $$;
insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row)
select 'iphone-families-20261023',id,to_jsonb(p) from public.products p
where id between 4294 and 4304 or id in (3887,3888,3889)
on conflict(operation,product_id) do nothing;

update public.products set parent_product_id=null,variant_label=null
where id in (3887,3888,3889) and parent_product_id=4294;

do $$
declare f record; representative record; changed integer:=0;
begin
  for f in select * from public.products where id in (4294,4295,4296,4299,4300,4301,4304) order by id loop
    select c.* into representative from public.products c
    where c.parent_product_id=f.id and c.is_active and nullif(btrim(c.image_path),'') is not null
      and c.name ~* '^\s*(смартфон|smartphone|iphone)\M'
      and c.name !~* '(case|cover|чохол|чехол|кабель|cable|charger|зарядн|адаптер)'
      and not (coalesce(c.specifications,'{}'::jsonb) ? 'Тип чохла')
    order by (coalesce(c.stock_quantity,0)>0) desc,(c.price>0) desc,c.id limit 1;
    if representative.id is null then raise exception 'No verified image representative for family %',f.id; end if;
    if not (coalesce(f.specifications,'{}'::jsonb) ? 'Тип чохла') then raise exception 'Family % no longer has the audited case metadata',f.id; end if;
    update public.products set
      description=f.name||'. Оберіть доступну модифікацію, щоб переглянути її характеристики, ціну та наявність.',
      specifications=jsonb_build_object('Тип товару','Сімейство смартфонів','Модель',replace(f.name,'Смартфон ','')),
      image_path=representative.image_path,image_paths=jsonb_build_array(representative.image_path)
    where id=f.id;
    changed:=changed+1;
  end loop;
  if changed<>7 then raise exception 'Unexpected repaired count: %',changed; end if;
end $$;
update public.products set is_active=false where id in (4297,4298,4302,4303);
do $$
begin
  if exists(select 1 from public.products p join technoroom_maintenance.product_repair_backup b on b.product_id=p.id and b.operation='iphone-families-20261023'
    where p.price is distinct from (b.before_row->>'price')::numeric
       or p.stock_quantity is distinct from (b.before_row->>'stock_quantity')::integer
       or p.sku is distinct from b.before_row->>'sku') then raise exception 'Protected commercial field changed'; end if;
end $$;
commit;
select id,name,is_active,image_path,(select count(*) from public.products c where c.parent_product_id=p.id and c.is_active) as active_variants
from public.products p where id between 4294 and 4304 order by id;
