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

export function officeSupplyCategoryPlan(value = '') {
  const name = String(value ?? '').trim().toLocaleLowerCase('uk-UA');
  if (/^(?:термо[еэ]тикет|термічн[а-яіїєґ]*\s+етикет|thermal\s+labels?)/iu.test(name)) {
    return {rootSlug:'office-consumables',rootName:'Витратні матеріали для друку',childSlug:'office-consumables-labels',childName:'Етикетки та термоетикетки'};
  }
  if (/^(?:комплект\s+ресурсних\s+матеріалів|підкладка|ролик[иів]*|набір\s+ролик[іи]в|consumable\s+kit|roller\s+(?:kit|set))/iu.test(name)
    && /(?:сканер|scanner)/iu.test(name)) {
    return {rootSlug:'office-equipment',rootName:'Оргтехніка',childSlug:'office-accessories',childName:'Аксесуари для оргтехніки'};
  }
  return null;
}
