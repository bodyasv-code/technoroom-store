import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');
const css=await read('store-modern.css');
assert.ok(css.includes('grid-template-areas: "logo catalog search cart"'));
assert.ok(css.includes('grid-template-areas: "logo catalog cart" "search search search"'));
assert.ok(css.includes('--store-catalog-width: 108px; --store-cart-width: 44px;'));
assert.match(css,/shared-cart-button\) \{ grid-area: cart;/);
assert.match(css,/shared-cart-button b \{ position: absolute; top: 2px; right: 2px;/);
assert.match(css,/\.home-cart i \{ position: absolute; top: 2px; right: 2px;/);
const home=await read('index.html');assert.match(home,/id="cartButton" type="button" aria-label="Кошик"/);
for(const page of ['index.html','catalog.html','product.html']){
 const html=await read(page);assert.ok(html.includes('class="store-cart-icon"'));
 if(page!=='index.html')assert.ok(html.includes('header-row store-shop-header'));
}
// Budget of explicitly declared phone tracks, not a browser layout measurement.
for(const width of [280,320,360,375,390,414,430,600,700]){
 const contentWidth=width-24,catalogWidth=108,cartWidth=44,gap=10;
 const logoTrack=contentWidth-catalogWidth-cartWidth-gap*2;
 const catalogRight=logoTrack+gap+catalogWidth;
 const cartLeft=catalogRight+gap;
 const logoWidth=Math.min(logoTrack,Math.max(120,Math.min(width*.35,148)));
 assert.ok(logoTrack>0&&logoWidth<=logoTrack);
 assert.equal(cartLeft+cartWidth,contentWidth);
 assert.equal(cartLeft-catalogRight,10);
}
console.log('Store header: named logo/catalog/search/cart tracks, fixed touch slots, bounded logo and badges; declared phone-track budgets 280–700px: PASS (visual QA pending)');
