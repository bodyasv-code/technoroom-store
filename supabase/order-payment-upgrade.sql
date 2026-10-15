-- Run after order-history-upgrade.sql and order-shipping-upgrade.sql.
-- Manual accounting only. Existing orders stay UNKNOWN, not assumed unpaid/paid.
begin;
alter table public.orders
  add column if not exists payment_status text,
  add column if not exists amount_paid numeric(12,2);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_manual_payment_check') then
    alter table public.orders add constraint orders_manual_payment_check check(
      (payment_status is null and amount_paid is null)
      or (payment_status is not null and amount_paid is not null and amount_paid>=0 and amount_paid<=total
        and ((payment_status='unpaid' and amount_paid=0)
          or (payment_status='partial' and amount_paid>0 and amount_paid<total)
          or (payment_status='paid' and amount_paid=total)))
    );
  end if;
end $$;
alter table public.order_events drop constraint if exists order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check check(kind in ('status','email','shipping','payment'));
create or replace function public.record_order_payment_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();actor_label text;
begin
  if new.payment_status is not distinct from old.payment_status
    and new.amount_paid is not distinct from old.amount_paid then return new; end if;
  if actor is not null then select coalesce(nullif(full_name,''),'Адміністратор') into actor_label from public.profiles where id=actor; end if;
  insert into public.order_events(order_id,kind,event_type,summary,actor_id,actor_name,previous_value,next_value)
  values(new.id,'payment','operations','Ручний облік оплати',actor,coalesce(actor_label,'Система / SQL'),
    jsonb_build_object('payment_status',old.payment_status,'amount_paid',old.amount_paid)::text,
    jsonb_build_object('payment_status',new.payment_status,'amount_paid',new.amount_paid)::text);
  return new;
end;
$$;
revoke all on function public.record_order_payment_event() from public,anon,authenticated,service_role;
drop trigger if exists record_order_payment_event on public.orders;
create trigger record_order_payment_event after update of payment_status,amount_paid on public.orders
for each row execute function public.record_order_payment_event();
notify pgrst,'reload schema';
commit;
