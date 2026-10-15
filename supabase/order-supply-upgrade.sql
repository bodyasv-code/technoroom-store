-- Run after the history, shipping and manual payment migrations. Repeatable.
-- Existing dates are not inferred, and existing order data is not backfilled.
begin;
alter table public.orders
  add column if not exists supply_expected_on date,
  add column if not exists supply_note text not null default '';
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_supply_fields_check') then
    alter table public.orders add constraint orders_supply_fields_check check(
      (supply_expected_on is null or supply_expected_on between date '0001-01-01' and date '9999-12-31')
      and (supply_note is null or char_length(supply_note)<=2000)
    );
  end if;
end $$;
alter table public.order_events drop constraint if exists order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check(kind in ('status','email','shipping','payment','supply'));
create or replace function public.record_order_supply_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();actor_label text;
begin
  if new.supply_expected_on is not distinct from old.supply_expected_on
    and new.supply_note is not distinct from old.supply_note then return new; end if;
  if actor is not null then select coalesce(nullif(full_name,''),'Адміністратор') into actor_label from public.profiles where id=actor; end if;
  insert into public.order_events(order_id,kind,event_type,summary,actor_id,actor_name,previous_value,next_value)
  values(new.id,'supply','operations','Строк постачання',actor,coalesce(actor_label,'Система / SQL'),
    jsonb_build_object('supply_expected_on',old.supply_expected_on,'supply_note',old.supply_note)::text,
    jsonb_build_object('supply_expected_on',new.supply_expected_on,'supply_note',new.supply_note)::text);
  return new;
end;
$$;
revoke all on function public.record_order_supply_event() from public,anon,authenticated,service_role;
drop trigger if exists record_order_supply_event on public.orders;
create trigger record_order_supply_event after update of supply_expected_on,supply_note on public.orders
for each row execute function public.record_order_supply_event();
notify pgrst,'reload schema';
commit;
