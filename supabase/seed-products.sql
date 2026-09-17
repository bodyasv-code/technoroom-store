-- Initial catalog for the new storefront. Re-running safely refreshes these entries.
insert into public.products (slug, name, brand, category, description, specifications, price, in_stock, is_active)
values
  ('acer-h6830bd', 'Acer H6830BD', 'Acer', 'projector', '4K UHD РїСЂРѕС”РєС‚РѕСЂ РґР»СЏ РґРѕРјР°С€РЅСЊРѕРіРѕ РєС–РЅРѕС‚РµР°С‚СЂСѓ', '{"brightness":"4000 Р»Рј","resolution":"3840 Г— 2160"}', 40449, true, true),
  ('epson-eh-tw9400', 'Epson EH-TW9400', 'Epson', 'projector', 'РљС–РЅРѕС‚РµР°С‚СЂР°Р»СЊРЅРёР№ Full HD РїСЂРѕС”РєС‚РѕСЂ', '{"brightness":"2600 Р»Рј","resolution":"1920 Г— 1080"}', 150505, true, true),
  ('kef-q750', 'KEF Q750', 'KEF', 'audio', 'РџС–РґР»РѕРіРѕРІР° Р°РєСѓСЃС‚РёС‡РЅР° СЃРёСЃС‚РµРјР°', '{"power":"150 Р’С‚","color":"С‡РѕСЂРЅРёР№"}', 47999, true, true),
  ('samsung-the-frame-65', 'Samsung The Frame 65', 'Samsung', 'tv', 'QLED С‚РµР»РµРІС–Р·РѕСЂ, 65 РґСЋР№РјС–РІ', '{"screen":"65 РґСЋР№РјС–РІ","resolution":"4K UHD"}', 52999, true, true),
  ('acer-x1526', 'Acer X1526', 'Acer', 'projector', 'РЇСЃРєСЂР°РІРёР№ Full HD РїСЂРѕС”РєС‚РѕСЂ РґР»СЏ РѕС„С–СЃСѓ', '{"brightness":"4000 Р»Рј","resolution":"1920 Г— 1080"}', 26688, true, true),
  ('sonos-arc-ultra', 'Sonos Arc Ultra', 'Sonos', 'audio', 'РџСЂРµРјС–Р°Р»СЊРЅРёР№ СЃР°СѓРЅРґР±Р°СЂ Р· РѕР±КјС”РјРЅРёРј Р·РІСѓС‡Р°РЅРЅСЏРј', '{"color":"Р±С–Р»РёР№"}', 38999, false, true)
on conflict (slug) do update set name = excluded.name, brand = excluded.brand, category = excluded.category, description = excluded.description, specifications = excluded.specifications, price = excluded.price, in_stock = excluded.in_stock, is_active = excluded.is_active;

