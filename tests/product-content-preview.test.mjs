import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildContentPreview,contentPreviewMarkup} from '../public/product-content-preview.js';
import {handleProductContentPreview as handle} from '../server/product-content-preview.js';
const product={id:4331,name:'Canon <test>',sku:'6928C001',brand:'Canon',category:'office-mfp-color',specifications:{'Двосторонній друк':'Ручний','Wi-Fi':'Так','Ручне поле':'Захищено'},manual_overrides:{specifications:{'Двосторонній друк':true,'Ручне поле':true}}};
const fixture={msg:'OK',data:{DemoAccount:false,GeneralInfo:{Brand:'Canon',BrandPartCode:'6928C001',IcecatId:123,Description:{LongDesc:'<script>bad()</script>'}},FeaturesGroups:[{FeatureGroup:{Name:{Value:'Друк'}},Features:[
  {Feature:{ID:1,Name:{Value:'Duplex printing mode',Language:'EN'}},PresentationValue:'Auto'},
  {Feature:{ID:2,Name:{Value:'Wi-Fi',Language:'UK'}},PresentationValue:'Ні'},
  {Feature:{ID:3,Name:{Value:'Ручне поле',Language:'UK'}},PresentationValue:'Інше'},
  {Feature:{ID:4,Name:{Value:'<img src=x onerror=bad()>',Language:'UK'}},PresentationValue:'<script>alert(1)</script>'},
]}],Gallery:[{}]}};
const before=JSON.stringify({product,fixture});
const result=buildContentPreview(product,fixture);
assert.equal(result.status,'review');assert.equal(result.databaseWrites,0);assert.equal(result.rows[0].status,'manual-protected');
assert.equal(result.rows[0].current[0].value,'Ручний');assert.ok(result.rows[0].reasons.includes('language-review'));
assert.equal(result.rows[1].status,'conflict');assert.equal(result.rows[2].status,'manual-protected');
assert.ok(result.rows.every(row=>row.automatic===false));assert.equal(JSON.stringify({product,fixture}),before);
const html=contentPreviewMarkup(result);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('data-review-approve'));
assert.equal(buildContentPreview({...product,sku:'6928C001-OTHER'},fixture).rows.length,0);
assert.equal(buildContentPreview(product,{data:{...fixture.data,DemoAccount:true}}).status,'demo-blocked');
assert.equal(buildContentPreview(product,{data:{...fixture.data,ContentErrors:['bad-section']}}).status,'incomplete-response');
assert.equal(buildContentPreview(product,{StatusCode:9}).status,'unavailable');
const deleted={...product,specifications:{},manual_overrides:{specifications:{'Wi-Fi':true}}};
assert.equal(buildContentPreview(deleted,fixture).rows.find(r=>r.canonical==='Wi-Fi').status,'manual-protected','Deleted manual key stays protected');
let queries=[],fetches=[];
function database({role='owner',auth=true,row=product,profileError=null,productError=null}={}){
  return {auth:{getUser:async()=>({data:{user:auth?{id:'staff'}:null},error:auth?null:{}})},from(table){
    const query={select(fields){queries.push({table,fields});return query;},eq(){return query;},async maybeSingle(){return table==='profiles'?{data:role?{role}:null,error:profileError}:{data:row,error:productError};}};
    return query;
  }};
}
async function call({body={action:'preview',productId:4331},method='POST',token='staff',db=database(),env={ICECAT_API_TOKEN:'private-api',ICECAT_CONTENT_TOKEN:'private-content'},fetcher}={}){
  let status,payload,headers={};
  const res={setHeader(k,v){headers[k]=v;},status(code){status=code;return res;},json(value){payload=value;return res;}};
  await handle({method,body,headers:{authorization:token?'Bearer '+token:''}},res,{db,env,fetcher:fetcher||(async(url,options)=>{fetches.push({url,options});return new Response(JSON.stringify(fixture),{status:200,headers:{'content-type':'application/json'}});})});
  return {status,payload,headers};
}
assert.equal((await call({method:'GET'})).status,405);
assert.equal((await call({token:''})).status,401);
assert.equal((await call({db:database({auth:false})})).status,401);
assert.equal((await call({db:database({role:'customer'})})).status,403);
assert.equal((await call({db:database({role:'owner',profileError:{}})})).status,403);
assert.equal(fetches.length,0,'Unauthorized requests never contact Icecat');
const noConfig=await call({env:{},body:{action:'status'}});
assert.deepEqual(noConfig.payload,{configured:false,readOnly:true,demoAllowed:false});
assert.equal((await call({env:{}})).status,503);assert.equal(fetches.length,0);
for(const id of ['4331',0,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal((await call({body:{action:'preview',productId:id}})).status,400);
assert.equal((await call({body:{action:'apply',productId:4331}})).status,400);
assert.equal((await call({db:database({row:null})})).status,404);
assert.equal((await call({db:database({productError:{}})})).status,503);
const success=await call({db:database({role:'manager'}),body:{action:'preview',productId:4331,url:'https://evil.example',brand:'OTHER',sku:'OTHER'}});
assert.equal(success.status,200);assert.equal(success.headers['Cache-Control'],'no-store');assert.equal(success.payload.preview.rows[0].status,'manual-protected');
const request=fetches[0];assert.equal(request.url.origin,'https://live.icecat.biz');assert.equal(request.url.searchParams.get('ProductCode'),'6928C001');assert.equal(request.url.searchParams.get('Brand'),'Canon');assert.equal(request.url.searchParams.get('content'),'generalinfo,featuregroups,image,gallery');
assert.equal(request.options.redirect,'error');assert.equal(request.options.method,'GET');assert.equal(request.options.headers['api-token'],'private-api');assert.ok(!request.url.toString().includes('private-'));
assert.ok(!JSON.stringify(success.payload).includes('private-'));assert.ok(!JSON.stringify(success.payload).includes('<script>bad()'));
const unavailable=await call({fetcher:async()=>new Response(JSON.stringify({Message:'private-content'}),{status:403})});
assert.equal(unavailable.status,502);assert.ok(!JSON.stringify(unavailable).includes('private-content'));
assert.equal((await call({fetcher:async()=>new Response('{}',{status:429})})).status,429);
assert.equal((await call({fetcher:async()=>new Response('{}',{headers:{'content-length':'2000001'}})})).status,502);
assert.equal((await call({fetcher:async()=>new Response('not-json')})).status,502);
const failed=await call({fetcher:async()=>{throw new Error('private-api private-content');}});assert.ok(!JSON.stringify(failed).includes('private-'));
const ui=await readFile(new URL('../public/product-content-preview-admin.js',import.meta.url),'utf8');
assert.ok(!/\.from\(|\.update\(|\.insert\(|localStorage|sessionStorage|openicecat-live/u.test(ui));
assert.match(ui,/pending=true/);assert.match(ui,/AbortSignal.timeout\(25000\)/);
console.log('Read-only content comparison: exact identity, demo block, manual tombstones, conflicts, language flags, XSS escaping; owner/manager auth, fixed upstream, no secrets or database writes, bounded body and errors: PASS');
