// Resolve supplier offers without summing quantities that may share a warehouse.
// Keep supplier quantities separate from the catalog's base quantity.
export function resolveSupplierInventory(product={},offers=[]){
 const base=product.in_stock===true?Number(product.stock_quantity||0):0;
 const quantities=offers.filter(o=>o.stock_kind==='exact'&&Number.isInteger(o.stock_quantity)&&o.stock_quantity>=0).map(o=>o.stock_quantity);
 const quantity=Math.max(0,base,...quantities);
 const uncertain=offers.some(o=>o.stock_kind==='needs_confirmation');
 return {quantity,inStock:quantity>0,status:quantity>0?'in_stock':uncertain?'needs_confirmation':'out_of_stock'};
}
