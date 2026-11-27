export const LEAD_EVENT='technoroom:lead';

function numericId(value,maxLength) {
  if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<1))return null;
  if(typeof value!=='number'&&typeof value!=='string')return null;
  const id=String(value);
  return /^[1-9]\d*$/.test(id)&&id.length<=maxLength?id:null;
}

// The saved inquiry ID is only for local deduplication; never send it or form fields to Google.
export function normalizeLead(detail) {
  const productId=numericId(detail?.productId,16),inquiryId=numericId(detail?.inquiryId,19);
  if(!productId||!inquiryId)return null;
  return {inquiryId,payload:{lead_source:'product_inquiry',item_id:productId}};
}

export function reportLead(detail) {
  try{
    const lead=normalizeLead(detail);
    if(!lead||typeof document==='undefined')return;
    document.dispatchEvent(new CustomEvent(LEAD_EVENT,{detail:{productId:lead.payload.item_id,inquiryId:lead.inquiryId}}));
  }catch{/* Analytics must never interrupt a saved inquiry. */}
}
