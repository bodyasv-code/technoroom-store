import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
function replace(source,oldValue,newValue){if(source.split(oldValue).length!==2)throw Error('Source guard template changed: '+oldValue.slice(0,70)+'; matches '+(source.split(oldValue).length-1)+'; tail '+source.slice(-600));return source.replace(oldValue,()=>newValue);}
let mti=(await read('supabase/mti-verified-identities-upgrade.sql')).split('create or replace function public.apply_mti_offer_batch')[1].split('revoke all on function')[0];
mti='create or replace function public.apply_mti_offer_batch'+mti;
mti=replace(mti,'created_count integer:=0; linked_count integer:=0; applied integer:=0; result_data jsonb;',"created_count integer:=0; linked_count integer:=0; applied integer:=0; result_data jsonb; source_meta jsonb; source_time timestamptz; source_hash text; source_facts jsonb; unchanged_count integer:=0;");
mti=replace(mti,"  perform pg_advisory_xact_lock(hashtextextended('mti-request:'||p_request::text,0));",`  source_meta:=p_rows->0->'source';
  if source_meta is null or exists(select 1 from jsonb_array_elements(p_rows) r where r->'source' is distinct from source_meta) then raise exception 'Вкажіть дату джерела і повторно підготуйте прайс.';end if;
  source_time:=(source_meta->>'observedAt')::timestamptz;source_hash:=source_meta->>'hash';
  perform public.register_supplier_import_source('MTI',source_hash,source_time,p_source_name);
  perform pg_advisory_xact_lock(hashtextextended('mti-request:'||p_request::text,0));`);
mti=replace(mti,'    select count(*) into matching from products where upper(btrim(sku))=mpn;',`    select * into old_offer from supplier_offers where supplier='MTI' and supplier_sku=source_sku for update;
    source_facts:=jsonb_build_object('mpn',mpn,'brand',upper(manufacturer),'supplierId',row_data->'supplierId','category',row_data->'category','retailPrice',row_data->'retailPrice','supplierPrice',row_data->'supplierPrice','currency',row_data->'currency','quantity',row_data->'quantity','kind',row_data->'stockKind','reserved',row_data->'reserved');
    if not public.accept_supplier_source_fact('MTI',source_sku,'offer',source_hash,source_time,source_facts,old_offer.observed_at) then
      if old_offer.product_id is null then raise exception 'Раніше імпортована пропозиція відсутня: %',source_sku;end if;
      applied:=applied+1;unchanged_count:=unchanged_count+1;continue;
    end if;
    select count(*) into matching from products where upper(btrim(sku))=mpn;`);
mti=replace(mti,'currency,stock_quantity,stock_kind,source_row,run_id,content_evidence)', 'currency,stock_quantity,stock_kind,source_row,run_id,content_evidence,observed_at)');
mti=replace(mti,"p_request,coalesce(row_data->'contentEvidence','{}'::jsonb))", "p_request,coalesce(row_data->'contentEvidence','{}'::jsonb),source_time)");
mti=replace(mti,'observed_at=now(),run_id=excluded.run_id','observed_at=excluded.observed_at,run_id=excluded.run_id');
mti=replace(mti,"'published',0);","'published',0,'unchanged',unchanged_count,'written',applied-unchanged_count);");

const oldSupplier=await read('supabase/product-suppliers-upgrade.sql');
let erc='create or replace function public.apply_product_supplier_import'+oldSupplier.split('create or replace function public.apply_product_supplier_import')[1].split('revoke all on function')[0];
erc=replace(erc,'p_expected jsonb,p_supplier text)','p_expected jsonb,p_supplier text,p_facts jsonb)');
erc=replace(erc,'result jsonb; field text;','result jsonb; field text; source_meta jsonb; source_time timestamptz; prior_time timestamptz;');
erc=replace(erc,"  if p_id is not null and p_patch='{}'::jsonb then",`  select options->'source' into source_meta from import_runs where id=p_run;
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
    if jsonb_typeof(p_facts->'stock') is distinct from 'object' or coalesce(p_facts->'stock'->>'quantity','') !~ '^\\d+$' or (p_patch?'stock_quantity' and p_patch->'stock_quantity' is distinct from p_facts->'stock'->'quantity') or (p_patch?'in_stock' and (p_patch->>'in_stock')::boolean is distinct from ((p_facts->'stock'->>'quantity')::numeric>0)) or (p_patch?'availability_status' and p_patch->'availability_status' is distinct from p_facts->'stock'->'status') then raise exception 'Invalid source stock';end if;
    if not public.accept_supplier_source_fact(p_supplier,code,'stock',source_meta->>'hash',source_time,p_facts->'stock',prior_time) then p_patch:=p_patch-array['stock_quantity','in_stock','availability_status'];end if;
  end if;
  if p_id is not null and p_patch='{}'::jsonb then`);
erc=replace(erc,"code,'import',now(),p_run)","code,'import',source_time,p_run)");
erc=replace(erc,'last_seen_at=excluded.last_seen_at,last_run_id=excluded.last_run_id;',"last_seen_at=greatest(product_suppliers.last_seen_at,excluded.last_seen_at),last_run_id=case when product_suppliers.last_seen_at is null or product_suppliers.last_seen_at<=excluded.last_seen_at then excluded.last_run_id else product_suppliers.last_run_id end;");

const header=await read('supabase/supplier-source-guard-base.sql');
const tail=`
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
`;
await writeFile(new URL('supabase/supplier-source-guard-upgrade.sql',root),(header+'\n'+mti+'\n'+erc+'\n'+tail).replace(/[ \t]+$/gm,''));
