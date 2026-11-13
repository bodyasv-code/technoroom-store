import assert from 'node:assert/strict';
import {verifiedMtiIdentity as valid} from '../public/mti-identities.js';
for(const [sku,model] of [['VS16905','PA503S'],['VS19343','PA700X'],['VS19341','PA700S'],['VS20135','PX700HDH'],['VS19746','PX704HD'],['VS20642','LSD400HD-ST'],['VS20579','LSD300W-ST'],['VS20996','LSD600W']]){
 const row={sku,model,supplierSku:model,vendor:'ViewSonic'};assert.equal(valid(row),true);assert.equal(valid({...row,model:'OTHER'}),false);assert.equal(valid({...row,vendor:'Epson'}),false);assert.equal(valid({...row,supplierSku:'OTHER'}),false);
}
console.log('PASS: eight exact pairs, model and brand guards');
