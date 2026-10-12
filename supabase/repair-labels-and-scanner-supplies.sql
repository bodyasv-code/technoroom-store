-- Narrow repair of the 19 verified products from the owner's screenshots.
-- Prices, stock, descriptions, specifications and URLs are not changed.
begin;
insert into public.categories(name,slug,parent_id,sort_order,is_active)
select 'Етикетки та термоетикетки','office-consumables-labels',id,60,true
from public.categories where slug='office-consumables'
on conflict(slug) do nothing;

update public.products
set category='office-consumables-labels',
    name=case when right(name,length(sku)+2)='('||sku||')' then name else name||' ('||sku||')' end
where id in (4793,4794,4795,4796,4797)
  and category='office-printers' and name ilike 'Термоетикетка 2E%'
  and exists(select 1 from public.categories where slug='office-consumables-labels');

update public.products set category='office-accessories'
where id in (4670,4671,4672,4673,4674,4675,4676,4677,4678,4679,4680,4681,4682,4683)
  and category='office-scanners'
  and (name ilike 'Комплект ресурсних матеріалів для сканер%' or name ilike 'Підкладка для сканера%')
  and exists(select 1 from public.categories where slug='office-accessories');
commit;

select category,count(*) as repaired_products
from public.products where id in (4793,4794,4795,4796,4797,4670,4671,4672,4673,4674,4675,4676,4677,4678,4679,4680,4681,4682,4683)
group by category;
