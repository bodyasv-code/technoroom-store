const priceValue=value=>{if(value==null||String(value).trim()==='')return '';const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=1e10?String(Math.round(n*100)/100):''};
export function catalogPriceBounds(min,max,changed='max'){
  let low=priceValue(min)||'0',high=priceValue(max);
  if(high!==''&&Number(low)>Number(high)){if(changed==='min')high=low;else low=high}
  return {min:low,max:high};
}
export function catalogPriceRangeMax(products,min='',max=''){
  return Math.max(1000,...products.map(product=>Math.ceil((Number(product.price)||0)/1000)*1000),Number(priceValue(min)||0),Number(priceValue(max)||0));
}
export function readCatalogFilterState(params){
  let specs=[];
  try{const raw=params.get('specs')||'[]';if(raw.length<=16000){const parsed=JSON.parse(raw);if(Array.isArray(parsed))specs=parsed.filter(pair=>Array.isArray(pair)&&typeof pair[0]==='string'&&pair[0].length<=100&&Array.isArray(pair[1])).slice(0,25).map(([id,values])=>[id,values.filter(value=>typeof value==='string'&&value.length<=500).slice(0,50)])}}catch{}
  specs=specs.map(([id,values])=>[id,[...new Set(values.map(value=>id==='printer-format'&&/^[AА]3(?:\+|\s*\/\s*[AА]3\+)?$/iu.test(value.trim())?'A3':id==='printer-duplex'&&value==='Є'?'Автоматичний':value))]]);
  const sort=params.get('sort'),size=Number(params.get('size')),page=Number(params.get('page'));
  return {...catalogPriceBounds(params.get('min'),params.get('max')),brand:params.get('brand')||'',search:params.get('search')||'',stock:params.get('stock')==='1',
    sort:['popular','newest','price-asc','price-desc','name'].includes(sort)?sort:sort==='new'?'newest':'popular',
    size:[10,12,20,40,80].includes(size)?size:12,page:Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1,
    specs,fluxMin:priceValue(params.get('fluxMin')),fluxMax:priceValue(params.get('fluxMax'))};
}
export function catalogFilterUrl(href,state){
  const url=new URL(href);
  for(const key of ['min','max','brand','search','stock','sort','size','page','specs','fluxMin','fluxMax','projector'])url.searchParams.delete(key);
  const put=(key,value)=>{if(value!==''&&value!=null)url.searchParams.set(key,String(value))};
  const min=priceValue(state.min),max=priceValue(state.max);
  if(Number(min)>0)put('min',min);put('max',max);put('brand',state.brand);put('search',state.search);
  if(state.stock)put('stock','1');if(state.sort!=='popular')put('sort',state.sort);if(Number(state.size)!==12)put('size',state.size);if(Number(state.page)>1)put('page',state.page);
  if(state.specs?.length)put('specs',JSON.stringify(state.specs));put('fluxMin',state.fluxMin);put('fluxMax',state.fluxMax);
  return url;
}
export function safeCatalogReturnUrl(value){return typeof value==='string'&&/^\/?catalog(?:\.html)?(?:\?|$)/u.test(value)?value:'catalog.html'}
