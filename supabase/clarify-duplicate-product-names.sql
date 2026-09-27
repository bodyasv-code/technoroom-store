-- TECHNOROOM: зробити однакові назви товарів зрозумілими.
-- Для груп з однаковою назвою додає SKU наприкінці: «… — MODEL-SKU».
-- Ціни, фото, описи, характеристики й наявність не змінюються.
-- Безпечно запускати повторно: SKU не буде дописано вдруге.

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

commit;
