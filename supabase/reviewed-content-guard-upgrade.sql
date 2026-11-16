-- Repeatable infrastructure only; does not enroll or change product cards.
begin;
create table if not exists technoroom_maintenance.reviewed_product_content (
 product_id bigint primary key references public.products(id) on delete cascade,
 sku text not null, brand text not null, source text not null,
 protect_description boolean not null default false,
 operation text not null, reviewed_at timestamptz not null default now()
);
-- NULL retains the original whole-table protection. An explicit list protects
-- only verified fields, including deleted keys, while allowing other enrichment.
alter table technoroom_maintenance.reviewed_product_content add column if not exists specification_keys text[];
alter table technoroom_maintenance.reviewed_product_content enable row level security;
revoke all on technoroom_maintenance.reviewed_product_content from public,anon,authenticated;

create or replace function public.guard_reviewed_product_content()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare reviewed technoroom_maintenance.reviewed_product_content;spec_key text;
begin
 -- Runs after the existing manual-provenance trigger. Clients cannot enroll
 -- arbitrary cards by submitting a forged manual_overrides flag.
 new.manual_overrides:=coalesce(new.manual_overrides,'{}'::jsonb)-array['verified_specifications','reviewed_specifications','reviewed_description'];
 select * into reviewed from technoroom_maintenance.reviewed_product_content
 where product_id=new.id and sku=new.sku and brand=new.brand;
 if not found then return new;end if;
 if current_setting('technoroom.import_write',true)='true' then
  if reviewed.specification_keys is null and new.specifications is distinct from old.specifications then
   raise exception 'Reviewed specifications protected; refresh import preview' using errcode='40001';
  end if;
  foreach spec_key in array coalesce(reviewed.specification_keys,array[]::text[]) loop
   if new.specifications->spec_key is distinct from old.specifications->spec_key then
    raise exception 'Reviewed specification protected: %; refresh import preview',spec_key using errcode='40001';
   end if;
  end loop;
  if reviewed.protect_description and new.description is distinct from old.description then
   raise exception 'Reviewed description protected; refresh import preview' using errcode='40001';
  end if;
 end if;
 if reviewed.specification_keys is null then
  new.manual_overrides:=new.manual_overrides||'{"verified_specifications":true}'::jsonb;
  if reviewed.protect_description then new.manual_overrides:=new.manual_overrides||'{"description":true}'::jsonb;end if;
 else
  new.manual_overrides:=new.manual_overrides||jsonb_build_object('reviewed_specifications',to_jsonb(reviewed.specification_keys));
  if reviewed.protect_description then new.manual_overrides:=new.manual_overrides||'{"reviewed_description":true}'::jsonb;end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_reviewed_product_content() from public,anon,authenticated;
drop trigger if exists zz_guard_reviewed_product_content on public.products;
create trigger zz_guard_reviewed_product_content before update on public.products
for each row execute function public.guard_reviewed_product_content();
commit;
