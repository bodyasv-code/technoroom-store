-- Run after order-history-upgrade.sql. No existing statuses, totals or stock change.
begin;
alter table public.orders
  add column if not exists shipping_carrier text not null default '' check(shipping_carrier in ('','nova_poshta','ukrposhta','other')),
  add column if not exists tracking_number text not null default '';
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_shipping_format_check') then
    alter table public.orders add constraint orders_shipping_format_check check(
      tracking_number='' or (shipping_carrier<>'' and tracking_number ~ '^[A-Z0-9-]{5,40}$'
        and (shipping_carrier<>'nova_poshta' or tracking_number ~ '^[0-9]{14}$')
        and (shipping_carrier<>'ukrposhta' or tracking_number ~ '^[A-Z0-9]{13}$'))
    );
  end if;
end $$;
alter table public.order_events drop constraint if exists order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check(kind in ('status','email','shipping'));
create or replace function public.record_order_shipping_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); actor_label text;
begin
  if new.shipping_carrier is not distinct from old.shipping_carrier
    and new.tracking_number is not distinct from old.tracking_number then return new; end if;
  if actor is not null then select coalesce(nullif(full_name,''),'Адміністратор') into actor_label from public.profiles where id=actor; end if;
  insert into public.order_events(order_id,kind,event_type,summary,actor_id,actor_name,previous_value,next_value)
  values(new.id,'shipping','operations','Оновлено перевізника / ТТН',actor,coalesce(actor_label,'Система / SQL'),
    jsonb_build_object('shipping_carrier',old.shipping_carrier,'tracking_number',old.tracking_number)::text,
    jsonb_build_object('shipping_carrier',new.shipping_carrier,'tracking_number',new.tracking_number)::text);
  return new;
end;
$$;
revoke all on function public.record_order_shipping_event() from public,anon,authenticated,service_role;
drop trigger if exists record_order_shipping_event on public.orders;
create trigger record_order_shipping_event after update of shipping_carrier,tracking_number on public.orders
for each row execute function public.record_order_shipping_event();
commit;
