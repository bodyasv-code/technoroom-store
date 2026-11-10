import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {supplierStockNeedsConfirmation,availableStockQuantity} from '../public/supplier-availability.js';
const source=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const expression=source.match(/const inventory=(.*);\r?\n/)[1];
const inventory=Function('supplierStockNeedsConfirmation','availableStockQuantity','return '+expression)(supplierStockNeedsConfirmation,availableStockQuantity);
test('positive stock overrides stale unavailable status; zero stock cannot report available',()=>{
 assert.equal(inventory({stock_quantity:2,in_stock:true,availability_status:'out_of_stock'}),'in_stock');
 assert.equal(inventory({stock_quantity:0,in_stock:false,availability_status:'in_stock'}),'out_of_stock');
 assert.equal(inventory({stock_quantity:0,in_stock:false,availability_status:'limited_stock'}),'out_of_stock');
 assert.equal(inventory({stock_quantity:0,in_stock:false,availability_status:'under_order'}),'under_order');
});

