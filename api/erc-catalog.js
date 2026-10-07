import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ERC_ENDPOINT = 'https://connect.erc.ua/connectservice/api/specprice/DoExport';
const safeId = (value) => String(value || '').trim().match(/^[A-Za-z0-9._-]{1,80}$/) ? String(value).trim() : '';
const list = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(safeId).filter(Boolean))].slice(0, 20);

const requireAdmin = async (request, response) => {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) { response.status(401).json({ error: 'Потрібна авторизація.' }); return false; }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (!profile) { response.status(403).json({ error: 'Доступ заборонено.' }); return false; }
  return true;
};

const parseResponse = (value) => {
  let parsed = value;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) parsed = JSON.parse(parsed);
  for (let depth = 0; depth < 3 && parsed && !Array.isArray(parsed); depth += 1) parsed = parsed.data || parsed.d || parsed.items || parsed.result || parsed;
  return Array.isArray(parsed) ? parsed : [];
};

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).end();
  if (!await requireAdmin(request, response)) return;

  const configured = Boolean(process.env.ERC_API_EMAIL && process.env.ERC_API_PASSWORD);
  if (request.body?.action === 'status') return response.status(200).json({ configured });
  if (!configured) return response.status(503).json({ error: 'Підключення ERC ще не налаштоване на сервері.' });

  const sku = safeId(request.body?.sku);
  const vendorIds = list(request.body?.vendorIds);
  const categoryIds = list(request.body?.categoryIds);
  if (!sku && !vendorIds.length && !categoryIds.length) return response.status(400).json({ error: 'Вкажіть SKU або код бренду чи категорії ERC.' });

  const payload = {
    Email: process.env.ERC_API_EMAIL,
    Pass: process.env.ERC_API_PASSWORD,
    InfoType: 6,
    IsJson: true,
    Lang: 'uk-ua',
    ...(sku ? { Ware: sku } : {}),
    ...(vendorIds.length ? { VendorId: vendorIds.length === 1 ? vendorIds[0] : vendorIds } : {}),
    ...(categoryIds.length ? { CategoryId: categoryIds.length === 1 ? categoryIds[0] : categoryIds } : {}),
    ...(request.body?.onlyFree ? { OnlyFree: true } : {}),
    ...(request.body?.isNew ? { IsNew: true } : {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(ERC_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const raw = await upstream.text();
    if (!upstream.ok) return response.status(502).json({ error: 'ERC відхилив запит. Перевірте доступ і дозволену IP-адресу сервера.' });
    let items;
    try { items = parseResponse(raw); } catch { return response.status(502).json({ error: 'ERC повернув відповідь у неочікуваному форматі.' }); }
    if (items.length > 1000) return response.status(413).json({ error: 'ERC повернув понад 1000 товарів. Звузьте запит за SKU, брендом або категорією.' });
    return response.status(200).json({ items, total: items.length });
  } catch (error) {
    return response.status(502).json({ error: error.name === 'AbortError' ? 'ERC не відповів вчасно.' : 'Не вдалося з’єднатися з ERC.' });
  } finally { clearTimeout(timer); }
}
