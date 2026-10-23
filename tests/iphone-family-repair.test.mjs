import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec('create table products(id bigint primary key,slug text,name text,sku text,price numeric,stock_quantity integer,is_active boolean,parent_product_id bigint,variant_label text,description text,specifications jsonb,image_path text,image_paths jsonb)');
const repaired=[4294,4295,4296,4299,4300,4301,4304],hidden=[4297,4298,4302,4303];
for(const id of [...repaired,...hidden])await db.query("insert into products values($1,$2,$3,null,0,0,true,null,null,'ЧОХОЛ', $4, 'case.png','[]')",[id,'apple-family-iphone-'+id,'Смартфон iPhone '+id,{'Тип чохла':'Чохол'}]);
for(const id of repaired)await db.query("insert into products values($1,'real-phone','СМАРТФОН IPHONE TEST',$2,100,2,true,$3,'Black','Телефон','{}','phone.png','[]')",[id+100,'SKU'+id,id]);
for(const id of [3887,3888,3889])await db.query("insert into products values($1,'case','iPhone Silicone Case','CASE',5,3,true,4294,'Case','Case','{}','case.png','[]')",[id]);
const script=await readFile(new URL('../supabase/repair-iphone-families-20261023.sql',import.meta.url),'utf8');
await db.exec(script);
assert.equal((await db.query('select * from technoroom_maintenance.product_repair_backup')).rows.length,14);
for(const id of repaired){const p=(await db.query('select * from products where id=$1',[id])).rows[0];assert.equal(p.image_path,'phone.png');assert.ok(!Object.hasOwn(p.specifications,'Тип чохла'));assert.equal(p.price,'0');}
for(const id of hidden)assert.equal((await db.query('select is_active from products where id=$1',[id])).rows[0].is_active,false);
for(const id of [3887,3888,3889])assert.equal((await db.query('select parent_product_id from products where id=$1',[id])).rows[0].parent_product_id,null);
await db.close();console.log('Approved family migration: exact scope, backups, guarded representatives, detached cases, hidden inactive families and commercial fields preserved: PASS');
