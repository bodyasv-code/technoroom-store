import assert from 'node:assert/strict';
import {searchScore, findSearchProducts, normalizeSearch} from '../public/store-search.js';
const products = [
  {id:1,name:'БФП Canon i-SENSYS MF664Cdw',sku:'6928C008',brand:'Canon'},
  {id:2,name:'Проєктор Epson EH-TW9400',sku:'V11H928040',brand:'Epson'},
  {id:3,name:'Картридж для Epson EH-TW9400',sku:'OTHER',brand:'Epson',description:'6928C008'},
  {id:4,name:'Прихована модифікація',sku:'6928C008',parentProductId:1},
];
assert.equal(findSearchProducts(products,'6928 C008')[0].id,1);
assert.equal(findSearchProducts(products,'eh tw9400')[0].id,2);
assert.equal(findSearchProducts(products,'MF-664Cdw')[0].id,1);
assert.equal(findSearchProducts(products,'CANON mf664cdw')[0].id,1);
assert.equal(findSearchProducts(products,'проектор epson')[0].id,2);
assert.equal(findSearchProducts(products,'немає такого товару').length,0);
assert.equal(findSearchProducts(products,'6928C008').some(p=>p.id===4),false);
assert.equal(searchScore(products[0],''),0);
assert.equal(searchScore(products[1],'canon'),-1);
assert.equal(normalizeSearch('  EH—TW9400  '),'eh tw9400');
console.log('Store search: 10 checks passed');
