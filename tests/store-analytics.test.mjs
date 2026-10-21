import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyticsPage,createAnalyticsController,MEASUREMENT_ID,CONSENT_KEY} from '../public/store-analytics.js';
const origin='https://www.technoroom.com.ua';
const context=analyticsPage(origin+'/product.html?id=4346&email=private%40example.com&phone=123#token','https://www.google.com/search?q=private');
assert.equal(context.page_location,origin+'/product?id=4346');
assert.equal(context.page_referrer,'https://www.google.com/');
assert.equal(analyticsPage(origin+'/catalog?search=private&email=private').page_location,origin+'/catalog');
assert.equal(analyticsPage(origin+'/checkout?order=123&email=private').page_location,origin+'/checkout');
assert.equal(analyticsPage(origin+'/product?id=private').page_location,origin+'/product');
assert.equal(analyticsPage(origin+'/admin.html#access_token=private'),null);
assert.equal(analyticsPage(origin+'/orphan-image-cleanup'),null);
assert.equal(analyticsPage('http://localhost/catalog'),null);
function fixture(saved){
  const memory=new Map(saved?[[CONSENT_KEY,saved]]:[]),scripts=[],cookies=[],events={};
  const win={location:{href:origin+'/catalog?email=private',hostname:'www.technoroom.com.ua'},localStorage:{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)},addEventListener:(key,fn)=>events[key]=fn};
  const doc={referrer:'',head:{append:script=>scripts.push(script)},createElement:()=>({})};
  Object.defineProperty(doc,'cookie',{set:value=>cookies.push(value)});
  return {win,doc,scripts,cookies,events,memory};
}
const env=fixture();const controller=createAnalyticsController(env.win,env.doc);
assert.equal(controller.getChoice(),null);assert.equal(env.scripts.length,0);assert.equal(env.win.dataLayer,undefined);
controller.choose('denied');assert.equal(env.scripts.length,0);assert.equal(env.win.dataLayer,undefined);
controller.choose('granted');assert.equal(env.scripts.length,1);assert.ok(env.scripts[0].src.endsWith(MEASUREMENT_ID));
const commands=env.win.dataLayer.map(args=>Array.from(args));
assert.equal(commands[0][0],'consent');assert.equal(commands[0][2].analytics_storage,'denied');
assert.equal(commands[1][2].analytics_storage,'granted');assert.equal(commands[0][2].ad_user_data,'denied');
const config=commands.find(args=>args[0]==='config')[2];
assert.equal(config.send_page_view,false);assert.equal(config.allow_google_signals,false);
assert.equal(config.page_location,origin+'/catalog');assert.ok(!JSON.stringify(commands).includes('private'));
assert.equal(commands.filter(args=>args[1]==='page_view').length,1);
controller.choose('granted');assert.equal(env.scripts.length,1);
controller.choose('denied');assert.equal(env.win['ga-disable-'+MEASUREMENT_ID],true);
assert.ok(env.cookies.some(value=>value.startsWith('_ga=; Max-Age=0')));
assert.ok(env.cookies.every(value=>value.startsWith('_ga')));
controller.choose('granted');assert.equal(env.win['ga-disable-'+MEASUREMENT_ID],false);
assert.equal(env.win.dataLayer.filter(args=>args[1]==='page_view').length,1);
env.memory.set(CONSENT_KEY,JSON.stringify({choice:'denied',at:Date.now()}));
env.events.storage({key:CONSENT_KEY});assert.equal(controller.getChoice(),'denied');
const stored=fixture(JSON.stringify({choice:'granted',at:Date.now()}));createAnalyticsController(stored.win,stored.doc);assert.equal(stored.scripts.length,1);
for(const data of ['invalid',JSON.stringify({choice:'granted',at:0}),JSON.stringify({choice:'granted',at:Date.now()+999999}),JSON.stringify({choice:'denied',at:Date.now()})]){
  const item=fixture(data);createAnalyticsController(item.win,item.doc);assert.equal(item.scripts.length,0);
}
const blocked=fixture();blocked.win.localStorage.getItem=()=>{throw Error('blocked');};blocked.win.localStorage.setItem=()=>{throw Error('blocked');};
const transient=createAnalyticsController(blocked.win,blocked.doc);assert.equal(blocked.scripts.length,0);transient.choose('granted');assert.equal(blocked.scripts.length,1);
for(const name of ['index.html','catalog.html','product.html','articles.html','article.html','checkout.html']){
  const html=await readFile(new URL('../public/'+name,import.meta.url),'utf8');
  assert.equal((html.match(/src="store-analytics.js/g)||[]).length,1);
  assert.equal((html.match(/href="store-analytics.css/g)||[]).length,1);
  assert.ok(!html.includes('googletagmanager.com'));
}
for(const name of ['admin.html','orphan-image-cleanup.html'])assert.ok(!(await readFile(new URL('../public/'+name,import.meta.url),'utf8')).includes('store-analytics'));
console.log('Analytics: no Google script before opt-in/after refusal, expiry, storage failures, cross-tab revocation, cookie scope, sanitized URLs, one page view and storefront-only embedding: PASS (live GA receipt pending)');
