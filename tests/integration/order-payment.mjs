import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {saveOrderPayment} from '../../public/order-payment.js';
// Offline only, no real payments, emails, customers or production database calls.
const history=execFileSync('git',['show','2113c85:supabase/order-history-upgrade.sql'],{encoding:'utf8'});
const shipping=await readFile(new URL('../../supabase/order-shipping-upgrade.sql',import.meta.url),'utf8');
const migration=await readFile(new URL('../../supabase/order-payment-upgrade.sql',import.meta.url),'utf8');
const db=await PGlite.create();
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
    grant usage on schema auth to authenticated,anon,service_role;
    create table profiles(id uuid primary key,full_name text);
    create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from profiles where id=auth.uid())$$;
    create table orders(id bigint primary key,status text,checkout_details jsonb,total numeric(12,2),manager_note text);
    create table products(id bigint primary key,stock_quantity int);insert into products values(1,8);
    create table order_items(order_id bigint,quantity int,unit_price numeric);insert into order_items values(1,2,50.05);
    insert into profiles values('11111111-1111-1111-1111-111111111111','TEST MANAGER');
    insert into orders values(1,'paid','{"notification":{"status":"accepted"},"company":{"name":"TEST"}}',100.10,'KEEP'),(2,'new','{}',0,'ZERO TOTAL');
    grant select,update on orders to authenticated;grant select on products,order_items to authenticated;
    alter table orders enable row level security;
    create policy "admin orders" on orders for all to authenticated using(is_admin()) with check(is_admin());`);
  await db.exec(history);await db.exec(shipping);await db.exec(migration);await db.exec(migration);
  assert.deepEqual((await db.query('select payment_status,amount_paid from orders where id=1')).rows[0],{payment_status:null,amount_paid:null},'old workflow paid does not imply manual receipt');
  const invariant=async()=>({order:(await db.query('select status,total,checkout_details,shipping_carrier,tracking_number,manager_note from orders where id=1')).rows[0],stock:(await db.query('select * from products')).rows,lines:(await db.query('select * from order_items')).rows});
  const before=await invariant();
  await db.exec("set test.actor='11111111-1111-1111-1111-111111111111';set test.role='authenticated';set role authenticated");
  const adapter={from(){return{update(value){this.value=value;this.filters={};return this},eq(key,value){this.filters[key]=value;return this},is(key,value){this.filters[key]=value;return this},async select(){return{data:(await db.query('update orders set payment_status=$1,amount_paid=$2 where id=$3 and total=$4 and payment_status is not distinct from $5 and amount_paid is not distinct from $6 returning id,total,payment_status,amount_paid',[this.value.payment_status,this.value.amount_paid,this.filters.id,this.filters.total,this.filters.payment_status,this.filters.amount_paid])).rows}}}}};
  let current={id:1,total:'100.10',payment_status:null,amount_paid:null};
  for(const [status,amount] of [['unpaid','0'],['partial','50.05'],['paid','100.10'],['','']]){
    const saved=await saveOrderPayment(adapter,current,status,amount);current={...current,...saved};assert.deepEqual(await invariant(),before);
  }
  assert.equal(await saveOrderPayment(adapter,current,'',''),false);
  let events=(await db.query('select * from order_events order by id')).rows;
  assert.equal(events.length,4);assert.ok(events.every(e=>e.kind==='payment'&&e.actor_name==='TEST MANAGER'));
  await saveOrderPayment(adapter,current,'partial','50.05');
  await assert.rejects(()=>saveOrderPayment(adapter,current,'paid','100.10'),/вже змінено/);
  const latest=(await db.query('select id,total,payment_status,amount_paid from orders where id=1')).rows[0];
  await assert.rejects(()=>saveOrderPayment(adapter,{...latest,total:'99.00'},'paid','99.00'),/вже змінено/);
  for(const [status,amount] of [[null,0],['unpaid',null],['unpaid',1],['paid',99],['partial',0],['partial',100.10],['partial',101],['partial',-1],['OTHER',50],['paid','NaN']]){
    await assert.rejects(()=>db.query('update orders set payment_status=$1,amount_paid=$2 where id=1',[status,amount]),/violates check constraint/);
  }
  const count=(await db.query('select count(*)::int as n from order_events')).rows[0].n;
  await db.exec("begin;update orders set payment_status='paid',amount_paid=100.10 where id=1;rollback");
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,count);
  assert.deepEqual((await db.query('select payment_status,amount_paid from orders where id=1')).rows[0],{payment_status:'partial',amount_paid:'50.05'});
  await db.exec("update orders set payment_status='paid',amount_paid=0 where id=2");
  for(const sql of ["insert into order_events(order_id,kind,next_value) values(1,'payment','fake')","update order_events set next_value='fake'","delete from order_events"])await assert.rejects(()=>db.exec(sql),/permission denied/);
  await db.exec("set test.actor='22222222-2222-2222-2222-222222222222'");
  assert.equal((await db.query('select * from order_events')).rows.length,0);
  assert.equal((await db.query("update orders set payment_status='paid',amount_paid=100.10 where id=1 returning id")).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from order_events'),/permission denied/);
  console.log('PASS: manual payment SQL, cents, status consistency, actor history, unknown legacy orders, CAS, no side effects, RLS, rollback and repeatability. No production access.');
}finally{await db.close()}
