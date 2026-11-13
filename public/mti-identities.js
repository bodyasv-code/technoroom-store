const pairs=new Map([['VS16905','PA503S'],['VS19343','PA700X'],['VS19341','PA700S'],['VS20135','PX700HDH'],['VS19746','PX704HD'],['VS20642','LSD400HD-ST'],['VS20579','LSD300W-ST'],['VS20996','LSD600W']]);
const key=v=>String(v??'').trim().toUpperCase();
export function verifiedMtiIdentity(row){
 if(key(row.supplierSku)===key(row.sku))return true;
 return key(row.vendor)==='VIEWSONIC'&&pairs.get(key(row.sku))===key(row.supplierSku)&&key(row.model)===key(row.supplierSku);
}
