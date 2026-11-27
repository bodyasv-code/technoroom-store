import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {specificationRepairSql} from '../scripts/specification-duplicate-tail-maintenance.mjs';
const plans=[1,2,3].map(id=>({id,sku:'SKU-'+id,brand:'Test',name:"Пристрій '"+id,category:'office-printers',before:{specifications:{ОС:'Windows Процесор: ARM',Процесор:'ARM'},manual_overrides:{}},after:{specifications:{ОС:'Windows',Процесор:'ARM'},manual_overrides:{}}}));
async function fixture(){
  const db=new PGlite();await db.exec(`create table products(id bigint primary key,sku text,brand text,name text,category text,is_active boolean,specifications jsonb,manual_overrides jsonb,price numeric,stock_quantity integer,description text,updated_at timestamptz default now());create schema technoroom_maintenance;create table technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,primary key(operation,product_id));alter table technoroom_maintenance.product_repair_backup enable row level security;`);
  for(const p of plans)await db.query('insert into products(id,sku,brand,name,category,is_active,specifications,manual_overrides,price,stock_quantity,description) values($1,$2,$3,$4,$5,true,$6,$7,123.45,7,$8)',[p.id,p.sku,p.brand,p.name,p.category,p.before.specifications,p.before.manual_overrides,'Опис не змінювати']);
  return db;
}
test('transaction backs up all rows, changes only approved fields and supports guarded restoration',async()=>{
  const db=await fixture();
  try{
    await db.exec(specificationRepairSql(plans));
    const rows=(await db.query('select * from products order by id')).rows;
    for(const row of rows){assert.deepEqual(row.specifications,plans[row.id-1].after.specifications);assert.equal(Number(row.price),123.45);assert.equal(row.stock_quantity,7);assert.equal(row.description,'Опис не змінювати');}
    assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,3);
    await assert.rejects(db.exec(specificationRepairSql(plans)),/Snapshot changed|already backed up/);await db.exec('rollback');
    await db.exec(specificationRepairSql(plans,{restore:true}));
    assert.deepEqual((await db.query('select specifications from products where id=1')).rows[0].specifications,plans[0].before.specifications);
  }finally{await db.close();}
});
test('a stale snapshot or a trigger changing commercial data rolls back every row and backup',async()=>{
  for(const failure of ['stale','trigger']){
    const db=await fixture();
    try{
      if(failure==='stale')await db.exec("update products set specifications=specifications||'{\"Ручне\":\"значення\"}'::jsonb where id=3");
      else await db.exec('create function corrupt() returns trigger language plpgsql as $$begin NEW.price=999;return NEW;end$$;create trigger corrupt before update on products for each row execute function corrupt()');
      await assert.rejects(db.exec(specificationRepairSql(plans)),/Snapshot changed|Unexpected fields changed/);await db.exec('rollback');
      assert.equal((await db.query('select count(*)::int n from technoroom_maintenance.product_repair_backup')).rows[0].n,0);
      assert.equal(Number((await db.query('select price from products where id=1')).rows[0].price),123.45);
      assert.deepEqual((await db.query('select specifications from products where id=1')).rows[0].specifications,plans[0].before.specifications);
    }finally{await db.close();}
  }
});
test('builder rejects duplicate scope, commercial changes and SQL in operation identifiers',()=>{
  assert.throws(()=>specificationRepairSql([...plans,plans[0]]));
  assert.throws(()=>specificationRepairSql(plans,{operation:"x';drop table products;"}));
  assert.throws(()=>specificationRepairSql([{...plans[0],after:{...plans[0].after,price:1}}]));
});
