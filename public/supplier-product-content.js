import {canonicalBrandName} from './brand-normalization.js';
import {normalizeImportedProductSpecifications} from './import-specification-rules.js?v=20261017-customer-content';
import {cleanCustomerText} from './product-content-policy.js?v=20261017-customer-content-3';

// Supplier adapters must map their own fields to this common row first.
// This stage handles product content only: supplier prices, stock, IDs and
// image permissions remain the responsibility of their existing import paths.
export function supplierProductContent(row, category='') {
  const product={
    name:row.name,
    sku:row.sku,
    brand:canonicalBrandName(row.vendor || row.brand || ''),
    category,
    description:cleanCustomerText(row.description || ''),
    specifications:row.specifications || {},
  };
  return {
    name:product.name,
    brand:product.brand,
    description:product.description,
    specifications:normalizeImportedProductSpecifications(product),
  };
}

// MPN/SKU equality alone is insufficient: different manufacturers can reuse a
// code. This guard blocks a confirmed brand mismatch without guessing a brand.
export function supplierBrandConflict(row, product) {
  const incoming=canonicalBrandName(row.vendor || row.brand || '').trim().toLowerCase();
  const saved=canonicalBrandName(product?.brand || '').trim().toLowerCase();
  return Boolean(incoming && saved && incoming !== saved);
}
