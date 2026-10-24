// Pure, conservative migration planner. No credentials, database client or writes.
import {appendSpecification,specificationContentProblems,isSpecificationLabel} from '../public/supplier-specification-parser.js';
import {isPrinterDevice} from '../public/printer-display.js';
const plain=value=>String(value??'').replace(/\s+/gu,' ').trim();
const equal=(a,b)=>plain(a).normalize('NFKC')===plain(b).normalize('NFKC');
const speedLabels=new Map([
  ['Принтер (швидкість','Швидкість друку'],
  ['Копір (швидкість','Швидкість копіювання'],
  ['Факс (швидкість','Швидкість факсу'],
]);
export function planOfficeSpecificationCleanup(product){
  const before=product.specifications||{},after=structuredClone(before),changes=[];
  const office=product.category?.startsWith('office-')||isPrinterDevice(product);
  const rename=(key,label,value,reason)=>{
    // Never overwrite or create a second conflicting canonical value.
    const existing=Object.keys(after).find(k=>k.toLocaleLowerCase('uk-UA')===label.toLocaleLowerCase('uk-UA')&&k!==key);
    if(existing&&!equal(after[existing],value))return;
    delete after[key];if(!existing)appendSpecification(after,label,value);
    changes.push({key,label,before:before[key],after:value,reason});
  };
  for(const [key,value] of Object.entries(before)){
    if(typeof value!=='string')continue;
    if(/^https?$/iu.test(key)&&/^\/\/[^\s<>]+$/u.test(value)){
      const address=key.toLowerCase()+':'+value;
      try{const url=new URL(address);if(url.username||url.password||!url.hostname)continue;}catch{continue;}
      rename(key,'Документ постачальника',address,'Відновлено повну адресу без зміни призначення документа');continue;
    }
    const balanced=(value.match(/\(/gu)||[]).length===(value.match(/\)/gu)||[]).length;
    if(office&&speedLabels.has(key)&&balanced&&!/:/u.test(value)){
      rename(key,speedLabels.get(key),value,'Відновлено назву швидкості з явного контексту; значення незмінне');continue;
    }
    if(office&&key==='масштабування'&&/^\d+\s*[-–]\s*\d+%\)$/u.test(value)){
      rename(key,'Масштабування копіювання',value.slice(0,-1),'Прибрано лише зайву закривальну дужку');continue;
    }
    if(!isSpecificationLabel(key))continue;
    // Remove a glued-on tail ONLY if a separate field already stores exactly
    // that entire tail. No splitting inferred facts, no loss of source content.
    const match=/\s+(Інтерфейс(?:и)?|Лотки|ОС|Панель (?:управління|керування)|Навантаження):\s*(.+)$/iu.exec(value);
    if(!match)continue;
    const target=Object.keys(before).find(k=>k.toLocaleLowerCase('uk-UA')===match[1].toLocaleLowerCase('uk-UA'));
    const prefix=value.slice(0,match.index).trim();
    if(!target||target===key||!equal(before[target],match[2])||!prefix||specificationContentProblems({[key]:prefix}).length)continue;
    after[key]=prefix;changes.push({key,label:key,before:value,after:prefix,reason:'Прибрано приклеєний повтор: повний текст уже збережений в окремому полі '+target});
  }
  return {id:product.id,sku:product.sku,name:product.name,category:product.category,before,after,changes,manual:specificationContentProblems(after)};
}
