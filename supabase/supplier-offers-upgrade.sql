-- Add supplier-specific offers without changing existing product prices/content.
-- Requires product-suppliers-upgrade.sql; safe to rerun.
begin;
insert into public.catalog_suppliers(code,name) values('MTI','МТІ') on conflict do nothing;
create table if not exists public.supplier_offer_runs (
  id uuid primary key,
  actor_id uuid not null references auth.users(id),
  source_name text not null,
  created_at timestamptz not null default now(),
  request_data jsonb not null,
  result jsonb not null default '{}'::jsonb
);
create table if not exists public.supplier_offers (
  supplier text not null references public.catalog_suppliers(code),
  supplier_sku text not null,
  supplier_product_id text not null,
  manufacturer_sku text not null,
  brand text not null,
  product_id bigint not null references public.products(id) on delete cascade,
  retail_price numeric(14,2) not null check(retail_price>0),
  supplier_price numeric(14,2) check(supplier_price>=0),
  currency text not null check(currency='UAH'),
  stock_quantity integer not null check(stock_quantity>=0),
  source_row integer not null check(source_row>0),
  observed_at timestamptz not null default now(),
  run_id uuid not null references public.supplier_offer_runs(id),
  content_evidence jsonb not null default '{}'::jsonb,
  primary key(supplier,supplier_sku)
);
create table if not exists public.supplier_offer_changes (
  run_id uuid not null references public.supplier_offer_runs(id),
  supplier text not null,
  supplier_sku text not null,
  before_values jsonb,
  after_values jsonb not null,
  created_product_id bigint,
  primary key(run_id,supplier,supplier_sku)
);
alter table public.supplier_offer_runs enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.supplier_offer_changes enable row level security;
revoke all on public.supplier_offer_runs,public.supplier_offers,public.supplier_offer_changes from public,anon,authenticated;
grant select on public.supplier_offer_runs,public.supplier_offers,public.supplier_offer_changes to authenticated;
drop policy if exists "admins read offer runs" on public.supplier_offer_runs;
create policy "admins read offer runs" on public.supplier_offer_runs for select to authenticated using(public.is_admin());
drop policy if exists "admins read supplier offers" on public.supplier_offers;
create policy "admins read supplier offers" on public.supplier_offers for select to authenticated using(public.is_admin());
drop policy if exists "admins read offer changes" on public.supplier_offer_changes;
create policy "admins read offer changes" on public.supplier_offer_changes for select to authenticated using(public.is_admin());

create or replace function public.apply_mti_offer_batch(p_request uuid,p_source_name text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  row_data jsonb; draft jsonb; batch public.supplier_offer_runs;
  old_offer public.supplier_offers; new_offer public.supplier_offers;
  found_product public.products;
  mpn text; manufacturer text; source_sku text; expected_id bigint; matching integer;
  created_id bigint; quantity integer; retail numeric; cost numeric;
  created_count integer:=0; linked_count integer:=0; applied integer:=0; result_data jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_request is null or p_source_name is null or length(p_source_name)>240 or length(btrim(p_source_name))=0 then raise exception 'Invalid source'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid batch'; end if;
  if jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)>1500000 then raise exception 'Batch must contain 1 to 100 offers'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mti-request:'||p_request::text,0));
  select * into batch from supplier_offer_runs where id=p_request for update;
  if found then
    if batch.actor_id<>auth.uid() or batch.source_name<>p_source_name or batch.request_data is distinct from p_rows then raise exception 'Request key already used for another batch'; end if;
    return batch.result;
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x group by upper(btrim(x->>'supplierSku')) having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_rows) x group by upper(btrim(x->>'brand')),upper(btrim(x->>'manufacturerSku')) having count(*)>1)
    then raise exception 'Duplicate identity in batch'; end if;
  insert into supplier_offer_runs(id,actor_id,source_name,request_data) values(p_request,auth.uid(),p_source_name,p_rows);
  for row_data in select value from jsonb_array_elements(p_rows) order by upper(value->>'manufacturerSku') loop
    mpn:=upper(btrim(row_data->>'manufacturerSku'));manufacturer:=btrim(row_data->>'brand');source_sku:=upper(btrim(row_data->>'supplierSku'));
    if coalesce(length(mpn),0) not between 1 and 120 or coalesce(length(manufacturer),0) not between 1 and 120
      or source_sku is distinct from mpn or coalesce(length(btrim(row_data->>'supplierId')),0) not between 1 and 120
      then raise exception 'Unverified manufacturer or supplier identity'; end if;
    if row_data->>'currency' is distinct from 'UAH' or row_data->>'priceBasis' is distinct from 'rrp'
      or row_data->>'stockKind' is distinct from 'exact' or row_data->'reserved' is distinct from '0'::jsonb
      or row_data->'reviewRequired' is distinct from 'false'::jsonb then raise exception 'Offer requires review'; end if;
    if row_data->>'category' not in ('projectors','erc-display-06','erc-display-10') or row_data->>'category' is null then raise exception 'Unsupported category'; end if;
    if jsonb_typeof(row_data->'retailPrice') is distinct from 'number'
      or jsonb_typeof(row_data->'quantity') is distinct from 'number'
      or coalesce(row_data->>'quantity','') !~ '^\d+$' then raise exception 'Invalid price or exact stock'; end if;
    retail:=(row_data->>'retailPrice')::numeric;quantity:=(row_data->>'quantity')::integer;
    if retail<=0 or retail>999999999999 or quantity not between 0 and 1000000 then raise exception 'Invalid price or exact stock'; end if;
    if row_data->'supplierPrice' is not null and row_data->'supplierPrice'<>'null'::jsonb and jsonb_typeof(row_data->'supplierPrice')<>'number' then raise exception 'Invalid supplier price'; end if;
    cost:=(row_data->>'supplierPrice')::numeric;
    if cost<0 or cost>999999999999 then raise exception 'Invalid supplier price'; end if;
    perform pg_advisory_xact_lock(hashtextextended('product-import:'||mpn,0));
    if exists(select 1 from product_import_exclusions where sku=mpn and is_active) then raise exception 'SKU % is excluded from import',mpn; end if;
    select count(*) into matching from products where upper(btrim(sku))=mpn;
    expected_id:=(row_data->>'expectedProductId')::bigint;created_id:=null;
    if matching>1 then raise exception 'Ambiguous catalog SKU %',mpn; end if;
    if matching=1 then
      select * into found_product from products where upper(btrim(sku))=mpn for update;
      if expected_id is distinct from found_product.id or lower(btrim(found_product.brand)) is distinct from lower(manufacturer) or found_product.category is distinct from row_data->>'category'
        or to_jsonb(found_product)->>'parent_product_id' is not null then raise exception 'Product identity changed after preview: %',mpn; end if;
      -- Existing product content, sale price, stock, manual flags and images are untouched.
      linked_count:=linked_count+1;
    else
      if expected_id is not null then raise exception 'Product disappeared after preview: %',mpn; end if;
      draft:=row_data->'draft';
      if draft is null or jsonb_typeof(draft)<>'object' or coalesce(length(btrim(draft->>'name')),0) not between 1 and 500
        or length(coalesce(draft->>'description',''))>40000 or jsonb_typeof(draft->'specifications') is distinct from 'object'
        or octet_length((draft->'specifications')::text)>100000 then raise exception 'Invalid new product draft'; end if;
      insert into products(name,slug,sku,brand,category,price,stock_quantity,in_stock,availability_status,description,specifications,is_active)
        values(draft->>'name','mti-'||substr(md5(lower(manufacturer)||':'||mpn),1,24),mpn,manufacturer,row_data->>'category',retail,quantity,quantity>0,
          case when quantity>0 then 'in_stock' else 'out_of_stock' end,nullif(draft->>'description',''),draft->'specifications',false)
        returning * into found_product;
      created_id:=found_product.id;created_count:=created_count+1;
    end if;
    select * into old_offer from supplier_offers where supplier='MTI' and supplier_sku=source_sku for update;
    if found and (old_offer.product_id<>found_product.id or old_offer.manufacturer_sku<>mpn or lower(old_offer.brand)<>lower(manufacturer)) then raise exception 'Supplier code already linked to another product'; end if;
    insert into supplier_offers(supplier,supplier_sku,supplier_product_id,manufacturer_sku,brand,product_id,retail_price,supplier_price,currency,stock_quantity,source_row,run_id,content_evidence)
      values('MTI',source_sku,row_data->>'supplierId',mpn,manufacturer,found_product.id,retail,cost,'UAH',quantity,(row_data->>'sourceRow')::integer,p_request,coalesce(row_data->'contentEvidence','{}'::jsonb))
      on conflict(supplier,supplier_sku) do update set supplier_product_id=excluded.supplier_product_id,retail_price=excluded.retail_price,
        supplier_price=excluded.supplier_price,stock_quantity=excluded.stock_quantity,source_row=excluded.source_row,observed_at=now(),run_id=excluded.run_id,content_evidence=excluded.content_evidence
      returning * into new_offer;
    insert into supplier_offer_changes(run_id,supplier,supplier_sku,before_values,after_values,created_product_id)
      values(p_request,'MTI',source_sku,case when old_offer.supplier is null then null else to_jsonb(old_offer) end,to_jsonb(new_offer),created_id);
    insert into product_suppliers(product_id,supplier,supplier_sku,origin,last_seen_at)
      values(found_product.id,'MTI',source_sku,'import',now()) on conflict(product_id,supplier) do update set supplier_sku=excluded.supplier_sku,last_seen_at=excluded.last_seen_at;
    applied:=applied+1;
  end loop;
  result_data:=jsonb_build_object('runId',p_request,'offers',applied,'createdDrafts',created_count,'linkedExisting',linked_count,'published',0);
  update supplier_offer_runs set result=result_data where id=p_request;
  return result_data;
end $$;
revoke all on function public.apply_mti_offer_batch(uuid,text,jsonb) from public,anon;
grant execute on function public.apply_mti_offer_batch(uuid,text,jsonb) to authenticated;
-- Restore the journal's intended admin-only SELECT; RLS policies stay in force.
grant select on public.import_runs,public.import_changes to authenticated;
grant select on public.catalog_suppliers,public.product_suppliers,public.product_import_exclusions to authenticated;
notify pgrst,'reload schema';
commit;
