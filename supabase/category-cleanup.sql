-- TECHNOROOM category cleanup / hierarchy.
-- Safe migration: keeps products and normalizes category structure.

alter table public.categories
  add column if not exists parent_id bigint references public.categories(id) on delete set null;

-- Canonical top-level categories.
insert into public.categories (slug, name, is_active, sort_order)
values
  ('projector', 'Проєктори', true, 10),
  ('projection-screens', 'Проекційні екрани', true, 20),
  ('tv', 'Телевізори', true, 30),
  ('audio', 'Акустика та звук', true, 40),
  ('accessories', 'Аксесуари', true, 50)
on conflict (slug) do update
set name = excluded.name, is_active = true, sort_order = excluded.sort_order;

-- Projector subcategories.
insert into public.categories (slug, name, is_active, sort_order, parent_id)
select v.slug, v.name, true, v.sort_order, p.id
from (values
  ('home-projectors', 'Для домашнього кінотеатру', 11),
  ('laser-proj', 'Лазерні проєктори', 12),
  ('short-throw-projectors', 'Короткофокусні проєктори', 13),
  ('installation-projectors', 'Інсталяційні проєктори', 14),
  ('universal-projectors', 'Універсальні проєктори', 15)
) as v(slug, name, sort_order)
cross join public.categories p
where p.slug = 'projector'
on conflict (slug) do update
set name = excluded.name, is_active = true, sort_order = excluded.sort_order, parent_id = excluded.parent_id;

-- Keep top-level categories at root.
update public.categories
set parent_id = null
where slug in ('projector','projection-screens','tv','audio','accessories');

-- Normalize common legacy category slugs on products.
update public.products set category = 'projector'
where lower(category) in ('projectors','проектор','проектори','проєктор','проєктори');

update public.products set category = 'projection-screens'
where lower(category) in ('screen','screens','projection-screen','проекційний екран','проекційні екрани','проєкційний екран','проєкційні екрани');

update public.products set category = 'tv'
where lower(category) in ('television','televisions','tvs','телевізор','телевізори');

update public.products set category = 'audio'
where lower(category) in ('sound','acoustics','акустика','звук');

-- Hide duplicate/legacy category records only when their slug is no longer used.
update public.categories c
set is_active = false
where c.slug not in (
  'projector','projection-screens','tv','audio','accessories',
  'home-projectors','laser-proj','short-throw-projectors',
  'installation-projectors','universal-projectors'
)
and not exists (select 1 from public.products p where p.category = c.slug);

-- Helpful indexes.
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists products_category_idx on public.products(category);
