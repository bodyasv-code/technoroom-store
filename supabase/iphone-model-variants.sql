-- TECHNOROOM: створює головні картки моделей iPhone 15–18 і прив'язує до них
-- кольори / пам'ять як модифікації. Запускати ПІСЛЯ product-variants-upgrade.sql.
-- Скрипт не видаляє товари, не змінює SKU, ціну, залишок або характеристики.
-- Безпечно запускати повторно: уже прив'язані товари не чіпає.

begin;

with candidates as (
  select
    p.*,
    case
      when p.name ~* '\miphone[[:space:]-]*15[[:space:]-]*pro[[:space:]-]*max\M' then 'iPhone 15 Pro Max'
      when p.name ~* '\miphone[[:space:]-]*15[[:space:]-]*pro\M' then 'iPhone 15 Pro'
      when p.name ~* '\miphone[[:space:]-]*15[[:space:]-]*plus\M' then 'iPhone 15 Plus'
      when p.name ~* '\miphone[[:space:]-]*15\M' then 'iPhone 15'
      when p.name ~* '\miphone[[:space:]-]*16[[:space:]-]*pro[[:space:]-]*max\M' then 'iPhone 16 Pro Max'
      when p.name ~* '\miphone[[:space:]-]*16[[:space:]-]*pro\M' then 'iPhone 16 Pro'
      when p.name ~* '\miphone[[:space:]-]*16[[:space:]-]*plus\M' then 'iPhone 16 Plus'
      when p.name ~* '\miphone[[:space:]-]*16[[:space:]-]*e\M' then 'iPhone 16e'
      when p.name ~* '\miphone[[:space:]-]*16\M' then 'iPhone 16'
      when p.name ~* '\miphone[[:space:]-]*17[[:space:]-]*pro[[:space:]-]*max\M' then 'iPhone 17 Pro Max'
      when p.name ~* '\miphone[[:space:]-]*17[[:space:]-]*pro\M' then 'iPhone 17 Pro'
      when p.name ~* '\miphone[[:space:]-]*17[[:space:]-]*air\M' then 'iPhone 17 Air'
      -- У частині XML Apple передає модель як «iPhone Air» без номера покоління.
      when p.name ~* '\miphone[[:space:]-]*air\M' then 'iPhone 17 Air'
      when p.name ~* '\miphone[[:space:]-]*17\M' then 'iPhone 17'
      when p.name ~* '\miphone[[:space:]-]*18[[:space:]-]*pro[[:space:]-]*max\M' then 'iPhone 18 Pro Max'
      when p.name ~* '\miphone[[:space:]-]*18[[:space:]-]*pro\M' then 'iPhone 18 Pro'
      when p.name ~* '\miphone[[:space:]-]*18[[:space:]-]*air\M' then 'iPhone 18 Air'
      when p.name ~* '\miphone[[:space:]-]*18\M' then 'iPhone 18'
    end as model_name
  from public.products p
  where p.parent_product_id is null
    and coalesce(p.brand, '') ~* '^apple$'
    and (p.name ~* '\miphone[[:space:]-]*(15|16|17|18)\M'
      or p.name ~* '\miphone[[:space:]-]*air\M')
),
representatives as (
  select distinct on (model_name)
    model_name, category, brand, brand_id, description, specifications, image_path, image_paths
  from candidates
  where model_name is not null
  order by model_name, (image_path is not null) desc, (price > 0) desc, id
),
created as (
  insert into public.products (
    slug, name, brand, brand_id, category, description, specifications,
    price, stock_quantity, in_stock, is_active, image_path, image_paths
  )
  select
    'apple-family-' || regexp_replace(lower(model_name), '[^a-z0-9]+', '-', 'g'),
    'Смартфон ' || model_name,
    brand, brand_id, category, description, specifications,
    0, 0, false, true, image_path, coalesce(image_paths, '[]'::jsonb)
  from representatives r
  where not exists (
    select 1 from public.products p
    where p.slug = 'apple-family-' || regexp_replace(lower(r.model_name), '[^a-z0-9]+', '-', 'g')
  )
  returning id, slug
),
families as (
  select id, slug, name as model_name
  from public.products
  where slug like 'apple-family-iphone-15%'
     or slug like 'apple-family-iphone-16%'
     or slug like 'apple-family-iphone-17%'
     or slug like 'apple-family-iphone-18%'
),
family_models as (
  select
    f.id,
    replace(initcap(replace(replace(f.slug, 'apple-family-', ''), '-', ' ')), 'Iphone', 'iPhone') as model_name
  from families f
)
update public.products child
set
  parent_product_id = family.id,
  variant_label = coalesce(
    nullif(concat_ws(' · ',
      (regexp_match(child.name, '\m([0-9]{2,4}[[:space:]]*(?:GB|TB|ГБ|ТБ))\M', 'i'))[1],
      initcap((regexp_match(child.name, '\m(black|white|blue|silver|gold|green|pink|purple|orange|sage|navy|teal|yellow|natural|titanium|чорн[а-яіїє]*|бі[л]?[а-яіїє]*|син[а-яіїє]*|сріб[а-яіїє]*|золот[а-яіїє]*|зелен[а-яіїє]*|рожев[а-яіїє]*|фіолет[а-яіїє]*)\M', 'i'))[1])
    ), ''),
    child.sku,
    'Варіант'
  )
from candidates source
join family_models family on family.model_name = source.model_name
where child.id = source.id
  and child.id <> family.id
  and child.parent_product_id is null;

commit;

-- Перевірка результату: один рядок на головну модель.
select
  parent.name as "Модель",
  count(child.id) as "Варіантів"
from public.products parent
left join public.products child on child.parent_product_id = parent.id
where parent.slug like 'apple-family-iphone-15%'
   or parent.slug like 'apple-family-iphone-16%'
   or parent.slug like 'apple-family-iphone-17%'
   or parent.slug like 'apple-family-iphone-18%'
group by parent.id, parent.name
order by parent.name;
