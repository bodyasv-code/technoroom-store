import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleIcecatProductImages,icecatImageUrl,imageCandidates,imageFileInfo} from '../server/icecat-product-images.js';
import {icecatImageCredit} from '../public/icecat-image-credit.js';

const png=Buffer.alloc(45);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(640,16);png.writeUInt32BE(480,20);
const original={id:247,name:'Проєктор',sku:'EXACT-42',brand:'Epson',image_path:'products/manual.jpg',image_paths:['products/manual.jpg'],manual_overrides:{}};
const fixture={data:{DemoAccount:false,GeneralInfo:{Brand:'Epson',BrandPartCode:'EXACT-42',IcecatId:123},Gallery:[{ID:'45',Type:'ProductImage',IsPrivate:'0',No:'1',Pic:'https://images.icecat.biz/img/gallery/123.jpg?content_token=private-content',PicWidth:640,PicHeight:480,Updated:'2026-10-27'}]}};
function setup(){
  const state={product:structuredClone(original),fixture:structuredClone(fixture),role:'owner',auth:true,now:1000000,fetches:[],rpcs:[],uploads:[],storage:new Map(),applied:0};
  const db={auth:{getUser:async()=>({data:{user:state.auth?{id:'staff'}:null}})},from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='profiles'?{role:state.role}:structuredClone(state.product)})};},storage:{from(name){assert.equal(name,'product-images');return {
    async upload(path,bytes,options){state.uploads.push({path,options});if(state.storage.has(path))return {error:{statusCode:'409'}};state.storage.set(path,Buffer.from(bytes));return {data:{path}};},
    async download(path){return {data:new Blob([state.storage.get(path)])};}
  };}}};
  const userDb={async rpc(name,args){state.rpcs.push({name,args:structuredClone(args)});
    if(name==='append_product_content_image'&&args.p_run.startsWith('00000000'))return {error:{code:state.noMigration?'PGRST202':'P0001'}};
    if(name==='start_product_import')return {data:'11111111-1111-1111-1111-111111111111'};
    if(name==='finish_product_import')return state.finishFails?{error:{code:'P0001'}}:{data:null};
    assert.equal(name,'append_product_content_image');if(state.lost)throw new Error('private-content');if(state.casError)return {error:{code:'40001',message:'private-content'}};
    state.product.image_paths.push(args.p_path);state.applied++;return {data:{id:247,unchanged:false}};
  }};
  const fetcher=async(url,options)=>{state.fetches.push({url:String(url),options});if(new URL(url).hostname==='live.icecat.biz')return new Response(JSON.stringify(state.fixture));return state.redirect?new Response('',{status:302,headers:{location:'http://127.0.0.1/'}}):new Response(state.changed?Buffer.concat([png,Buffer.from('new')]):png,{headers:{'content-type':state.mime||'image/png'}});};
  const env={ICECAT_API_TOKEN:'private-api',ICECAT_CONTENT_TOKEN:'private-content',SUPABASE_SERVICE_ROLE_KEY:'private-service'};
  const call=async(body,{token='staff'}={})=>{let status,payload;const headers={};const response={setHeader(k,v){headers[k]=v;},status(code){status=code;return this;},json(value){payload=value;return this;}};
    await handleIcecatProductImages({method:'POST',headers:{authorization:token?'Bearer '+token:''},body},response,{db,userDb,fetcher,env,now:()=>state.now});return {status,payload,headers};};
  const preview=async()=>{const listed=await call({action:'icecat-image-list',productId:247});return call({action:'icecat-image-preview',productId:247,key:listed.payload.candidates[0].key});};
  return {state,call,preview};
}

test('Icecat image candidates: exact identity, no demo/private/logos, fixed HTTPS file hosts',()=>{
  for(const url of ['http://images.icecat.biz/a','https://images.icecat.biz.evil/a','https://127.0.0.1/a','https://user@images.icecat.biz/a','https://images.icecat.biz:444/a'])assert.equal(icecatImageUrl(url),null);
  assert.ok(icecatImageUrl(fixture.data.Gallery[0].Pic));
  for(const data of [{...fixture.data,DemoAccount:true},{...fixture.data,GeneralInfo:{Brand:'Epson',BrandPartCode:'OTHER'}}])assert.throws(()=>imageCandidates({data},original));
  const variants=['BrandLogo','Screenshot','Unknown'].map(Type=>({...fixture.data.Gallery[0],Type}));
  assert.equal(imageCandidates({data:{...fixture.data,Gallery:[...variants,{...fixture.data.Gallery[0],IsPrivate:'1'},{...fixture.data.Gallery[0],TaxonomyName:'exclusive'}]}},original).length,0);
  assert.equal(imageCandidates({data:{...fixture.data,Gallery:[fixture.data.Gallery[0],fixture.data.Gallery[0]]}},original).length,1);
  assert.deepEqual(imageFileInfo(png,'image/png').width,640);
  assert.throws(()=>imageFileInfo(png,'image/svg+xml'));assert.throws(()=>imageFileInfo(Buffer.from('<svg>'),'image/png'));
  const tiny=Buffer.from(png);tiny.writeUInt32BE(20,16);assert.throws(()=>imageFileInfo(tiny,'image/png'));
});

test('Image list/preview do not write or expose tokens; signed apply appends bytes and source journal only',async()=>{
  const {state,call,preview}=setup();
  const listed=await call({action:'icecat-image-list',productId:247,url:'http://127.0.0.1',sku:'OTHER'});
  assert.equal(listed.status,200);assert.equal(listed.payload.existingCount,1);assert.ok(!JSON.stringify(listed.payload).includes('private-'));assert.ok(!JSON.stringify(listed.payload).includes('icecat.biz'));
  const prepared=await preview();assert.equal(prepared.status,200);assert.match(prepared.payload.dataUrl,/^data:image\/png;base64,/);assert.ok(!JSON.stringify(prepared.payload).includes('private-'));
  assert.equal(state.uploads.length,0);assert.equal(state.rpcs.length,0);assert.equal(prepared.headers['Cache-Control'],'no-store');
  const result=await call({action:'icecat-image-apply',plan:prepared.payload.plan});assert.equal(result.status,200);assert.equal(result.payload.applied,true);
  assert.equal(state.product.image_path,original.image_path);assert.deepEqual(state.product.image_paths.slice(0,1),original.image_paths);
  assert.equal(state.uploads[0].options.upsert,false);assert.ok(state.storage.get(result.payload.path).equals(png));
  const write=state.rpcs.find(c=>c.name==='append_product_content_image'&&!c.args.p_run.startsWith('00000000'));
  assert.deepEqual(Object.keys(write.args).sort(),['p_expected','p_id','p_path','p_run']);
  const options=state.rpcs.find(c=>c.name==='start_product_import').args.p_options;
  for(const key of ['price','stock','category','description','specifications','publish'])assert.equal(options[key],false);
  assert.equal(options.images.source,'Icecat');assert.equal(options.images.imageId,'45');assert.ok(!JSON.stringify(options).includes('private-'));
  assert.equal((await call({action:'icecat-image-apply',plan:prepared.payload.plan})).status,409);
  assert.equal(state.applied,1);
  assert.ok(state.fetches.every(c=>c.options.redirect==='error'));
  const imageFetch=state.fetches.find(c=>new URL(c.url).hostname==='images.icecat.biz');assert.ok(!imageFetch.options.headers['api-token']);
});

test('No writes for unauthorized users, forged/expired plans, stale card, changed bytes or untrusted source',async()=>{
  for(const option of ['auth','role']){const {state,call}=setup();state[option]=option==='auth'?false:'customer';assert.ok([401,403].includes((await call({action:'icecat-image-list',productId:247})).status));assert.equal(state.fetches.length,0);}
  for(const kind of ['forged','expired','stale','bytes','private','host','migration']){
    const {state,call,preview}=setup();const prepared=await preview();let plan=prepared.payload.plan;
    if(kind==='forged')plan+='x';if(kind==='expired')state.now+=600001;if(kind==='stale')state.product.image_paths.push('manual-new.jpg');if(kind==='bytes')state.changed=true;
    if(kind==='private')state.fixture.data.Gallery[0].IsPrivate='1';if(kind==='host')state.fixture.data.Gallery[0].Pic='https://localhost/a';if(kind==='migration')state.noMigration=true;
    const result=await call({action:'icecat-image-apply',plan});assert.notEqual(result.status,200,kind);assert.equal(state.uploads.length,0,kind);assert.equal(state.applied,0,kind);assert.ok(!JSON.stringify(result).includes('private-'));
  }
  const {state,preview}=setup();state.redirect=true;assert.equal((await preview()).status,422);assert.equal(state.uploads.length,0);
});

test('Lost response never retries; CAS leaves a journalled orphan instead of deleting or overwriting files',async()=>{
  for(const kind of ['lost','casError','finishFails']){
    const {state,call,preview}=setup(),prepared=await preview();state[kind]=true;
    const result=await call({action:'icecat-image-apply',plan:prepared.payload.plan});
    assert.equal(state.uploads.length,1);assert.equal(state.rpcs.filter(c=>c.name==='append_product_content_image'&&!c.args.p_run.startsWith('00000000')).length,1);
    if(kind==='lost'){assert.equal(result.payload.uncertain,true);assert.match(result.payload.error,/невідомий/);assert.ok(!state.rpcs.some(c=>c.name==='finish_product_import'));}
    if(kind==='casError'){assert.equal(result.status,409);assert.equal(state.product.image_paths.length,1);assert.ok(state.rpcs.some(c=>c.name==='finish_product_import'));}
    if(kind==='finishFails'){assert.equal(result.status,200);assert.equal(result.payload.applied,true);assert.match(result.payload.warning,/Не повторюйте/);}
  }
});

test('Icecat attribution is scoped to imported files and contains no supplied markup',()=>{
  assert.equal(icecatImageCredit(['products/normal.jpg']), '');
  const html=icecatImageCredit(['products/icecat/247/'+'a'.repeat(64)+'.png','<script>']);
  assert.match(html,/Open Icecat/);assert.match(html,/All rights reserved/);assert.match(html,/grid-column:1\/-1/);assert.ok(!html.includes('<script>'));
});

test('Real SQL: append preserves existing main/gallery/other fields, CAS, journal atomicity and admin boundaries',async()=>{
  const pg=await PGlite.create(),admin='11111111-1111-1111-1111-111111111111';
  try{
    await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${admin}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
      grant usage on schema auth to authenticated;
      create table products(id bigint generated always as identity primary key,name text,slug text,sku text,brand_id bigint,brand text,category text,price numeric,stock_quantity integer,in_stock boolean,availability_status text,description text,specifications jsonb,is_active boolean,image_path text,image_paths jsonb,manual_overrides jsonb default '{}');
      insert into products(name,sku,brand,category,price,stock_quantity,description,specifications,image_path,image_paths) values('Exact','S','Epson','projectors',123,5,'Manual description','{"Manual":"Keep"}','products/main.jpg','["products/main.jpg","products/second.jpg"]');`);
    await pg.exec(await readFile(new URL('../supabase/import-history-upgrade.sql',import.meta.url),'utf8'));
    const sql=await readFile(new URL('../supabase/icecat-product-images-upgrade.sql',import.meta.url),'utf8');await pg.exec(sql);await pg.exec(sql);
    const row=async()=>(await pg.query('select * from products where id=1')).rows[0];
    const expected=async()=>{const p=await row();return Object.fromEntries(['sku','brand','name','image_path','image_paths','manual_overrides'].map(k=>[k,p[k]??null]));};
    const rpc=async(name,args)=>(await pg.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
    const run=()=>rpc('start_product_import',['{}',1]);
    const path='products/icecat/1/'+'a'.repeat(64)+'.png',second='products/icecat/1/'+'b'.repeat(64)+'.png';
    const originalRow=await row(),before=await expected();
    await pg.exec(`set role authenticated;set request.jwt.claim.sub='${admin}';`);
    const runId=await run();await rpc('append_product_content_image',[runId,1,path,JSON.stringify(before)]);
    await pg.exec('reset role');const after=await row();assert.equal(after.image_path,originalRow.image_path);assert.deepEqual(after.image_paths,[...originalRow.image_paths,path]);
    for(const key of Object.keys(after).filter(k=>!['image_path','image_paths'].includes(k)))assert.deepEqual(after[key],originalRow[key],key);
    const history=(await pg.query('select before_values,after_values from import_changes')).rows[0];assert.deepEqual(history.before_values,{image_path:originalRow.image_path,image_paths:originalRow.image_paths});
    const current=await expected();await pg.exec('set role authenticated');
    await assert.rejects(()=>rpc('append_product_content_image',[runId,1,second,JSON.stringify(before)]),/changed after preview/);
    assert.equal((await rpc('append_product_content_image',[runId,1,path,JSON.stringify(current)])).unchanged,true);
    await assert.rejects(()=>rpc('append_product_content_image',[runId,1,'products/icecat/2/'+'a'.repeat(64)+'.png',JSON.stringify(current)]),/Invalid image path/);
    await pg.exec(`reset role;create function reject_image_history() returns trigger language plpgsql as $$begin raise exception 'History failed';end$$;create trigger reject_image_history before insert on import_changes for each row execute function reject_image_history();set role authenticated;`);
    await assert.rejects(()=>rpc('append_product_content_image',[runId,1,second,JSON.stringify(current)]),/History failed/);
    await pg.exec('reset role');assert.deepEqual((await row()).image_paths,after.image_paths);await pg.exec('drop trigger reject_image_history on import_changes');
    await pg.exec(`update products set manual_overrides='{"images":true}'`);const manual=await expected();await pg.exec('set role authenticated');
    await assert.rejects(()=>rpc('append_product_content_image',[runId,1,second,JSON.stringify(manual)]),/manually protected/);
    await pg.exec("set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'");
    await assert.rejects(()=>rpc('append_product_content_image',[runId,1,second,JSON.stringify(current)]),/Access denied/);
  }finally{await pg.close();}
});
