const normal = raw => String(raw??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('uk-UA');
export function resolveEditorBrand(product, brands, canonical = value=>value) {
  const raw=String(product?.brand||'').trim();
  const linked=brands.find(brand=>product?.brand_id!=null&&Number(brand.id)===Number(product.brand_id))
    || brands.find(brand=>raw&&normal(brand.name)===normal(raw))
    || brands.find(brand=>raw&&normal(canonical(raw))!==normal(raw)&&normal(brand.name)===normal(canonical(raw)));
  return {linked,raw,selection:linked?String(linked.id):raw?'__legacy':''};
}
