-- Source dates are facts; upload time never replaces them.
begin;
create table if not exists public.supplier_import_sources(
 supplier text not null references catalog_suppliers(code),source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 source_observed_at timestamptz not null,source_name text not null,first_received_at timestamptz not null default now(),
 primary key(supplier,source_hash));
create table if not exists public.supplier_source_facts(
 supplier text not null,sku text not null,field text not null check(field in ('offer','price','stock')),
 source_hash text not null,source_observed_at timestamptz not null,facts jsonb not null,recorded_at timestamptz not null default now(),
 primary key(supplier,sku,field,source_hash),foreign key(supplier,source_hash) references supplier_import_sources(supplier,source_hash));
create index if not exists supplier_source_facts_latest on public.supplier_source_facts(supplier,sku,field,source_observed_at desc);
alter table public.supplier_import_sources enable row level security;
alter table public.supplier_source_facts enable row level security;
revoke all on public.supplier_import_sources,public.supplier_source_facts from public,anon,authenticated;
grant select on public.supplier_import_sources,public.supplier_source_facts to authenticated;
drop policy if exists "admins read import sources" on public.supplier_import_sources;
create policy "admins read import sources" on public.supplier_import_sources for select to authenticated using(public.is_admin());
drop policy if exists "admins read source facts" on public.supplier_source_facts;
create policy "admins read source facts" on public.supplier_source_facts for select to authenticated using(public.is_admin());
create or replace function public.register_supplier_import_source(p_supplier text,p_hash text,p_observed_at timestamptz,p_name text)
returns void language plpgsql security definer set search_path=public as $$
declare source public.supplier_import_sources;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501';end if;
 if p_supplier not in ('ERC','MTI','ASBIS') or p_supplier is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_observed_at is null or p_observed_at>now() or p_observed_at<'2000-01-01' or coalesce(length(btrim(p_name)),0) not between 1 and 240 then raise exception 'Вкажіть коректну дату джерела і повторно підготуйте прайс.';end if;
 perform pg_advisory_xact_lock(hashtextextended('import-source:'||p_supplier||':'||p_hash,0));
 select * into source from supplier_import_sources where supplier=p_supplier and source_hash=p_hash for update;
 if found then
  if source.source_observed_at<>p_observed_at then raise exception 'Цей файл уже має іншу дату джерела. Повторне завантаження не робить його новішим.';end if;
 else
  insert into supplier_import_sources(supplier,source_hash,source_observed_at,source_name) values(p_supplier,p_hash,p_observed_at,p_name);
 end if;
end $$;
create or replace function public.accept_supplier_source_fact(p_supplier text,p_sku text,p_field text,p_hash text,p_observed_at timestamptz,p_facts jsonb,p_legacy_time timestamptz default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare prior public.supplier_source_facts;latest public.supplier_source_facts;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501';end if;
 if p_sku is null or btrim(p_sku)='' or p_field not in ('offer','price','stock') or p_facts is null or p_facts='null'::jsonb then raise exception 'Invalid source fact';end if;
 perform pg_advisory_xact_lock(hashtextextended('source-fact:'||p_supplier||':'||p_sku||':'||p_field,0));
 select * into prior from supplier_source_facts where supplier=p_supplier and sku=p_sku and field=p_field and source_hash=p_hash;
 if found then
  if prior.facts is distinct from p_facts or prior.source_observed_at<>p_observed_at then raise exception 'Дані раніше обробленого файлу змінилися: %',p_sku;end if;
  return false;
 end if;
 select * into latest from supplier_source_facts where supplier=p_supplier and sku=p_sku and field=p_field order by source_observed_at desc limit 1;
 if latest.source_observed_at>p_observed_at then raise exception 'Старіший прайс заблоковано: %. Дата джерела %, новіше джерело %',p_sku,p_observed_at,latest.source_observed_at;end if;
 if latest.source_observed_at=p_observed_at and latest.facts is distinct from p_facts then raise exception 'Суперечливі дані за однакову дату: %',p_sku;end if;
 if p_legacy_time>p_observed_at and p_legacy_time>coalesce((select max(source_observed_at) from supplier_source_facts where supplier=p_supplier and sku=p_sku),'-infinity'::timestamptz) then raise exception 'Є пізніший запис або перевірка залишку: %. Потрібен свіжий прайс або звірка джерела.',p_sku;end if;
 insert into supplier_source_facts(supplier,sku,field,source_hash,source_observed_at,facts) values(p_supplier,p_sku,p_field,p_hash,p_observed_at,p_facts);
 return latest.source_observed_at is distinct from p_observed_at;
end $$;
revoke all on function public.register_supplier_import_source(text,text,timestamptz,text),public.accept_supplier_source_fact(text,text,text,text,timestamptz,jsonb,timestamptz) from public,anon,authenticated;
create or replace function public.start_product_import(p_options jsonb,p_count integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;source jsonb:=p_options->'source';
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501';end if;
 if source is null or source='null'::jsonb then raise exception 'Оновіть адмінку та вкажіть дату джерела перед імпортом.';end if;
 perform public.register_supplier_import_source(source->>'supplier',source->>'hash',(source->>'observedAt')::timestamptz,source->>'name');
 insert into import_runs(actor_id,options,selected_count) values(auth.uid(),jsonb_build_object('price',p_options->'price','stock',p_options->'stock','category',p_options->'category','description',p_options->'description','specifications',p_options->'specifications','images',p_options->'images','publish',p_options->'publish','source',source),p_count) returning id into result;
 return result;
end $$;
