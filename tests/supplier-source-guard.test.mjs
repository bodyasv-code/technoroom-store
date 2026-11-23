import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const admin='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const hash=n=>String(n).repeat(64),source=(supplier,n,date)=>({supplier,hash:hash(n),observedAt:date,name:'price.xlsx'});
let seq=0;const uuid=()=>`aaaaaaaa-aaaa-4aaa-aaaa-${String(++seq).padStart(12,'0')}`;
const sql=await readFile(new URL('../supabase/supplier-source-guard-upgrade.sql',import.meta.url),'utf8');
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${admin}'),('${other}');
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_admin()returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;grant usage on schema auth to authenticated;
 create table products(id bigint generated always as identity primary key,name text,slug text unique,sku text unique,brand_id bigint,brand text,category text,price numeric,stock_quantity integer,in_stock boolean,availability_status text,description text,specifications jsonb,is_active boolean,image_path text,image_paths jsonb,parent_product_id bigint);
 insert into products(name,slug,sku,brand,category,price,stock_quantity,in_stock,description,specifications,is_active)values('Manual','manual','EXIST','Epson','projectors',999,0,false,'Ручний опис','{}',true);
 grant select on products to authenticated;`);
 for(const file of ['import-history-upgrade.sql','product-manual-overrides-upgrade.sql','product-suppliers-upgrade.sql','supplier-offers-upgrade.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.exec((await readFile(new URL('../supabase/supplier-inventory-upgrade.sql',import.meta.url),'utf8')).split('-- Run in Supabase SQL Editor')[0]);
 await db.exec(await readFile(new URL('../supabase/mti-verified-identities-upgrade.sql',import.meta.url),'utf8'));
 await db.exec(sql);await db.exec(sql);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}'`);
 return db;
}
const offer=(sku,meta,id=null)=>({supplierSku:sku,supplierId:'source-'+sku,manufacturerSku:sku,brand:'Epson',category:'projectors',expectedProductId:id,retailPrice:12000,supplierPrice:10000,currency:'UAH',priceBasis:'rrp',quantity:2,stockKind:'exact',reserved:0,reviewRequired:false,sourceRow:5,source:meta,draft:id?null:{name:'Новий проєктор',description:null,specifications:{}},contentEvidence:{status:'content-unavailable'}});
const call=async(db,name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;
const mti=(db,rows)=>call(db,'apply_mti_offer_batch',[uuid(),'price.xlsx',JSON.stringify(rows)]);

test('MTI source dates, exact duplicate files, reloaded drafts, newer portal checks, RLS and atomic stale rejection',async()=>{
 const db=await fixture();try{
  const first=source('MTI',1,'2020-01-01T00:00:00Z'),newer=source('MTI',2,'2021-01-01T00:00:00Z');
  const result=await mti(db,[offer('EXIST',first,1),offer('NEW',first)]);
  assert.equal(result.written,2);assert.equal(result.createdDrafts,1);assert.equal(result.unchanged,0);
  const created=(await db.query("select * from products where sku='NEW'")).rows[0];assert.equal(created.stock_quantity,0);assert.equal(created.is_active,false);
  assert.equal(Number((await db.query('select price from products where id=1')).rows[0].price),999);
  const duplicate=await mti(db,[offer('EXIST',first,1),offer('NEW',first,created.id)]);
  assert.equal(duplicate.offers,2);assert.equal(duplicate.written,0);assert.equal(duplicate.unchanged,2);
  assert.equal((await db.query('select count(*)::int n from supplier_offer_changes')).rows[0].n,2);
  const firstStamp=(await db.query("select observed_at from supplier_offers where supplier_sku='NEW'")).rows[0].observed_at;
  assert.equal(new Date(firstStamp).toISOString(),'2020-01-01T00:00:00.000Z');
  await mti(db,[{...offer('NEW',newer,created.id),quantity:5}]);
  assert.equal((await mti(db,[offer('NEW',first,created.id)])).unchanged,1);
  assert.equal((await db.query("select stock_quantity from supplier_offers where supplier_sku='NEW'")).rows[0].stock_quantity,5);
  await assert.rejects(mti(db,[offer('NEW',source('MTI',3,'2020-06-01T00:00:00Z'),created.id)]),/Старіший прайс/);
  await assert.rejects(mti(db,[offer('NEW',{...first,observedAt:'2022-01-01T00:00:00Z'},created.id)]),/іншу дату/);
  await assert.rejects(mti(db,[{...offer('NEW',newer,created.id),quantity:77}]),/раніше обробленого/);
  await assert.rejects(mti(db,[offer('ROLLBACK',source('MTI',4,'2020-06-01T00:00:00Z')),offer('NEW',source('MTI',4,'2020-06-01T00:00:00Z'),created.id)]),/Старіший прайс/);
  assert.equal((await db.query("select count(*)::int n from products where sku='ROLLBACK'")).rows[0].n,0);
  await db.exec("reset role;update supplier_offers set observed_at='2022-01-01T00:00:00Z' where supplier_sku='NEW';set role authenticated;");
  await assert.rejects(mti(db,[offer('NEW',source('MTI',5,'2021-06-01T00:00:00Z'),created.id)]),/пізніший запис/);
  await assert.rejects(mti(db,[offer('MISSING',null)]),/дату джерела/);
  await db.exec(`set request.jwt.claim.sub='${other}'`);assert.equal((await db.query('select * from supplier_source_facts')).rows.length,0);
  await assert.rejects(mti(db,[offer('DENIED',first)]),/Access denied/);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from supplier_source_facts'),/permission denied/);
 }finally{await db.close();}
});

test('ERC records source facts even for unchanged fields; repeated files preserve manual changes and older sources cannot overwrite newer facts',async()=>{
 const db=await fixture();try{
  const start=meta=>call(db,'start_product_import',[JSON.stringify({price:true,stock:true,source:meta}),1]);
  const write=async(run,patch,facts)=>{
   const current=(await db.query('select * from products where id=1')).rows[0];
   const expected=Object.fromEntries(['sku',...Object.keys(patch),'manual_overrides'].map(k=>[k,k==='price'?Number(current[k]):current[k]??null]));
   return call(db,'apply_product_supplier_import',[run,1,JSON.stringify(patch),JSON.stringify(expected),'ERC',JSON.stringify(facts)]);
  };
  const first=source('ERC',1,'2020-01-01T00:00:00Z'),newer=source('ERC',2,'2021-01-01T00:00:00Z');
  await write(await start(first),{price:110,stock_quantity:2,in_stock:true,availability_status:'in_stock'},{price:110,stock:{quantity:2,status:'in_stock'}});
  await db.exec('reset role;update products set price=999 where id=1;set role authenticated;');
  const repeated=await write(await start(first),{price:110},{price:110});assert.equal(repeated.unchanged,true);
  assert.equal(Number((await db.query('select price from products where id=1')).rows[0].price),999);
  await write(await start(newer),{}, {price:999});
  assert.equal((await db.query("select count(*)::int n from supplier_source_facts where supplier='ERC' and field='price'")).rows[0].n,2);
  await assert.rejects(write(await start(source('ERC',3,'2020-06-01T00:00:00Z')),{price:70},{price:70}),/Старіший прайс/);
  await assert.rejects(write(await start(source('ERC',4,'2021-01-01T00:00:00Z')),{price:70},{price:70}),/однакову дату/);
  await assert.rejects(start({...first,observedAt:'2022-01-01T00:00:00Z'}),/іншу дату/);
  await assert.rejects(write(await start(source('ERC',5,'2022-01-01T00:00:00Z')),{price:70},{}),/не підтверджена/);
  await assert.rejects(call(db,'start_product_import',['{}',1]),/дату джерела/);
  assert.equal(Number((await db.query('select price from products where id=1')).rows[0].price),999);
 }finally{await db.close();}
});
