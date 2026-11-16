const operation='mti-screen-protection-20261116';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export function screenReviewSql(plans,{restore=false}={}){
  if(!Array.isArray(plans)||plans.length!==13||new Set(plans.map(p=>p.id)).size!==13)throw Error('Expected 13 distinct screens');
  for(const p of plans)if(!p.sku||!p.brand||!p.source||!Array.isArray(p.keys)||!p.keys.length||p.keys.some(k=>!Object.hasOwn(p.before.specifications,k)))throw Error('Incomplete screen review');
  return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';
set local technoroom.import_write='false';
create temporary table screen_review_plan(payload jsonb) on commit drop;
insert into screen_review_plan values(${literal(plans)});
do $review$
declare item jsonb;before_row jsonb;after_row jsonb;expected_marks jsonb;expected_images jsonb;expected_main jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 perform id from public.products where id in (select (value->>'id')::bigint from screen_review_plan,jsonb_array_elements(payload)) order by id for update;
 for item in select value from screen_review_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into before_row from public.products p where id=(item->>'id')::bigint;
  if before_row is null or before_row->>'sku' is distinct from item->>'sku' or before_row->>'brand' is distinct from item->>'brand' or before_row->>'name' is distinct from item->>'name' then raise exception 'Screen identity changed';end if;
  expected_marks:=(item->'before'->'manual_overrides')||jsonb_build_object('reviewed_specifications',item->'keys','reviewed_description',true);
  expected_images:=coalesce(item->'images',item->'before'->'image_paths');
  expected_main:=case when item?'images' then item->'images'->0 else item->'before'->'image_path' end;
  if before_row->'specifications' is distinct from item->'before'->'specifications' or before_row->'description' is distinct from item->'before'->'description' then raise exception 'Screen content changed after preview';end if;
  ${restore?`
  if before_row->'manual_overrides' is distinct from expected_marks or before_row->'image_paths' is distinct from expected_images or before_row->'image_path' is distinct from expected_main then raise exception 'Screen changed since review';end if;
  if not exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint) then raise exception 'Backup missing';end if;
  delete from technoroom_maintenance.reviewed_product_content where product_id=(item->>'id')::bigint and operation='${operation}';
  if not found then raise exception 'Review enrollment changed';end if;
  update public.products set image_path=item->'before'->>'image_path',image_paths=item->'before'->'image_paths' where id=(item->>'id')::bigint;
  expected_marks:=item->'before'->'manual_overrides';
  expected_main:=item->'before'->'image_path';expected_images:=item->'before'->'image_paths';
  `:`
  if before_row->'manual_overrides' is distinct from item->'before'->'manual_overrides' or before_row->'image_paths' is distinct from item->'before'->'image_paths' or before_row->'image_path' is distinct from item->'before'->'image_path' then raise exception 'Screen changed after preview';end if;
  if exists(select 1 from technoroom_maintenance.reviewed_product_content where product_id=(item->>'id')::bigint) then raise exception 'Screen already reviewed';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',(item->>'id')::bigint,before_row,now());
  insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,specification_keys,operation) values((item->>'id')::bigint,item->>'sku',item->>'brand',item->>'source',true,array(select jsonb_array_elements_text(item->'keys')),'${operation}');
  update public.products set image_path=expected_main#>>'{}',image_paths=expected_images where id=(item->>'id')::bigint;
  `}
  select to_jsonb(p) into after_row from public.products p where id=(item->>'id')::bigint;
  if after_row->'manual_overrides' is distinct from expected_marks or after_row->'image_path' is distinct from expected_main or after_row->'image_paths' is distinct from expected_images or (after_row-array['manual_overrides','image_path','image_paths','updated_at']) is distinct from (before_row-array['manual_overrides','image_path','image_paths','updated_at']) then raise exception 'Unexpected screen side effect';end if;
 end loop;
end $review$;
commit;
`;
}
