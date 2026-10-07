import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const trustedHosts = new Set([
  'www.tradeinn.com', 'www.audiotrends.com.au', 'static-ecapac.acer.com', 'media4home.com.pl',
  'media.sonos.com', 'images.samsung.com', 'assets2.razerzone.com', 'd7qztf2ityad6.cloudfront.net',
  'hp.widen.net', 'img06.en25.com', 'koss.com.ua', 'ssl-product-images.www8-hp.com', 'www.3ona51.com',
  'www.hp.com', 'www.koss.com', 'yugcontract.ua', 'www.it4profit.com', 'content.it4profit.com', 'erc.ua', 'www.erc.ua',
]);
const isTrustedHost = (hostname = '') => trustedHosts.has(hostname) || hostname === 'erc.ua' || hostname.endsWith('.erc.ua');

const extensionFor = (contentType) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}[String(contentType || '').split(';')[0].toLowerCase()] || 'jpg');

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && isTrustedHost(url.hostname) ? url : null;
  } catch {
    return null;
  }
};

const fetchTrustedImage = async (url, redirectsLeft = 2) => {
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'TECHNOROOM catalog importer' },
    redirect: 'manual',
  });
  if (![301, 302, 303, 307, 308].includes(upstream.status)) return upstream;
  if (!redirectsLeft) return null;
  const next = safeUrl(new URL(upstream.headers.get('location') || '', url));
  return next ? fetchTrustedImage(next, redirectsLeft - 1) : null;
};

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).end();
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return response.status(401).json({ error: 'Потрібна авторизація.' });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (!profile) return response.status(403).json({ error: 'Доступ заборонено.' });

  const productId = Number(request.body?.productId);
  const urls = [...new Set(Array.isArray(request.body?.urls) ? request.body.urls : [])]
    .map(safeUrl)
    .filter(Boolean)
    .slice(0, 6);
  if (!Number.isInteger(productId) || !urls.length) return response.status(400).json({ error: 'Невірні дані для імпорту фото.' });

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,image_path,image_paths')
    .eq('id', productId)
    .maybeSingle();
  if (productError || !product) return response.status(404).json({ error: 'Товар не знайдено.' });

  const uploaded = [];
  for (let index = 0; index < urls.length; index += 1) {
    try {
      const upstream = await fetchTrustedImage(urls[index]);
      if (!upstream) continue;
      const type = upstream.headers.get('content-type') || '';
      const length = Number(upstream.headers.get('content-length') || 0);
      if (!upstream.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type.split(';')[0].toLowerCase()) || length > 10 * 1024 * 1024) continue;
      const image = Buffer.from(await upstream.arrayBuffer());
      if (image.length > 10 * 1024 * 1024) continue;
      const path = `products/import-${productId}-${Date.now()}-${index}.${extensionFor(type)}`;
      const { error } = await supabase.storage.from('product-images').upload(path, image, { contentType: type, upsert: false });
      if (!error) uploaded.push(path);
    } catch {}
  }

  if (!uploaded.length) return response.status(422).json({ error: 'Жодне зображення не вдалося безпечно завантажити.' });
  const imagePaths = [...new Set([product.image_path, ...(Array.isArray(product.image_paths) ? product.image_paths : []), ...uploaded].filter(Boolean))];
  const { error: updateError } = await supabase.from('products').update({ image_path: product.image_path || uploaded[0], image_paths: imagePaths }).eq('id', productId);
  if (updateError) return response.status(500).json({ error: updateError.message });
  return response.status(200).json({ uploaded: uploaded.length });
}
