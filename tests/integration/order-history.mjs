import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
// Isolated in-memory PostgreSQL. Never contacts production or sends mail.
const db=await PGlite.create();
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
    grant usage on schema auth to authenticated,anon,service_role;
    create table profiles(id uuid primary key,full_name text);
    create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from profiles where id=auth.uid())$$;
    create table orders(id bigint primary key,status text,checkout_details jsonb,total numeric);
    insert into profiles values('11111111-1111-1111-1111-111111111111','TEST MANAGER');
    insert into orders values(1,'new','{}',100);
    grant select,update on orders to authenticated,service_role;`);
  const migration=await readFile(new URL('../../supabase/order-history-upgrade.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,0);
  await db.exec(`set test.actor='11111111-1111-1111-1111-111111111111';set test.role='authenticated';set role authenticated;
    update orders set status='paid' where id=1;
    update orders set status='paid' where id=1;`);
  let events=(await db.query('select * from order_events order by id')).rows;
  assert.equal(events.length,1);assert.equal(events[0].actor_name,'TEST MANAGER');assert.equal(events[0].previous_value,'new');assert.equal(events[0].next_value,'paid');
  for(const statement of ["insert into order_events(order_id,kind,next_value) values(1,'status','forged')","update order_events set next_value='forged'","delete from order_events"]){await assert.rejects(()=>db.exec(statement),/permission denied/)}
  await db.exec(`reset role;set test.actor='';set test.role='service_role';set role service_role;
    update orders set checkout_details='{"notification":{"status":"retrying","attempt":"TEST_ATTEMPT","requested_by":"11111111-1111-1111-1111-111111111111"}}' where id=1;
    update orders set checkout_details='{"notification":{"status":"accepted","attempt":"TEST_ATTEMPT","requested_by":"11111111-1111-1111-1111-111111111111"}}' where id=1;`);
  events=(await db.query('select * from order_events order by id')).rows;
  assert.equal(events.length,3);assert.equal(events[1].next_value,'retrying');assert.equal(events[2].next_value,'accepted');assert.equal(events[2].actor_name,'TEST MANAGER');assert.equal(events[2].attempt_id,'TEST_ATTEMPT');
  await db.exec(`update orders set checkout_details='{"notification":{"status":"failed","code":"PRIVATE SECRET"}}' where id=1`);
  assert.equal((await db.query('select error_code from order_events order by id desc limit 1')).rows[0].error_code,null);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from order_events'),/permission denied/);
  await db.exec("reset role;set test.actor='22222222-2222-2222-2222-222222222222';set role authenticated");
  assert.equal((await db.query('select * from order_events')).rows.length,0,'non-admin cannot read private history');
  await db.exec('reset role');
  const before=(await db.query('select count(*)::int as n from order_events')).rows[0].n;
  await db.exec("begin;update orders set status='shipped' where id=1;rollback");
  assert.equal((await db.query('select count(*)::int as n from order_events')).rows[0].n,before);
  assert.equal((await db.query('select total,status from orders where id=1')).rows[0].total,'100');
  console.log('PASS: repeatable migration, trigger actor/status/email, atomic rollback, immutable history and admin-only reads. No production access.');
}finally{await db.close()}
