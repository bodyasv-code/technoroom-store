-- TECHNOROOM: робочий процес обробки замовлень.
-- Безпечно запускати повторно. Наявні замовлення та статуси не змінюються.

alter type public.order_status add value if not exists 'processing';
alter type public.order_status add value if not exists 'supplier_check';

alter table public.orders
  add column if not exists manager_note text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_order_updated_at();

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);
