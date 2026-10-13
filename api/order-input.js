const text=value=>typeof value==='string'?value.trim():'';
export function normalizeOrder(body={}) {
  const customer=body.customer||{}, delivery=body.delivery||{}, payment=body.payment||{};
  const phone=text(customer.phone).replace(/\D/g,'');
  if(!text(customer.name)||!text(customer.lastName)||!/^380\d{9}$/.test(phone)
    ||body.consent!==true||!text(delivery.city)
    ||!['nova_poshta','courier','pickup'].includes(delivery.method)
    ||!['cod','invoice','card'].includes(payment.method)
    ||(delivery.method!=='pickup'&&!text(delivery.address))) throw new Error('Invalid order data');
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>100) throw new Error('Invalid items');
  const quantities=new Map();
  for(const item of body.items) {
    const id=Number(item?.productId),quantity=Number(item?.quantity);
    if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(quantity)||quantity<1||quantity>99) throw new Error('Invalid items');
    if(typeof item?.expectedUnitPrice!=='number'||!Number.isFinite(item.expectedUnitPrice)||item.expectedUnitPrice<0) throw new Error('Invalid price');
    quantities.set(id,(quantities.get(id)||0)+quantity);
    if(quantities.get(id)>99) throw new Error('Invalid items');
  }
  let company=null;
  if(body.company) {
    company=Object.fromEntries(['name','code','contact','invoiceEmail'].map(key=>[key,text(body.company[key])]));
    if(Object.values(company).some(value=>!value)) throw new Error('Invalid company data');
  }
  const labels={nova_poshta:'Нова пошта',courier:'Кур’єр',pickup:'Самовивіз',cod:'При отриманні',invoice:'За рахунком',card:'Карткою онлайн'};
  const comment=[text(delivery.comment),'Доставка: '+labels[delivery.method],'Оплата: '+labels[payment.method],
    ...(company?['Компанія: '+company.name,'ЄДРПОУ / ІПН: '+company.code,'Контакт: '+company.contact,'Email для рахунку: '+company.invoiceEmail]:[])].filter(Boolean).join('\n');
  return {
    customer:{name:text(customer.name),lastName:text(customer.lastName),phone:'+'+phone,email:text(customer.email),newsletter:customer.newsletter===true},
    delivery:{method:delivery.method,city:text(delivery.city),address:text(delivery.address),comment},
    payment:{method:payment.method},company,consent:true,
    items:[...quantities].map(([productId,quantity])=>({productId,quantity,expectedUnitPrice:body.items.find(item=>Number(item.productId)===productId).expectedUnitPrice}))
  };
}
