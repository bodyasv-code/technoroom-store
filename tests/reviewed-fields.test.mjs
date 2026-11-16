import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {manualFields,preserveManualSpecifications} from '../public/product-manual-overrides.js';
import {buildImportChangePlan} from '../public/import-change-plan.js';
import {prepareBulkProductContent} from '../public/bulk-product-content.js';

const migration=await readFile(new URL('../supabase/reviewed-content-guard-upgrade.sql',import.meta.url),'utf8');
const product={id:1,sku:'SCREEN',brand:'Epson',name:'Екран',category:'screens',specifications:{'Діагональ':['80″','65″'],'Співвідношення сторін':['16:9','4:3']},manual_overrides:{reviewed_specifications:['Діагональ','Співвідношення сторін','Видалене'],reviewed_description:true}};

test('Granular review keeps arrays and tombstones, permits other enrichment and protects empty descriptions',()=>{
  const before=structuredClone(product);
  const incoming={'Діагональ':'100″','Співвідношення сторін':'1:1','Видалене':'supplier','Колір':'Білий'};
  assert.deepEqual(preserveManualSpecifications(incoming,product),{...product.specifications,'Колір':'Білий'});
  const plan=buildImportChangePlan({vendor:'Epson',specifications:incoming,description:'supplier',hasPrice:true,price:99,hasStock:true,stock:2},product);
  assert.deepEqual(plan.patch.specifications,{...product.specifications,'Колір':'Білий'});
  assert.equal(plan.patch.description,undefined);assert.equal(plan.patch.price,99);assert.equal(plan.patch.stock_quantity,2);
  const preview={status:'review',product:{id:1,sku:'SCREEN',brand:'Epson'},rows:[{status:'new',mapping:'test',canonical:'Видалене',value:'supplier',language:'UK'}]};
  assert.equal(prepareBulkProductContent(product,preview).patch.specifications,undefined);
  assert.equal(manualFields(product).description,true);assert.deepEqual(product,before);
  const projector={name:'Проєктор',category:'projectors',specifications:{'Технологія проекції':'DLP'},manual_overrides:{reviewed_specifications:['Технологія проекції']}};
  assert.deepEqual(preserveManualSpecifications({'Технологія':'LCD','Колір':'Білий'},projector),{'Технологія проекції':'DLP','Колір':'Білий'});
});

test('Database guard blocks imported reviewed fields, allows unrelated fields and revokes only derived marks',async()=>{
  const db=await PGlite.create();try{
    await db.exec(`create role anon;create role authenticated;create schema technoroom_maintenance;
      create table products(id bigint primary key,sku text,brand text,description text,specifications jsonb,manual_overrides jsonb default '{}',price numeric);
      insert into products values(1,'SCREEN','Epson','reviewed','{"Діагональ":["80″","65″"]}','{"category":true,"specifications":{"Ручне":true}}',10);`);
    await db.exec(migration);await db.exec(migration);
    await db.exec(`insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,operation,protect_description,specification_keys) values(1,'SCREEN','Epson','manufacturer','test',true,array['Діагональ','Видалене']);update products set id=id;set technoroom.import_write='true';`);
    for(const assignment of ["specifications='{}'","specifications=specifications||'{\"Діагональ\":\"100″\"}'","specifications=specifications||'{\"Видалене\":\"bad\"}'","description='supplier'"]){
      await assert.rejects(db.exec('update products set '+assignment),/Reviewed/);
    }
    await db.exec(`update products set price=12,specifications=specifications||'{"Колір":"Білий"}';`);
    let row=(await db.query('select * from products')).rows[0];assert.equal(Number(row.price),12);assert.equal(row.specifications.Колір,'Білий');assert.deepEqual(row.manual_overrides.reviewed_specifications,['Діагональ','Видалене']);
    await db.exec(`set technoroom.import_write='false';update products set specifications=specifications||'{"Діагональ":"90″"}';`);
    assert.equal((await db.query('select specifications from products')).rows[0].specifications.Діагональ,'90″');
    await db.exec(`delete from technoroom_maintenance.reviewed_product_content;update products set id=id;`);
    row=(await db.query('select * from products')).rows[0];assert.deepEqual(row.manual_overrides,{category:true,specifications:{Ручне:true}});
    await db.exec(`update products set manual_overrides=manual_overrides||'{"reviewed_specifications":["Колір"],"reviewed_description":true,"verified_specifications":true}';`);
    assert.deepEqual((await db.query('select manual_overrides from products')).rows[0].manual_overrides,{category:true,specifications:{Ручне:true}});
    await db.exec('set role authenticated');await assert.rejects(db.exec('select * from technoroom_maintenance.reviewed_product_content'),/permission denied/);
  }finally{await db.close();}
});
