import assert from 'node:assert/strict';
import {productGalleryPaths,galleryImageUrl} from '../public/admin-product-gallery.js';

const product={image_path:'products/main.jpg',image_paths:['products/side.jpg','products/main.jpg','products/side.jpg','',null]};
const before=JSON.stringify(product);
assert.deepEqual(productGalleryPaths(product),['products/main.jpg','products/side.jpg']);
assert.deepEqual(productGalleryPaths(product,'https://static.mti.ua/new.jpg'),['https://static.mti.ua/new.jpg','products/side.jpg']);
assert.deepEqual(productGalleryPaths(product,''),['products/main.jpg','products/side.jpg'],'Clearing the URL follows the existing save fallback');
assert.equal(JSON.stringify(product),before,'Opening a gallery must not mutate saved photo order');
assert.deepEqual(productGalleryPaths({image_path:'only-main.png'}),['only-main.png']);
assert.deepEqual(productGalleryPaths({image_paths:['gallery-only.png']}),['gallery-only.png']);
assert.deepEqual(productGalleryPaths(null),[]);
const storage=path=>'https://storage.example/product-images/'+path;
assert.equal(galleryImageUrl('products/a.png',storage),'https://storage.example/product-images/products/a.png');
assert.equal(galleryImageUrl('https://static.mti.ua/product/photo.jpg',storage),'https://static.mti.ua/product/photo.jpg');
for(const value of ['javascript:alert(1)','data:image/svg+xml,unsafe','file:///C:/private.jpg','//untrusted.example/x','https:\n//bad.example'])assert.equal(galleryImageUrl(value,storage),'');
console.log('Admin gallery: main photo, deduplication, replacement/save consistency, immutability, storage paths and unsafe URL rejection: PASS');
