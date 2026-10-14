import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {orderMail,sendMicrosoftMail,notifyNewOrder,mailbox} from '../api/microsoft-order-mail.js';
const order={id:99,total:432259.5,checkout_details:{customer:{phone:'private',lastName:'private'}},
  customer_name:'PRIVATE NAME',order_items:[{product_name:'TEST Product',unit_price:216129.75,quantity:2}]};
const message=orderMail(order);
assert.match(message.subject,/99/);assert.match(message.text,/432/);assert.match(message.text,/TEST Product/);
assert.ok(!message.text.includes('PRIVATE'));assert.ok(!message.text.includes('private'));
assert.equal((await sendMicrosoftMail(message,{secret:''})).status,'not_configured');
const calls=[];
const fetcher=async(url,options)=>{calls.push({url,options});return calls.length===1
  ?{ok:true,json:async()=>({access_token:'TEST_TOKEN'})}:{status:202};};
assert.equal((await sendMicrosoftMail(message,{secret:'TEST_SECRET',fetcher})).status,'accepted');
assert.ok(calls[0].url.startsWith('https://login.microsoftonline.com/'));
assert.equal(calls[1].url,'https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(mailbox)+'/sendMail');
const sent=JSON.parse(calls[1].options.body);
assert.deepEqual(sent.message.toRecipients,[{emailAddress:{address:mailbox}}]);
assert.equal(sent.message.body.contentType,'Text');assert.equal(sent.saveToSentItems,true);
await assert.rejects(()=>sendMicrosoftMail(message,{secret:'TEST',fetcher:async()=>({ok:false,status:401})}),/mail_auth_401/);
let count=0;
await assert.rejects(()=>sendMicrosoftMail(message,{secret:'TEST',fetcher:async()=>++count===1
  ?{ok:true,json:async()=>({access_token:'TEST'})}:{status:403}}),/mail_send_403/);
let stored;
const db={from(){return {select(){return this},update(data){stored=data;return this},eq(){return this},
  single:async()=>({data:order}),then(resolve){return Promise.resolve({error:null}).then(resolve)}}}};
assert.equal((await notifyNewOrder(db,99,{sender:async()=>({status:'accepted'})})).status,'accepted');
assert.equal(stored.checkout_details.customer.lastName,'private');
assert.equal(stored.checkout_details.notification.status,'accepted');
const priorWarn=console.warn;console.warn=()=>{};
try {const result=await notifyNewOrder(db,99,{sender:async()=>{throw new Error('SECRET CONTENT');}});
  assert.equal(result.status,'failed');assert.equal(result.code,'mail_internal_error');
  assert.ok(!JSON.stringify(stored).includes('SECRET CONTENT'));
}finally{console.warn=priorWarn;}
console.log('Microsoft mail fixed recipient, privacy, failures and saved status: OK');
const endpoint=readFileSync(new URL('../api/test-order-mail.js',import.meta.url),'utf8');
const handler=endpoint.slice(endpoint.indexOf('export default async function handler')).replace('export default ','');
let authorized=false,mailCalls=0;
const context={lastTest:0,Date,sendMicrosoftMail:async()=>{mailCalls++;return {status:'accepted'};},
  supabase:{auth:{getUser:async()=>({data:{user:{id:'TEST_USER'}}})},from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:authorized?{id:'TEST_USER'}:null})}}}};
vm.createContext(context);vm.runInContext(handler,context);
const response={statusCode:0,body:null,setHeader(){},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
await context.handler({method:'POST',headers:{}},response);assert.equal(response.statusCode,401);assert.equal(mailCalls,0);
await context.handler({method:'POST',headers:{authorization:'Bearer TEST_SESSION'}},response);assert.equal(response.statusCode,403);assert.equal(mailCalls,0);
authorized=true;
await context.handler({method:'POST',headers:{authorization:'Bearer TEST_SESSION'}},response);assert.equal(response.statusCode,202);assert.equal(mailCalls,1);
await context.handler({method:'POST',headers:{authorization:'Bearer TEST_SESSION'}},response);assert.equal(response.statusCode,429);assert.equal(mailCalls,1);
