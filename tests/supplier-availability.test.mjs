import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierStockNeedsConfirmation} from '../public/supplier-availability.js';
import {mtiStock} from '../public/mti-price.js';
import {prepareMtiOfferBatch} from '../public/mti-offer-import.js';
import {mtiOfferReviewMarkup} from '../public/mti-offer-admin.js';

test('explicit MTI clarification is distinct from empty, zero and positive stock',()=>{
  assert.equal(mtiStock(' Потребує уточнення ').kind,'needs_confirmation');
  assert.equal(mtiStock('Потребує уточнення').quantity,null);
  assert.equal(mtiStock('').kind,'unknown');
  assert.equal(mtiStock('-').kind,'unknown');
  assert.equal(mtiStock('0').kind,'exact');
  assert.equal(mtiStock('3').quantity,3);
});
test('uncertain supplier stock permits inquiry, while confirmed catalog stock takes priority',()=>{
  assert.equal(supplierStockNeedsConfirmation({supplier_stock_uncertain:true,in_stock:false,stock_quantity:0}),true);
  assert.equal(supplierStockNeedsConfirmation({supplier_stock_uncertain:true,in_stock:true,stock_quantity:3}),false);
  assert.equal(supplierStockNeedsConfirmation({supplierStockUncertain:true,stock:false,stockQuantity:0}),true);
  assert.equal(supplierStockNeedsConfirmation({supplierStockUncertain:true,stock:true,stockQuantity:1}),false);
  assert.equal(supplierStockNeedsConfirmation({in_stock:false,stock_quantity:0}),false);
});
test('uncertain offer writes null quantity and survives review without guessing stock',()=>{
  const row={key:'one',supplierId:'3703528',supplierSku:'V12H002AG0',sku:'V12H002AG0',vendor:'Epson',category:'erc-display-06',
    issues:[],hasPrice:true,price:80039,supplierPrice:null,hasStock:false,stock:0,stockDetail:mtiStock('Потребує уточнення'),reserved:0,sourceRow:5,
    content:{name:'Екран Epson ELPSC36',specifications:{}}};
  const plan=prepareMtiOfferBatch([row],[]);
  assert.equal(plan.ready.length,1);
  assert.equal(plan.ready[0].offer.quantity,null);
  assert.equal(plan.ready[0].offer.stockKind,'needs_confirmation');
  assert.match(mtiOfferReviewMarkup(plan),/Наявність уточнюється/);
  assert.equal(prepareMtiOfferBatch([{...row,stockDetail:mtiStock('')}],[]).ready.length,0);
  assert.equal(prepareMtiOfferBatch([{...row,reserved:1}],[]).ready.length,0);
});
