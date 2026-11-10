import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {normalizeOrder} from '../../api/order-input.js';
import {discountedPrice} from '../../public/store-pricing.js';
import {saveOrderChanges,orderStatuses} from '../../public/order-admin.js';

// No URLs, credentials, env vars or remote clients. Always a fresh local directory.
const repo=fileURLToPath(new URL('../../',import.meta.url));
const base=path.join(repo,'.local-test-db');
await mkdir(base,{recursive:true});
const dataDir=await mkdtemp(path.join(base,'orders-'));
const db=await PGlite.create(dataDir);
const sql=async name=>readFile(path.join(repo,'supabase',name),'utf8');
const table=(source,name)=>{
  const match=source.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match,`Actual schema must include ${name}`);return match[0];
};
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS: '+name);};
const snapshot=async()=>({
  orders:(await db.query('select count(*)::int as n from orders')).rows[0].n,
  items:(await db.query('select count(*)::int as n from order_items')).rows[0].n,
  stocks:(await db.query('select id,stock_quantity from products order by id')).rows
});
const payload=(items=[{productId:1,quantity:2,expectedUnitPrice:216129.75}])=>normalizeOrder({
  customer:{name:'TEST',lastName:'LOCAL ONLY',phone:'+380500000000',email:'test@example.invalid'},
  delivery:{method:'nova_poshta',city:'TEST CITY',address:'TEST BRANCH',comment:'Local database test'},
  payment:{method:'invoice'},company:{name:'TEST COMPANY',code:'00000000',contact:'TEST CONTACT',invoiceEmail:'invoice@example.invalid'},
  consent:true,items
});
const call=async(client,value)=>(await client.query('select public.create_store_order_v2($1::jsonb) as id',[JSON.stringify(value)])).rows[0].id;
const rollback=Symbol('intentional rollback');
try {
  const schema=await sql('schema.sql');
  const promos=await sql('promotions-banners.sql');
  const targets=await sql('promotion-targets.sql');
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create type public.order_status as enum ('new','confirmed','paid','shipped','completed','cancelled');
    ${table(schema,'products')}
    ${table(schema,'orders')}
    ${table(schema,'order_items')}
    alter table public.products add column stock_quantity integer not null default 0,
      add column brand_id bigint,add column parent_product_id bigint references public.products(id);
    ${table(promos,'promotions')}
    alter table promotions add column target_type text not null default 'all',add column target_value text;
    ${table(targets,'promotion_products')}`);
  // Execute the production migration unchanged, twice to check repeatability.
  await db.exec('create table if not exists supplier_offers(product_id bigint, stock_quantity integer, stock_kind text)'); await db.exec(await sql('supplier-inventory-upgrade.sql'));
  await db.exec('create table if not exists supplier_offers(product_id bigint, stock_quantity integer, stock_kind text)'); await db.exec(await sql('supplier-inventory-upgrade.sql'));
  await db.exec(await sql('order-workflow-upgrade.sql'));
  await db.exec(`insert into products(slug,name,category,price,stock_quantity,brand_id) values
    ('test-projector','TEST Projector','projectors',227505,10,3),
    ('test-device','TEST Device','printers',100,5,4),
    ('test-variant','TEST Variant','projectors',100,5,3);
    update products set parent_product_id=1 where id=3;
    insert into promotions(name,discount_type,discount_value,target_type) values('TEST 5 percent','percent',5,'products');
    insert into promotion_products values(1,1);`);
  const initial=await snapshot();
  await check('order details, discounted unit price, totals, stock and full rollback',async()=>{
    try {
      await db.transaction(async tx=>{
        const id=await call(tx,payload());
        const order=(await tx.query('select * from orders where id=$1',[id])).rows[0];
        const line=(await tx.query('select * from order_items where order_id=$1',[id])).rows[0];
        assert.equal(Number(order.total),432259.50);
        assert.equal(Number(line.unit_price),216129.75);assert.equal(line.quantity,2);
        assert.equal(order.customer_name,'TEST LOCAL ONLY');
        assert.equal(order.city,'TEST CITY');assert.equal(order.address,'TEST BRANCH');
        assert.equal(order.checkout_details.customer.lastName,'LOCAL ONLY');
        assert.equal(order.checkout_details.payment.method,'invoice');
        assert.equal(order.checkout_details.delivery.method,'nova_poshta');
        assert.equal(order.checkout_details.company.code,'00000000');
        assert.equal(order.checkout_details.consent,true);
        assert.match(order.comment,/Оплата: За рахунком/);
        assert.equal((await tx.query('select stock_quantity from products where id=1')).rows[0].stock_quantity,8);
        throw rollback;
      });
    } catch(error){if(error!==rollback)throw error;}
    assert.deepEqual(await snapshot(),initial);
  });
  await check('changed price rejected with no order or stock changes',async()=>{
    await assert.rejects(()=>call(db,payload([{productId:1,quantity:2,expectedUnitPrice:227505}])),/Price changed/);
    assert.deepEqual(await snapshot(),initial);
  });
  await check('insufficient stock rejected atomically across multiple products',async()=>{
    await assert.rejects(()=>call(db,payload([{productId:1,quantity:1,expectedUnitPrice:216129.75},{productId:2,quantity:6,expectedUnitPrice:100}])),/unavailable/);
    assert.deepEqual(await snapshot(),initial);
  });
  await check('invalid quantity and duplicate IDs rejected by SQL',async()=>{
    const data=payload();data.items[0].quantity=0;
    await assert.rejects(()=>call(db,data),/Invalid quantity/);
    data.items[0].quantity=1;data.items.push({...data.items[0]});
    await assert.rejects(()=>call(db,data),/Duplicate products/);
    assert.deepEqual(await snapshot(),initial);
  });
  await check('phone and consent rejected by SQL',async()=>{
    const data=payload();data.customer.phone='+380';
    await assert.rejects(()=>call(db,data),/Invalid order data/);
    data.customer.phone='+380500000000';data.consent=false;
    await assert.rejects(()=>call(db,data),/Invalid order data/);
  });
  async function priceCase(productId,expected){
    try {await db.transaction(async tx=>{
      const id=await call(tx,payload([{productId,quantity:1,expectedUnitPrice:expected}]));
      assert.equal(Number((await tx.query('select total from orders where id=$1',[id])).rows[0].total),expected);
      throw rollback;
    });}catch(error){if(error!==rollback)throw error;}
  }
  await check('unpromoted product keeps base price',()=>priceCase(2,100));
  await check('parent-linked promotion applies to variant',()=>priceCase(3,95));
  await check('fixed discount matches browser rounding',async()=>{
    await db.exec("update promotions set discount_type='fixed',discount_value=12.34");
    await priceCase(1,discountedPrice(227505,{discount_type:'fixed',discount_value:12.34}));
  });
  await check('expired promotion is ignored',async()=>{
    await db.exec("update promotions set ends_at=now()-interval '1 day'");await priceCase(1,227505);
  });
  await check('inactive product cannot be ordered',async()=>{
    await db.exec('update products set is_active=false where id=2');
    await assert.rejects(()=>call(db,payload([{productId:2,quantity:1,expectedUnitPrice:100}])),/unavailable/);
    await db.exec('update products set is_active=true where id=2');
  });
  await check('only service_role can execute checkout function',async()=>{
    const privileges=(await db.query(`select
      has_function_privilege('anon','public.create_store_order_v2(jsonb)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.create_store_order_v2(jsonb)','EXECUTE') as authenticated,
      has_function_privilege('service_role','public.create_store_order_v2(jsonb)','EXECUTE') as service`)).rows[0];
    assert.deepEqual(privileges,{anon:false,authenticated:false,service:true});
  });
  await check('actual API handler → SQL → saved metadata, followed by rollback',async()=>{
    await db.exec("update promotions set discount_type='percent',discount_value=5,ends_at=null");
    const api=await readFile(path.join(repo,'api','orders.js'),'utf8');
    const handler=api.slice(api.indexOf('export default async function handler')).replace('export default ','');
    try {await db.transaction(async tx=>{
      const context={normalizeOrder,notifyNewOrder:async()=>({status:'not_configured'}),console,supabase:{async rpc(name,args){
        assert.equal(name,'create_store_order_v2');
        return {data:await call(tx,args.p_payload),error:null};
      }}};
      vm.createContext(context);vm.runInContext(handler,context);
      const response={statusCode:0,body:null,setHeader(){},status(code){this.statusCode=code;return this},json(value){this.body=value;return this}};
      await context.handler({method:'POST',body:payload()},response);
      assert.equal(response.statusCode,201);
      const order=(await tx.query('select total,checkout_details from orders where id=$1',[response.body.orderId])).rows[0];
      assert.equal(Number(order.total),432259.50);
      assert.equal(order.checkout_details.company.invoiceEmail,'invoice@example.invalid');
      assert.equal(order.checkout_details.customer.lastName,'LOCAL ONLY');
      assert.equal(order.checkout_details.payment.method,'invoice');
      throw rollback;
    });}catch(error){if(error!==rollback)throw error;}
    assert.deepEqual(await snapshot(),initial);
  });
  await check('all admin statuses preserve stock, lines and totals; stale updates rejected',async()=>{
    try{await db.transaction(async tx=>{
      const id=await call(tx,payload()),before=(await tx.query('select total,checkout_details from orders where id=$1',[id])).rows[0];
      const lines=(await tx.query('select * from order_items where order_id=$1',[id])).rows,stocks=(await tx.query('select id,stock_quantity from products order by id')).rows;
      const adapter={from(){return{update(value){this.value=value;this.filters={};return this},eq(key,value){this.filters[key]=value;return this},async select(){return{data:(await tx.query('update orders set status=$1,manager_note=$2 where id=$3 and status=$4 returning id',[this.value.status,this.value.manager_note,this.filters.id,this.filters.status])).rows}}}}};
      let previous='new';
      for(const status of orderStatuses){await saveOrderChanges(adapter,{id,status:previous},status,' TEST ');previous=status;assert.deepEqual((await tx.query('select total,checkout_details from orders where id=$1',[id])).rows[0],before);assert.deepEqual((await tx.query('select * from order_items where order_id=$1',[id])).rows,lines);assert.deepEqual((await tx.query('select id,stock_quantity from products order by id')).rows,stocks)}
      await assert.rejects(()=>saveOrderChanges(adapter,{id,status:'new'},'paid',''),/уже змінено/);
      throw rollback;
    })}catch(error){if(error!==rollback)throw error}
    assert.deepEqual(await snapshot(),initial);
  });
  assert.deepEqual(await snapshot(),initial);
  await check('supplier-only stock and repeat import cannot sell last unit twice',async()=>{
   try {await db.transaction(async tx=>{
    await tx.exec("update products set stock_quantity=0,in_stock=false where id=2;insert into supplier_offers values(2,1,'exact')");
    await call(tx,payload([{productId:2,quantity:1,expectedUnitPrice:100}]));
    assert.equal((await tx.query('select supplier_available_quantity from products where id=2')).rows[0].supplier_available_quantity,0);
    await tx.exec('update supplier_offers set stock_quantity=1 where product_id=2');
    assert.equal((await tx.query('select supplier_available_quantity from products where id=2')).rows[0].supplier_available_quantity,0);
    throw rollback;
   });}catch(e){if(e!==rollback)throw e;}
  });
  console.log(`${passed} database checks passed. Orders: 0; order items: 0; stock restored.`);
  console.log('Isolated local database: '+dataDir);
  console.log('Production Supabase was not accessed. Sequence gaps after rollback are normal.');
} finally {await db.close();}


