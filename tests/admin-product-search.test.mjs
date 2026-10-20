import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankAdminProducts} from '../public/admin-product-search.js';
const products=[
  {id:1,name:'Картридж зі стрічкою Epson LK5YBW принтерів LW-400/LW-400VP/LW-700',sku:'C53S655010'},
  {id:2,name:'Картридж для Epson LW-400',sku:'OTHER'},
  {id:3,name:'Принтер для друку наклейок Epson LabelWorks LW-400',sku:'C51CB70080'},
  {id:4,name:'Сумісний товар',sku:'LW-400'},
];
assert.deepEqual(rankAdminProducts(products,'lw-400').map(p=>p.id),[4,3,1,2]);
assert.deepEqual(rankAdminProducts(products,'LW 400').map(p=>p.id),[4,3,1,2]);
assert.deepEqual(rankAdminProducts(products,'lw400').map(p=>p.id),[4,3,1,2]);
assert.equal(rankAdminProducts(products,'C51CB70080')[0].id,3);
assert.equal(rankAdminProducts(products,'C53S655010')[0].id,1);
assert.equal(rankAdminProducts(products,'3')[0].id,3);
assert.deepEqual(rankAdminProducts(products,'missing'),[]);
assert.equal(rankAdminProducts(products,''),products);
assert.deepEqual(rankAdminProducts(products,'Картридж').map(p=>p.id),[1,2]);
// Matches beyond page one must be ranked before slicing, not only within a page.
const many=[...Array.from({length:25},(_,id)=>({...products[0],id:100+id})),products[2]];
assert.equal(rankAdminProducts(many,'lw-400').slice(0,10)[0].id,3);
assert.equal(many[0].id,100);
const variants=[{id:5,name:'Принтер Epson LabelWorks LW-400VP',sku:'VP'},products[2]];
for(const query of ['lw-400','LW 400','lw400'])assert.equal(rankAdminProducts(variants,query)[0].id,3);
assert.equal(rankAdminProducts(variants,'lw400vp')[0].id,5);
const source=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
assert.match(source,/a=rankAdminProducts\(a,q\);const size=/);
console.log('Admin search ranking passed');
