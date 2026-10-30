import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMtiOfferBatch,mtiDraftContent,applyMtiOfferBatch} from '../public/mti-offer-import.js';
import {mtiOfferReviewMarkup} from '../public/mti-offer-admin.js';
const row={key:'one',supplierId:'source-1',supplierSku:'MPN-1',sku:'MPN-1',manufacturerPartNumber:'MPN-1',vendor:'Epson',category:'projectors',name:'Проєктор Epson Test',
  issues:[],hasPrice:true,price:12000,supplierPrice:10000,hasStock:true,stock:2,stockDetail:{kind:'exact',quantity:2},reserved:0,sourceRow:5,
  content:{name:'Проєктор Epson Test',specifications:{Гарантія:'24 міс.'}}};
const existing={id:7,sku:'MPN-1',brand:'Epson',category:'projectors',price:9999,description:'Ручний опис',stock_quantity:7,image_path:'manual.jpg'};
test('offers keep MTI commercial values separate and never patch existing cards',()=>{
  const before=structuredClone(existing),plan=prepareMtiOfferBatch([row],[existing]);
  assert.equal(plan.ready.length,1);const offer=plan.ready[0].offer;
  assert.equal(offer.expectedProductId,7);assert.equal(offer.retailPrice,12000);assert.equal(offer.supplierPrice,10000);
  assert.equal(offer.quantity,2);assert.equal(offer.draft,null);assert.deepEqual(existing,before);
  assert.deepEqual(Object.keys(offer.contentEvidence).sort(),['photosImported','status']);
});
test('uncertain identities, stock, category, excluded products and variants cannot enter the write plan',()=>{
  for(const edit of [{issues:['review']},{hasStock:false},{stockDetail:{kind:'at_least'}},{hasPrice:false},{reserved:1},{supplierSku:'OTHER'}])assert.equal(prepareMtiOfferBatch([{...row,...edit}],[]).ready.length,0);
  assert.equal(prepareMtiOfferBatch([row],[{...existing,brand:'Canon'}]).ready.length,0);
  assert.equal(prepareMtiOfferBatch([row],[{...existing,category:'office-accessories'}]).ready.length,0);
  assert.equal(prepareMtiOfferBatch([row],[{...existing,parent_product_id:4}]).ready.length,0);
  assert.equal(prepareMtiOfferBatch([row],[],new Map(),['mpn-1']).ready.length,0);
});
const preview={status:'review',icecatId:123,product:{sku:'MPN-1',brand:'Epson'},rows:[],descriptionDraft:{available:true,languages:['UK'],translation:{remainingRussian:false},paragraphs:['Перевірений проєктор <test>'],bullets:['Для презентацій'],html:'<script>bad()</script>'}};
test('new drafts take only the exact Icecat identity, gate language and rebuild escaped text',()=>{
  const good=mtiDraftContent(row,preview);assert.ok(good.description.includes('&lt;test&gt;'));assert.ok(!good.description.includes('<script>'));
  assert.equal(good.evidence.descriptionNeedsReview,true);assert.equal(good.evidence.photosImported,false);
  for(const changed of [{...preview,status:'demo-blocked'},{...preview,product:{sku:'OTHER',brand:'Epson'}},{...preview,descriptionDraft:{...preview.descriptionDraft,languages:['RU']}},{...preview,descriptionDraft:{...preview.descriptionDraft,translation:{remainingRussian:true}}}])assert.equal(mtiDraftContent(row,changed).description,null);
  assert.equal(prepareMtiOfferBatch([row],[]).ready[0].offer.draft.description,null);
  assert.ok(prepareMtiOfferBatch([row],[],new Map([['one',preview]])).ready[0].offer.draft.description);
  const html=mtiOfferReviewMarkup(prepareMtiOfferBatch([{...row,name:'<img>'}],[]));assert.ok(!html.includes('<img>'));assert.match(html,/прихован/);
});
test('writer uses one atomic idempotent RPC and fails closed if database setup is missing',async()=>{
  const plan=prepareMtiOfferBatch([row],[existing]);let args;
  const client={rpc:async(name,value)=>{assert.equal(name,'apply_mti_offer_batch');args=value;return {data:{offers:1,published:0,createdDrafts:0,linkedExisting:1}};}};
  await applyMtiOfferBatch(client,plan,{requestId:'request',sourceName:'price.xlsx'});
  assert.equal(args.p_rows[0].expectedProductId,7);assert.equal(args.p_request,'request');
  await assert.rejects(()=>applyMtiOfferBatch({rpc:async()=>({error:{code:'PGRST202'}})},plan,{}),/оновлення бази/);
  await assert.rejects(()=>applyMtiOfferBatch(client,{ready:[]},{}),/від 1 до 100/);
  await assert.rejects(()=>applyMtiOfferBatch({rpc:async()=>({data:{offers:1,published:1}})},plan,{}),/Неочікувана/);
});
