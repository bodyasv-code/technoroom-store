import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {saveOrderShipping} from '../../public/order-shipping.js';
// Offline only. The saved history migration is read from Git because the user's
// working copy of that file was cleared after its production installation.
const history=execFileSync('git',['show','2113c85:supabase/order-history-upgrade.sql'],{encoding:'utf8'});
const migration=await readFile(new URL('../../supabase/order-shipping-upgrade.sql',import.meta.url),'utf8');
const db=await PGlite.create();
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
    grant usage on schema auth to authenticated,anon,service_role;
    create table profiles(id uuid primary key,full_name text);
    create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from profiles where id=auth.uid())$$;
    create table orders(id bigint primary key,status text,checkout_details jsonb,total numeric);
    insert into profiles values('11111111-1111-1111-1111-111111111111','TEST MANAGER');
    insert into orders values(1,'new','{"company":{"name":"TEST"},"notification":{"status":"accepted"}}',100);
    grant select,update on orders to authenticated,service_role;`);
  await db.exec(history);await db.exec(migration);await db.exec(migration);
  const before=(await db.query('select status,total,checkout_details from orders where id=1')).rows[0];
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,0,'migration invents no events');
  await db.exec("set test.actor='11111111-1111-1111-1111-111111111111';set test.role='authenticated';set role authenticated");
  const adapter={from(){return{update(value){this.value=value;this.filters={};return this},eq(key,value){this.filters[key]=value;return this},async select(){return{data:(await db.query('update orders set shipping_carrier=$1,tracking_number=$2 where id=$3 and shipping_carrier=$4 and tracking_number=$5 returning id',[this.value.shipping_carrier,this.value.tracking_number,this.filters.id,this.filters.shipping_carrier,this.filters.tracking_number])).rows}}}}};
  await saveOrderShipping(adapter,{id:1,shipping_carrier:'',tracking_number:''},'nova_poshta','20450000000000');
  let events=(await db.query('select * from order_events order by id')).rows;
  assert.equal(events.length,1);assert.equal(events[0].kind,'shipping');assert.equal(events[0].actor_name,'TEST MANAGER');
  assert.equal(JSON.parse(events[0].next_value).tracking_number,'20450000000000');
  assert.deepEqual((await db.query('select status,total,checkout_details from orders where id=1')).rows[0],before);
  await assert.rejects(()=>saveOrderShipping(adapter,{id:1,shipping_carrier:'',tracking_number:''},'other','TEST-777'),/вже змінено/);
  await db.exec("update orders set tracking_number=tracking_number where id=1");
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,1,'no-op produces no event');
  for(const sql of ["update orders set tracking_number='INVALID' where id=1","update orders set shipping_carrier='evil' where id=1"]){await assert.rejects(()=>db.exec(sql),/violates check constraint/)}
  await assert.rejects(()=>db.exec('delete from order_events'),/permission denied/);
  await db.exec("begin;update orders set shipping_carrier='ukrposhta',tracking_number='RR123456789UA' where id=1;rollback");
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,1,'event rolls back with shipment');
  await db.exec("update orders set status='paid',checkout_details='{"+'"notification":{"status":"failed","code":"mail_send_403"}'+"}' where id=1");
  events=(await db.query('select * from order_events order by id')).rows;
  assert.deepEqual(events.map(e=>e.kind),['shipping','status','email'],'existing journal still records status and mail');
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from order_events'),/permission denied/);
  console.log('PASS: real shipping SQL, repeatability, format constraints, CAS, actor history, rollback, legacy triggers and no public history access. No production access or mail.');
}finally{await db.close()}
