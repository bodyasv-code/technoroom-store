// An uncertain supplier offer never authorizes checkout or invents a quantity.
export function supplierStockNeedsConfirmation(product={}) {
  const available = (product.in_stock ?? product.stock) && Number(product.stock_quantity ?? product.stockQuantity ?? 0)>0;
  return !available && (product.supplier_stock_uncertain === true || product.supplierStockUncertain === true);
}
