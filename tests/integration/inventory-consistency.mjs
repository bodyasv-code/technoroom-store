import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('database keeps labels consistent on import and order decrement',async()=>{
 const db=new PGlite();try{
 await db.exec(`create table products(id int primary key,stock_quantity int,in_stock boolean,availability_status text,updated_at timestamptz);insert into products values(1,2,true,'out_of_stock',now()),(2,0,false,'in_stock',now());`);
 const sql=await fs.readFile(new URL('../../supabase/inventory-consistency-upgrade.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 assert.deepEqual((await db.query('select availability_status from products order by id')).rows.map(r=>r.availability_status),['in_stock','out_of_stock']);
 await db.exec('update products set stock_quantity=0 where id=1');
 assert.equal((await db.query('select in_stock from products where id=1')).rows[0].in_stock,false);
 await db.exec("update products set availability_status='in_stock' where id=1");
 assert.equal((await db.query('select availability_status from products where id=1')).rows[0].availability_status,'out_of_stock');
 }finally{await db.close();}
});
