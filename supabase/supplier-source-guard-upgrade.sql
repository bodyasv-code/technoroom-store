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

create or replace function public.apply_mti_offer_batch(p_request uuid,p_source_name text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  row_data jsonb; draft jsonb; batch public.supplier_offer_runs;
  old_offer public.supplier_offers; new_offer public.supplier_offers;
  found_product public.products;
  mpn text; manufacturer text; source_sku text; expected_id bigint; matching integer;
  created_id bigint; quantity integer; retail numeric; cost numeric;
  created_count integer:=0; linked_count integer:=0; applied integer:=0; result_data jsonb; source_meta jsonb; source_time timestamptz; source_hash text; source_facts jsonb; unchanged_count integer:=0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_request is null or p_source_name is null or length(p_source_name)>240 or length(btrim(p_source_name))=0 then raise exception 'Invalid source'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid batch'; end if;
  if jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)>1500000 then raise exception 'Batch must contain 1 to 100 offers'; end if;
  source_meta:=p_rows->0->'source';
  if source_meta is null or exists(select 1 from jsonb_array_elements(p_rows) r where r->'source' is distinct from source_meta) then raise exception 'Вкажіть дату джерела і повторно підготуйте прайс.';end if;
  source_time:=(source_meta->>'observedAt')::timestamptz;source_hash:=source_meta->>'hash';
  perform public.register_supplier_import_source('MTI',source_hash,source_time,p_source_name);
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
      or (source_sku is distinct from mpn and not (upper(manufacturer)='VIEWSONIC' and coalesce(upper(btrim(row_data->>'model'))=source_sku,false) and exists(select 1 from (values ('VS16905','PA503S'),('VS19343','PA700X'),('VS19341','PA700S'),('VS20135','PX700HDH'),('VS19746','PX704HD'),('VS20642','LSD400HD-ST'),('VS20579','LSD300W-ST'),('VS20996','LSD600W')) v(part,model) where v.part=mpn and v.model=source_sku))) or coalesce(length(btrim(row_data->>'supplierId')),0) not between 1 and 120
      then raise exception 'Unverified manufacturer or supplier identity'; end if;
    if row_data->>'currency' is distinct from 'UAH' or row_data->>'priceBasis' is distinct from 'rrp'
      or coalesce(row_data->>'stockKind','') not in ('exact','needs_confirmation') or row_data->'reserved' is distinct from '0'::jsonb
      or row_data->'reviewRequired' is distinct from 'false'::jsonb then raise exception 'Offer requires review'; end if;
    if row_data->>'category' not in ('projectors','erc-display-06','erc-display-10','erc-display-08') or row_data->>'category' is null then raise exception 'Unsupported category'; end if;
    if jsonb_typeof(row_data->'retailPrice') is distinct from 'number'
      or (row_data->>'stockKind'='exact' and (jsonb_typeof(row_data->'quantity') is distinct from 'number' or coalesce(row_data->>'quantity','') !~ '^\d+$'))
      or (row_data->>'stockKind'='needs_confirmation' and row_data->'quantity' is distinct from 'null'::jsonb) then raise exception 'Invalid price or exact stock'; end if;
    retail:=(row_data->>'retailPrice')::numeric;quantity:=(row_data->>'quantity')::integer;
    if retail<=0 or retail>999999999999 or quantity not between 0 and 1000000 then raise exception 'Invalid price or exact stock'; end if;
    if row_data->'supplierPrice' is not null and row_data->'supplierPrice'<>'null'::jsonb and jsonb_typeof(row_data->'supplierPrice')<>'number' then raise exception 'Invalid supplier price'; end if;
    cost:=(row_data->>'supplierPrice')::numeric;
    if cost<0 or cost>999999999999 then raise exception 'Invalid supplier price'; end if;
    perform pg_advisory_xact_lock(hashtextextended('product-import:'||mpn,0));
    if exists(select 1 from product_import_exclusions where sku=mpn and is_active) then raise exception 'SKU % is excluded from import',mpn; end if;
    select * into old_offer from supplier_offers where supplier='MTI' and supplier_sku=source_sku for update;
    source_facts:=jsonb_build_object('mpn',mpn,'brand',upper(manufacturer),'supplierId',row_data->'supplierId','category',row_data->'category','retailPrice',row_data->'retailPrice','supplierPrice',row_data->'supplierPrice','currency',row_data->'currency','quantity',row_data->'quantity','kind',row_data->'stockKind','reserved',row_data->'reserved');
    if not public.accept_supplier_source_fact('MTI',source_sku,'offer',source_hash,source_time,source_facts,old_offer.observed_at) then
      if old_offer.product_id is null then raise exception 'Раніше імпортована пропозиція відсутня: %',source_sku;end if;
      applied:=applied+1;unchanged_count:=unchanged_count+1;continue;
    end if;
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
        values(draft->>'name','mti-'||substr(md5(lower(manufacturer)||':'||mpn),1,24),mpn,manufacturer,row_data->>'category',retail,0,false,'out_of_stock',nullif(draft->>'description',''),draft->'specifications',false)
        returning * into found_product;
      created_id:=found_product.id;created_count:=created_count+1;
    end if;
    select * into old_offer from supplier_offers where supplier='MTI' and supplier_sku=source_sku for update;
    if found and (old_offer.product_id<>found_product.id or old_offer.manufacturer_sku<>mpn or lower(old_offer.brand)<>lower(manufacturer)) then raise exception 'Supplier code already linked to another product'; end if;
    insert into supplier_offers(supplier,supplier_sku,supplier_product_id,manufacturer_sku,brand,product_id,retail_price,supplier_price,currency,stock_quantity,stock_kind,source_row,run_id,content_evidence,observed_at)
      values('MTI',source_sku,row_data->>'supplierId',mpn,manufacturer,found_product.id,retail,cost,'UAH',quantity,row_data->>'stockKind',(row_data->>'sourceRow')::integer,p_request,coalesce(row_data->'contentEvidence','{}'::jsonb),source_time)
      on conflict(supplier,supplier_sku) do update set supplier_product_id=excluded.supplier_product_id,retail_price=excluded.retail_price,
        supplier_price=excluded.supplier_price,stock_quantity=excluded.stock_quantity,stock_kind=excluded.stock_kind,source_row=excluded.source_row,observed_at=excluded.observed_at,run_id=excluded.run_id,content_evidence=excluded.content_evidence
      returning * into new_offer;
    insert into supplier_offer_changes(run_id,supplier,supplier_sku,before_values,after_values,created_product_id)
      values(p_request,'MTI',source_sku,case when old_offer.supplier is null then null else to_jsonb(old_offer) end,to_jsonb(new_offer),created_id);
    insert into product_suppliers(product_id,supplier,supplier_sku,origin,last_seen_at)
      values(found_product.id,'MTI',source_sku,'import',now()) on conflict(product_id,supplier) do update set supplier_sku=excluded.supplier_sku,last_seen_at=excluded.last_seen_at;
    applied:=applied+1;
  end loop;
  result_data:=jsonb_build_object('runId',p_request,'offers',applied,'createdDrafts',created_count,'linkedExisting',linked_count,'published',0,'unchanged',unchanged_count,'written',applied-unchanged_count);
  update supplier_offer_runs set result=result_data where id=p_request;
  return result_data;
end $$;

create or replace function public.apply_product_supplier_import(p_run uuid,p_id bigint,p_patch jsonb,p_expected jsonb,p_supplier text,p_facts jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare code text; current_product public.products; result jsonb; field text; source_meta jsonb; source_time timestamptz; prior_time timestamptz;
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
  select options->'source' into source_meta from import_runs where id=p_run;
  if jsonb_typeof(p_facts) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_facts) k where k not in ('price','stock')) then raise exception 'Invalid source facts';end if;
  if source_meta is null or source_meta='null'::jsonb then raise exception 'Оновіть адмінку та вкажіть дату джерела перед імпортом.';end if;
  if source_meta->>'supplier' is distinct from p_supplier then raise exception 'Постачальник джерела змінився';end if;
  source_time:=(source_meta->>'observedAt')::timestamptz;
  select last_seen_at into prior_time from product_suppliers where product_id=p_id and supplier=p_supplier;
  if p_patch?'price' and not(p_facts?'price') and (p_id is not null or p_patch->'price' is distinct from '0'::jsonb) then raise exception 'Ціна не підтверджена джерелом';end if;
  if p_facts?'price' then
    if jsonb_typeof(p_facts->'price') is distinct from 'number' or (p_facts->>'price')::numeric<=0 or (p_patch?'price' and p_patch->'price' is distinct from p_facts->'price') then raise exception 'Invalid source price';end if;
    if not public.accept_supplier_source_fact(p_supplier,code,'price',source_meta->>'hash',source_time,p_facts->'price',prior_time) then p_patch:=p_patch-'price';end if;
  end if;
  if (p_patch ?| array['stock_quantity','in_stock','availability_status']) and not(p_facts?'stock') and (p_id is not null or coalesce((p_patch->>'stock_quantity')::numeric,0)<>0 or coalesce((p_patch->>'in_stock')::boolean,false)) then raise exception 'Залишок не підтверджений джерелом';end if;
  if p_facts?'stock' then
    if jsonb_typeof(p_facts->'stock') is distinct from 'object' or coalesce(p_facts->'stock'->>'quantity','') !~ '^\d+$' or (p_patch?'stock_quantity' and p_patch->'stock_quantity' is distinct from p_facts->'stock'->'quantity') or (p_patch?'in_stock' and (p_patch->>'in_stock')::boolean is distinct from ((p_facts->'stock'->>'quantity')::numeric>0)) or (p_patch?'availability_status' and p_patch->'availability_status' is distinct from p_facts->'stock'->'status') then raise exception 'Invalid source stock';end if;
    if not public.accept_supplier_source_fact(p_supplier,code,'stock',source_meta->>'hash',source_time,p_facts->'stock',prior_time) then p_patch:=p_patch-array['stock_quantity','in_stock','availability_status'];end if;
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
    values((result->>'id')::bigint,p_supplier,code,'import',source_time,p_run)
    on conflict(product_id,supplier) do update set supplier_sku=excluded.supplier_sku,last_seen_at=greatest(product_suppliers.last_seen_at,excluded.last_seen_at),last_run_id=case when product_suppliers.last_seen_at is null or product_suppliers.last_seen_at<=excluded.last_seen_at then excluded.last_run_id else product_suppliers.last_run_id end;
  return result;
end $$;


-- The old writer signature cannot bypass the dated-source checks.
create or replace function public.apply_product_supplier_import(p_run uuid,p_id bigint,p_patch jsonb,p_expected jsonb,p_supplier text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 return public.apply_product_supplier_import(p_run,p_id,p_patch,p_expected,p_supplier,
   (case when p_patch?'price' then jsonb_build_object('price',p_patch->'price') else '{}'::jsonb end)||
   (case when p_patch?'stock_quantity' then jsonb_build_object('stock',jsonb_build_object('quantity',p_patch->'stock_quantity','status',p_patch->'availability_status')) else '{}'::jsonb end));
end $$;
revoke all on function public.apply_product_supplier_import(uuid,bigint,jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.apply_product_supplier_import(uuid,bigint,jsonb,jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
