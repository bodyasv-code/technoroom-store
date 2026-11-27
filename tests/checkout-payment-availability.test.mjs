import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {normalizeOrder} from '../api/order-input.js';
const body={customer:{name:'Тест',lastName:'Покупець',phone:'+380500000000'},delivery:{method:'pickup',city:'Київ'},payment:{method:'cod'},consent:true,items:[{productId:1,quantity:1,expectedUnitPrice:100}]};
test('only connected methods are accepted for new orders; card checkout never reaches the order RPC',async()=>{
  for(const method of ['cod','invoice'])assert.equal(normalizeOrder({...body,payment:{method}}).payment.method,method);
  assert.throws(()=>normalizeOrder({...body,payment:{method:'card'}}),/Онлайн-оплата тимчасово недоступна/);
  const api=await readFile(new URL('../api/orders.js',import.meta.url),'utf8'),source=api.slice(api.indexOf('export default async function handler')).replace('export default ','');
  let called=0;const scope={normalizeOrder,supabase:{rpc(){called++;throw Error('must not save');}}};
  const handler=runInNewContext('('+source+')',scope),response={statusCode:0,status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  await handler({method:'POST',body:{...body,payment:{method:'card'}}},response);assert.equal(response.statusCode,400);assert.equal(called,0);
});
test('unavailable card method is disabled in the first HTML; stale form submissions are rejected before fetching',async()=>{
  const html=await readFile(new URL('../public/checkout.html',import.meta.url),'utf8'),app=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  assert.match(html,/<input[^>]*name="paymentMethod"[^>]*value="card"[^>]*disabled/);
  assert.match(html,/Карткою онлайн<\/b><small>Тимчасово недоступна/);
  const start=app.lastIndexOf('  form.onsubmit = async (event) => {'),end=app.indexOf('\n  };\n\n};',start);
  const source=app.slice(start,end+5).trim().replace(/^form.onsubmit = /,'').replace(/;$/,'');let requests=0,notice='';
  const handler=runInNewContext('('+source+')',{cart:[{productId:1,quantity:1}],get:()=>({id:1}),availability:()=>({orderable:true}),commerceItems:()=>[],salePrice:()=>100,FormData:class{*[Symbol.iterator](){yield ['paymentMethod','card'];}},form:{querySelector:()=>({})},fetch:()=>requests++,alert:value=>notice=value});
  await handler({preventDefault(){}});assert.equal(requests,0);assert.match(notice,/Онлайн-оплата тимчасово недоступна/);
});
