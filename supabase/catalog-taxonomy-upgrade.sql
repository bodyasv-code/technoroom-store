-- TECHNOROOM: впорядкування назв і дерева каталогу.
-- Безпечно запускати у Supabase SQL Editor: товари, їхні slug і категорії не видаляються.

-- Основні розділи з короткими назвами для вітрини.
update public.categories
set name = case slug
  when 'cat-projectors' then 'Проєктори та екрани'
  when 'cat-displays' then 'Телевізори, монітори та дисплеї'
  when 'cat-audio' then 'Акустика й звук'
  when 'cat-power' then 'Резервне живлення'
  when 'cat-solar' then 'Сонячна енергетика'
  when 'cat-electrical' then 'Електротехніка'
  when 'cat-accessories' then 'Кріплення та аксесуари'
  else name
end,
sort_order = case slug
  when 'cat-projectors' then 100
  when 'cat-displays' then 200
  when 'cat-audio' then 300
  when 'cat-power' then 400
  when 'cat-solar' then 500
  when 'cat-electrical' then 600
  when 'cat-accessories' then 700
  else sort_order
end
where slug in ('cat-projectors', 'cat-displays', 'cat-audio', 'cat-power', 'cat-solar', 'cat-electrical', 'cat-accessories');

-- Зрозумілі назви підкатегорій. Slug лишаються без змін, тому прив’язка товарів збережеться.
update public.categories
set name = case slug
  when 'erc-display-01' then 'Монітори'
  when 'erc-display-02' then 'Інформаційні дисплеї'
  when 'erc-display-03' then 'Домашні проєктори'
  when 'erc-display-06' then 'Проєкційні екрани'
  when 'erc-display-07' then 'Телевізори'
  when 'erc-display-08' then 'Аксесуари для проєкторів'
  when 'erc-display-09' then 'Інтерактивні дошки'
  when 'erc-display-10' then 'Кріплення для проєкторів'
  when 'erc-display-11' then 'Інсталяційні проєктори'
  when 'erc-display-12' then 'Короткофокусні проєктори'
  when 'erc-display-13' then 'Універсальні проєктори'
  when 'erc-display-14' then 'Лампи для проєкторів'
  when 'erc-display-15' then 'Оптика для проєкторів'
  when 'erc-display-16' then 'Аксесуари для дисплеїв'
  when 'erc-display-17' then 'Аксесуари для телевізорів'
  when 'erc-display-18' then 'Кріплення для дисплеїв'
  when 'erc-display-19' then 'Інтерактивні дисплеї'
  when 'erc-display-20' then 'Комерційні телевізори'
  when 'erc-consumer-01' then 'Гарнітури для ПК'
  when 'erc-consumer-02' then 'Аксесуари для навушників і гарнітур'
  when 'erc-consumer-03' then 'Комп’ютерна акустика'
  when 'erc-consumer-04' then 'Накладні гарнітури'
  when 'erc-consumer-05' then 'Мікрофони'
  when 'erc-consumer-06' then 'TWS-навушники'
  when 'erc-consumer-07' then 'Портативна акустика'
  when 'erc-consumer-08' then 'Внутрішньоканальні гарнітури'
  when 'erc-consumer-09' then 'Ігрові гарнітури'
  when 'erc-consumer-10' then 'Внутрішньоканальні навушники'
  when 'erc-consumer-11' then 'Накладні навушники'
  when 'erc-consumer-12' then 'Саундбари'
  when 'erc-consumer-13' then 'Музичні центри'
  when 'erc-consumer-14' then 'Стаціонарна акустика'
  else name
end
where slug like 'erc-display-%' or slug like 'erc-consumer-%';

-- Окрема підкатегорія для лазерних проєкторів, яку вже розуміє імпорт ERC.
insert into public.categories (slug, name, parent_id, is_active, sort_order)
select 'laser-proj', 'Лазерні проєктори', id, true, 104
from public.categories
where slug = 'cat-projectors'
on conflict (slug) do update
set name = excluded.name,
    parent_id = excluded.parent_id,
    is_active = true,
    sort_order = excluded.sort_order;
