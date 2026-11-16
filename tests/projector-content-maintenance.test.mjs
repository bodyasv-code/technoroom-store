import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {projectorContentSql} from '../scripts/projector-content-maintenance.mjs';
import {isReviewedProjectorImageUrl} from '../server/reviewed-projector-image-sources.js';
import {buildImportChangePlan} from '../public/import-change-plan.js';
const plans=JSON.parse(await readFile(new URL('../docs/mti-projector-content-plan-20261116.json',import.meta.url),'utf8'));
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema technoroom_maintenance;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function is_admin() returns boolean language sql as $$select false$$;
 create table products(id bigint primary key,name text,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb default '{}',image_path text,image_paths jsonb,price numeric default 100,stock_quantity int default 2,is_active boolean default false);
 create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
 for(const p of plans)await db.query('insert into products(id,name,sku,brand,description,specifications,manual_overrides,image_path,image_paths) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p.id,p.name,p.sku,p.brand,p.before.description,p.before.specifications,p.before.manual_overrides,p.before.image_path,p.before.image_paths]);
 const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8'),end='for each row execute function public.track_product_manual_overrides();';
 await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');await db.exec(await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8'));return db;
}
test('Manifest has exact identities, unit-bearing brightness and only reviewed manufacturer photo URLs',()=>{
 assert.equal(plans.length,14);assert.equal(plans.reduce((n,p)=>n+p.keys.length,0),36);assert.equal(plans.filter(p=>p.protectDescription).length,13);assert.equal(plans.filter(p=>p.patch.image_path).length,11);
 for(const p of plans){
  if(p.patch.specifications.Яскравість)assert.match(p.patch.specifications.Яскравість,/\d+ (?:ANSI|ISO) лм/u);
  if(!p.patch.image_path)continue;
  assert.equal(isReviewedProjectorImageUrl(new URL(p.patch.image_path)),true);
  assert.equal(isReviewedProjectorImageUrl(new URL(p.patch.image_path+'&arbitrary=1')),false);
  assert.equal(isReviewedProjectorImageUrl(new URL(p.patch.image_path.replace('https:','http:'))),false);
 }
 assert.equal(plans.find(p=>p.id===238).patch.specifications['Роздільна здатність'],'1920 × 1080');
 assert.equal(plans.find(p=>p.id===238).patch.specifications['Покращення роздільної здатності'],'4K Enhancement');
 assert.equal(plans.find(p=>p.id===6137).patch.specifications['Співвідношення сторін'],'4:3');
 assert.equal(plans.find(p=>p.id===6168).patch.description,undefined);
});
test('Actual 14-card SQL backs up, applies and protects content; restore retains later commercial changes',async()=>{
 const db=await fixture();try{
  assert.equal(await readFile(new URL('../supabase/mti-projector-content-20261116.sql',import.meta.url),'utf8'),projectorContentSql(plans));
  assert.equal(await readFile(new URL('../supabase/restore-mti-projector-content-20261116.sql',import.meta.url),'utf8'),projectorContentSql(plans,{restore:true}));
  await db.exec(projectorContentSql(plans));
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,14);
  for(const row of (await db.query('select * from products')).rows){const p=plans.find(p=>p.id===row.id);assert.deepEqual(row.specifications,{...p.before.specifications,...p.patch.specifications});assert.equal(row.description,p.patch.description??p.before.description);assert.equal(row.image_path,p.patch.image_path??p.before.image_path);assert.equal(row.is_active,false);}
  const epson=(await db.query('select * from products where id=238')).rows[0];const preview=buildImportChangePlan({vendor:'Epson',specifications:{'Роздільна здатність':'4K UHD'},hasPrice:true,price:123},epson);assert.equal((preview.patch.specifications||epson.specifications)['Роздільна здатність'],'1920 × 1080');assert.equal((preview.patch.specifications||epson.specifications)['Покращення роздільної здатності'],'4K Enhancement');assert.equal(preview.patch.price,123);
  await db.exec("set technoroom.import_write='true';update products set price=150,stock_quantity=5;");
  await assert.rejects(db.exec(`update products set specifications=specifications||'{"Роздільна здатність":"bad"}' where id=238`),/Reviewed/);
  await db.exec(projectorContentSql(plans,{restore:true}));
  for(const row of (await db.query('select * from products')).rows){const p=plans.find(p=>p.id===row.id);assert.equal(Number(row.price),150);assert.equal(row.stock_quantity,5);assert.equal(row.name,p.name);assert.equal(row.description,p.before.description);assert.deepEqual(row.specifications,p.before.specifications);assert.deepEqual(row.manual_overrides,p.before.manual_overrides);assert.equal(row.image_path,p.before.image_path);}
 }finally{await db.close();}
});
test('Stale final card cancels all preceding content, photo, backup and protection writes',async()=>{
 const db=await fixture();try{
  await db.exec("update products set description='new' where id=6173");await assert.rejects(db.exec(projectorContentSql(plans)),/changed after preview/);await db.exec('rollback');
  for(const table of ['reviewed_product_content','product_repair_backup'])assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.'+table)).rows[0].n,0);
  assert.equal((await db.query('select image_path from products where id=6136')).rows[0].image_path,null);
 }finally{await db.close();}
});
