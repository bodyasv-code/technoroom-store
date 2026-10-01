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

  const { productId, customer } = request.body ?? {};
  const id = Number(productId);
  if (!Number.isInteger(id) || !customer?.name?.trim() || !customer?.phone?.trim()) {
    return response.status(400).json({ error: 'Вкажіть товар, ім’я та номер телефону' });
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,name,sku,price,is_active')
    .eq('id', id)
    .single();
  if (productError || !product?.is_active) return response.status(404).json({ error: 'Товар не знайдено' });

  const comment = ['Запит на товар під замовлення. Потрібно уточнити строк постачання.', customer.comment?.trim()]
    .filter(Boolean).join(' ');
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: customer.name.trim(),
      customer_phone: customer.phone.trim(),
      customer_email: customer.email?.trim() || null,
      comment,
      total: Number(product.price) || 0,
    })
    .select('id')
    .single();
  if (orderError) return response.status(500).json({ error: 'Не вдалося створити запит' });

  const { error: itemError } = await supabase.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    unit_price: Number(product.price) || 0,
    quantity: 1,
  });
  if (itemError) {
    await supabase.from('orders').delete().eq('id', order.id);
    return response.status(500).json({ error: 'Не вдалося зберегти товар у запиті' });
  }
  return response.status(201).json({ orderId: order.id });
}
