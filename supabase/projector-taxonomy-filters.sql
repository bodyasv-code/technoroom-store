-- TECHNOROOM: одна категорія «Проєктори» + фільтри замість дублювання товарів.
-- Запустіть один раз у Supabase SQL Editor перед наступним XML-імпортом.
-- Скрипт не видаляє товари й не змінює SKU. Старі категорії лишаються
-- технічними неактивними alias-ами, щоб старі посилання могли коректно
-- відкрити новий розділ у вітрині.

begin;

with root as (
  select id from public.categories where slug = 'cat-projectors' limit 1
), upsert as (
  insert into public.categories (name, slug, parent_id, sort_order, is_active)
  select 'Проєктори', 'projectors', root.id, 10, true from root
  on conflict (slug) do update
    set name = excluded.name,
        parent_id = excluded.parent_id,
        is_active = true
  returning id
)
select id from upsert;

-- Переносимо лише власне проєктори зі старих тематичних підкатегорій.
-- Лампи, екрани, оптика та кріплення не зачіпаються.
with candidates as (
  select
    p.id,
    p.category,
    lower(concat_ws(' ', p.name, p.description, p.category)) as source,
    p.specifications
  from public.products p
  where p.category in (
    'projector', 'laser-proj', 'home-projectors', 'short-throw-projectors',
    'installation-projectors', 'universal-projectors',
    'erc-display-03', 'erc-display-11', 'erc-display-12', 'erc-display-13'
  )
  and coalesce(p.name, '') !~* '(?:лампа|lamp|об[’''`]?єктив|оптика|lens)'
), classified as (
  select
    id,
    case
      when source ~* '(ультра[[:space:]-]*короткофокус|ultra[[:space:]-]*short[[:space:]-]*throw)' then 'Ультракороткофокусний · Короткофокусний'
      else null
    end as short_throw,
    case when category = 'laser-proj' or source ~* '(?:лазер|laser)' then 'Лазерний' end as laser,
    case when category in ('erc-display-03', 'home-projectors') or source ~* '(?:домашн|home[[:space:]]*(cinema|theater|theatre))' then 'Домашній' end as home,
    case when category in ('erc-display-12', 'short-throw-projectors') or source ~* '(?:короткофокус|short[[:space:]-]*throw)' then 'Короткофокусний' end as short,
    case when category in ('erc-display-11', 'installation-projectors') or source ~* '(?:інсталяційн|installation)' then 'Інсталяційний' end as installation,
    case when category in ('erc-display-13', 'universal-projectors') or source ~* '(?:універсальн|universal)' then 'Універсальний' end as universal,
    case
      when source ~* '(?:світлодіод|(^|[^[:alpha:]])led([^[:alpha:]]|$))' then 'Світлодіод'
      when source ~* '(?:лазер|laser)' then 'Лазер'
      when source ~* '(?:ламп|lamp)' then 'Лампа'
      else null
    end as light_source
  from candidates
), values_to_save as (
  select
    id,
    array_to_string(array_remove(array[laser, home, short_throw, case when short_throw is null then short end, installation, universal], null), ' · ') as purpose,
    light_source
  from classified
)
update public.products p
set category = 'projectors',
    specifications = coalesce(p.specifications, '{}'::jsonb)
      || case when nullif(v.purpose, '') is not null then jsonb_build_object('Призначення', v.purpose) else '{}'::jsonb end
      || case when v.light_source is not null then jsonb_build_object('Джерело світла', v.light_source) else '{}'::jsonb end
from values_to_save v
where p.id = v.id;

-- Старі тематичні підкатегорії більше не показуємо у меню.
update public.categories
set is_active = false
where slug in (
  'projector', 'laser-proj', 'home-projectors', 'short-throw-projectors',
  'installation-projectors', 'universal-projectors',
  'erc-display-03', 'erc-display-11', 'erc-display-12', 'erc-display-13'
);

commit;

-- Перевірка після запуску: мають бути тільки активні «Проєктори» та
-- окремі категорії екранів / ламп / оптики.
select c.name, c.slug, c.is_active, count(p.id) as products
from public.categories c
left join public.products p on p.category = c.slug
where c.slug in ('projectors', 'erc-display-06', 'erc-display-14', 'erc-display-15')
group by c.id, c.name, c.slug, c.is_active
order by c.sort_order, c.name;
