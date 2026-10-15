-- Run after order-history-upgrade.sql and order-shipping-upgrade.sql.
-- Manual accounting only. Existing orders stay UNKNOWN, not assumed unpaid/paid.
-- Dedicated manual_* columns: existing payment_status/amount_paid are NOT changed.
begin;
alter table public.orders
  add column if not exists manual_payment_status text,
  add column if not exists manual_amount_paid numeric(12,2);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_manual_payment_v2_check') then
    alter table public.orders add constraint orders_manual_payment_v2_check check(
      (manual_payment_status is null and manual_amount_paid is null)
      or (manual_payment_status is not null and manual_amount_paid is not null and manual_amount_paid>=0 and manual_amount_paid<=total
        and ((manual_payment_status='unpaid' and manual_amount_paid=0)
          or (manual_payment_status='partial' and manual_amount_paid>0 and manual_amount_paid<total)
          or (manual_payment_status='paid' and manual_amount_paid=total)))
    );
  end if;
end $$;
alter table public.order_events drop constraint if exists order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check(kind in ('status','email','shipping','payment'));
create or replace function public.record_order_payment_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();actor_label text;
begin
  if new.manual_payment_status is not distinct from old.manual_payment_status
    and new.manual_amount_paid is not distinct from old.manual_amount_paid then return new; end if;
  if actor is not null then select coalesce(nullif(full_name,''),'Адміністратор') into actor_label from public.profiles where id=actor; end if;
  insert into public.order_events(order_id,kind,event_type,summary,actor_id,actor_name,previous_value,next_value)
  values(new.id,'payment','operations','Ручний облік оплати',actor,coalesce(actor_label,'Система / SQL'),
    jsonb_build_object('manual_payment_status',old.manual_payment_status,'manual_amount_paid',old.manual_amount_paid)::text,
    jsonb_build_object('manual_payment_status',new.manual_payment_status,'manual_amount_paid',new.manual_amount_paid)::text);
  return new;
end;
$$;
revoke all on function public.record_order_payment_event() from public,anon,authenticated,service_role;
drop trigger if exists record_order_payment_event on public.orders;
create trigger record_order_payment_event after update of manual_payment_status,manual_amount_paid on public.orders
for each row execute function public.record_order_payment_event();
notify pgrst,'reload schema';
commit;
