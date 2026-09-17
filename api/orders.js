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

  const productIds = items.map((item) => item.productId);
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, price, in_stock')
    .in('id', productIds)
    .eq('is_active', true);

  if (productError || products.length !== productIds.length || products.some((product) => !product.in_stock)) {
    return response.status(400).json({ error: 'One or more items are unavailable' });
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = items.map((item) => ({ product: byId.get(item.productId), quantity: Math.max(1, Number(item.quantity) || 1) }));
  const total = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ customer_name: customer.name, customer_phone: customer.phone, customer_email: customer.email || null, city: delivery?.city || null, address: delivery?.address || null, comment: delivery?.comment || null, total })
    .select('id')
    .single();

  if (orderError) return response.status(500).json({ error: 'Unable to create order' });
  const { error: linesError } = await supabase.from('order_items').insert(lines.map((line) => ({ order_id: order.id, product_id: line.product.id, product_name: line.product.name, unit_price: line.product.price, quantity: line.quantity })));
  if (linesError) return response.status(500).json({ error: 'Unable to create order items' });
  return response.status(201).json({ orderId: order.id });
}

