-- TECHNOROOM: прибирає з «Оргтехніки» знайдені винятки — аксесуари,
-- навушники та послуги. Скрипт безпечно запускати повторно.

begin;

with roots(name, slug, sort_order) as (
  values
    ('Кріплення та аксесуари', 'cat-accessories', 90),
    ('Audio', 'audio', 30),
    ('Послуги', 'services', 100)
)
insert into public.categories (name, slug, sort_order, is_active)
select name, slug, sort_order, true from roots
on conflict (slug) do update set is_active = true;

with children(name, slug, root_slug, sort_order) as (
  values
    ('Аксесуари для оргтехніки', 'office-accessories', 'cat-accessories', 10),
    ('Навушники', 'headphones', 'audio', 10),
    ('Технічна підтримка', 'technical-support', 'services', 10)
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select children.name, children.slug, root.id, children.sort_order, true
from children join public.categories root on root.slug = children.root_slug
on conflict (slug) do update set parent_id = excluded.parent_id, sort_order = excluded.sort_order, is_active = true;

update public.products
set category = case
  when lower(coalesce(name, '')) ~ '(навушник|headphone|headset|гарнітур)' then 'headphones'
  when lower(coalesce(name, '')) ~ '(послуг|service|активац|технічн[^ ]*[[:space:]]+підтримк)' then 'technical-support'
  -- «Базовий блок БФП, 1 лоток» і принтер зі стендом у комплекті —
  -- це основні пристрої. Самі слова «лоток» або «стенд» не є достатньою
  -- підставою переносити їх у аксесуари.
  when lower(coalesce(name, '')) ~ '(лоток|підставк|стенд|tray|stand|accessor|аксесуар|додатковий[[:space:]]+планшет)'
   and lower(trim(coalesce(name, ''))) !~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат)|принтер|printer)'
    then 'office-accessories'
  else category
end
where category like 'office-%'
  and (
    lower(coalesce(name, '')) ~ '(навушник|headphone|headset|гарнітур|послуг|service|активац|технічн[^ ]*[[:space:]]+підтримк)'
    or (
      lower(coalesce(name, '')) ~ '(лоток|підставк|стенд|tray|stand|accessor|аксесуар|додатковий[[:space:]]+планшет)'
      and lower(trim(coalesce(name, ''))) !~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат)|принтер|printer)'
    )
  );

commit;

-- Перевірка: у «Оргтехніці» більше не повинно лишитися таких винятків.
select id, name, sku, category
from public.products
where category like 'office-%'
  and (
    lower(coalesce(name, '')) ~ '(навушник|headphone|headset|гарнітур|послуг|service|активац|технічн[^ ]*[[:space:]]+підтримк)'
    or (
      lower(coalesce(name, '')) ~ '(лоток|підставк|стенд|tray|stand|accessor|аксесуар|додатковий[[:space:]]+планшет)'
      and lower(trim(coalesce(name, ''))) !~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат)|принтер|printer)'
    )
  )
order by name;
