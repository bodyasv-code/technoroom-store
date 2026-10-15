-- Run once in Supabase SQL Editor. Safe to rerun; no historical events are invented.
-- Requires checkout-pricing-upgrade.sql and order-workflow-upgrade.sql.
begin;
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('status','email')),
  actor_id uuid,
  actor_name text,
  previous_value text,
  next_value text not null,
  error_code text,
  attempt_id text
);
create index if not exists order_events_order_idx on public.order_events(order_id,id desc);
alter table public.order_events enable row level security;
revoke all on public.order_events from anon,authenticated,service_role;
grant select on public.order_events to authenticated,service_role;
drop policy if exists "admins read order events" on public.order_events;
create policy "admins read order events" on public.order_events for select to authenticated using (public.is_admin());

create or replace function public.record_order_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid();
  actor_label text;
  notification jsonb:=new.checkout_details->'notification';
  previous_notification jsonb:=old.checkout_details->'notification';
begin
  if actor is not null then
    select coalesce(nullif(full_name,''),'Адміністратор') into actor_label from public.profiles where id=actor;
    actor_label:=coalesce(actor_label,'Адміністратор');
  end if;
  if new.status is distinct from old.status then
    insert into public.order_events(order_id,kind,actor_id,actor_name,previous_value,next_value)
    values(new.id,'status',actor,coalesce(actor_label,'Система / SQL'),old.status::text,new.status::text);
  end if;
  if notification is distinct from previous_notification
    and notification->>'status' in ('retrying','accepted','failed','not_configured') then
    -- Only the trusted server may attribute a retry to its authenticated requester.
    if actor is null and auth.role()='service_role' then
      select id,coalesce(nullif(full_name,''),'Адміністратор') into actor,actor_label
      from public.profiles where id::text=notification->>'requested_by';
    end if;
    insert into public.order_events(order_id,kind,actor_id,actor_name,previous_value,next_value,error_code,attempt_id)
    values(new.id,'email',actor,coalesce(actor_label,'Система / SQL'),previous_notification->>'status',notification->>'status',
      case when notification->>'code' ~ '^mail_[a-z0-9_]+$' then left(notification->>'code',100) end,
      left(notification->>'attempt',100));
  end if;
  return new;
end;
$$;
revoke all on function public.record_order_event() from public,anon,authenticated,service_role;
drop trigger if exists record_order_event on public.orders;
create trigger record_order_event after update of status,checkout_details on public.orders
for each row execute function public.record_order_event();
commit;
