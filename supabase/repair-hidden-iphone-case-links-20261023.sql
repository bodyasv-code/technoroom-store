-- Separately approved hidden cases. Keep hidden status, names, descriptions,
-- prices, stock and all specifications unchanged. Backup before detaching.
begin;
select id from public.products where id in (3502,3505,3506,3507,3582,3583,3584) order by id for update;
do $$
declare n integer;
begin
  select count(*) into n from public.products where id in (3502,3505,3506,3507,3582,3583,3584)
    and not is_active and parent_product_id in (4295,4296) and name ~* '(case|чохол|чехол)';
  if n<>7 then raise exception 'Hidden accessory scope changed: %',n; end if;
end $$;
insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row)
select 'iphone-hidden-cases-20261023',id,to_jsonb(p) from public.products p
where id in (3502,3505,3506,3507,3582,3583,3584) on conflict(operation,product_id) do nothing;
update public.products set parent_product_id=null,variant_label=null
where id in (3502,3505,3506,3507,3582,3583,3584) and parent_product_id in (4295,4296) and not is_active;
commit;
select id,name,is_active,parent_product_id from public.products where id in (3502,3505,3506,3507,3582,3583,3584) order by id;
