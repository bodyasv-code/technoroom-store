// Server only. Credentials must never be included in public/ or logs.
export const mailbox='office@tehnoroom.com.ua';
const tenant='ac889dad-6a53-42d4-83ec-bc5e771daaa0';
const client='a4d3b3b5-81a1-4c45-bed7-89660a65d64e';
export function orderMail(order) {
  const money=value=>new Intl.NumberFormat('uk-UA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value))+' ₴';
  return {subject:`TECHNOROOM: нове замовлення №${order.id}`,text:[
    `Нове замовлення №${order.id}`,`Сума: ${money(order.total)}`,'',
    ...(order.order_items||[]).map(item=>`${item.product_name} — ${item.quantity} шт. × ${money(item.unit_price)}`),
    '', 'Деталі замовлення: https://www.technoroom.com.ua/admin#orders',
    'Контактні дані покупця доступні лише в адмінці.'
  ].join('\n')};
}
export async function sendMicrosoftMail(message,{secret=process.env.MS_GRAPH_CLIENT_SECRET,fetcher=fetch}={}) {
  if(!secret) return {status:'not_configured'};
  const request=async(url,options)=>{
    try {return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});}
    catch {throw new Error('mail_network_error');}
  };
  const tokenResponse=await request(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:client,client_secret:secret,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})
  });
  if(!tokenResponse.ok)throw new Error(`mail_auth_${tokenResponse.status}`);
  const token=await tokenResponse.json();
  if(!token.access_token)throw new Error('mail_auth_invalid_response');
  const sent=await request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,{
    method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({message:{subject:message.subject,body:{contentType:'Text',content:message.text},
      toRecipients:[{emailAddress:{address:mailbox}}]},saveToSentItems:true})
  });
  // 202 means accepted, not proof of final mailbox delivery. Don't retry ambiguous sends.
  if(sent.status!==202)throw new Error(`mail_send_${sent.status}`);
  return {status:'accepted'};
}
export async function notifyNewOrder(db,id,{sender=sendMicrosoftMail}={}) {
  let order;
  let result;
  try {
    const loaded=await db.from('orders').select('id,total,checkout_details,order_items(product_name,unit_price,quantity)').eq('id',id).single();
    if(loaded.error||!loaded.data)throw new Error('mail_order_read_failed');
    order=loaded.data;
    result=await sender(orderMail(order));
  } catch(error) {
    const code=/^mail_[a-z0-9_]+$/.test(error.message)?error.message:'mail_internal_error';
    result={status:'failed',code};
  }
  if(order) {
    try {
      const saved=await db.from('orders').update({checkout_details:{...order.checkout_details,
        notification:{...result,at:new Date().toISOString(),
          ...(order.checkout_details?.notification?.status==='retrying'?{
            attempt:order.checkout_details.notification.attempt,requested_by:order.checkout_details.notification.requested_by}: {})}}}).eq('id',id);
      if(saved.error) console.warn('Order mail status could not be saved',{orderId:id});
    } catch {console.warn('Order mail status could not be saved',{orderId:id});}
  }
  if(result.status!=='accepted')console.warn('Order email notification not accepted',{orderId:id,...result});
  return result;
}
