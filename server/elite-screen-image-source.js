// Manufacturer B2B gallery, verified against exact SKUs on 2026-11-16.
// PlentyONE is shared by many tenants: do not trust its entire CDN domain.
const sources=new Set([
  'https://elitescreens.com/wp-content/uploads/Tripod_ZType_Angle.jpg',
  'https://cdn02.plentyone.com/i1qqodjcsbke/item/images/210/full/T120UWH-01.jpg',
  'https://cdn02.plentyone.com/i1qqodjcsbke/item/images/224/full/newYardMasterDual-FrontEScopy.png',
  'https://cdn02.plentyone.com/i1qqodjcsbke/item/images/224/full/OMS100H2-01.jpg',
]);
export const isEliteScreenImageUrl=url=>sources.has(url.href);
