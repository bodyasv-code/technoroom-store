import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildImportChangePlan} from '../public/import-change-plan.js';
import {manualOverrideSummary} from '../public/product-manual-overrides.js';
import {reviewedPlans,reviewedSql,restoreUpsSql} from '../scripts/reviewed-content-pilot.mjs';
let PGlite;try{({PGlite}=await import('@electric-sql/pglite'));}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const databaseTest={skip:PGlite?false:'Install @electric-sql/pglite for PostgreSQL checks'};
const plans=JSON.parse(await readFile(new URL('../docs/reviewed-content-plan-2026-10-27.json',import.meta.url),'utf8'));
const previous=JSON.parse(await readFile(new URL('../docs/manufacturer-pilot-plan-2026-10-27.json',import.meta.url),'utf8'));
const migration=await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8');
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_admin() returns boolean language sql stable as $$select auth.uid() is not null$$;
 create table products(id bigint primary key,name text,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb default '{}',price numeric,stock_quantity int,image_path text);
 create schema technoroom_maintenance;create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
 for(const p of plans)await db.query('insert into products(id,name,sku,brand,description,specifications,manual_overrides,price,stock_quantity,image_path) values($1,$2,$3,$4,$5,$6,$7,100,4,$8)',[p.id,p.name,p.sku,p.brand,p.before.description,JSON.stringify(p.before.specifications),JSON.stringify(p.before.manual_overrides),'keep.jpg']);
 const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8');
 const end='for each row execute function public.track_product_manual_overrides();';
 await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');
 await db.exec(migration);await db.exec(migration);
 return db;
}
test('Reviewed import preserves the complete table, rejects alias resurrection, and still updates price/stock',()=>{
 const current={...plans[1],...plans[1].after,price:100,stock_quantity:4};
 const row={vendor:'2E',hasPrice:true,price:120,hasStock:true,stock:5,specifications:{'Активна потужність':'300 Вт','дозвіл':'bad','Нове поле':'unknown'}};
 const plan=buildImportChangePlan(row,current);
 assert.equal(plan.patch.specifications,undefined);assert.equal(plan.patch.price,120);assert.equal(plan.patch.stock_quantity,5);
 assert.equal(plan.conflicts.length,3);assert.match(manualOverrideSummary(current),/всю таблицю/);
 assert.equal(buildImportChangePlan({description:'supplier'}, {...current,description:'',manual_overrides:{description:true}}).patch.description,undefined);
 assert.throws(()=>reviewedPlans(plans.map(p=>({...p,...p.before,sku:'OTHER'})),previous),/changed|identity/);
});
test('Actual trigger protects imported content and permits commercial and manual edits',databaseTest,async()=>{
 const db=await fixture();try{
  await db.exec(reviewedSql(plans));
  await db.exec(await readFile(new URL('../supabase/verify-reviewed-content-pilot-20261027.sql',import.meta.url),'utf8'));
  assert.equal(Number((await db.query('select price from products where id=576')).rows[0].price),100);
  assert.equal((await db.query("select count(*)::int n from technoroom_maintenance.product_repair_backup where operation='reviewed-content-pilot-20261027'")).rows[0].n,3);
  await db.exec("set technoroom.import_write='true';update products set price=120,stock_quantity=5 where id=576");
  await assert.rejects(db.exec("update products set specifications=specifications||'{\"Alias\":\"bad\"}' where id=576"),/Reviewed specifications/);
  await assert.rejects(db.exec("update products set description='supplier error' where id=4331"),/Reviewed description/);
  const product=(await db.query('select * from products where id=576')).rows[0];
  assert.deepEqual(product.specifications,plans[1].after.specifications);assert.equal(Number(product.price),120);assert.equal(product.stock_quantity,5);assert.equal(product.image_path,'keep.jpg');
  await db.exec("set technoroom.import_write='false';set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';update products set specifications=specifications||'{\"Ручне поле\":\"Так\"}' where id=576");
  const manual=(await db.query('select * from products where id=576')).rows[0];assert.equal(manual.specifications['Ручне поле'],'Так');assert.equal(manual.manual_overrides.verified_specifications,true);assert.equal(manual.manual_overrides.specifications['Ручне поле'],true);
  await db.exec("set technoroom.import_write='true';update products set price=121 where id=576");
  assert.equal((await db.query('select specifications from products where id=576')).rows[0].specifications['Ручне поле'],'Так');
  await db.exec('set role authenticated');await assert.rejects(db.query('select * from technoroom_maintenance.reviewed_product_content'),/permission denied/);
 }finally{await db.close();}
});
test('Stale enrollment rolls back all cards, review records and backups',databaseTest,async()=>{
 const db=await fixture();try{
  await db.exec("update products set description='newer' where id=4331");
  await assert.rejects(db.exec(reviewedSql(plans)),/changed after preview/);await db.exec('rollback');
  for(const table of ['reviewed_product_content','product_repair_backup'])assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.'+table)).rows[0].n,0);
  assert.deepEqual((await db.query('select specifications from products where id=576')).rows[0].specifications,{});
 }finally{await db.close();}
});
test('UPS restore preserves new price and protection; refuses later content edits',databaseTest,async()=>{
 for(const stale of [false,true]){
  const db=await fixture();try{
   await db.exec(reviewedSql(plans));await db.exec('update products set price=150 where id=576');
   if(stale){await db.exec("update products set specifications=specifications||'{\"Ручне\":\"Нове\"}' where id=576");await assert.rejects(db.exec(restoreUpsSql(plans[1])),/changed since enrichment/);await db.exec('rollback');}
   else{await db.exec(restoreUpsSql(plans[1]));const row=(await db.query('select * from products where id=576')).rows[0];assert.deepEqual(row.specifications,{});assert.equal(Number(row.price),150);assert.equal(row.manual_overrides.verified_specifications,true);}
  }finally{await db.close();}
 }
});
