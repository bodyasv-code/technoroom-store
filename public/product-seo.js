import {productNameWithSku} from './product-identity.js';
import {availableStockQuantity,supplierStockNeedsConfirmation} from './supplier-availability.js';
import {matchingPromotion,discountedPrice} from './store-pricing.js';

export const STORE_ORIGIN='https://www.technoroom.com.ua';
const readableText = (value = '') => {
  let text = String(value);
  try { if (/%u[0-9a-f]{4}/i.test(text)) text = unescape(text); } catch {}
  try { if (/%[0-9a-f]{2}/i.test(text)) text = decodeURIComponent(text); } catch {}
  // Деякі постачальники кодують амперсанд двічі: G&amp;amp;G. Розкодовуємо
  // кілька разів, але з обмеженням, щоб не зачепити звичайний текст.
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = text.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ');
    if (decoded === text) break;
    text = decoded;
  }
  return text.replace(/\s+/g, ' ').trim();
};
const compactProductName = (value = '', sku = '', brand = '') => {
  let name = readableText(value).replace(/\s*[|•]\s*(?:код|sku|артикул|vendor code)\b.*$/iu, '').replace(/\s*\((?:код|sku|артикул)\s*[:#]?[^)]*\)/iu, '').replace(/\s{2,}/g, ' ').trim();
  if (/^телевізор\b/iu.test(name)) {
    const size = name.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
    const technology = [
      [/mini\s*-?\s*led/iu, 'miniLED'], [/oled/iu, 'OLED'], [/qled/iu, 'QLED'], [/\bled\b/iu, 'LED']
    ].find(([pattern]) => pattern.test(name))?.[1];
    const excludedModels = new Set(['4K', '8K', 'HDR', 'HDR10', 'HDMI', 'USB', 'WIFI', 'WI-FI', 'LED', 'OLED', 'QLED', 'MINILED', 'FULLHD']);
    const model = [...name.matchAll(/\b[A-ZА-ЯІЇЄ]{1,6}(?:[-_ ]?[A-Z0-9]{2,})+\b/g)]
      .map((match) => match[0]).find((candidate) => candidate.replace(/[-_ ]/g, '').length >= 5 && !excludedModels.has(candidate.replace(/[-_ ]/g, '').toUpperCase()));
    const cleanBrand = readableText(brand).replace(/\s+(?:tv|телевізори)$/iu, '').trim();
    const compact = ['Телевізор', size ? size.replace(',', '.') + '"' : '', cleanBrand, technology || '', model || ''].filter(Boolean).join(' ');
    if (compact) name = compact;
  }
  const parts = name.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  const startsWithProductType = /^(?:про[єе]ктор|телевізор|монітор|екран|саундбар|акустичн|гарнітур|навушник|мікрофон|портативн|зарядн|джерел|ноутбук|планшет|смартфон|годинник|принтер|роутер|камера|клавіатур|миша|кабель|адаптер|блокs+живлення|павербанк|powers*bank)/iu;
  const technicalTail = /\b(?:usb|hdmi|wifi|wi-fi|bluetooth|bt\s*\d|led|oled|qled|mini\s*-?\s*led|fhd|uhd|4k|8k|ips|va|tn|rgb|hdr|гб|gb|тб|tb|гц|hz|вт|w|лм|lm|кг|kg|м|mm\b|чорн|білий|сірий|silver|black|white|gray|grey)\b/iu;
  if (startsWithProductType.test(name) && parts.length >= 2 && (parts.length >= 3 || technicalTail.test(parts.slice(1).join(' ')))) name = parts[0];
  return productNameWithSku(name || readableText(value), readableText(sku));
};

export {readableText,compactProductName};

export const htmlEscape=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const jsonForHtml=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');

// Plain text is escaped again at every HTML boundary. Never emit supplier HTML.
export function productPlainText(value='') {
  const text=String(value??'').replace(/<!--[^]*?-->/g,' ')
    .replace(/<(script|style|iframe|template)\b[^>]*>[^]*?<\/\1\s*>/giu,' ')
    .replace(/<[^>]*>/g,' ');
  return readableText(text).replace(/&#(x[0-9a-f]+|\d+);/giu,(_,code)=>{
    const point=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);
    return point>0&&point<=0x10ffff&&! (point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):'';
  }).replace(/\s+/gu,' ').trim();
}

export function productAvailability(product={}) {
  const quantity=availableStockQuantity(product);
  if(supplierStockNeedsConfirmation(product))return {label:'Наявність уточнюється',button:'Уточнити наявність',orderable:false,inquiry:true};
  if(quantity>=1&&quantity<=2)return {label:'Закінчується',button:'У кошик',orderable:true};
  if(!quantity&&(product.availabilityStatus??product.availability_status)==='under_order')return {label:'Під замовлення — уточнюйте термін',button:'Уточнити наявність',orderable:false,inquiry:true};
  if(quantity>0)return {label:'В наявності',button:'У кошик',orderable:true};
  return {label:'Немає в наявності',button:'Немає',orderable:false};
}

const parentId=row=>Number(row?.parentProductId??row?.parent_product_id)||null;
export function selectProductForPage(requested,rows,variantId=null) {
  if(!requested)return null;
  const base=(parentId(requested)&&rows.find(row=>Number(row.id)===parentId(requested)))||requested;
  const variants=rows.filter(row=>parentId(row)===Number(base.id)).sort((a,b)=>Number(a.id)-Number(b.id));
  const explicit=Number(variantId)>0?[base,...variants].find(row=>Number(row.id)===Number(variantId)):null;
  const item=explicit||(parentId(requested)&&requested)||variants.find(row=>productAvailability(row).orderable)
    ||variants.find(row=>productAvailability(row).inquiry)||variants[0]||base;
  return {base,item,variants};
}

export function productImageUrl(product,storageOrigin) {
  const path=product.image_path??product.image;
  if(!path||typeof path!=='string')return '';
  if(/^https?:\/\//i.test(path))return STORE_ORIGIN+'/api/product-image?id='+encodeURIComponent(product.id);
  if(/[\\\x00-\x1f?#]/.test(path)||path.startsWith('//')||path.includes(':')||path.split('/').some(part=>part==='.'||part==='..'))return '';
  if(path.startsWith('/'))return STORE_ORIGIN+path;
  try{
    const origin=new URL(storageOrigin);if(origin.protocol!=='https:')return '';
    return origin.origin+'/storage/v1/object/public/product-images/'+path.split('/').map(encodeURIComponent).join('/');
  }catch{return '';}
}

export function productSeoDetails({base,item,storageOrigin,promotions=[],promotionLinks=new Map(),now=Date.now()}) {
  const heading=productPlainText(compactProductName(base.name,base.sku,base.brand));
  const name=productPlainText(compactProductName(item.name,item.sku,item.brand));
  const description=productPlainText(item.descriptionContent??item.description)||name+' — купити в TECHNOROOM.';
  const canonical=STORE_ORIGIN+'/product?id='+encodeURIComponent(base.id);
  const image=productImageUrl(item,storageOrigin);
  const state=productAvailability(item);
  const priced={...item,parentProductId:parentId(item)};
  const price=discountedPrice(item.price,matchingPromotion(priced,promotions,promotionLinks,now));
  const schema={'@context':'https://schema.org','@type':'Product','@id':canonical+'#product',name,description,url:canonical};
  if(image)schema.image=[image];
  const brand=productPlainText(item.brand||base.brand),sku=productPlainText(item.sku);
  if(brand)schema.brand={'@type':'Brand',name:brand};
  if(sku)schema.sku=sku;
  // Inquiry-only goods are not confirmed stock or preorders. Never invent an offer.
  if(!state.inquiry&&Number.isFinite(price)&&price>0)schema.offers={'@type':'Offer',url:canonical,priceCurrency:'UAH',price:price.toFixed(2),availability:'https://schema.org/'+(state.orderable?'InStock':'OutOfStock')};
  return {heading,title:heading+' | TECHNOROOM',description,metaDescription:[...description].slice(0,160).join(''),canonical,image,state,price,schema};
}

export function productHeadMarkup(details) {
  const e=htmlEscape;
  return '<meta name="description" content="'+e(details.metaDescription)+'">'
    +'<link rel="canonical" href="'+e(details.canonical)+'">'
    +'<meta property="og:type" content="product"><meta property="og:title" content="'+e(details.heading)+'">'
    +'<meta property="og:description" content="'+e(details.metaDescription)+'"><meta property="og:url" content="'+e(details.canonical)+'">'
    +(details.image?'<meta property="og:image" content="'+e(details.image)+'">':'')
    +'<script type="application/ld+json" id="product-schema">'+jsonForHtml(details.schema)+'</script>';
}

export function updateProductSeo(doc,details) {
  doc.title=details.title;
  const meta=(selector,attributes)=>{
    const node=doc.querySelector(selector)||doc.createElement(selector.startsWith('link')?'link':'meta');
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
    if(!node.parentNode)doc.head.append(node);
  };
  meta('link[rel="canonical"]',{rel:'canonical',href:details.canonical});
  meta('meta[name="description"]',{name:'description',content:details.metaDescription});
  for(const [property,content] of Object.entries({'og:type':'product','og:title':details.heading,'og:description':details.metaDescription,'og:url':details.canonical,...(details.image?{'og:image':details.image}:{})}))meta('meta[property="'+property+'"]',{property,content});
  if(!details.image)doc.querySelector('meta[property="og:image"]')?.remove();
  const schema=doc.getElementById('product-schema')||doc.createElement('script');
  schema.id='product-schema';schema.type='application/ld+json';schema.textContent=jsonForHtml(details.schema);
  if(!schema.parentNode)doc.head.append(schema);
}

export function productBreadcrumbMarkup(path,name) {
  return '<a href="/">Головна</a> / <a href="/catalog">Каталог</a>'
    +path.map(category=>' / <a href="/catalog?category='+encodeURIComponent(category.slug)+'">'+htmlEscape(category.name)+'</a>').join('')
    +' / <span aria-current="page">'+htmlEscape(name)+'</span>';
}
