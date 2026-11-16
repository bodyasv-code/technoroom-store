import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProductSpecificationText} from '../public/admin-specification-text.js';

test('Unchanged multi-aspect screen retains array and numeric JSON values',()=>{
  const original={'Діагональ':['80″','74″','65″'],'Співвідношення сторін':['16:9','16:10','4:3'],'Вага':10};
  const text=Object.entries(original).map(([key,value])=>key+': '+value).join('\n');
  assert.deepEqual(parseProductSpecificationText(text,original),original);
  assert.deepEqual(parseProductSpecificationText(text+'\nКолір: Білий',original),{...original,'Колір':'Білий'});
});
test('Explicit edits remain text, removed rows stay removed and inner colons survive',()=>{
  assert.deepEqual(parseProductSpecificationText('Діагональ: 100″\nСпіввідношення сторін: 16:9\nДокумент: https://example.com/a:b',{'Діагональ':['80″','65″'],'Вага':10}),{'Діагональ':'100″','Співвідношення сторін':'16:9','Документ':'https://example.com/a:b'});
});
