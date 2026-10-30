import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBulkProductContent,commitBulkProductContent} from '../public/bulk-product-content.js';
const product={id:7,name:'Проєктор тест',sku:'MPN-7',brand:'Epson',category:'projectors',description:null,specifications:{Гарантія:'24 міс.'},manual_overrides:{},is_active:false};
const preview={status:'review',icecatId:77,product:{id:7,sku:'MPN-7',brand:'Epson'},descriptionDraft:{available:true,languages:['UK'],translation:{remainingRussian:false},paragraphs:['Проєктор для навчання'],bullets:[]},rows:[{status:'new',mapping:'feature-id',canonical:'Яскравість',value:'3000 лм',language:'UK',reasons:[]}]};
test('only empty description and absent mapped fields are offered; commercial data and visibility never enter patch',()=>{
  const plan=prepareBulkProductContent(product,preview);
  assert.deepEqual(Object.keys(plan.patch).sort(),['description','specifications']);
  assert.match(plan.patch.description,/Проєктор для навчання/);
  assert.deepEqual(plan.patch.specifications,{Гарантія:'24 міс.',Яскравість:'3000 лм'});
  assert.equal(plan.expected.is_active,false);assert.equal(product.description,null);
  const existing=prepareBulkProductContent({...product,description:'Ручний опис',specifications:{Яскравість:'4000 лм'}},preview);
  assert.deepEqual(existing.patch,{});
});
test('identity, language, manual tombstones, related context, ambiguous duplicate features fail closed',()=>{
  for(const change of [{status:'demo-blocked'},{product:{...preview.product,id:8}},{product:{...preview.product,brand:'Canon'}}])assert.deepEqual(prepareBulkProductContent(product,{...preview,...change}).patch,{});
  const field=preview.rows[0];
  for(const edit of [{language:'RU'},{status:'conflict'},{reasons:['technical-review']},{relatedCurrent:[{name:'Контекст'}]},{mapping:null},{value:'<img>'}])assert.ok(!prepareBulkProductContent(product,{...preview,rows:[{...field,...edit}]}).patch.specifications);
  for(const marks of [{verified_specifications:true},{specifications:{Яскравість:true}}])assert.ok(!prepareBulkProductContent({...product,manual_overrides:marks},preview).patch.specifications);
  assert.ok(!prepareBulkProductContent(product,{...preview,rows:[field,{...field,value:'4000 лм'}]}).patch.specifications);
  assert.ok(!prepareBulkProductContent(product,{...preview,descriptionDraft:{...preview.descriptionDraft,languages:['RU']}}).patch.description);
});
function dbMock({current=product,failure=null}={}){
  const calls=[];return {calls,from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:structuredClone(current)}}}},async rpc(name,args){calls.push({name,args});if(name==='start_product_import')return {data:'run-1'};if(name==='finish_product_import')return {data:{}};if(failure==='throw')throw new Error('network');if(failure)return {error:{code:failure,message:'stale'}};return {data:{id:7,unchanged:false}}}};
}
test('journal write carries optimistic identity/content snapshot and never publishes',async()=>{
  const db=dbMock(),result=await commitBulkProductContent(db,[prepareBulkProductContent(product,preview)]);
  assert.equal(result.applied,1);assert.equal(result.runId,'run-1');
  const write=db.calls.find(c=>c.name==='apply_product_import');
  assert.equal(write.args.p_expected.brand,'Epson');assert.equal(write.args.p_expected.description,null);assert.equal(write.args.p_expected.is_active,false);assert.equal(write.args.p_images,false);
  assert.equal(db.calls.filter(c=>c.name==='finish_product_import').length,1);
  const stale=dbMock({current:{...product,description:'Змінено після перегляду'}});
  await assert.rejects(()=>commitBulkProductContent(stale,[prepareBulkProductContent(product,preview)]),/змінилася/);assert.equal(stale.calls.length,0);
});
test('lost responses stop batch and leave journal unfinished without retry',async()=>{
  const db=dbMock({failure:'throw'}),result=await commitBulkProductContent(db,[prepareBulkProductContent(product,preview)]);
  assert.equal(result.uncertain,true);assert.equal(db.calls.filter(c=>c.name==='apply_product_import').length,1);
  assert.ok(!db.calls.some(c=>c.name==='finish_product_import'));
  await assert.rejects(()=>commitBulkProductContent(db,[]),/від 1 до 20/);
});
