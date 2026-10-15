import assert from 'node:assert/strict';
import {matchesOrderSearch,hasFailedOrderEmail} from '../public/order-admin.js';
const products=new Map([[45,{id:45,name:'Нова назва',sku:'MR.JWT11.005'}],[46,{id:46,name:'Інший товар',sku:'OTHER-001'}]]);
const order={id:321,customer_name:'Тест Покупець',customer_phone:'+380 50 123-45-67',customer_email:'test@example.invalid',comment:'Уточнити строк',order_items:[{product_id:45,product_name:'Проєктор Acer Vero FHD'}]};
for(const query of ['', '321','ТЕСТ покупець','380501234567','test@example.invalid','Уточнити','acer vero','MR.JWT11.005','mr-jwt11-005','Нова назва'])assert.equal(matchesOrderSearch(order,query,products),true,query);
assert.equal(matchesOrderSearch(order,'OTHER-001',products),false,'no match on unrelated catalog products');
assert.equal(matchesOrderSearch(order,'неіснуючий',products),false);
assert.equal(matchesOrderSearch({...order,order_items:[{product_id:null,product_name:'Видалений TEST-777'}]},'test777',products),true);
assert.equal(matchesOrderSearch({...order,order_items:[{product_id:null,product_name:'Видалений'}]},'MR.JWT11.005',products),false);
assert.equal(matchesOrderSearch({id:1},'Проєктор',products),false);
assert.equal(matchesOrderSearch({order_items:[{sku:'HISTORICAL-9'}]},'historical9'),true);
for(const status of ['failed','not_configured'])assert.equal(hasFailedOrderEmail({checkout_details:{notification:{status}}}),true);
for(const status of ['accepted','retrying','unknown',undefined])assert.equal(hasFailedOrderEmail({checkout_details:{notification:{status}}}),false);
assert.equal(hasFailedOrderEmail({}),false);
// Both independent filters must apply: a failed email on a matching new order.
const orders=[{...order,status:'new',checkout_details:{notification:{status:'failed'}}},{...order,id:322,status:'paid',checkout_details:{notification:{status:'failed'}}},{...order,id:323,status:'new',checkout_details:{notification:{status:'accepted'}}}];
assert.deepEqual(orders.filter(o=>matchesOrderSearch(o,'mrjwt11005',products)&&o.status==='new'&&hasFailedOrderEmail(o)).map(o=>o.id),[321]);
console.log('Order product/SKU search, deleted products, email failure and combined filters: OK');
