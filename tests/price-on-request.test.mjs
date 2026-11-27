import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PRICE_ON_REQUEST,hasProductPrice,formatProductPrice,discountedPrice} from '../public/store-pricing.js';
import {productAvailability,productSeoDetails,selectProductForPage,htmlEscape} from '../public/product-seo.js';
import {renderProductPage} from '../server/product-page.js';

const product={id:4760,name:'Базовий блок Xerox AltaLink',sku:'B8201V_F',brand:'Xerox',category:'office-mfp-mono',price:0,stock_quantity:1,is_active:true};
const template=await readFile(new URL('../server/product-template.html',import.meta.url),'utf8');
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const data=item=>({base:item,item,variants:[],categories:[],promotions:[],promotionLinks:new Map()});

test('missing, zero and invalid prices are quotes; a real amount retains its currency and rounding',()=>{
  for(const value of [0,'0','0.00',null,undefined,'',NaN,Infinity,-1,'not a price',false,[],[12],{}]){
    assert.equal(hasProductPrice(value),false);
    assert.equal(formatProductPrice(value),PRICE_ON_REQUEST);
  }
  assert.equal(formatProductPrice(123.5),new Intl.NumberFormat('uk-UA').format(123.5)+' ₴');
  assert.equal(formatProductPrice('123.50',price=>'UAH '+price),'UAH 123.5');
  assert.equal(discountedPrice(19.99,{discount_type:'percent',discount_value:5}),18.99);
});

test('first HTML and Product metadata never advertise an unpriced product as free or directly purchasable',()=>{
  for(const price of [0,null,undefined,-1,NaN]){
    const item={...product,price},html=renderProductPage(template,data(item),{});
    const schema=JSON.parse(html.match(/id="product-schema">([^]*?)<\/script>/)[1]);
    assert.match(html,/<strong class="detail-price">Ціна за запитом<\/strong>/);
    assert.match(html,/href="\/contacts">Уточнити ціну<\/a>/);
    assert.doesNotMatch(html,/0 ₴|Ціна вказана за 1 одиницю товару/);
    assert.equal(schema.offers,undefined);
    assert.equal(productAvailability(item).orderable,false);
    assert.equal(productAvailability(item).label,'Закінчується');
  }
  const positive={...product,price:123.5};
  assert.equal(productSeoDetails(data(positive)).schema.offers.price,'123.50');
  assert.equal(productAvailability(positive).orderable,true);
  const promotion={id:1,target_type:'all',discount_type:'percent',discount_value:100};
  const details=productSeoDetails({...data(positive),promotions:[promotion]});
  assert.equal(details.price,0);assert.equal(details.state.priceInquiry,true);assert.equal(details.schema.offers,undefined);
  assert.equal(selectProductForPage({...product,id:10},[...([0,123.5].map((price,index)=>({...product,id:11+index,parent_product_id:10,price}))) ]).item.id,12);
});

test('the actual catalog card and hover view use quote actions while positive-price cards retain purchase controls',()=>{
  const start=app.indexOf('card = (product) => {'),end=app.indexOf('// Для проекційних екранів',start);
  assert.ok(start>0&&end>start);
  const cardSource=app.slice(start,end).trim().replace(/^card = /,'').replace(/;$/,'');
  const card=runInNewContext('('+cardSource+')',{
    productVariantsFor:()=>[],preferredVariantFor:row=>row,
    availability:productAvailability,promotionFor:()=>null,salePrice:row=>Number(row.price)||0,
    hasProductPrice,formatProductPrice,catalogCardEscape:htmlEscape,compactProductName:name=>name,
    imageUrl:()=>'',displaySpecificationEntries:()=>[],isProjectorProduct:()=>false,
    money:value=>new Intl.NumberFormat('uk-UA').format(value)+' ₴'
  });
  const quote=card(product);
  assert.equal((quote.match(/Ціна за запитом/g)||[]).length,2);
  assert.equal((quote.match(/data-inquiry="4760"/g)||[]).length,2);
  assert.doesNotMatch(quote,/0 ₴|data-add=/);
  const priced=card({...product,price:125});
  assert.match(priced,/125 ₴/);assert.match(priced,/data-add="4760"/);assert.doesNotMatch(priced,/data-inquiry=/);
});

test('add-to-cart cannot add a quote product or emit a commerce purchase intent',()=>{
  const start=app.indexOf('add = (id) => {'),end=app.indexOf('renderCart =',start);
  assert.ok(start>0&&end>start);
  const addSource=app.slice(start,end).trim().replace(/^add = /,'').replace(/;$/,'');
  const cart=[],events=[];
  const add=runInNewContext('('+addSource+')',{
    get:()=>product,availability:productAvailability,cart,save(){throw Error('Quote must not enter cart');},
    reportCommerce:(...event)=>events.push(event),renderCart(){},commerceItems(){},salePrice:row=>row.price
  });
  add(product.id);assert.equal(cart.length,0);assert.equal(events.length,0);
});
