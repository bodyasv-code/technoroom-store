import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {orderDetailsMarkup,saveOrderChanges,orderStatuses,canRetryNotification} from '../public/order-admin.js';

const markup=orderDetailsMarkup({customer_name:'<script>test</script>',city:'Київ',address:'Відділення 1',comment:'Перший\nДругий',checkout_details:{delivery:{method:'nova_poshta'},payment:{method:'invoice'},company:{name:'TEST LTD',code:'12345678',contact:'TEST',invoiceEmail:'test@example.invalid'},notification:{status:'failed'}}});
for(const value of ['Покупець','Доставка','Оплата','Реквізити компанії','TEST LTD','За рахунком','Нова пошта','confirmOrderEmailRetry'])assert.ok(markup.includes(value));
assert.ok(!markup.includes('<script>'));assert.ok(markup.includes('&lt;script&gt;'));
assert.match(orderDetailsMarkup({}),/Статус надсилання невідомий/);
assert.ok(!orderDetailsMarkup({}).includes('retryOrderEmail'));
assert.equal(canRetryNotification({status:'accepted'}),false);
assert.equal(canRetryNotification({status:'failed'}),true);
assert.equal(canRetryNotification({status:'not_configured'}),true);
assert.equal(canRetryNotification({status:'retrying',at:'invalid'}),false);
assert.equal(canRetryNotification({status:'retrying',at:new Date(0).toISOString()},300001),true);
assert.equal(canRetryNotification({status:'retrying',at:new Date(0).toISOString()},300000),false);
let changes,guards=[];
const db={from(table){assert.equal(table,'orders');return{update(value){changes=value;return this},eq(...args){guards.push(args);return this},select:async()=>({data:[{id:1}]})}}};
for(const status of orderStatuses){guards=[];await saveOrderChanges(db,{id:1,status:'new'},status,' TEST ');assert.deepEqual(changes,{status,manager_note:'TEST'});assert.deepEqual(guards,[['id',1],['status','new']]);}
await assert.rejects(()=>saveOrderChanges(db,{id:1,status:'new'},'invalid',''),/Некоректний/);
const rejected={from(){return{update(){return this},eq(){return this},select:async()=>({data:[]})}}};
await assert.rejects(()=>saveOrderChanges(rejected,{id:1,status:'new'},'paid',''),/уже змінено/);

const source=readFileSync(new URL('../api/retry-order-mail.js',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('export default async function handler')).replace('export default ','');
let admin=true,notification={status:'failed'},claimed=true,sendCount=0,persisted;
const context={Date,JSON,Number,randomUUID:()=> 'TEST_ATTEMPT',canRetryNotification,notifyNewOrder:async()=>{sendCount++;return{status:'accepted'}},supabase:{auth:{getUser:async()=>({data:{user:{id:'TEST'}}})},from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:admin?{id:'TEST'}:null}),single:async()=>({data:{id:1,checkout_details:{company:{name:'TEST LTD'},notification}}}),update(value){persisted=value;return{eq(){return this},select:async()=>({data:claimed?[{id:1}]:[]})}}}}}};
vm.createContext(context);vm.runInContext(functionSource,context);
const response={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
const request={method:'POST',headers:{authorization:'Bearer TEST'},body:{orderId:1,confirmPossibleDuplicate:true,recipient:'attacker@example.invalid'}};
await context.handler({...request,headers:{}},response);assert.equal(response.code,401);assert.equal(sendCount,0);
admin=false;await context.handler(request,response);assert.equal(response.code,403);assert.equal(sendCount,0);admin=true;
await context.handler({...request,body:{orderId:1}},response);assert.equal(response.code,400);assert.equal(sendCount,0);
notification={status:'accepted'};await context.handler(request,response);assert.equal(response.code,409);assert.equal(sendCount,0);
notification={status:'failed'};claimed=false;await context.handler(request,response);assert.equal(response.code,409);assert.equal(sendCount,0);
claimed=true;await context.handler(request,response);assert.equal(response.code,202);assert.equal(sendCount,1);
assert.deepEqual(Object.keys(persisted),['checkout_details']);assert.equal(persisted.checkout_details.company.name,'TEST LTD');assert.equal(persisted.checkout_details.notification.status,'retrying');
notification=persisted.checkout_details.notification;await context.handler(request,response);assert.equal(response.code,409);assert.equal(sendCount,1);
console.log('Order blocks, all statuses, conflicts, admin-only retry and duplicate lease: OK');
