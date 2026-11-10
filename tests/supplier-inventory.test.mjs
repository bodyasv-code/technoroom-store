import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSupplierInventory as resolve} from '../public/supplier-inventory.js';
const exact=n=>({stock_kind:'exact',stock_quantity:n});
test('MTI availability supplements an existing empty catalog product',()=>{
 assert.deepEqual(resolve({stock_quantity:0,in_stock:false},[exact(1)]),{quantity:1,inStock:true,status:'in_stock'});
});
test('supplier quantities do not add together and a supplier zero preserves catalog stock',()=>{
 assert.equal(resolve({stock_quantity:2,in_stock:true},[exact(1),exact(2)]).quantity,2);
 assert.equal(resolve({stock_quantity:2,in_stock:true},[exact(0)]).quantity,2);
});
test('latest supplier zero clears supplier availability without changing base stock',()=>{
 assert.equal(resolve({stock_quantity:0,in_stock:false},[exact(0)]).status,'out_of_stock');
});
test('unknown supplier stock cannot authorize checkout',()=>{
 assert.equal(resolve({},[{stock_kind:'needs_confirmation',stock_quantity:null}]).status,'needs_confirmation');
 assert.equal(resolve({},[{stock_kind:'exact',stock_quantity:null}]).inStock,false);
 assert.equal(resolve({},[exact(-1)]).inStock,false);
});
