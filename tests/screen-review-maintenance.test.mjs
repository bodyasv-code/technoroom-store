import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {screenReviewSql} from '../scripts/screen-review-maintenance.mjs';
const plans=JSON.parse(await readFile(new URL('../docs/mti-screen-protection-plan-20261116.json',import.meta.url),'utf8'));
async function fixture(){
  const db=await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema technoroom_maintenance;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function is_admin() returns boolean language sql as $$select false$$;
    create table products(id bigint primary key,name text,sku text,brand text,brand_id bigint,category text,description text,specifications jsonb,manual_overrides jsonb default '{}',image_path text,image_paths jsonb,price numeric default 100,stock_quantity int default 2,is_active boolean default false);
    create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
  for(const p of plans)await db.query('insert into products(id,name,sku,brand,description,specifications,manual_overrides,image_path,image_paths) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[p.id,p.name,p.sku,p.brand,p.before.description,p.before.specifications,p.before.manual_overrides,p.before.image_path,p.before.image_paths]);
  const manual=await readFile(new URL('../supabase/product-manual-overrides-upgrade.sql',import.meta.url),'utf8'),end='for each row execute function public.track_product_manual_overrides();';
  await db.exec(manual.slice(0,manual.indexOf(end)+end.length)+'\ncommit;');
  await db.exec(await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8'));return db;
}
test('Actual thirteen-screen batch protects 45 fields, changes only two galleries and can restore without changing later stock/prices',async()=>{
  const db=await fixture();try{
    assert.equal(plans.reduce((n,p)=>n+p.keys.length,0),45);
    assert.equal(await readFile(new URL('../supabase/mti-screen-protection-20261116.sql',import.meta.url),'utf8'),screenReviewSql(plans));
    assert.equal(await readFile(new URL('../supabase/restore-mti-screen-protection-20261116.sql',import.meta.url),'utf8'),screenReviewSql(plans,{restore:true}));
    await db.exec(screenReviewSql(plans));
    const rows=(await db.query('select * from products order by id')).rows;
    assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,13);
    for(const row of rows){const p=plans.find(p=>p.id===row.id);assert.deepEqual(row.specifications,p.before.specifications);assert.equal(row.description,p.before.description);assert.deepEqual(row.image_paths,p.images||p.before.image_paths);assert.deepEqual(row.manual_overrides.reviewed_specifications,p.keys);assert.equal(row.is_active,false);}
    await db.exec("set technoroom.import_write='true';update products set price=150,stock_quantity=5;");
    await assert.rejects(db.exec(`update products set specifications=specifications||'{"Діагональ":"bad"}' where id=1177`),/Reviewed/);
    await db.exec(screenReviewSql(plans,{restore:true}));
    for(const row of (await db.query('select * from products')).rows){const p=plans.find(p=>p.id===row.id);assert.equal(Number(row.price),150);assert.equal(row.stock_quantity,5);assert.deepEqual(row.manual_overrides,p.before.manual_overrides);assert.equal(row.image_path,p.before.image_path);assert.deepEqual(row.image_paths,p.before.image_paths);}
  }finally{await db.close();}
});
test('A stale last card rolls back earlier galleries, enrollments and backups',async()=>{
  const db=await fixture();try{
    await db.exec("update products set description='new manual description' where id=6171");
    await assert.rejects(db.exec(screenReviewSql(plans)),/changed after preview/);await db.exec('rollback');
    for(const table of ['reviewed_product_content','product_repair_backup'])assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.'+table)).rows[0].n,0);
    assert.equal((await db.query('select image_path from products where id=6162')).rows[0].image_path,null);
  }finally{await db.close();}
});
