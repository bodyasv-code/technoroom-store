import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {LEAD_EVENT,normalizeLead,reportLead} from '../public/store-lead-events.js';
import {COMMERCE_EVENT} from '../public/store-commerce-events.js';
import {CONSENT_KEY,MEASUREMENT_ID,createAnalyticsController} from '../public/store-analytics.js';

const detail={productId:4760,inquiryId:123};
function fixture({session=new Map(),saved,storageBlocked=false}={}){
  const memory=new Map(saved?[[CONSENT_KEY,saved]]:[]),handlers={},scripts=[];
  const storage=values=>({getItem:key=>{if(storageBlocked)throw Error('blocked');return values.get(key);},setItem:(key,value)=>{if(storageBlocked)throw Error('blocked');values.set(key,value);}});
  const win={location:{href:'https://www.technoroom.com.ua/product?id=4760&phone=PRIVATE#secret',hostname:'www.technoroom.com.ua'},localStorage:storage(memory),sessionStorage:storage(session),addEventListener:(name,fn)=>handlers[name]=fn};
  const doc={referrer:'https://www.google.com/search?q=PRIVATE',head:{append:script=>scripts.push(script)},createElement:()=>({}),addEventListener:(name,fn)=>handlers[name]=fn};
  const controller=createAnalyticsController(win,doc);
  return {win,controller,handlers,memory,session,scripts,emit:(data=detail)=>handlers[LEAD_EVENT]({detail:data}),leads:()=>Array.from(win.dataLayer||[],args=>Array.from(args)).filter(args=>args[1]==='generate_lead')};
}

test('only numeric product and saved inquiry IDs survive; no price, contacts or arbitrary source reaches GA',()=>{
  assert.deepEqual(normalizeLead({...detail,name:'PRIVATE',phone:'PRIVATE',email:'PRIVATE',comment:'PRIVATE',value:50000,currency:'UAH',lead_source:'PRIVATE'}),{inquiryId:'123',payload:{lead_source:'product_inquiry',item_id:'4760'}});
  for(const field of ['productId','inquiryId'])for(const value of [undefined,null,0,-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,true,{},[],['123'],'','01','1e3','PRIVATE','123 '])assert.equal(normalizeLead({...detail,[field]:value}),null);
  assert.equal(normalizeLead({...detail,productId:'1'.repeat(17)}),null);
  assert.equal(normalizeLead({...detail,inquiryId:'1'.repeat(20)}),null);
  assert.equal(normalizeLead({...detail,inquiryId:'1234567890123456789'}).inquiryId,'1234567890123456789');
});

test('reporting strips form data before the DOM event and survives blocked analytics',()=>{
  const originalDocument=globalThis.document,originalEvent=globalThis.CustomEvent,events=[];
  try{
    globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
    globalThis.document={dispatchEvent:event=>events.push(event)};
    reportLead({...detail,email:'PRIVATE',comment:'PRIVATE'});reportLead({productId:4760});
    assert.equal(events.length,1);assert.equal(events[0].type,LEAD_EVENT);
    assert.deepEqual(events[0].detail,{productId:'4760',inquiryId:'123'});
    globalThis.document.dispatchEvent=()=>{throw Error('blocked');};
    assert.doesNotThrow(()=>reportLead(detail));
  }finally{
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
    if(originalEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=originalEvent;
  }
});

test('unknown/denied/expired consent sends nothing and never replays requests after consent',()=>{
  for(const saved of [undefined,JSON.stringify({choice:'denied',at:Date.now()}),JSON.stringify({choice:'granted',at:0})]){
    const env=fixture({saved});env.emit();
    assert.equal(env.scripts.length,0);assert.equal(env.win.dataLayer,undefined);assert.equal(env.session.size,0);
    env.controller.choose('granted');assert.equal(env.leads().length,0);
  }
});

test('one consented saved request is a lead, separate from purchase, with clean context and no revenue',()=>{
  const env=fixture();env.controller.choose('granted');env.emit({...detail,phone:'PRIVATE',value:50000});env.emit();
  assert.equal(env.leads().length,1);
  const payload=env.leads()[0][2];
  assert.deepEqual(payload,{lead_source:'product_inquiry',item_id:'4760',page_location:'https://www.technoroom.com.ua/product?id=4760',page_title:'Товар — TECHNOROOM',page_referrer:'https://www.google.com/',send_to:MEASUREMENT_ID});
  assert.equal(env.session.get('technoroom-ga-lead-123'),'sent');
  env.handlers[COMMERCE_EVENT]({detail:{name:'purchase',detail:{orderId:123,items:[{item_id:'4760',price:100,quantity:1}]}}});
  assert.equal(env.win.dataLayer.filter(args=>args[1]==='purchase').length,1);
  assert.equal(env.leads().length,1);
  assert.ok(!JSON.stringify(env.win.dataLayer).includes('PRIVATE'));
});

test('same saved request is deduplicated after reload; another ID is a separate lead',()=>{
  const session=new Map(),first=fixture({session});first.controller.choose('granted');first.emit();
  const next=fixture({session});next.controller.choose('granted');next.emit();next.emit({...detail,inquiryId:124});
  assert.equal(next.leads().length,1);assert.equal(next.leads()[0][2].item_id,'4760');
});

test('revocation, including another tab, prevents further leads; no rejected request is queued',()=>{
  const env=fixture();env.controller.choose('granted');env.emit();env.controller.choose('denied');env.emit({...detail,inquiryId:124});
  env.controller.choose('granted');assert.equal(env.leads().length,1);
  env.memory.set(CONSENT_KEY,JSON.stringify({choice:'denied',at:Date.now()}));env.handlers.storage({key:CONSENT_KEY});
  env.emit({...detail,inquiryId:125});assert.equal(env.leads().length,1);
  assert.equal(env.session.has('technoroom-ga-lead-124'),false);assert.equal(env.session.has('technoroom-ga-lead-125'),false);
});

test('storage and SDK failures do not break an inquiry; a failed SDK call is not marked sent',()=>{
  const env=fixture({storageBlocked:true});env.controller.choose('granted');
  const original=env.win.gtag;env.win.gtag=()=>{throw Error('blocked');};
  assert.doesNotThrow(()=>env.emit());assert.equal(env.leads().length,0);
  env.win.gtag=original;env.emit();env.emit();assert.equal(env.leads().length,1);
});

// Exercise the actual storefront dialog and submit listener, using only a fake API and fake GA tag.
const app=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const source=app.slice(app.indexOf('function openInquiry(id) {'),app.indexOf('\nadd = (id) => {',app.indexOf('function openInquiry(id) {')));
assert.ok(source.includes("fetch('/api/inquiries'"));
function inquiry({response=async()=>({ok:true,json:async()=>({orderId:123})}),analytics=fixture()}={}){
  const controls=[{},{}],button={},close={},message={},requests=[];let submit,shown=0,closed=0;
  const form={querySelector:selector=>selector==='.inquiry-message'?message:selector==='.inquiry-close'?close:button,querySelectorAll:()=>[...controls,button],addEventListener:(name,fn)=>{if(name==='submit')submit=fn;}};
  const dialog={querySelector:()=>form,showModal:()=>shown++,close:()=>closed++};
  const open=runInNewContext('('+source+')',{
    get:()=>({id:4760,name:'Xerox',sku:'B8201V_F'}),document:{getElementById:()=>dialog},availability:()=>({button:'Уточнити ціну'}),catalogCardEscape:value=>value,compactProductName:value=>value,normalizeLead,
    reportLead:data=>analytics.emit(data),
    FormData:class{*[Symbol.iterator](){for(const name of ['name','phone','email','comment'])yield [name,'PRIVATE'];}},
    fetch:async(url,options)=>{requests.push({url,options});return response();}
  });
  open(4760);
  return {analytics,button,close,message,requests,submit:()=>submit({preventDefault(){}}),shown:()=>shown,closed:()=>closed};
}

test('opening/closing a dialog is not a lead; successful API confirmation sends exactly one lead',async()=>{
  const env=inquiry();env.analytics.controller.choose('granted');
  assert.equal(env.shown(),1);assert.equal(env.analytics.leads().length,0);env.close.onclick();assert.equal(env.closed(),1);assert.equal(env.requests.length,0);
  await env.submit();await env.submit();
  assert.equal(env.requests.length,1);assert.equal(env.analytics.leads().length,1);
  assert.match(env.message.textContent,/Запит №123 надіслано/);assert.equal(env.button.disabled,true);
  assert.ok(!JSON.stringify(env.analytics.win.dataLayer).includes('PRIVATE'));
});

test('a second submit while saving cannot create another request or lead',async()=>{
  let resolve;const wait=new Promise(done=>resolve=done),env=inquiry({response:()=>wait});env.analytics.controller.choose('granted');
  const pending=env.submit();await env.submit();assert.equal(env.requests.length,1);assert.equal(env.analytics.leads().length,0);
  resolve({ok:true,json:async()=>({orderId:123})});await pending;assert.equal(env.analytics.leads().length,1);
});

test('API rejection or network failure produces no lead and allows a deliberate retry',async()=>{
  for(const response of [async()=>({ok:false,json:async()=>({error:'Server unavailable'})}),async()=>{throw Error('Offline');}]){
    const env=inquiry({response});env.analytics.controller.choose('granted');await env.submit();
    assert.equal(env.analytics.leads().length,0);assert.equal(env.button.disabled,false);await env.submit();assert.equal(env.requests.length,2);
  }
});

test('malformed success cannot create a lead or encourage duplicate resubmission',async()=>{
  for(const json of [async()=>({}),async()=>null,async()=>({orderId:'PRIVATE'}),async()=>{throw Error('bad JSON');}]){
    const env=inquiry({response:async()=>({ok:true,json})});env.analytics.controller.choose('granted');await env.submit();await env.submit();
    assert.equal(env.analytics.leads().length,0);assert.equal(env.requests.length,1);assert.equal(env.button.disabled,true);
    assert.match(env.message.textContent,/Не отримали номер запиту/);assert.doesNotMatch(env.message.textContent,/undefined|PRIVATE/);
  }
});

test('a real dialog success works with analytics refused or the Google tag blocked',async()=>{
  const refused=inquiry();refused.analytics.controller.choose('denied');await refused.submit();
  assert.match(refused.message.textContent,/Запит №123 надіслано/);assert.equal(refused.analytics.leads().length,0);
  const blocked=inquiry();blocked.analytics.controller.choose('granted');blocked.analytics.win.gtag=()=>{throw Error('blocked');};await blocked.submit();
  assert.match(blocked.message.textContent,/Запит №123 надіслано/);assert.equal(blocked.button.disabled,true);assert.equal(blocked.analytics.leads().length,0);
});
