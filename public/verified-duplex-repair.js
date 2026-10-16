import {writePrinterDuplex} from './printer-duplex.js?v=20261016-duplex';
// Owner-approved list, verified against Epson/HP documentation on 2026-10-13.
// No model-name guessing, imports, or unrelated product field updates.
export const verifiedDuplexProducts = [
  [4433,'C11CL59405','Ручний'],[4443,'C11CJ19401','Ручний'],[4444,'C11CJ18404','Немає'],
  [4530,'4ZB96A','Ручний (через драйвер)'],[4531,'4ZB97A','Ручний (через драйвер)'],
  [4551,'7MD73A','Немає'],[4599,'7MD67A','Немає'],[4600,'7MD68A','Немає'],[4607,'2Z611A','Ручний'],
];
// Exact Canon models verified against manufacturer specifications/manuals on 2026-10-16.
export const verifiedCanonDuplexProducts = [
  [4351,'6672C039','Ручний'],[4360,'1366C009','Ручний'],[4361,'0727C067','Ручний'],
  [4362,'6670C007','Ручний'],[4376,'8747B007','Ручний'],
];
const duplexKey=/^(?:дуплекс(?:ний друк)?|автоматичний двосторонній друк|двосторонній друк|duplex(?: printing)?)(?:\s*\(інше значення \d+\))?\s*[:：]?$/iu;
export function verifiedDuplexRepair(product) {
  const canon=verifiedCanonDuplexProducts.find(([id,sku])=>Number(product.id)===id&&product.sku===sku);
  const verified=canon||verifiedDuplexProducts.find(([id,sku])=>Number(product.id)===id&&product.sku===sku);
  if(!verified || !product.specifications || typeof product.specifications!=='object' || Array.isArray(product.specifications)) return null;
  // Never undo an explicit choice made in the new editor.
  if(Object.hasOwn(product.specifications,'Двосторонній друк'))return null;
  const specifications=canon?writePrinterDuplex(product.specifications,'manual'):Object.fromEntries(Object.entries(product.specifications).filter(([key])=>!duplexKey.test(key.trim())));
  if(!canon){specifications['Дуплексний друк']='Немає';specifications['Дуплекс']=verified[2];}
  const unchanged=Object.keys(specifications).length===Object.keys(product.specifications).length&&Object.entries(specifications).every(([key,value])=>JSON.stringify(product.specifications[key])===JSON.stringify(value));
  return unchanged?null:{id:verified[0],sku:verified[1],before:product.specifications,specifications};
}

export async function applyVerifiedDuplexRepair(client, plan) {
  const result=await client.from('products').update({specifications:plan.specifications})
    .eq('id',plan.id).eq('sku',plan.sku).eq('specifications',JSON.stringify(plan.before)).select('id');
  if(result.error)throw result.error;
  if(result.data?.length!==1)throw new Error('Товар '+plan.id+' змінився або SKU не збігається. Оновіть каталог і перевірте вручну.');
  return plan.id;
}

export function confirmVerifiedDuplexRepair(plans) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='inquiry-dialog';
    const content=document.createElement('div');content.className='inquiry-form';
    const heading=document.createElement('h2');heading.textContent='Перевірені характеристики';
    const detail=document.createElement('p');detail.textContent='Зміняться лише перевірені характеристики дуплексу, формату друку або сканування в '+plans.length+' товарах за окремими правилами для точних SKU. Ціни, назви, категорії, фото та інші характеристики не змінюються.';
    const list=document.createElement('ul');for(const plan of plans){const item=document.createElement('li');const changes=Object.entries(plan.specifications).filter(([key,value])=>JSON.stringify(plan.before[key])!==JSON.stringify(value)).map(([key,value])=>key+': '+value);item.textContent='ID '+plan.id+' · '+plan.sku+' — '+changes.join('; ');list.append(item);}
    const approve=document.createElement('button');approve.type='button';approve.className='button';approve.textContent='Підтвердити '+plans.length+' виправлень';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='button outline';cancel.textContent='Скасувати';
    const finish=approved=>{dialog.close();dialog.remove();resolve(approved)};
    approve.onclick=()=>finish(true);cancel.onclick=()=>finish(false);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)});
    content.append(heading,detail,list,approve,cancel);dialog.append(content);document.body.append(dialog);dialog.showModal();
  });
}
