import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('ERC function includes browser-shared modules with versioned ESM imports',()=>{
  const root=new URL('../',import.meta.url);
  const config=JSON.parse(readFileSync(new URL('vercel.json',root),'utf8'));
  assert.equal(config.functions['api/erc-catalog.js'].includeFiles,'public/**/*.js');
  const visited=new Set();
  function visit(url){
    url=new URL(url);url.search='';
    if(visited.has(url.href))return;
    visited.add(url.href);
    assert.ok(existsSync(url),`Missing shared module ${url.pathname}`);
    const source=readFileSync(url,'utf8');
    for(const match of source.matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/gu)){
      const child=new URL(match[1],url);child.search='';
      assert.ok(child.pathname.startsWith(new URL('public/',root).pathname));
      visit(child);
    }
  }
  visit(new URL('public/product-content-preview.js',root));
  assert.ok(visited.size>1);
});
