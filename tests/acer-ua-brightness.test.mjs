import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {acerBrightnessSql,source} from '../scripts/acer-ua-brightness-20261120.mjs';
const plan=JSON.parse(await readFile(new URL('../docs/acer-ua-brightness-plan-20261120.json',import.meta.url),'utf8'));
test('Ukrainian exact-part source adds only brightness, protects it, and restores without losing later stock or price',async()=>{
 const db=await PGlite.create();try{
  assert.equal(plan.source,source);assert.equal(plan.afterSpecifications.Яскравість,'4000 ANSI лм');
  const bad=structuredClone(plan);bad.afterSpecifications.Гарантія='bad';assert.throws(()=>acerBrightnessSql(bad),/Only brightness/);
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema technoroom_maintenance;
   create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function is_admin() returns boolean language sql as $$select false$$;
   create table products(id bigint primary key,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb,price numeric,stock_quantity int,is_active boolean);
   create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
  await db.query('insert into products(id,sku,brand,description,specifications,manual_overrides,price,stock_quantity,is_active) values(6176,$1,$2,$3,$4,$5,100,0,false)',[plan.sku,plan.brand,'Existing description',plan.beforeSpecifications,plan.beforeManualOverrides]);
  const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8'),end='for each row execute function public.track_product_manual_overrides();';await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');
  await db.exec(await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8'));
  assert.equal(await readFile(new URL('../supabase/acer-ua-brightness-20261120.sql',import.meta.url),'utf8'),acerBrightnessSql(plan));
  assert.equal(await readFile(new URL('../supabase/restore-acer-ua-brightness-20261120.sql',import.meta.url),'utf8'),acerBrightnessSql(plan,{restore:true}));
  await db.exec(acerBrightnessSql(plan));
  const applied=(await db.query('select * from products')).rows[0];assert.deepEqual(applied.specifications,plan.afterSpecifications);assert.equal(applied.description,'Existing description');assert.equal(applied.is_active,false);
  assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,1);
  await db.exec("set technoroom.import_write='true';update products set price=150,stock_quantity=3;");
  await assert.rejects(db.exec(`update products set specifications=specifications||'{"Яскравість":"3600 лм"}'`),/Reviewed/);
  await db.exec(acerBrightnessSql(plan,{restore:true}));const restored=(await db.query('select * from products')).rows[0];
  assert.deepEqual(restored.specifications,plan.beforeSpecifications);assert.deepEqual(restored.manual_overrides,plan.beforeManualOverrides);assert.equal(Number(restored.price),150);assert.equal(restored.stock_quantity,3);
 }finally{await db.close();}
});
