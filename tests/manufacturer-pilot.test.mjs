import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// PostgreSQL integration checks use the optional local database-test runtime.
// Keep pure plan checks usable in a storefront-only dependency installation.
let PGlite;
try { ({PGlite}=await import('@electric-sql/pglite')); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const databaseTest={skip:PGlite?false:'Install @electric-sql/pglite to run PostgreSQL integration checks'};
import {planManufacturerPilot,manufacturerSql,operation} from '../scripts/manufacturer-pilot.mjs';
const plans=JSON.parse(await readFile(new URL('../docs/manufacturer-pilot-plan-2026-10-27.json',import.meta.url),'utf8'));
async function fixture(){
 const db=await PGlite.create();
 await db.exec('create table products(id bigint primary key,sku text,brand text,name text,description text,specifications jsonb,manual_overrides jsonb,price numeric,stock_quantity int,image_path text);create schema technoroom_maintenance;create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;');
 for(const p of plans)await db.query('insert into products values($1,$2,$3,$4,$5,$6,$7,123.45,7,$8)',[p.id,p.sku,p.brand,p.name,p.before.description,JSON.stringify(p.before.specifications),JSON.stringify(p.before.manual_overrides),'products/keep.jpg']);
 return db;
}
test('Exact manufacturer pilot preserves manual fields and separates meanings',()=>{
 for(const p of plans){assert.deepEqual(planManufacturerPilot({id:p.id,sku:p.sku,brand:p.brand,name:p.name,...p.before}).after,p.after);}
 const c=plans.find(p=>p.id===4331),e=plans.find(p=>p.id===247);
 assert.equal(c.after.specifications['макс. кількість копій'],'999');assert.equal(c.after.specifications['Пам’ять факсу'],'До 512 сторінок');assert.notEqual(c.after.specifications['Роздільна здатність друку'],c.after.specifications['Роздільна здатність копіювання']);
 assert.equal(e.before.description,e.after.description);assert.ok(!e.after.specifications['Джерело світла (тип, термін роботи)']);
 assert.throws(()=>planManufacturerPilot({id:1,sku:'X',brand:'Canon'}),/identity/);
 assert.throws(()=>planManufacturerPilot({id:247,sku:e.sku,brand:e.brand,...e.before,manual_overrides:{specifications:{'Габарити (мм)':true}}}),/Manual/);
});
test('Real SQL: exact backups, commercial/photo preservation, duplicate guard and reversible repair',databaseTest,async()=>{
 const db=await fixture();try{
  const before=(await db.query('select * from products order by id')).rows;
  await db.exec(manufacturerSql(plans));
  const after=(await db.query('select * from products order by id')).rows;
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup where operation=$1',[operation])).rows[0].n,2);
  for(let i=0;i<2;i++){assert.deepEqual(after[i].specifications,plans[i].after.specifications);for(const key of ['price','stock_quantity','image_path','manual_overrides'])assert.deepEqual(after[i][key],before[i][key]);}
  await assert.rejects(()=>db.exec(manufacturerSql(plans)),/Backups already/);await db.exec('rollback');
  await db.exec(manufacturerSql(plans,{rollback:true}));assert.deepEqual((await db.query('select * from products order by id')).rows,before);
 }finally{await db.close();}
});
test('Stale snapshot and side-effecting triggers roll back both cards and backups',databaseTest,async()=>{
 for(const kind of ['stale','trigger']){
  const db=await fixture();try{
   if(kind==='stale')await db.exec("update products set description='New manual description' where id=4331");
   else await db.exec('create function bad() returns trigger language plpgsql as $$begin new.price=999;return new;end$$;create trigger bad before update on products for each row execute function bad()');
   await assert.rejects(()=>db.exec(manufacturerSql(plans)),kind==='stale'?/Precondition changed/:/side effect/);await db.exec('rollback');
   assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,0);
   assert.equal((await db.query('select specifications from products where id=247')).rows[0].specifications['Енергоспоживання (Вт)'],plans[0].before.specifications['Енергоспоживання (Вт)']);
  }finally{await db.close();}
 }
});
test('Rollback refuses newer manual specifications',databaseTest,async()=>{
 const db=await fixture();try{await db.exec(manufacturerSql(plans));await db.exec("update products set specifications=specifications||'{\"Manual\":\"New\"}' where id=4331");await assert.rejects(()=>db.exec(manufacturerSql(plans,{rollback:true})),/changed after repair/);await db.exec('rollback');assert.equal((await db.query('select specifications from products where id=4331')).rows[0].specifications.Manual,'New');}finally{await db.close();}
});
