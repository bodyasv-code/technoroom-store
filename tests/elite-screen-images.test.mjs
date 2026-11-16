import test from 'node:test';
import assert from 'node:assert/strict';
import {isEliteScreenImageUrl} from '../server/elite-screen-image-source.js';
test('Shared manufacturer CDN accepts only the three exact reviewed files',()=>{
  const photo='https://cdn02.plentyone.com/i1qqodjcsbke/item/images/224/full/newYardMasterDual-FrontEScopy.png';
  assert.equal(isEliteScreenImageUrl(new URL(photo)),true);
  for(const value of [photo.replace('https:','http:'),photo.replace('i1qqodjcsbke','other-tenant'),photo+'?url=http://localhost',photo.replace('cdn02.plentyone.com','cdn02.plentyone.com.evil.example'),photo.replace('newYardMasterDual-FrontEScopy.png','unreviewed.png')])assert.equal(isEliteScreenImageUrl(new URL(value)),false);
});
