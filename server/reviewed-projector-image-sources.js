// Exact manufacturer gallery files reviewed visually on 2026-11-16.
const sources=new Set([
  "https://image.benq.com/is/image/benqco/MH560C-product%20photo-front?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/03-mx560c-right30?wid=1200&fmt=png-alpha",
  "https://region-resource.optoma.com/products/images/RatgiDzub1lk8KspP2bcBmpuaBe8sIHVcsR7qaB9.jpg",
  "https://image.benq.com/is/image/benqco/tk700i-right30?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/th575i-right30?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/gv50-left45?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/gp520-right30?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/tk705i-right30-1-2?wid=1200&fmt=png-alpha",
  "https://image.benq.com/is/image/benqco/tk705sti-right30-1-2?wid=1200&fmt=png-alpha",
  "https://www.viewsonic.com/media/catalog/product/cache/10c8e383424fa76a79b8616adb267790/2/6/26prj-edu1695_vsa-prd-lsd401hd_front.png",
  "https://www.viewsonic.com/vsAssetFile/global/img/slides/0projector/LSD600W/scaled/25-PJ-LSD600W-Product%20Photo_LF031_pc_m.png"
]);
export const isReviewedProjectorImageUrl=url=>sources.has(url.href);
