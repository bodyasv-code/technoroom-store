import assert from 'node:assert/strict';
import {orderActionSummary,orderActionFilters,mountOrderActions} from '../public/order-actions.js';
import {hasFailedOrderEmail} from '../public/order-admin.js';
import {supplyState} from '../public/order-supply.js';
const orders=[
  {id:1,status:'new',supply_expected_on:'2026-10-15',checkout_details:{notification:{status:'failed'}}},
  {id:2,status:'supplier_check',supply_expected_on:'2026-10-16',checkout_details:{notification:{status:'accepted'}}},
  {id:3,status:'shipped',supply_expected_on:'2026-10-15'},
  {id:4,status:'completed',supply_expected_on:'2026-10-15'},
  {id:5,status:'cancelled',supply_expected_on:'2026-10-15',checkout_details:{notification:{status:'not_configured'}}},
  {id:6,status:'new',checkout_details:{notification:{status:'retrying'}}},
  {id:7,status:'processing',supply_expected_on:'invalid'},
];
assert.deepEqual(orderActionSummary([], '2026-10-16'),{new:0,overdue:0,email:0});
const counts=orderActionSummary(orders,'2026-10-16');assert.deepEqual(counts,{new:2,overdue:1,email:2});
for(const kind of ['new','overdue','email']){
  const filters=orderActionFilters(kind);assert.equal(filters.search,'');
  const filtered=orders.filter(order=>(filters.status==='all'||order.status===filters.status)&&(filters.email==='all'||hasFailedOrderEmail(order))&&(filters.supply==='all'||supplyState(order,'2026-10-16')==='overdue'));
  assert.equal(filtered.length,counts[kind],'card count equals the destination filter');
}
assert.equal(orderActionFilters('__proto__'),null);assert.equal(orderActionFilters('unknown'),null);
let chosen,panel;
const hint={textContent:''};
const buttons=['new','overdue','email'].map(kind=>({dataset:{orderAction:kind},disabled:true,strong:{textContent:'—'},classList:{toggle(){}},querySelector(){return this.strong}}));
const root={querySelector(){return{append(value){panel=value}}},createElement(){return{setAttribute(){},querySelectorAll(){return buttons},querySelector(){return hint}}}};
const render=mountOrderActions({root,onSelect:filters=>{chosen=filters}});
assert.ok(panel);render(orders,{ready:false,today:'2026-10-16'});buttons[0].onclick();assert.equal(chosen,undefined);assert.equal(buttons[0].strong.textContent,'—');
render(orders,{today:'2026-10-16'});assert.equal(buttons[0].strong.textContent,'2');buttons[2].onclick();assert.deepEqual(chosen,{search:'',status:'all',supply:'all',email:'failed'});
render([],{today:'2026-10-16'});assert.equal(buttons[0].strong.textContent,'0');assert.equal(buttons[0].disabled,false);
console.log('Action counts match filters, loading/empty states, overlap, closed orders and safe navigation presets: OK');
