import {STORE_ORIGIN,htmlEscape,jsonForHtml,productPlainText} from './product-seo.js';
import {readCatalogFilterState} from './catalog-filter-state.js';

export function catalogSeoDetails({category=null,params=new URLSearchParams(),items=[]}={}){
  const state=readCatalogFilterState(params);
  const filtered=Boolean(state.search.trim()||state.brand.trim()||Number(state.min)>0||state.max!==''||state.stock||state.specs.length||state.fluxMin!==''||state.fluxMax!==''||['laser','short','ultra'].includes(params.get('projector'))||Number(params.get('promotion'))>0||params.get('promo')==='sale'||state.sort!=='popular');
  const heading=category?productPlainText(category.name):params.get('promo')==='sale'?'Акційні товари':'Каталог техніки';
  const canonical=new URL('/catalog',STORE_ORIGIN);
  if(category?.slug)canonical.searchParams.set('category',category.slug);
  // A real unfiltered paginated page keeps its own canonical URL.
  if(!filtered){if(state.page>1)canonical.searchParams.set('page',state.page);if(state.size!==12)canonical.searchParams.set('size',state.size);}
  const suffix=!filtered&&state.page>1?' — сторінка '+state.page:'';
  const description=heading+' у TECHNOROOM: товари, актуальні ціни, характеристики та наявність. Допоможемо з вибором і доставкою.';
  const schema={'@context':'https://schema.org','@type':'CollectionPage',name:heading+suffix,url:canonical.href,description};
  if(items.length)schema.mainEntity={'@type':'ItemList',itemListOrder:'https://schema.org/ItemListUnordered',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:(state.page-1)*state.size+index+1,name:productPlainText(item.name),url:STORE_ORIGIN+'/product?id='+item.id}))};
  return {heading,title:heading+suffix+' | TECHNOROOM',description,canonical:canonical.href,filtered,state,schema};
}
export function catalogHeadMarkup(details){
  return '<meta name="description" content="'+htmlEscape(details.description)+'"><link rel="canonical" href="'+htmlEscape(details.canonical)+'">'
    +'<meta property="og:type" content="website"><meta property="og:title" content="'+htmlEscape(details.heading)+'"><meta property="og:description" content="'+htmlEscape(details.description)+'"><meta property="og:url" content="'+htmlEscape(details.canonical)+'">'
    +'<script type="application/ld+json" id="catalog-schema">'+jsonForHtml(details.schema)+'</script>';
}
export function updateCatalogSeo(doc,details){
  doc.title=details.title;
  const set=(selector,tag,attributes)=>{const node=doc.querySelector(selector)||doc.createElement(tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);if(!node.parentNode)doc.head.append(node);};
  set('link[rel="canonical"]','link',{rel:'canonical',href:details.canonical});
  set('meta[name="description"]','meta',{name:'description',content:details.description});
  for(const [property,content]of Object.entries({'og:type':'website','og:title':details.heading,'og:description':details.description,'og:url':details.canonical}))set('meta[property="'+property+'"]','meta',{property,content});
  const schema=doc.getElementById('catalog-schema')||doc.createElement('script');schema.id='catalog-schema';schema.type='application/ld+json';schema.textContent=jsonForHtml(details.schema);if(!schema.parentNode)doc.head.append(schema);
}
