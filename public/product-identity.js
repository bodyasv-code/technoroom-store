export function productNameWithSku(value = '', sku = '') {
  let name = String(value ?? '').trim();
  const code = String(sku ?? '').trim();
  if (!code || /^(null|undefined|none|—|-)$/iu.test(code)) return name;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\(' + escaped + '\\)\\s*$', 'iu').test(name)) return name;
  // Only remove a separate trailing code, never part of a model number.
  name = name.replace(new RegExp('(?:\\s+[—–-]?\\s*|[—–]\\s*)' + escaped + '$', 'iu'), '').trim();
  return name + ' (' + code + ')';
}

export function isSpecializedPrinterName(value = '') {
  const name=String(value??'').trim();
  return /^(?:принтер|printer)(?=\s|$)/iu.test(name) && /етикет|\blabels?\b|термо|\bthermal\b|\bcolorworks\b/iu.test(name);
}

export function officeSupplyCategoryPlan(value = '', currentCategory = '') {
  const name = String(value ?? '').trim().toLocaleLowerCase('uk-UA');
  const root={rootSlug:'office-consumables',rootName:'Витратні матеріали для друку'};
  // Leading product type wins over MFP/printer models mentioned as compatibility.
  if(/^(?:тонер(?:[\s-]+картридж)?|toner(?:[\s-]+cartridge)?)(?=\s|$|[-(])/iu.test(name))return {...root,childSlug:'office-consumables-toner',childName:'Тонери та тонер-картриджі'};
  if(/^(?:картридж\s+(?:зі?|із)\s+стрічкою|ribbon\s+cartridge)(?=\s|$|[-(])/iu.test(name))return {...root,childSlug:'office-consumables-ribbons',childName:'Стрічки для принтерів'};
  if(/^(?:картридж|cartridge)(?=\s|$|[-(])/iu.test(name)){
    // A generic cartridge title does not justify moving an already classified ink/toner.
    if(['office-consumables-ink','office-consumables-toner','office-consumables-ribbons','office-consumables-drums'].includes(currentCategory))return null;
    return {...root,childSlug:'office-consumables-cartridges',childName:'Картриджі'};
  }
  if(/^(?:фотобарабан|drum(?:\s+unit)?|imaging\s+drum)(?=\s|$|[-(])/iu.test(name))return {...root,childSlug:'office-consumables-drums',childName:'Фотобарабани'};
  if(/^(?:чорнил[ао]|ink\s+(?:bottle|tank)|контейнер\s+(?:з\s+)?чорнилами)(?=\s|$|[-(])/iu.test(name))return {...root,childSlug:'office-consumables-ink',childName:'Чорнила та контейнери'};
  if (/^(?:термо[еэ]тикет|термічн[а-яіїєґ]*\s+етикет|thermal\s+labels?)/iu.test(name)) {
    return {rootSlug:'office-consumables',rootName:'Витратні матеріали для друку',childSlug:'office-consumables-labels',childName:'Етикетки та термоетикетки'};
  }
  if (/^(?:комплект\s+ресурсних\s+матеріалів|підкладка|ролик[иів]*|набір\s+ролик[іи]в|consumable\s+kit|roller\s+(?:kit|set))/iu.test(name)
    && /(?:сканер|scanner)/iu.test(name)) {
    return {rootSlug:'office-equipment',rootName:'Оргтехніка',childSlug:'office-accessories',childName:'Аксесуари для оргтехніки'};
  }
  return null;
}
