import {canonicalBrandName} from './brand-normalization.js?v=20261029-mti';
import {supplierProductContent} from './supplier-product-content.js?v=20261029-shared';
const text=value=>String(value??'').replace(/\s+/gu,' ').trim();
const key=value=>text(value).toUpperCase();
const header=value=>text(value).toLowerCase();
const columns={brand:'Бренд',model:'Модель',supplierSku:'Код товара постачальника',mpn:'Парт номер',
  supplierId:'Номер',description:'Опис',category:'Категорія товару',categoryCode:'Код категорії товару',
  rrp:'РРЦ, грн',supplierPrice:'Ціна продажу, грн',stock:'На складі',reserved:'Зарезервовано клієнтом',warranty:'Гарантія, міс.',gtin:'Штрихкод (GTIN)'};
const categories={ПРОЕКТОРИ:'projectors',ПРОЕКЦІЙНІЕКРАНИ:'erc-display-06',КРІПЛЕННЯДЛЯПРОЕКТОР:'erc-display-10'};
export function mtiNumber(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
  const raw=text(value).replace(/[\s\u00a0]/gu,'').replace(',','.');
  const parsed=/^\d+(?:\.\d+)?$/u.test(raw)?Number(raw):null;
  return parsed!==null&&Number.isFinite(parsed)?parsed:null;
}
export function mtiStock(value){
  const raw=text(value),atLeast=/^(\d+)\s+і\s+більше$/iu.exec(raw);
  if(atLeast)return {kind:'at_least',quantity:null,minimum:Number(atLeast[1]),label:raw};
  const amount=mtiNumber(value);
  return amount!==null&&Number.isInteger(amount)?{kind:'exact',quantity:amount,minimum:amount,label:String(amount)}:
    {kind:'unknown',quantity:null,minimum:null,label:raw||'Не вказано'};
}
const brand=value=>canonicalBrandName(value);
const identity=(manufacturer,mpn)=>key(brand(manufacturer))+'\u0000'+key(mpn);
export function parseMtiPriceRows(matrix){
  const headerIndex=matrix.findIndex(row=>Object.values(columns).every(label=>row.some(cell=>header(cell)===header(label))));
  if(headerIndex<0)throw new Error('Формат МТІ не розпізнано: потрібні колонки бренду, моделі, партномера, РРЦ у гривнях, ціни МТІ та залишку.');
  const headings=matrix[headerIndex],positions={};
  for(const [field,label]of Object.entries(columns)){
    const matches=headings.flatMap((cell,index)=>header(cell)===header(label)?[index]:[]);
    if(matches.length!==1)throw new Error('Неоднозначна колонка МТІ: '+label);
    positions[field]=matches[0];
  }
  const rows=[];
  for(let index=headerIndex+1;index<matrix.length;index++){
    const source=matrix[index],value=field=>source[positions[field]]??'';
    if(!['brand','model','supplierSku','mpn'].some(field=>text(value(field))))continue;
    const issues=[],supplierSku=text(value('supplierSku')),mpn=text(value('mpn')),manufacturer=brand(value('brand'));
    const category=categories[key(value('categoryCode'))]||'',stock=mtiStock(value('stock'));
    const price=mtiNumber(value('rrp')),supplierPrice=mtiNumber(value('supplierPrice')),reserved=mtiNumber(value('reserved'));
    if(!mpn||!manufacturer)issues.push('Не вказано бренд або партномер виробника.');
    if(!supplierSku||!text(value('supplierId')))issues.push('Не вказано код товару МТІ.');
    if(key(supplierSku)!==key(mpn))issues.push('Код постачальника відрізняється від партномера: перевірити модель перед зіставленням.');
    if(!category)issues.push('Категорію потрібно зіставити вручну.');
    if(price===null||price<=0)issues.push('Немає додатної РРЦ у гривнях.');
    if(stock.kind==='unknown')issues.push('Залишок не визначено; наявний залишок не можна обнулювати.');
    if(stock.kind==='at_least')issues.push('Вказано нижню межу залишку, а не точну кількість.');
    if(reserved===null||reserved>0)issues.push('Потрібно уточнити вплив резерву на доступний залишок.');
    const model=text(value('model')),name=[category==='projectors'?'Проєктор':category==='erc-display-06'?'Екран':category==='erc-display-10'?'Кріплення':'',manufacturer,model].filter(Boolean).join(' ');
    const warranty=mtiNumber(value('warranty'));
    const row={key:'mti-'+text(value('supplierId'))+'-'+(index+1),supplier:'MTI',sourceRow:index+1,
      supplierId:text(value('supplierId')),supplierSku,manufacturerPartNumber:mpn,sku:mpn,vendor:manufacturer,model,name,
      category,sourceCategory:text(value('category')),sourceCategoryCode:text(value('categoryCode')),
      description:text(value('description')),specifications:warranty>0?{'Гарантія':warranty+' міс.'}:{},images:[],
      price:price??0,hasPrice:price!==null&&price>0,supplierPrice,priceBasis:'rrp',currency:'UAH',
      stock:stock.quantity??0,hasStock:stock.kind==='exact',stockDetail:stock,reserved,
      sourceGtin:text(value('gtin')),issues};
    row.content=supplierProductContent(row,category);
    rows.push(row);
  }
  if(!rows.length)throw new Error('У прайсі МТІ не знайдено товарів.');
  const counts=new Map();for(const row of rows){const id=identity(row.vendor,row.sku);counts.set(id,(counts.get(id)||0)+1);}
  for(const row of rows)if(counts.get(identity(row.vendor,row.sku))>1)row.issues.push('Бренд і партномер повторюються у файлі; автоматичне зіставлення неоднозначне.');
  return {headerRow:headerIndex+1,rows};
}
export function matchMtiPriceRows(rows,products){
  return rows.map(row=>{
    const matches=products.filter(product=>!product.parent_product_id&&!product.parentProductId&&key(product.sku)===key(row.sku)&&key(brand(product.brand))===key(row.vendor));
    const issues=[...row.issues];
    if(matches.length>1)issues.push('У каталозі кілька карток цього бренду з однаковим артикулом.');
    if(products.some(product=>key(product.sku)===key(row.sku)&&key(brand(product.brand))!==key(row.vendor)))issues.push('Такий артикул є в каталозі під іншим брендом.');
    return {...row,issues,matchedProductId:matches.length===1&&!issues.length?matches[0].id:null,
      matchLabel:issues.length?'Потрібна перевірка':matches.length===1?'Збіг бренду й артикула':'У каталозі не знайдено'};
  });
}
export function mtiWorksheetRange(sheet){
  // MTI exports can declare A1:Z4 even when product cells extend below row 4.
  // Use the actual populated sparse cells, rather than trusting stale !ref.
  // https://docs.sheetjs.com/docs/csf/sheet/
  let lastRow=0,lastColumn=0,lastLetters='A';
  for(const [address,cell]of Object.entries(sheet)){
    const match=/^([A-Z]+)([1-9]\d*)$/u.exec(address);
    if(!match||cell?.v==null||cell.v==='')continue;
    const row=Number(match[2]);let column=0;
    for(const letter of match[1])column=column*26+letter.charCodeAt(0)-64;
    if(row>50000||column>100)throw new Error('Прайс МТІ перевищує підтримуваний діапазон: 50 000 рядків і 100 колонок.');
    lastRow=Math.max(lastRow,row);
    if(column>lastColumn){lastColumn=column;lastLetters=match[1];}
  }
  return lastRow?'A1:'+lastLetters+lastRow:'A1:A1';
}
export async function readMtiPriceFile(file){
  if(!/\.xlsx$/iu.test(file.name)||file.size>20*1024*1024)throw new Error('Оберіть Excel .xlsx розміром до 20 МБ.');
  const module=await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'),XLSX=module.default||module;
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const results=[];
  for(const name of workbook.SheetNames){
    const sheet=workbook.Sheets[name];
    const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,range:mtiWorksheetRange(sheet)});
    if(!matrix.some(row=>row.some(cell=>header(cell)===header(columns.mpn))))continue;
    results.push({...parseMtiPriceRows(matrix),sheetName:name});
  }
  if(results.length!==1)throw new Error('Потрібен один аркуш прайсу МТІ з розпізнаними колонками.');
  return results[0];
}
