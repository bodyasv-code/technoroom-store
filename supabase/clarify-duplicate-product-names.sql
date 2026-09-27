-- TECHNOROOM: зробити однакові назви товарів зрозумілими.
-- Для груп з однаковою назвою додає SKU наприкінці: «… — MODEL-SKU».
-- Ціни, фото, описи, характеристики й наявність не змінюються.
-- Безпечно запускати повторно: SKU не буде дописано вдруге.
-- Після запуску правило також працюватиме для всіх наступних імпортів.

begin;

with duplicate_names as (
  select lower(regexp_replace(trim(name), '\s+', ' ', 'g')) as normalized_name
  from public.products
  where nullif(trim(name), '') is not null
  group by lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
  having count(*) > 1
)
update public.products as product
set name = regexp_replace(trim(product.name), '\s+', ' ', 'g') || ' — ' || trim(product.sku)
from duplicate_names
where lower(regexp_replace(trim(product.name), '\s+', ' ', 'g')) = duplicate_names.normalized_name
  and nullif(trim(product.sku), '') is not null
  and right(product.name, length(trim(product.sku)) + 3) is distinct from ' — ' || trim(product.sku);

-- Під час наступних імпортів одразу прибираємо неоднозначність назв.
-- Якщо та сама базова назва вже є з іншим SKU, обидві позиції отримують
-- зрозуміле завершення «— SKU». Це не змінює ціни, фото чи характеристики.
create or replace function public.clarify_product_name_on_duplicate()
returns trigger
language plpgsql
as $$
declare
  base_name text;
  clean_sku text;
begin
  base_name := regexp_replace(trim(coalesce(new.name, '')), '\s+', ' ', 'g');
  clean_sku := trim(coalesce(new.sku, ''));

  if base_name = '' or clean_sku = ''
     or right(base_name, length(clean_sku) + 3) = ' — ' || clean_sku then
    return new;
  end if;

  if exists (
    select 1
    from public.products as existing
    where existing.id is distinct from new.id
      and lower(regexp_replace(trim(existing.name), '\s+', ' ', 'g')) = lower(base_name)
      and nullif(trim(existing.sku), '') is not null
      and trim(existing.sku) <> clean_sku
  ) then
    update public.products as existing
    set name = regexp_replace(trim(existing.name), '\s+', ' ', 'g') || ' — ' || trim(existing.sku)
    where existing.id is distinct from new.id
      and lower(regexp_replace(trim(existing.name), '\s+', ' ', 'g')) = lower(base_name)
      and nullif(trim(existing.sku), '') is not null
      and right(existing.name, length(trim(existing.sku)) + 3) is distinct from ' — ' || trim(existing.sku);

    new.name := base_name || ' — ' || clean_sku;
  end if;

  return new;
end;
$$;

drop trigger if exists clarify_product_name_on_duplicate on public.products;
create trigger clarify_product_name_on_duplicate
before insert or update of name, sku on public.products
for each row execute function public.clarify_product_name_on_duplicate();

commit;
