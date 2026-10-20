-- Requires import-history-upgrade.sql and product-manual-overrides-upgrade.sql.
-- No historical supplier guesses, product deletion or photo deletion.
begin;
create table if not exists public.catalog_suppliers (
  code text primary key check(code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
  name text not null check(length(btrim(name)) between 1 and 120)
);
insert into public.catalog_suppliers(code,name) values('ERC','ERC'),('ASBIS','ASBIS') on conflict do nothing;
create table if not exists public.product_suppliers (
  product_id bigint not null references public.products(id) on delete cascade,
  supplier text not null references public.catalog_suppliers(code),
  supplier_sku text not null,
  origin text not null default 'manual' check(origin in ('manual','import')),
  last_seen_at timestamptz,
  last_run_id uuid references public.import_runs(id),
  primary key(product_id,supplier)
);
create table if not exists public.product_import_exclusions (
  sku text primary key check(sku=upper(btrim(sku)) and sku<>''),
  product_name text,
  reason text not null default 'Товар поки не потрібен',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.product_suppliers enable row level security;
alter table public.catalog_suppliers enable row level security;
alter table public.product_import_exclusions enable row level security;
revoke all on public.catalog_suppliers,public.product_suppliers,public.product_import_exclusions from anon,authenticated;
grant select on public.catalog_suppliers,public.product_suppliers,public.product_import_exclusions to authenticated;
drop policy if exists "admins read supplier directory" on public.catalog_suppliers;
create policy "admins read supplier directory" on public.catalog_suppliers for select to authenticated using(public.is_admin());
drop policy if exists "admins read suppliers" on public.product_suppliers;
create policy "admins read suppliers" on public.product_suppliers for select to authenticated using(public.is_admin());
drop policy if exists "admins read exclusions" on public.product_import_exclusions;
create policy "admins read exclusions" on public.product_import_exclusions for select to authenticated using(public.is_admin());

create or replace function public.add_catalog_supplier(p_code text,p_name text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  insert into catalog_suppliers(code,name) values(upper(btrim(p_code)),btrim(p_name));
end $$;

create or replace function public.set_product_import_exclusion(p_sku text,p_active boolean,p_reason text default '')
returns void language plpgsql security definer set search_path=public as $$
declare code text:=upper(btrim(p_sku));
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if code is null or code='' or p_active is null then raise exception 'Вкажіть SKU та стан виключення'; end if;
  perform pg_advisory_xact_lock(hashtextextended('product-import:'||code,0));
  insert into product_import_exclusions(sku,is_active,reason)
    values(code,p_active,coalesce(nullif(btrim(p_reason),''),'Товар поки не потрібен'))
    on conflict(sku) do update set is_active=excluded.is_active,reason=excluded.reason,updated_at=now();
end $$;

-- Manual changes are explicit; reading a file alone never links suppliers.
create or replace function public.set_product_suppliers(p_id bigint,p_suppliers text[])
returns void language plpgsql security definer set search_path=public as $$
declare code text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_suppliers is null or exists(select 1 from unnest(p_suppliers) s where s is null or not exists(select 1 from catalog_suppliers cs where cs.code=s)) then raise exception 'Невідомий постачальник'; end if;
  select upper(btrim(sku)) into code from products where id=p_id for update;
  if not found then raise exception 'Товар не знайдено'; end if;
  if code is null or code='' then raise exception 'Спочатку збережіть SKU товару'; end if;
  delete from product_suppliers where product_id=p_id and not (supplier=any(p_suppliers));
  insert into product_suppliers(product_id,supplier,supplier_sku,origin)
    select p_id,s,code,'manual' from (select distinct unnest(p_suppliers) s) x
    on conflict(product_id,supplier) do nothing;
end $$;

-- Deleting a product records a global SKU exclusion, even if its supplier is unknown.
-- An exclusion is reversible; it does not recreate the product or remove its photos.
create or replace function public.protect_deleted_product_import()
returns trigger language plpgsql security definer set search_path=public as $$
declare code text;
begin
  code:=upper(btrim(case when TG_OP='DELETE' then old.sku else new.sku end));
  if code is not null and code<>'' then
    perform pg_advisory_xact_lock(hashtextextended('product-import:'||code,0));
    if TG_OP='DELETE' then
      insert into product_import_exclusions(sku,product_name,reason)
        values(code,old.name,'Видалено вручну: не відновлювати імпортом')
        on conflict(sku) do update set is_active=true,product_name=excluded.product_name,reason=excluded.reason,updated_at=now();
    elsif current_setting('technoroom.import_write',true)='true'
      and exists(select 1 from product_import_exclusions where sku=code and is_active) then
      raise exception 'SKU % виключено з імпорту. Спочатку зніміть виключення в адмінці.',code;
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists protect_deleted_product_import on public.products;
create trigger protect_deleted_product_import before insert or update or delete on public.products
  for each row execute function public.protect_deleted_product_import();

-- The existing writer retains its manual-override, CAS and journal guarantees.
-- Supplier attribution and the product write commit atomically, including unchanged rows.
create or replace function public.apply_product_supplier_import(p_run uuid,p_id bigint,p_patch jsonb,p_expected jsonb,p_supplier text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare code text; current_product public.products; result jsonb; field text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_supplier is null or p_supplier not in ('ERC','ASBIS') then raise exception 'Постачальника не визначено'; end if;
  perform 1 from import_runs where id=p_run and actor_id=auth.uid() and status='running' for update;
  if not found then raise exception 'Import is not running or belongs to another user'; end if;
  if p_id is not null then
    select * into current_product from products where id=p_id for update;
    if not found then raise exception 'Product no longer exists'; end if;
  end if;
  code:=upper(btrim(case when p_id is null then p_patch->>'sku' else p_expected->>'sku' end));
  if code is null or code='' then raise exception 'Missing expected SKU'; end if;
  perform pg_advisory_xact_lock(hashtextextended('product-import:'||code,0));
  if exists(select 1 from product_import_exclusions where sku=code and is_active) then
    raise exception 'SKU % виключено з імпорту. Спочатку зніміть виключення в адмінці.',code;
  end if;
  if p_id is not null and p_patch='{}'::jsonb then
    if jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'Missing expected values'; end if;
    for field in select jsonb_object_keys(p_expected) loop
      if coalesce(to_jsonb(current_product)->field,'null'::jsonb) is distinct from p_expected->field then
        raise exception 'Product changed after preview. Refresh and retry.' using errcode='40001';
      end if;
    end loop;
    result:=jsonb_build_object('id',p_id,'unchanged',true);
  else
    result:=public.apply_product_import(p_run,p_id,p_patch,p_expected,false);
  end if;
  insert into product_suppliers(product_id,supplier,supplier_sku,origin,last_seen_at,last_run_id)
    values((result->>'id')::bigint,p_supplier,code,'import',now(),p_run)
    on conflict(product_id,supplier) do update set supplier_sku=excluded.supplier_sku,last_seen_at=excluded.last_seen_at,last_run_id=excluded.last_run_id;
  return result;
end $$;
revoke all on function public.add_catalog_supplier(text,text),public.set_product_import_exclusion(text,boolean,text),public.set_product_suppliers(bigint,text[]),public.apply_product_supplier_import(uuid,bigint,jsonb,jsonb,text),public.protect_deleted_product_import() from public,anon;
grant execute on function public.add_catalog_supplier(text,text),public.set_product_import_exclusion(text,boolean,text),public.set_product_suppliers(bigint,text[]),public.apply_product_supplier_import(uuid,bigint,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
