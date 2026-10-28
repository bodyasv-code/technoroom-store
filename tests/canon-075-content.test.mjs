import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cartridgePlans,applyCartridgesSql,restoreCartridgesSql,cartridges} from '../scripts/canon-075-content.mjs';
import {reviewedSql} from '../scripts/reviewed-content-pilot.mjs';
import {buildImportChangePlan} from '../public/import-change-plan.js';
import {makePlans as nextPlans,applySql as nextApply,restoreSql as nextRestore} from '../scripts/canon-075-magenta-yellow.mjs';
let PGlite;try{({PGlite}=await import('@electric-sql/pglite'));}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const databaseTest={skip:PGlite?false:'Install @electric-sql/pglite for SQL checks'};
const plans=JSON.parse(await readFile(new URL('../docs/canon-075-content-plan-2026-10-27.json',import.meta.url),'utf8'));
const remaining=JSON.parse(await readFile(new URL('../docs/canon-075-magenta-yellow-plan-2026-10-28.json',import.meta.url),'utf8'));
async function fixture(rows=plans){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create function public.is_admin() returns boolean language sql stable as $$select false$$;
 create table products(id bigint primary key,name text,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb default '{}',price numeric,stock_quantity int,image_path text,is_active boolean);
 create schema technoroom_maintenance;create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
 for(const p of rows)await db.query('insert into products values($1,$2,$3,$4,null,$5,$6,$7,$8,123.45,7,$9,true)',[p.id,p.name,p.sku,p.brand,'office-consumables-cartridges',p.before.description,JSON.stringify(p.before.specifications),JSON.stringify(p.before.manual_overrides),'products/keep.jpg']);
 const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8'),end='for each row execute function public.track_product_manual_overrides();';
 await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');
 await db.exec(await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8'));
 return db;
}
test('Each exact Canon SKU has its own yield/color, immutable existing description and fixed compatibility',()=>{
 const rows=plans.map(p=>({...p,...p.before,category:'office-consumables-cartridges'}));
 assert.deepEqual(cartridgePlans(rows),plans);
 assert.deepEqual(plans.map(p=>p.after.specifications['Ресурс друку']),['До 1400 сторінок','До 1300 сторінок','До 3500 сторінок','До 2500 сторінок']);
 for(const p of plans){assert.equal(p.before.description,p.after.description);assert.match(p.after.specifications['Сумісні пристрої'],/MF664Cdw; MF667Cdw; LBP646Cdw; LBP647Cdw/);assert.ok(!JSON.stringify(p.after.specifications).includes('5%'));const preview=buildImportChangePlan({specifications:{'Колір друку':'помилка',Дублікат:'помилка'}},{...p,...p.after});assert.equal(preview.patch.specifications,undefined);}
 assert.deepEqual(cartridges.map(c=>c.sku),plans.map(p=>p.sku));
 assert.throws(()=>cartridgePlans(rows.map((p,i)=>i? p:{...p,sku:'6369C002'})),/identity/);
 assert.throws(()=>cartridgePlans(rows.map((p,i)=>i? p:{...p,manual_overrides:{specifications:{Deleted:true}}})),/unprotected/);
 assert.throws(()=>reviewedSql([plans[0],plans[0]],{operationId:'unsafe',expectedIds:[4903,4904]}),/unique scope/);
 assert.throws(()=>reviewedSql(plans,{operationId:"a';bad",expectedIds:plans.map(p=>p.id)}),/unique scope/);
});
test('Actual four-card SQL backs up, protects from import and restores content while preserving later prices',databaseTest,async()=>{
 const db=await fixture();try{
  const before=(await db.query('select * from products order by id')).rows;
  await db.exec(applyCartridgesSql(plans));
  await db.exec(await readFile(new URL('../supabase/verify-canon-075-content-20261027.sql',import.meta.url),'utf8'));
  assert.equal((await db.query("select count(*)::int n from technoroom_maintenance.product_repair_backup where operation='canon-075-content-20261027'")).rows[0].n,4);
  const after=(await db.query('select * from products order by id')).rows;
  for(let i=0;i<4;i++){assert.deepEqual(after[i].specifications,plans[i].after.specifications);assert.deepEqual(after[i].manual_overrides,plans[i].after.manual_overrides);for(const key of ['name','sku','brand','description','price','stock_quantity','image_path','is_active'])assert.deepEqual(after[i][key],before[i][key]);}
  await assert.rejects(db.exec(applyCartridgesSql(plans)),/changed after preview|Already backed/);await db.exec('rollback');
  await db.exec("set technoroom.import_write='true';update products set price=150 where id=4903");
  await assert.rejects(db.exec("update products set specifications=specifications||'{\"resource\":\"wrong\"}' where id=4903"),/Reviewed specifications protected/);
  await db.exec('set technoroom.import_write=\'false\'');await db.exec(restoreCartridgesSql(plans));
  const restored=(await db.query('select * from products order by id')).rows;for(const p of restored){assert.deepEqual(p.specifications,{});assert.equal(p.manual_overrides.verified_specifications,true);}assert.equal(Number(restored[0].price),150);
 }finally{await db.close();}
});
test('Stale last card and unexpected trigger side effects roll back the entire batch and backups',databaseTest,async()=>{
 for(const kind of ['stale','trigger']){
  const db=await fixture();try{
   if(kind==='stale')await db.exec("update products set description='newer' where id=4906");
   else await db.exec('create function wrong_price() returns trigger language plpgsql as $$begin new.price=999;return new;end$$;create trigger wrong_price before update on products for each row execute function wrong_price()');
   await assert.rejects(db.exec(applyCartridgesSql(plans)),kind==='stale'?/changed after preview/:/Unexpected side effect/);await db.exec('rollback');
   for(const table of ['product_repair_backup','reviewed_product_content'])assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.'+table)).rows[0].n,0);
   assert.ok((await db.query('select specifications from products')).rows.every(p=>Object.keys(p.specifications).length===0));
  }finally{await db.close();}
 }
});
test('Restore refuses later edits and rolls back restoration of earlier cards',databaseTest,async()=>{
 const db=await fixture();try{
  await db.exec(applyCartridgesSql(plans));await db.exec("update products set specifications=specifications||'{\"Ручне\":\"Нове\"}' where id=4906");
  await assert.rejects(db.exec(restoreCartridgesSql(plans)),/changed since enrichment/);await db.exec('rollback');
  assert.deepEqual((await db.query('select specifications from products where id=4903')).rows[0].specifications,plans[0].after.specifications);
 }finally{await db.close();}
});
test('Remaining colors use individual exact SKUs, yields and the established compatibility list',()=>{
 const rows=remaining.map(p=>({...p,...p.before,category:'office-consumables-cartridges'}));
 assert.deepEqual(nextPlans(rows),remaining);
 assert.match(nextApply(remaining),/alter table reviewed_plan enable row level security;/);
 assert.match(nextRestore(remaining),/alter table cartridge_restore_plan enable row level security;/);
 assert.deepEqual(remaining.map(p=>p.after.specifications['Ресурс друку']),['До 2500 сторінок','До 2500 сторінок','До 1300 сторінок','До 1300 сторінок']);
 assert.deepEqual(remaining.map(p=>p.after.specifications['Колір друку']),['Пурпуровий (Magenta)','Жовтий','Пурпуровий (Magenta)','Жовтий']);
 assert.throws(()=>nextPlans([...rows.slice(0,3),{...plans[0],...plans[0].before,category:'office-consumables-cartridges'}]),/identity/);
 for(const p of remaining){assert.equal(p.after.description,p.before.description);assert.equal(Object.keys(p.after.specifications).length,7);assert.equal(p.after.specifications['Сумісні пристрої'],plans[0].after.specifications['Сумісні пристрої']);}
});
test('Shared generator preserves the historical executed apply and restore SQL byte content',async()=>{
 assert.equal(applyCartridgesSql(plans).trim(),(await readFile(new URL('../supabase/apply-canon-075-content-20261027.sql',import.meta.url),'utf8')).trim());
 assert.equal(restoreCartridgesSql(plans).trim(),(await readFile(new URL('../supabase/restore-canon-075-content-20261027.sql',import.meta.url),'utf8')).trim());
});
test('Remaining-color SQL and recovery touch only the new four rows; later manual edits abort recovery',databaseTest,async()=>{
 const db=await fixture([...plans,...remaining]);try{
  const old=async()=>(await db.query('select * from products where id between 4903 and 4906 order by id')).rows;
  const unchanged=await old();
  await db.exec(nextApply(remaining));
  await db.exec(await readFile(new URL('../supabase/verify-canon-075-magenta-yellow-20261028.sql',import.meta.url),'utf8'));
  assert.deepEqual(await old(),unchanged);
  for(const p of remaining){const row=(await db.query('select * from products where id=$1',[p.id])).rows[0];assert.deepEqual(row.specifications,p.after.specifications);assert.equal(row.description,p.before.description);assert.equal(Number(row.price),123.45);assert.equal(row.stock_quantity,7);assert.equal(row.image_path,'products/keep.jpg');}
  await db.exec("update products set specifications=specifications||'{\"Ручне\":\"Нове\"}' where id=4910");
  await assert.rejects(db.exec(nextRestore(remaining)),/changed since enrichment/);await db.exec('rollback');
  assert.deepEqual((await db.query('select specifications from products where id=4907')).rows[0].specifications,remaining[0].after.specifications);
  await db.query('update products set specifications=$1 where id=4910',[JSON.stringify(remaining[3].after.specifications)]);
  await db.exec('update products set price=155 where id=4907');
  await db.exec(nextRestore(remaining));
  for(const p of remaining)assert.deepEqual((await db.query('select specifications from products where id=$1',[p.id])).rows[0].specifications,{});
  assert.equal(Number((await db.query('select price from products where id=4907')).rows[0].price),155);assert.deepEqual(await old(),unchanged);
 }finally{await db.close();}
});
