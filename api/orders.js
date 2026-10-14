import { createClient } from '@supabase/supabase-js';
import {normalizeOrder} from './order-input.js';
import {notifyNewOrder} from './microsoft-order-mail.js';

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

  let payload;
  try { payload=normalizeOrder(request.body ?? {}); } catch {
    return response.status(400).json({ error: 'Invalid order data' });
  }
  const { data: orderId, error } = await supabase.rpc('create_store_order_v2', {p_payload:payload});

  if (error) {
    if (/Price changed/i.test(error.message||'')) return response.status(409).json({error:'Ціна товару змінилася. Оновіть сторінку й перевірте суму.'});
    const unavailable = /unavailable/i.test(error.message || '');
    return response.status(unavailable ? 409 : 500).json({ error: unavailable ? 'One or more items are unavailable' : 'Unable to create order' });
  }
  // An email outage must never turn a saved order into an error and cause duplicates.
  let notification;
  try {notification=await notifyNewOrder(supabase,orderId);}
  catch {notification={status:'failed'};console.warn('Order email failed',{orderId});}
  return response.status(201).json({ orderId,notification:notification.status });
}

