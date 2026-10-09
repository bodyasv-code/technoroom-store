-- Стала структура витратних матеріалів для друку.
-- Безпечний повторний запуск: наявні категорії не дублюються.

insert into public.categories (name, slug, parent_id, sort_order, is_active)
select 'Витратні матеріали для друку', 'office-consumables', parent.id, 90, true
from public.categories parent
where parent.slug = 'office-equipment'
  and not exists (select 1 from public.categories where slug = 'office-consumables');

with root as (
  select id from public.categories where slug = 'office-consumables'
), planned(name, slug, sort_order) as (
  values
    ('Картриджі', 'office-consumables-cartridges', 10),
    ('Тонери та тонер-картриджі', 'office-consumables-toner', 20),
    ('Чорнила та контейнери', 'office-consumables-ink', 30),
    ('Фотобарабани', 'office-consumables-drums', 40),
    ('Стрічки для принтерів', 'office-consumables-ribbons', 50)
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select planned.name, planned.slug, root.id, planned.sort_order, true
from planned cross join root
where not exists (select 1 from public.categories where categories.slug = planned.slug);
