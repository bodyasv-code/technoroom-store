import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const trustedHosts = new Set([
  'www.tradeinn.com',
  'www.audiotrends.com.au',
  'static-ecapac.acer.com',
  'media4home.com.pl',
]);

export default async function handler(request, response) {
  const id = Number(request.query.id);
  if (!Number.isInteger(id)) return response.status(400).end('Invalid product');

  const { data: product, error } = await supabase
    .from('products')
    .select('image_path')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !product?.image_path?.startsWith('http')) return response.status(404).end('Image not found');

  let url;
  try { url = new URL(product.image_path); } catch { return response.status(404).end('Image not found'); }
  if (!trustedHosts.has(url.hostname)) return response.status(403).end('Image source not allowed');

  try {
    const upstream = await fetch(url, { headers: { 'User-Agent': 'TECHNOROOM image service' } });
    if (!upstream.ok) return response.status(upstream.status).end('Image unavailable');
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return response.status(415).end('Invalid image');
    response.setHeader('Content-Type', type);
    response.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return response.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return response.status(502).end('Image unavailable');
  }
}

