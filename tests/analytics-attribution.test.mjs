import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsPage,createAnalyticsController,CONSENT_KEY} from '../public/store-analytics.js';
const origin='https://www.technoroom.com.ua';
const click='AbCdEf_1234567890-test';
test('landing page retains exact-case click IDs and approved campaign fields only',()=>{
  const page=analyticsPage(origin+'/product?id=4331&gclid='+click+'&gbraid='+click+'&wbraid='+click+'&utm_source=google&utm_medium=cpc&utm_campaign=projectors&utm_id=123456&email=buyer%40example.com&phone=123&search=private&utm_term=private&utm_content=private#secret');
  const url=new URL(page.page_location);
  assert.deepEqual(Object.fromEntries(url.searchParams),{id:'4331',gclid:click,gbraid:click,wbraid:click,utm_source:'google',utm_medium:'cpc',utm_campaign:'projectors',utm_id:'123456'});
  assert.ok(!JSON.stringify(page).includes('private'));
  assert.equal(url.hash,'');
});
test('invalid, duplicate and free-text attribution never reaches page context',()=>{
  for(const query of ['gclid=short','gclid='+click+'&gclid='+click,'gclid=buyer%40example.com','gclid=123456789012','wbraid='+('a'.repeat(513)),'utm_source=buyer%40example.com&utm_medium=cpc','utm_source=google&utm_medium=private']){
    assert.equal(analyticsPage(origin+'/?'+query).page_location,origin+'/');
  }
  const url=new URL(analyticsPage(origin+'/?utm_source=google&utm_medium=cpc&utm_campaign=PrivateBuyer&utm_id=customer-name').page_location);
  assert.equal(url.searchParams.has('utm_campaign'),false);
  assert.equal(url.searchParams.has('utm_id'),false);
});
test('only current landing attribution is used; clean internal links do not invent a campaign',()=>{
  assert.equal(analyticsPage(origin+'/checkout').page_location,origin+'/checkout');
  assert.equal(analyticsPage(origin+'/admin?gclid='+click),null);
  assert.equal(analyticsPage('https://preview.example.com/?gclid='+click),null);
});
test('attribution waits for renewed consent and does not grant advertising permissions',()=>{
  const memory=new Map([['technoroom-analytics-consent-v2',JSON.stringify({choice:'granted',at:Date.now()})]]);
  const scripts=[],listeners={};
  const win={location:{href:origin+'/?gclid='+click,hostname:'www.technoroom.com.ua'},localStorage:{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)},addEventListener:(name,fn)=>listeners[name]=fn};
  const doc={referrer:'',head:{append:script=>scripts.push(script)},createElement:()=>({}),addEventListener(){}};
  const controller=createAnalyticsController(win,doc);
  assert.equal(controller.getChoice(),null);
  assert.equal(win.dataLayer,undefined);
  controller.choose('denied');assert.equal(scripts.length,0);
  controller.choose('granted');assert.equal(scripts.length,1);
  const commands=win.dataLayer.map(args=>Array.from(args));
  assert.equal(new URL(commands.find(c=>c[0]==='config')[2].page_location).searchParams.get('gclid'),click);
  const consent=commands.filter(c=>c[0]==='consent');
  assert.equal(consent[0][2].ad_storage,'denied');
  assert.equal(consent[0][2].ad_user_data,'denied');
  assert.equal(consent[1][2].ad_storage,undefined);
  assert.equal(consent[1][2].analytics_storage,'granted');
  assert.equal(JSON.parse(memory.get(CONSENT_KEY)).choice,'granted');
  assert.ok([...memory.keys()].every(key=>key.includes('consent')),'No click-ID storage');
});
test('previous refusal remains effective while previous grant cannot expand silently',()=>{
  for(const oldChoice of ['denied','granted']){
    const memory=new Map([['technoroom-analytics-consent-v2',JSON.stringify({choice:oldChoice,at:Date.now()})]]);
    const win={location:{href:origin+'/?gclid='+click,hostname:'www.technoroom.com.ua'},localStorage:{getItem:key=>memory.get(key)},addEventListener(){}};
    const doc={referrer:'',addEventListener(){}};
    assert.equal(createAnalyticsController(win,doc).getChoice(),oldChoice==='denied'?'denied':null);
    assert.equal(win.dataLayer,undefined);
  }
});
