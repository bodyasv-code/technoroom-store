export const COMMERCE_EVENT='technoroom:commerce';
export const ANALYTICS_READY='technoroom:analytics-ready';

// Strict analytics allowlist: no names, contacts, addresses, comments or form data.
export function normalizeCommerce(name,detail) {
  if(!['add_to_cart','begin_checkout','purchase'].includes(name)||!Array.isArray(detail?.items)||!detail.items.length||detail.items.length>200)return null;
  const items=[];
  for(const entry of detail.items){
    const id=String(entry.item_id??''),price=Number(entry.price),quantity=Number(entry.quantity);
    if(!/^[1-9]\d{0,15}$/.test(id)||!Number.isFinite(price)||price<0||price>1e9||!Number.isInteger(quantity)||quantity<1||quantity>99)return null;
    items.push({item_id:id,price:Math.round(price*100)/100,quantity});
  }
  const value=Math.round(items.reduce((sum,item)=>sum+Math.round(item.price*100)*item.quantity,0))/100;
  if(!Number.isFinite(value))return null;
  const payload={currency:'UAH',value,items};
  if(name==='purchase'){
    const id=String(detail.orderId??'');
    if(!/^[1-9]\d{0,18}$/.test(id))return null;
    payload.transaction_id='TR-'+id;
  }
  return payload;
}

export function commerceItems(rows,priceFor) {
  try{return rows.map(({product,quantity})=>({item_id:String(product.id),price:priceFor(product),quantity}));}catch{return [];}
}

export function reportCommerce(name,detail) {
  try{
    // Events before consent are dropped, never saved or replayed after consent.
    if(typeof document==='undefined')return;
    document.dispatchEvent(new CustomEvent(COMMERCE_EVENT,{detail:{name,detail}}));
  }catch{/* Analytics must never interrupt a cart change or a saved order. */}
}
