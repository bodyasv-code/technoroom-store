const operation='projection-content-finish-20261120';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const ids=[6141,6142,6162,6177];
export function projectionFinishSql(plans,{restore=false}={}){
 if(!Array.isArray(plans)||plans.length!==4||JSON.stringify(plans.map(p=>p.id).sort((a,b)=>a-b))!==JSON.stringify(ids))throw Error('Expected four reviewed projection cards');
 for(const p of plans){
  if(!p.sku||!p.brand||!p.source||!p.before||Object.keys(p.patch).some(k=>!['description','specifications','image_path','image_paths'].includes(k)))throw Error('Invalid content-only plan');
  if(p.newReview&&(p.reviewBefore!==null||p.id!==6177||p.newReview.keys.join()!=='Яскравість'))throw Error('Unexpected review enrollment');
 }
 return `begin;
set local lock_timeout='5s';set local statement_timeout='45s';set local timezone='UTC';set local technoroom.import_write='false';
create temporary table projection_finish_plan(payload jsonb) on commit drop;
alter table projection_finish_plan enable row level security;
insert into projection_finish_plan values(${literal(plans)});
do $repair$
declare item jsonb;old_row jsonb;new_row jsonb;expected jsonb;review_row jsonb;marks jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 perform id from public.products where id in(select (value->>'id')::bigint from projection_finish_plan,jsonb_array_elements(payload)) order by id for update;
 for item in select value from projection_finish_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into old_row from public.products p where id=(item->>'id')::bigint;
  if old_row is null or old_row->>'sku' is distinct from item->>'sku' or old_row->>'brand' is distinct from item->>'brand' then raise exception 'Projection identity changed';end if;
  select to_jsonb(r) into review_row from technoroom_maintenance.reviewed_product_content r where product_id=(item->>'id')::bigint for update;
  expected:=(item->'before')||(item->'patch');
  marks:=item->'before'->'manual_overrides';
  if item?'newReview' then marks:=marks||jsonb_build_object('reviewed_specifications',item->'newReview'->'keys','reviewed_description',true);end if;
  expected:=jsonb_set(expected,'{manual_overrides}',marks);
  ${restore?`
  if exists(select 1 from jsonb_each(expected) e where old_row->e.key is distinct from e.value) then raise exception 'Projection content changed since repair';end if;
  if not exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint) then raise exception 'Backup missing';end if;
  if item?'newReview' then
   if review_row->>'operation' is distinct from '${operation}' or review_row->'specification_keys' is distinct from item->'newReview'->'keys' or review_row->>'source' is distinct from item->>'source' or review_row->>'sku' is distinct from item->>'sku' or review_row->>'brand' is distinct from item->>'brand' or review_row->'protect_description' is distinct from 'true'::jsonb then raise exception 'Review enrollment changed';end if;
   delete from technoroom_maintenance.reviewed_product_content where product_id=(item->>'id')::bigint;
  elsif coalesce(review_row,'null'::jsonb) is distinct from item->'reviewBefore' then raise exception 'Earlier review changed';end if;
  expected:=item->'before';
  `:`
  if exists(select 1 from jsonb_each(item->'before') e where old_row->e.key is distinct from e.value) then raise exception 'Projection content changed after preview';end if;
  if coalesce(review_row,'null'::jsonb) is distinct from item->'reviewBefore' then raise exception 'Earlier review changed';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',(item->>'id')::bigint,old_row,now());
  if item?'newReview' then
   insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,specification_keys,operation) values((item->>'id')::bigint,item->>'sku',item->>'brand',item->>'source',true,array(select jsonb_array_elements_text(item->'newReview'->'keys')),'${operation}');
  end if;
  `}
  update public.products set description=expected->>'description',specifications=expected->'specifications',image_path=expected->>'image_path',image_paths=expected->'image_paths' where id=(item->>'id')::bigint;
  select to_jsonb(p) into new_row from public.products p where id=(item->>'id')::bigint;
  if exists(select 1 from jsonb_each(expected) e where new_row->e.key is distinct from e.value) or (new_row-array['description','specifications','image_path','image_paths','manual_overrides','updated_at']) is distinct from (old_row-array['description','specifications','image_path','image_paths','manual_overrides','updated_at']) then raise exception 'Unexpected projection side effect';end if;
 end loop;
end $repair$;
commit;
`;
}
