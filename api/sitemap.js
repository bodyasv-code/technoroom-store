import {createClient} from '@supabase/supabase-js';
import {visibleCategoryRows} from '../public/category-tree.js';

export const SITE_ORIGIN='https://www.technoroom.com.ua';
const PAGE_SIZE=500;
const xmlEscape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

async function readAll(client,table,columns,filter) {
  const rows=[];
  for(let offset=0;offset<50000;offset+=PAGE_SIZE){
    let query=client.from(table).select(columns).order('id',{ascending:true});
    if(filter) query=query.eq(...filter);
    const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
    if(error||!Array.isArray(data))throw new Error('Sitemap data unavailable');
    rows.push(...data);
    if(data.length<PAGE_SIZE)return rows;
  }
  // Never return a silently incomplete sitemap; split into an index if we outgrow this limit.
  throw new Error('Sitemap index required');
}

export async function sitemapUrls(client) {
  const [products,categories,articles]=await Promise.all([
    readAll(client,'products','id',['is_active',true]),
    readAll(client,'categories','id,slug,parent_id,is_active'),
    readAll(client,'articles','id,slug',['is_published',true])
  ]);
  const urls=[SITE_ORIGIN+'/',SITE_ORIGIN+'/catalog',SITE_ORIGIN+'/articles',SITE_ORIGIN+'/contacts'];
  for(const category of visibleCategoryRows(categories))if(category.slug)urls.push(SITE_ORIGIN+'/catalog?category='+encodeURIComponent(category.slug));
  for(const product of products)if(/^\d+$/.test(String(product.id)))urls.push(SITE_ORIGIN+'/product?id='+encodeURIComponent(product.id));
  for(const article of articles)if(article.slug)urls.push(SITE_ORIGIN+'/article?slug='+encodeURIComponent(article.slug));
  const unique=[...new Set(urls)];
  if(unique.length>50000)throw new Error('Sitemap index required');
  return unique;
}

export function sitemapXml(urls) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    +urls.map(url=>'  <url><loc>'+xmlEscape(url)+'</loc></url>').join('\n')+'\n</urlset>';
}

export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method||'GET')){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
  try{
    const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const xml=sitemapXml(await sitemapUrls(client));
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).send(xml);
  }catch{
    res.setHeader('Cache-Control','no-store');
    return res.status(503).send('Sitemap temporarily unavailable');
  }
}
