import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {writeImportProduct,startImportRun,finishImportRun,importHistoryDetailsMarkup,historySetupMessage} from '../public/import-history.js';

const calls=[];
const mock={rpc:async(name,args)=>{calls.push({name,args});return {data:'run',error:null}}};
await startImportRun(mock,{price:true},1);
await writeImportProduct(mock,'run',{id:3,sku:'S',price:10},{price:20});
assert.deepEqual(calls[1].args.p_expected,{sku:'S',price:10});
assert.equal(calls[1].name,'apply_product_import');
assert.equal((await writeImportProduct(mock,'run',{id:3},{})).data.unchanged,true);
assert.equal(calls.length,2);
await finishImportRun(mock,'run',{unchanged:1,failures:[{key:'private',sku:'S',reason:'x'}]});
assert.deepEqual(calls[2].args.p_errors,[{sku:'S',reason:'x'}]);
await assert.rejects(()=>startImportRun({rpc:async()=>({error:{code:'PGRST202'}})},{},1),error=>error.message===historySetupMessage);
assert.ok(importHistoryDetailsMarkup([{product_name:'<script>',sku:'<img>',action:'updated',before_values:{price:10},after_values:{price:20}}]).includes('&lt;script&gt;'));

// Real PostgreSQL engine in memory: no credentials, network or production data.
const db=await PGlite.create();
const admin='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${admin}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    grant usage on schema auth to authenticated;
    create table public.products(id bigint generated always as identity primary key,name text not null,slug text unique not null,
      sku text unique,brand_id bigint,brand text,category text not null,price numeric(12,2) not null check(price>=0),
      stock_quantity integer,in_stock boolean,availability_status text,description text,specifications jsonb,is_active boolean,
      image_path text,image_paths jsonb);
    insert into products(name,slug,sku,category,price) values('Original','original','S','printers',10);`);
  const sql=await readFile(new URL('../supabase/import-history-upgrade.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const call=async(name,args)=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
  const write=(run,id,patch,expected={},images=false)=>call('apply_product_import',[run,id,JSON.stringify(patch),JSON.stringify(expected),images]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
  const run=await call('start_product_import',['{}',2]);
  await assert.rejects(()=>db.exec("insert into public.import_changes(run_id,product_id,action,after_values) values('"+run+"',1,'updated','{}')"),/permission denied/);
  await write(run,1,{price:20},{sku:'S',price:10});
  assert.equal((await db.query('select before_values,after_values from import_changes')).rows[0].before_values.price,10);
  await assert.rejects(()=>write(run,1,{price:30},{sku:'S',price:10}),/changed after preview/);
  await assert.rejects(()=>write(run,1,{name:'Wrong'},{sku:'S',name:'Original'}),/Unsupported import field/);
  await assert.rejects(()=>write(run,1,{price:30},{sku:'S'}),/Missing expected field/);
  const unchanged=await write(run,1,{price:20},{sku:'S',price:20});assert.equal(unchanged.unchanged,true);
  assert.equal((await db.query('select count(*)::int as n from import_changes')).rows[0].n,1);
  const created=await write(run,null,{name:'New',slug:'new',sku:'NEW',category:'printers',price:30});
  await write(run,created.id,{image_path:'products/test.jpg',image_paths:['products/test.jpg']},{sku:'NEW',image_path:null,image_paths:null},true);
  await assert.rejects(()=>write(run,created.id,{image_path:'overwrite.jpg',image_paths:[]},{sku:'NEW',image_path:'products/test.jpg',image_paths:['products/test.jpg']},true),/photos must be preserved/);
  await call('finish_product_import',[run,'[]',1,false]);
  assert.equal((await db.query('select status from import_runs')).rows[0].status,'completed');
  await assert.rejects(()=>write(run,1,{price:30},{sku:'S',price:20}),/not running/);
  await db.exec(`set request.jwt.claim.sub='${other}'`);
  assert.equal((await db.query('select * from import_runs')).rows.length,0);
  assert.equal((await db.query('select * from import_changes')).rows.length,0);
  await assert.rejects(()=>call('start_product_import',['{}',1]),/Access denied/);
  await db.exec(`set request.jwt.claim.sub='${admin}';reset role;
    create function public.reject_history_test() returns trigger language plpgsql as $$begin raise exception 'History write failed';end$$;
    create trigger reject_history_test before insert on public.import_changes for each row execute function public.reject_history_test();
    set role authenticated;`);
  const failedRun=await call('start_product_import',['{}',1]);
  await assert.rejects(()=>write(failedRun,1,{price:99},{sku:'S',price:20}),/History write failed/);
  await db.exec('reset role');
  assert.equal(Number((await db.query('select price from products where id=1')).rows[0].price),20);
  await db.exec(`drop trigger reject_history_test on public.import_changes;set role authenticated;`);
  await call('finish_product_import',[failedRun,'[{"sku":"S","reason":"failed"}]',0,true]);
  assert.equal((await db.query('select status from import_runs where id=$1',[failedRun])).rows[0].status,'failed');
  const partialRun=await call('start_product_import',['{}',2]);
  await write(partialRun,1,{price:21},{sku:'S',price:20});
  await call('finish_product_import',[partialRun,'[{"sku":"OTHER","reason":"failed"}]',0,false]);
  assert.equal((await db.query('select status from import_runs where id=$1',[partialRun])).rows[0].status,'partial');
  console.log('Import journal: repeatable SQL, atomic rollback, CAS, create/update/photos, RLS, protected history and statuses: OK');
}finally{await db.close()}
