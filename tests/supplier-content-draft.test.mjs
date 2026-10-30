import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSupplierContentDraft} from '../server/supplier-content-draft.js';
const product={name:'Проєктор Epson Test',brand:'Epson',sku:'MPN-1',category:'projectors'};
const env={ICECAT_API_TOKEN:'test-api',ICECAT_CONTENT_TOKEN:'test-content'};
function db(role='owner'){return {auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from:table=>{assert.equal(table,'profiles');return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{role}})};}};}
async function run(body,options={}){
  const result={};const response={setHeader(){},status(code){result.status=code;return this},json(value){result.body=value;return value}};
  await handleSupplierContentDraft({method:'POST',headers:{authorization:'Bearer test'},body},response,{db:db(),env,...options});return result;
}
test('new-row lookup requires admin authentication and configured private server credentials',async()=>{
  let calls=0;const fetcher=async()=>{calls++;throw Error('No request expected')};
  assert.equal((await run({product},{db:db('customer'),fetcher})).status,403);
  assert.equal((await run({product},{env:{},fetcher})).status,503);
  assert.equal((await run({product:{...product,brand:'<img>'}},{fetcher})).status,400);
  assert.equal((await run({product:{...product,category:'phones'}},{fetcher})).status,400);assert.equal(calls,0);
});
test('lookup uses fixed Icecat host, ignores client credentials and returns exact-identity content only',async()=>{
  const fetcher=async(url,options)=>{
    assert.equal(url.origin,'https://live.icecat.biz');assert.equal(url.searchParams.get('ProductCode'),'MPN-1');
    assert.equal(url.searchParams.get('lang'),'UK');assert.equal(url.searchParams.get('content'),'generalinfo,featuregroups');
    assert.equal(options.headers['api-token'],'test-api');assert.equal(options.redirect,'error');
    return new Response(JSON.stringify({data:{GeneralInfo:{Brand:'Epson',BrandPartCode:'MPN-1',IcecatId:123,Description:{LongDesc:'Опис проєктора',Language:'UK'}},FeaturesGroups:[]}}));
  };
  const result=await run({product,url:'https://untrusted.example',apiToken:'not-used'},{fetcher});
  assert.equal(result.status,200);assert.equal(result.body.preview.status,'review');assert.equal(result.body.preview.databaseWrites,0);
  assert.ok(!JSON.stringify(result.body).includes('test-api'));
  const mismatch=await run({product},{fetcher:async()=>new Response(JSON.stringify({data:{GeneralInfo:{Brand:'Other',BrandPartCode:'MPN-1'}}}))});
  assert.equal(mismatch.body.preview.status,'identity-mismatch');
});
