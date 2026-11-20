// Exact manufacturer gallery files reviewed visually on 2026-11-16.
const sources=new Set([
  "https://www.optomaeurope.com/ContentStorage/Media/bc10f78f-572f-430e-b519-c03b32dc8e9e.jpg",
  "https://www.optomaeurope.com/ContentStorage/Media/7c6cd615-4898-478c-b734-8dbee73842ce.jpg",
  "https://www.optomaeurope.com/ContentStorage/Media/ce1c9cea-2828-4549-984b-ff5c84ff6022.jpg",
  "https://www.optomaeurope.com/ContentStorage/Media/0a9b18b4-13b6-4d4a-b88d-6fc6740fdcf3.jpg",
  "https://www.optomaeurope.com/ContentStorage/Media/433112bd-0b96-43a0-b381-062369debfbb.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/410ee8b4-f3fc-44fa-9c58-0bf938a735d8.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/55dea6bf-6b3a-40ed-80a5-77ddd18237b6.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/06aaa09a-3db8-460e-bc8d-12d69cb39020.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/ae8d0df3-6a58-4820-a996-4fcfd004499c.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/72b17eab-4a1c-4eef-b460-48c0cb787465.jpg",
  "https://beta.optomaeurope.com/ContentStorage/Media/f87e0736-a8a5-41e3-986b-c735a6df6727.jpg",
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
