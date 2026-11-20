import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {projectionFinishSql} from '../scripts/projection-finish-maintenance.mjs';
import {isReviewedProjectorImageUrl} from '../server/reviewed-projector-image-sources.js';
import {isEliteScreenImageUrl} from '../server/elite-screen-image-source.js';
import {buildImportChangePlan} from '../public/import-change-plan.js';
const plans=JSON.parse(await readFile(new URL('../docs/projection-content-finish-plan-20261120.json',import.meta.url),'utf8'));
const unresolved=JSON.parse(await readFile(new URL('../docs/projection-content-unresolved-20261120.json',import.meta.url),'utf8'));
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`set timezone='UTC';create role anon;create role authenticated;create schema auth;create schema technoroom_maintenance;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function is_admin() returns boolean language sql as $$select false$$;
 create table products(id bigint primary key,name text,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb default '{}',image_path text,image_paths jsonb,price numeric default 100,stock_quantity int default 2,is_active boolean default false);
 create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
 const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8'),end='for each row execute function public.track_product_manual_overrides();';
 await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');await db.exec(await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8'));
 for(const p of plans){
  await db.query('insert into products(id,name,sku,brand,description,specifications,manual_overrides,image_path,image_paths) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p.id,p.name,p.sku,p.brand,p.before.description,p.before.specifications,p.before.manual_overrides,p.before.image_path,p.before.image_paths]);
  // Seed historical provenance after the INSERT trigger, as the production rows were imported earlier.
  await db.exec('alter table products disable trigger track_product_manual_overrides;alter table products disable trigger zz_guard_reviewed_product_content;');
  await db.query('update products set manual_overrides=$1 where id=$2',[p.before.manual_overrides,p.id]);
  await db.exec('alter table products enable trigger track_product_manual_overrides;alter table products enable trigger zz_guard_reviewed_product_content;');
  if(p.reviewBefore)await db.query('insert into technoroom_maintenance.reviewed_product_content select (jsonb_populate_record(null::technoroom_maintenance.reviewed_product_content,$1)).*',[p.reviewBefore]);
 }
 return db;
}
test('Exact gallery bindings, UPC-specific brightness and bounded source URLs',()=>{
 assert.deepEqual(plans.map(p=>p.id),[6141,6142,6162,6177]);
 assert.equal(plans.find(p=>p.id===6177).evidence.gtin,'766907904710');
 assert.equal(plans.find(p=>p.id===6177).patch.specifications.Яскравість,'3800 лм');
 assert.equal(plans.find(p=>p.id===6162).evidence.attributes.attribute_pa_size,'120-169');
 for(const p of plans)for(const image of p.patch.image_paths||[]){
  const allowed=url=>isReviewedProjectorImageUrl(url)||isEliteScreenImageUrl(url);
  assert.equal(allowed(new URL(image)),true);
  assert.equal(allowed(new URL(image+'?arbitrary=1')),false);
  assert.equal(allowed(new URL(image.replace('https:','http:'))),false);
 }
 const commercial=structuredClone(plans);commercial[0].patch.price=1;assert.throws(()=>projectionFinishSql(commercial),/content-only/);
 assert.equal(unresolved[0].status,'source-conflict');
});
test('Four-card SQL applies atomically; protects brightness; recovery preserves later commercial edits and earlier reviews',async()=>{
 const db=await fixture();try{
  assert.equal(await readFile(new URL('../supabase/projection-content-finish-20261120.sql',import.meta.url),'utf8'),projectionFinishSql(plans));
  assert.equal(await readFile(new URL('../supabase/restore-projection-content-finish-20261120.sql',import.meta.url),'utf8'),projectionFinishSql(plans,{restore:true}));
  await db.exec(projectionFinishSql(plans));
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.reviewed_product_content')).rows[0].n,4);
  const p=(await db.query('select * from products where id=6177')).rows[0];
  const preview=buildImportChangePlan({vendor:'ViewSonic',specifications:{Яскравість:'4000 лм'},hasPrice:true,price:150},p);
  assert.equal((preview.patch.specifications||p.specifications).Яскравість,'3800 лм');assert.equal(preview.patch.price,150);
  for(const row of(await db.query('select * from products')).rows){const plan=plans.find(p=>p.id===row.id);assert.deepEqual(row.specifications,plan.patch.specifications||plan.before.specifications);assert.deepEqual(row.image_paths,plan.patch.image_paths||plan.before.image_paths);assert.equal(row.is_active,false);}
  await db.exec("set technoroom.import_write='true';update products set price=150,stock_quantity=7;");
  await assert.rejects(db.exec(`update products set specifications=specifications||'{"Яскравість":"4000 лм"}' where id=6177`),/Reviewed/);
  await db.exec(projectionFinishSql(plans,{restore:true}));
  for(const row of(await db.query('select * from products')).rows){const plan=plans.find(p=>p.id===row.id);for(const key of Object.keys(plan.before))assert.deepEqual(row[key],plan.before[key]);assert.equal(Number(row.price),150);assert.equal(row.stock_quantity,7);}
  const reviews=(await db.query('select to_jsonb(r) as data from technoroom_maintenance.reviewed_product_content r order by product_id')).rows.map(r=>r.data);
  assert.deepEqual(reviews,plans.map(p=>p.reviewBefore).filter(Boolean));
 }finally{await db.close();}
});
test('Stale last card cancels all photos and backups; recovery rejects later photo edits',async()=>{
 const db=await fixture();try{
  await db.exec("update products set description='later edit' where id=6177");
  await assert.rejects(db.exec(projectionFinishSql(plans)),/changed after preview/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,0);
  assert.equal((await db.query('select image_path from products where id=6141')).rows[0].image_path,null);
  await db.query('update products set description=$1 where id=6177',[plans.find(p=>p.id===6177).before.description]);
  await db.exec(projectionFinishSql(plans));await db.exec("update products set image_path='later photo' where id=6141");
  await assert.rejects(db.exec(projectionFinishSql(plans,{restore:true})),/changed since repair/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.reviewed_product_content')).rows[0].n,4);
 }finally{await db.close();}
});
