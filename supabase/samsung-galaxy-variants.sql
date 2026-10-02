-- TECHNOROOM: створює головні картки моделей Samsung Galaxy та прив'язує
-- кольори / пам'ять як модифікації. Запускати ПІСЛЯ product-variants-upgrade.sql.
-- Скрипт не видаляє товари, не змінює SKU, ціну, залишок або характеристики.
-- До вибірки входять лише товари, назва яких починається зі «Смартфон»,
-- «Smartphone» або «Samsung», тому чохли, кабелі та інші аксесуари не потрапляють.

begin;

-- На випадок помилкових зв'язків із ранніх запусків від'єднуємо не-смартфони.
update public.products child
set parent_product_id = null,
    variant_label = null
from public.products parent
where child.parent_product_id = parent.id
  and parent.slug like 'samsung-family-galaxy-%'
  and child.name !~* '^\s*(?:смартфон|smartphone|samsung)\M';

with candidates as (
  select
    p.*,
    initcap(lower((regexp_match(
      p.name,
      '\mgalaxy[[:space:]]+(?:z[[:space:]]+(?:fold|flip)[[:space:]]*[0-9]+|s[0-9]{2}[[:space:]]*(?:ultra|fe|\+)?|a[0-9]{2})\M',
      'i'
    ))[1])) as model_name
  from public.products p
  where p.parent_product_id is null
    and coalesce(p.brand, '') ~* '^samsung$'
    and p.name ~* '^\s*(?:смартфон|smartphone|samsung)\M'
    and p.name ~* '\mgalaxy[[:space:]]+(?:z[[:space:]]+(?:fold|flip)[[:space:]]*[0-9]+|s[0-9]{2}[[:space:]]*(?:ultra|fe|\+)?|a[0-9]{2})\M'
), eligible_models as (
  select model_name
  from candidates
  group by model_name
  having count(*) > 1
), representatives as (
  select distinct on (model_name)
    model_name, category, brand, brand_id, description, specifications, image_path, image_paths
  from candidates
  where model_name in (select model_name from eligible_models)
  order by model_name, (image_path is not null) desc, (price > 0) desc, id
), created as (
  insert into public.products (
    slug, name, brand, brand_id, category, description, specifications,
    price, stock_quantity, in_stock, is_active, image_path, image_paths
  )
  select
    'samsung-family-' || regexp_replace(lower(model_name), '[^a-z0-9]+', '-', 'g'),
    'Смартфон Samsung ' || model_name,
    brand, brand_id, category, description, specifications,
    0, 0, false, true, image_path, coalesce(image_paths, '[]'::jsonb)
  from representatives r
  where not exists (
    select 1 from public.products p
    where p.slug = 'samsung-family-' || regexp_replace(lower(r.model_name), '[^a-z0-9]+', '-', 'g')
  )
  returning id
), families as (
  select id, slug
  from public.products
  where slug like 'samsung-family-galaxy-%'
)
update public.products child
set
  parent_product_id = family.id,
  variant_label = nullif(concat_ws(' - ',
    (regexp_match(child.name, '\m([0-9]{1,4}[[:space:]]*(?:GB|TB|ГБ|ТБ))\M', 'i'))[1],
    initcap((regexp_match(child.name, '\m(black|white|blue|silver|gold|green|pink|purple|orange|yellow|gray|grey|graphite|cream|mint|lavender|coral|violet|navy|titanium|чорн[а-яіїє]*|бі[л]?[а-яіїє]*|син[а-яіїє]*|сріб[а-яіїє]*|золот[а-яіїє]*|зелен[а-яіїє]*|рожев[а-яіїє]*|фіолет[а-яіїє]*|сір[а-яіїє]*)\M', 'i'))[1])
  ), '')
from candidates source
join families family on family.slug = 'samsung-family-' || regexp_replace(lower(source.model_name), '[^a-z0-9]+', '-', 'g')
where child.id = source.id
  and child.id <> family.id
  and child.parent_product_id is null;

commit;

-- Перевірка: один рядок на головну модель.
select
  parent.name as "Модель",
  count(child.id) as "Варіантів"
from public.products parent
left join public.products child on child.parent_product_id = parent.id
where parent.slug like 'samsung-family-galaxy-%'
group by parent.id, parent.name
order by parent.name;
