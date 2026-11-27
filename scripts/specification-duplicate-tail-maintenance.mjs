const json=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export function specificationRepairSql(plans,{operation='spec-duplicate-tails-20261127',restore=false}={}) {
  if(!/^[a-z0-9-]+$/.test(operation)||!plans.length||plans.length>1500||new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('Invalid repair scope');
  for(const p of plans){
    if(!Number.isSafeInteger(p.id)||p.id<1||!p.sku||!p.name||!p.category||!p.before||!p.after)throw Error('Missing identity or snapshot');
    for(const row of [p.before,p.after])if(Object.keys(row).some(k=>!['specifications','manual_overrides'].includes(k))||!row.specifications||Array.isArray(row.specifications)||!Object.hasOwn(row,'manual_overrides'))throw Error('Only specifications and their protection marks may change');
    if(JSON.stringify(p.before)===JSON.stringify(p.after))throw Error('Unchanged repair');
  }
  return `begin;
set local lock_timeout='5s';set local statement_timeout='60s';set local technoroom.import_write='true';
create temporary table spec_tail_plan(payload jsonb) on commit drop;
alter table spec_tail_plan enable row level security;
insert into spec_tail_plan values(${json(plans)});
do $repair$
declare item jsonb;original jsonb;expected jsonb;actual jsonb;restored jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 perform id from public.products where id in(select (value->>'id')::bigint from spec_tail_plan,jsonb_array_elements(payload)) order by id for update;
 for item in select value from spec_tail_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into original from public.products p where p.id=(item->>'id')::bigint;
  if original is null or original->>'sku' is distinct from item->>'sku' or original->>'name' is distinct from item->>'name' or original->>'brand' is distinct from item->>'brand' or original->>'category' is distinct from item->>'category' or original->'is_active'<>'true'::jsonb then raise exception 'Product identity changed';end if;
  if exists(select 1 from jsonb_each(item->'${restore?'after':'before'}') e where original->e.key is distinct from e.value) then raise exception 'Snapshot changed';end if;
  ${restore?`select before_row into restored from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint;
  if restored is null or exists(select 1 from jsonb_each(item->'before') e where restored->e.key is distinct from e.value) then raise exception 'Backup missing or changed';end if;
  expected:=original||jsonb_build_object('specifications',restored->'specifications','manual_overrides',restored->'manual_overrides');`:`if exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint) then raise exception 'Operation already backed up';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',(item->>'id')::bigint,original,now());
  expected:=original||(item->'after');`}
  update public.products set specifications=expected->'specifications',manual_overrides=expected->'manual_overrides' where id=(item->>'id')::bigint;
  select to_jsonb(p) into actual from public.products p where p.id=(item->>'id')::bigint;
  if (actual-'updated_at') is distinct from (expected-'updated_at') then raise exception 'Unexpected fields changed';end if;
 end loop;
end $repair$;
select '${operation}' operation,${plans.length} expected_products,
 (select count(*) from technoroom_maintenance.product_repair_backup where operation='${operation}') backed_up_products,
 (select count(*) from public.products p join spec_tail_plan x on true join lateral jsonb_array_elements(x.payload) item on p.id=(item->>'id')::bigint where p.specifications=item->'${restore?'before':'after'}'->'specifications' and p.manual_overrides=item->'${restore?'before':'after'}'->'manual_overrides') verified_products;
commit;
`;
}
