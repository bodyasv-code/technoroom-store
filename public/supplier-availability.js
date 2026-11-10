export function availableStockQuantity(product={}) { return Math.max(0,Number(product.stock_quantity ?? product.stockQuantity ?? 0)||0,Number(product.supplier_available_quantity ?? product.supplierAvailableQuantity ?? 0)||0); }
// An uncertain supplier offer never authorizes checkout or invents a quantity.
export function supplierStockNeedsConfirmation(product={}) {
  const available = availableStockQuantity(product)>0;
  return !available && (product.supplier_stock_uncertain === true || product.supplierStockUncertain === true);
}
