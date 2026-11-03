import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('MTI migration preserves catalog stock and records uncertain offers atomically',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001');
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select true$$;
      create table catalog_suppliers(code text primary key,name text);
      create table products(id bigint generated always as identity primary key,name text,slug text,sku text,brand text,category text,
        price numeric,stock_quantity integer not null,in_stock boolean not null,availability_status text,description text,specifications jsonb,is_active boolean);
      create table product_suppliers(product_id bigint,supplier text,supplier_sku text,origin text,last_seen_at timestamptz,primary key(product_id,supplier));
      create table product_import_exclusions(sku text,is_active boolean);
      create table import_runs(id int);create table import_changes(id int);`);
    const migration=await readFile(new URL('../../supabase/supplier-offers-upgrade.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    const base={supplierSku:'V12H002AG0',manufacturerSku:'V12H002AG0',supplierId:'3703528',brand:'Epson',category:'erc-display-06',
      currency:'UAH',priceBasis:'rrp',stockKind:'needs_confirmation',quantity:null,reserved:0,reviewRequired:false,retailPrice:80039,
      supplierPrice:null,expectedProductId:null,sourceRow:5,draft:{name:'Екран Epson ELPSC36',description:null,specifications:{}}};
    const call=async(n,row)=>(await db.query('select apply_mti_offer_batch($1,$2,$3::jsonb) result',[
      `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,'test.xlsx',JSON.stringify([row])])).rows[0].result;
    const first=await call(2,base);
    assert.equal(first.createdDrafts,1);
    let product=(await db.query('select * from products')).rows[0];
    assert.equal(product.supplier_stock_uncertain,true);assert.equal(product.stock_quantity,0);assert.equal(product.in_stock,false);assert.equal(product.is_active,false);
    assert.equal((await db.query('select stock_quantity from supplier_offers')).rows[0].stock_quantity,null);
    await db.exec('update products set stock_quantity=7,in_stock=true,price=12345');
    await call(3,{...base,expectedProductId:product.id,draft:null});
    product=(await db.query('select * from products')).rows[0];
    assert.equal(product.stock_quantity,7);assert.equal(Number(product.price),12345);
    await call(4,{...base,expectedProductId:product.id,draft:null,stockKind:'exact',quantity:0});
    assert.equal((await db.query('select supplier_stock_uncertain from products')).rows[0].supplier_stock_uncertain,false);
    const before=(await db.query('select count(*)::int n from supplier_offer_runs')).rows[0].n;
    await assert.rejects(()=>call(5,{...base,expectedProductId:product.id,quantity:0}),/Invalid price or exact stock/);
    await assert.rejects(()=>call(6,{...base,expectedProductId:product.id,stockKind:'unknown'}),/Offer requires review/);
    assert.equal((await db.query('select count(*)::int n from supplier_offer_runs')).rows[0].n,before);
    assert.equal((await db.query('select count(*)::int n from supplier_offer_changes')).rows[0].n,3);
    await db.exec(`create table profiles(id uuid,full_name text,role text);
      insert into profiles values ('00000000-0000-0000-0000-000000000001','Bohdan','owner');
      update supplier_offers set supplier_sku='TEST-OLD',manufacturer_sku='TEST-OLD';
      update products set sku='TEST-OLD';
      insert into products(id,name,sku,brand,category,price,stock_quantity,in_stock,availability_status,is_active)
      overriding system value values(1180,'Екран Epson ELPSC36','V12H002AG0','Epson','erc-display-06',80039,0,false,'out_of_stock',true);`);
    const repair=await readFile(new URL('../../supabase/repair-mti-elpsc36-stock-20261103.sql',import.meta.url),'utf8');
    await db.exec(repair);await db.exec(repair);
    const fixed=(await db.query('select * from products where id=1180')).rows[0];
    assert.equal(fixed.supplier_stock_uncertain,true);assert.equal(fixed.stock_quantity,0);assert.equal(fixed.is_active,true);
    assert.equal((await db.query("select count(*)::int n from supplier_offer_changes where run_id='738d273b-4609-4439-b3db-2601fab9732c'")).rows[0].n,1);
  } finally {await db.close();}
});
