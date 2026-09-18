-- Галерея зображень товару. Запускати один раз у Supabase SQL Editor.
alter table public.products
  add column if not exists image_paths jsonb not null default '[]'::jsonb;

-- Переносимо наявне головне фото в масив, не змінюючи сам image_path.
update public.products
set image_paths = jsonb_build_array(image_path)
where coalesce(jsonb_array_length(image_paths), 0) = 0
  and nullif(trim(image_path), '') is not null;
