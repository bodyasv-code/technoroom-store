import test from 'node:test';
import assert from 'node:assert/strict';
import {kyivSourceDate,sourceDateFromName,sourceDigest,sourceFactsFor} from '../public/supplier-import-source.js';
test('file dates use Kyiv, never file modification or upload time, and invalid dates are rejected',()=>{
 assert.equal(sourceDateFromName('Прайс-лист-2026-11-12 23_37_04.xlsx'),'2026-11-12T23:37:04');
 assert.equal(kyivSourceDate('2026-11-12T23:37:04'),'2026-11-12T21:37:04.000Z');
 assert.equal(kyivSourceDate('2026-06-12T23:37'),'2026-06-12T20:37:00.000Z');
 assert.equal(sourceDateFromName('PriceAvail.xml'),'');assert.equal(sourceDateFromName('price-2026-02-30 12_00_00.xlsx'),'');
 for(const value of ['','2026-02-30T12:00','2026-03-29T03:30','2026-11-12T25:00'])assert.throws(()=>kyivSourceDate(value));
});
test('content fingerprints are deterministic for renamed identical files and change with bytes',async()=>{
 const bytes=new TextEncoder().encode('same content');
 assert.equal(await sourceDigest(bytes),await sourceDigest('same content'));
 assert.notEqual(await sourceDigest(bytes),await sourceDigest('changed content'));
 assert.match(await sourceDigest(bytes),/^[a-f0-9]{64}$/);
});
test('source facts retain enabled commercial observations even when catalog values already match',()=>{
 const row={hasPrice:true,price:100,hasStock:true,stock:2};
 assert.deepEqual(sourceFactsFor(row,{price:100,stock_quantity:2}),{price:100,stock:{quantity:2,status:'in_stock'}});
 assert.deepEqual(sourceFactsFor(row,{}, {price:false,stock:false}),{});
 assert.deepEqual(sourceFactsFor(row,null,{price:false,stock:false}),{price:100,stock:{quantity:2,status:'in_stock'}});
 assert.deepEqual(sourceFactsFor({...row,hasStock:false,hasPrice:false},{}),{});
});
