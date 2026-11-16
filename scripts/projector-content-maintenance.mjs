const operation='mti-projector-content-20261116';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export function projectorContentSql(plans,{restore=false}={}){
 if(!Array.isArray(plans)||plans.length!==14||new Set(plans.map(p=>p.id)).size!==14)throw Error('Expected 14 distinct projectors');
 for(const p of plans){
  if(!p.sku||!p.brand||!p.source||!p.keys?.length||p.keys.some(k=>!Object.hasOwn(p.patch.specifications,k)))throw Error('Incomplete verified content');
  if(Object.keys(p.patch).some(k=>!['name','description','specifications','image_path','image_paths'].includes(k)))throw Error('Commercial changes forbidden');
 }
 return `begin;
set local lock_timeout='5s';set local statement_timeout='45s';set local technoroom.import_write='false';
create temporary table projector_plan(payload jsonb) on commit drop;
alter table projector_plan enable row level security;
insert into projector_plan values(${literal(plans)});
do $repair$
declare item jsonb;before_row jsonb;after_row jsonb;expected jsonb;marks jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 perform id from public.products where id in(select (value->>'id')::bigint from projector_plan,jsonb_array_elements(payload)) order by id for update;
 for item in select value from projector_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into before_row from public.products p where id=(item->>'id')::bigint;
  if before_row is null or before_row->>'sku' is distinct from item->>'sku' or before_row->>'brand' is distinct from item->>'brand' then raise exception 'Projector identity changed';end if;
  expected:=(item->'before')||jsonb_build_object('name',item->'name')||(item->'patch');
  expected:=jsonb_set(expected,'{specifications}',coalesce(item->'before'->'specifications','{}')||(item->'patch'->'specifications'));
  marks:=(item->'before'->'manual_overrides')||jsonb_build_object('reviewed_specifications',item->'keys');
  if (item->>'protectDescription')::boolean then marks:=marks||'{"reviewed_description":true}'::jsonb;end if;
  expected:=jsonb_set(expected,'{manual_overrides}',marks);
  ${restore?`
  if exists(select 1 from jsonb_each(expected) e where before_row->e.key is distinct from e.value) then raise exception 'Projector changed since repair';end if;
  if not exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint) then raise exception 'Backup missing';end if;
  delete from technoroom_maintenance.reviewed_product_content where product_id=(item->>'id')::bigint and operation='${operation}';
  if not found then raise exception 'Review enrollment changed';end if;
  expected:=(item->'before')||jsonb_build_object('name',item->'name');
  `:`
  if before_row->>'name' is distinct from item->>'name' or exists(select 1 from jsonb_each(item->'before') e where before_row->e.key is distinct from e.value) then raise exception 'Projector changed after preview';end if;
  if exists(select 1 from technoroom_maintenance.reviewed_product_content where product_id=(item->>'id')::bigint) then raise exception 'Projector already reviewed';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',(item->>'id')::bigint,before_row,now());
  insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,specification_keys,operation) values((item->>'id')::bigint,item->>'sku',item->>'brand',item->>'source',(item->>'protectDescription')::boolean,array(select jsonb_array_elements_text(item->'keys')),'${operation}');
  `}
  update public.products set name=expected->>'name',description=expected->>'description',specifications=expected->'specifications',image_path=expected->>'image_path',image_paths=expected->'image_paths' where id=(item->>'id')::bigint;
  select to_jsonb(p) into after_row from public.products p where id=(item->>'id')::bigint;
  if exists(select 1 from jsonb_each(expected) e where after_row->e.key is distinct from e.value) or (after_row-array['name','description','specifications','image_path','image_paths','manual_overrides','updated_at']) is distinct from (before_row-array['name','description','specifications','image_path','image_paths','manual_overrides','updated_at']) then raise exception 'Unexpected projector side effect';end if;
 end loop;
end $repair$;
commit;
`;
}
