import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../public/store-modern.css',import.meta.url),'utf8');
const legacy=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
assert.ok(legacy.includes('height:535px'),'Regression source: desktop gallery used a fixed height');
assert.match(css,/height: clamp\(300px,52vw,440px\); min-height: 300px!important; max-height: 440px/);
assert.match(css,/height: clamp\(260px,75vw,380px\); min-height: 260px!important; max-height: 380px/);
assert.match(css,/\.product-detail-visual \.product-image \{ min-height: 0!important; \}/);
assert.match(css,/font-size: 16px!important/);
assert.match(css,/\.product-code \{ max-width: 100%; white-space: normal; \}/);
assert.match(css,/screen-specification-filter__options label \{ min-height: 44px/);
// Numeric bounds of the CSS clamp expression, not a claim of browser rendering.
for(const width of [320,360,375,390,414,430,640,700]){
  const galleryHeight=Math.max(260,Math.min(width*.75,380));
  assert.ok(galleryHeight>=260&&galleryHeight<=380&&galleryHeight<535);
}
console.log('Mobile source audit: bounded gallery height, image min-height reset, 16px fields, long SKU wrapping and touch targets: PASS (device/browser visual QA pending)');
