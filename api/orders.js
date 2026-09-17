import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { customer, delivery, items } = request.body ?? {};
  if (!customer?.name || !customer?.phone || !Array.isArray(items) || !items.length) {
    return response.status(400).json({ error: 'Invalid order data' });
  }

  const normalizedItems = items.map((item) => ({ productId: Number(item.productId), quantity: Math.max(1, Number(item.quantity) || 1) }));
  if (normalizedItems.some((item) => !Number.isInteger(item.productId))) return response.status(400).json({ error: 'Invalid product' });

  const { data: orderId, error } = await supabase.rpc('create_store_order', {
    p_customer_name: customer.name.trim(),
    p_customer_phone: customer.phone.trim(),
    p_customer_email: customer.email || '',
    p_city: delivery?.city || '',
    p_address: delivery?.address || '',
    p_comment: delivery?.comment || '',
    p_items: normalizedItems,
  });

  if (error) {
    const unavailable = /unavailable/i.test(error.message || '');
    return response.status(unavailable ? 409 : 500).json({ error: unavailable ? 'One or more items are unavailable' : 'Unable to create order' });
  }
  return response.status(201).json({ orderId });
}

