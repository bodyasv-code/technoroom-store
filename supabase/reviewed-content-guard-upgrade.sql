-- Repeatable infrastructure only; does not enroll or change product cards.
begin;
create table if not exists technoroom_maintenance.reviewed_product_content (
 product_id bigint primary key references public.products(id) on delete cascade,
 sku text not null, brand text not null, source text not null,
 protect_description boolean not null default false,
 operation text not null, reviewed_at timestamptz not null default now()
);
alter table technoroom_maintenance.reviewed_product_content enable row level security;
revoke all on technoroom_maintenance.reviewed_product_content from public,anon,authenticated;

create or replace function public.guard_reviewed_product_content()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare reviewed technoroom_maintenance.reviewed_product_content;
begin
 -- Runs after the existing manual-provenance trigger. Clients cannot enroll
 -- arbitrary cards by submitting a forged manual_overrides flag.
 new.manual_overrides:=coalesce(new.manual_overrides,'{}'::jsonb)-'verified_specifications';
 select * into reviewed from technoroom_maintenance.reviewed_product_content
 where product_id=new.id and sku=new.sku and brand=new.brand;
 if not found then return new;end if;
 if current_setting('technoroom.import_write',true)='true' then
  if new.specifications is distinct from old.specifications then
   raise exception 'Reviewed specifications protected; refresh import preview' using errcode='40001';
  end if;
  if reviewed.protect_description and new.description is distinct from old.description then
   raise exception 'Reviewed description protected; refresh import preview' using errcode='40001';
  end if;
 end if;
 new.manual_overrides:=new.manual_overrides||'{"verified_specifications":true}'::jsonb;
 if reviewed.protect_description then new.manual_overrides:=new.manual_overrides||'{"description":true}'::jsonb;end if;
 return new;
end $$;
revoke all on function public.guard_reviewed_product_content() from public,anon,authenticated;
drop trigger if exists zz_guard_reviewed_product_content on public.products;
create trigger zz_guard_reviewed_product_content before update on public.products
for each row execute function public.guard_reviewed_product_content();
commit;
