import assert from 'node:assert/strict';
import {imageDimensions,inspectImage} from '../tools/audit-merchant-feed.mjs';
const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(800,16);png.writeUInt32BE(600,20);
assert.deepEqual(imageDimensions(png),{width:800,height:600,format:'png'});
const jpeg=Buffer.from([255,216,255,192,0,17,8,2,88,3,32,3,1,17,0,2,17,0,3,17,0]);
assert.deepEqual(imageDimensions(jpeg),{width:800,height:600,format:'jpeg'});
const gif=Buffer.alloc(10);gif.write('GIF89a');gif.writeUInt16LE(200,6);gif.writeUInt16LE(100,8);assert.deepEqual(imageDimensions(gif),{width:200,height:100,format:'gif'});
const webp=Buffer.alloc(30);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(799,24,3);webp.writeUIntLE(599,27,3);assert.deepEqual(imageDimensions(webp),{width:800,height:600,format:'webp'});
assert.equal(imageDimensions(Buffer.from('not an image')),null);
const original=globalThis.fetch;let cancelled=false;
try{
 globalThis.fetch=async()=>({ok:false,status:429,headers:new Headers({'retry-after':'60'}),body:{cancel:async()=>{cancelled=true;}}});
 assert.deepEqual(await inspectImage('https://example.test/photo.jpg'),{status:429,error:'http_error',retryAfter:'60'});assert.ok(cancelled);
 globalThis.fetch=async()=>new Response(png,{status:206,headers:{'content-type':'image/png','content-range':'bytes 0-23/1234'}});
 const result=await inspectImage('https://example.test/photo.png');assert.equal(result.width,800);assert.equal(result.height,600);assert.equal(result.bytes,1234);
}finally{globalThis.fetch=original;}
console.log('Read-only image audit: bounded header dimensions, content-range size and explicit rate-limit status; no network in tests: PASS');
