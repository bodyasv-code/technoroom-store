-- TECHNOROOM: товар може мати варіанти (колір, пам’ять, комплектація).
-- Запустити один раз у Supabase SQL Editor. Скрипт безпечний для повторного запуску.

alter table public.products
  add column if not exists parent_product_id bigint references public.products(id) on delete set null,
  add column if not exists variant_label text;

create index if not exists products_parent_product_id_idx
  on public.products(parent_product_id);

comment on column public.products.parent_product_id is
  'Основний товар, до якого належить ця модифікація.';

comment on column public.products.variant_label is
  'Коротка назва варіанта для покупця: наприклад, 256 ГБ · Blue.';
