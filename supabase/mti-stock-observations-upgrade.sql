begin;
alter table public.supplier_offers drop constraint if exists supplier_offers_stock_state_check;
alter table public.supplier_offers add constraint supplier_offers_stock_state_check check (
 (stock_kind='exact' and stock_quantity is not null and stock_quantity>=0)
 or (stock_kind in ('needs_confirmation','unknown') and stock_quantity is null));
create table if not exists public.mti_stock_observation_runs(
 id uuid primary key,actor_id uuid not null,source_name text not null,observed_at timestamptz not null,
 request_data jsonb not null,before_values jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table public.mti_stock_observation_runs enable row level security;
revoke all on public.mti_stock_observation_runs from public,anon,authenticated;
grant select on public.mti_stock_observation_runs to authenticated;
drop policy if exists "admins read stock observations" on public.mti_stock_observation_runs;
create policy "admins read stock observations" on public.mti_stock_observation_runs for select to authenticated using(public.is_admin());
create or replace function public.refresh_supplier_stock_uncertain()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP<>'INSERT' then update products p set supplier_stock_uncertain=exists(select 1 from supplier_offers o where o.product_id=p.id and o.stock_kind in ('needs_confirmation','unknown')) where p.id=OLD.product_id;end if;
 if TG_OP<>'DELETE' then update products p set supplier_stock_uncertain=exists(select 1 from supplier_offers o where o.product_id=p.id and o.stock_kind in ('needs_confirmation','unknown')) where p.id=NEW.product_id;end if;
 return null;
end $$;
revoke all on function public.refresh_supplier_stock_uncertain() from public,anon,authenticated;
create or replace function public.apply_mti_stock_observations(p_request uuid,p_source text,p_observed_at timestamptz,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare old_run public.mti_stock_observation_runs; r jsonb; o public.supplier_offers; backups jsonb:='[]'; answer jsonb; n integer:=0;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501';end if;
 if p_request is null or coalesce(length(btrim(p_source)),0) not between 1 and 240 or p_observed_at is null or p_observed_at>now()
 or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Invalid observation';end if;
 if jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)>500000 then raise exception 'Invalid batch';end if;
 perform pg_advisory_xact_lock(hashtextextended('mti-stock:'||p_request::text,0));
 select * into old_run from mti_stock_observation_runs where id=p_request;
 if found then
 if old_run.actor_id<>auth.uid() or old_run.source_name<>p_source or old_run.observed_at<>p_observed_at or old_run.request_data is distinct from p_rows then raise exception 'Request key reused';end if;
 return old_run.result;end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x group by x->>'supplierSku' having count(*)>1) then raise exception 'Duplicate SKU';end if;
 for r in select value from jsonb_array_elements(p_rows) order by (value->>'productId')::bigint loop
 if r->>'stockKind' is distinct from 'unknown' or r->'quantity' is distinct from 'null'::jsonb then raise exception 'Invalid unknown stock';end if;
 perform 1 from products where id=(r->>'productId')::bigint for update;
 select * into strict o from supplier_offers where supplier='MTI' and supplier_sku=r->>'supplierSku' for update;
 if upper(btrim(o.brand)) is distinct from upper(btrim(r->>'brand')) or upper(btrim(o.manufacturer_sku)) is distinct from upper(btrim(r->>'manufacturerSku')) or o.supplier_product_id is distinct from r->>'supplierId' or o.product_id is distinct from (r->>'productId')::bigint or o.observed_at is distinct from (r->>'expectedObservedAt')::timestamptz
 or o.stock_kind is distinct from r->>'expectedStockKind' or to_jsonb(o.stock_quantity) is distinct from nullif(r->'expectedQuantity','null'::jsonb)
 or o.observed_at>=p_observed_at or exists(select 1 from product_import_exclusions e where upper(btrim(e.sku))=upper(btrim(o.manufacturer_sku)) and e.is_active)
 then raise exception 'Observation changed or excluded: %',o.supplier_sku;end if;
 backups:=backups||jsonb_build_array(to_jsonb(o));
 update supplier_offers set stock_kind='unknown',stock_quantity=null,observed_at=p_observed_at,
 content_evidence=content_evidence||jsonb_build_object('stockSource',p_source,'stockSourceStatus','unknown') where supplier='MTI' and supplier_sku=o.supplier_sku;
 n:=n+1;
 end loop;
 answer:=jsonb_build_object('updated',n,'runId',p_request);
 insert into mti_stock_observation_runs values(p_request,auth.uid(),p_source,p_observed_at,p_rows,backups,answer,now());
 return answer;
end $$;
revoke all on function public.apply_mti_stock_observations(uuid,text,timestamptz,jsonb) from public,anon;
grant execute on function public.apply_mti_stock_observations(uuid,text,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

