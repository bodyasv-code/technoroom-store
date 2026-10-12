const manufacturers=['2E','Acer','ASUS','Dell','DIGITUS','EPOS','FSP','Legrand','LEDVANCE','LG','MSI','OnePlus','Philips','Samsung','Sony','TCL','HP','Epson','Canon','Ricoh','Xerox','Brother','Lenovo'];
const names=new Map(manufacturers.map(name=>[name.toLowerCase(),name]));
const suffix=/\s+(?:accessories|audio|displays|energy(?:\s+ups)?|gaming|lfd|mobile|monitors|mounts|multimedia|projectors|printers|printing|peripherals|peripheras|peripheral|supplies|paper|gmo|channels|retail|screens|scs|tv|ups)(?:\s+(?:accessories|peripherals|supplies|paper|printers|projectors))*\s*$/iu;
export function canonicalBrandName(value='') {
  const name=String(value??'').replace(/&amp;/giu,'&').replace(/\s+/g,' ').trim();
  const root=name.replace(suffix,'').trim(),known=names.get(root.toLowerCase());
  // Never infer a manufacturer from compatibility wording or unknown compounds.
  return known||name;
}
export function brandConsolidationPlan(products=[],brands=[]) {
  const groups=new Map(),byId=new Map(brands.map(brand=>[Number(brand.id),brand]));
  const groupFor=canonical=>{if(!groups.has(canonical))groups.set(canonical,{canonical,brands:[],products:[]});return groups.get(canonical);};
  for(const brand of brands){const canonical=canonicalBrandName(brand.name);if(canonical)groupFor(canonical).brands.push(brand);}
  for(const product of products){const linked=byId.get(Number(product.brand_id)),raw=String(product.brand||linked?.name||'').trim();if(!raw)continue;const canonical=canonicalBrandName(raw);
    // Conflicting linked/text brands require review, not automatic consolidation.
    if(linked&&canonicalBrandName(linked.name)!==canonical)continue;
    groupFor(canonical).products.push(product);
  }
  return [...groups.values()].filter(group=>group.brands.some(brand=>brand.name!==group.canonical)||group.products.some(product=>product.brand!==group.canonical));
}
