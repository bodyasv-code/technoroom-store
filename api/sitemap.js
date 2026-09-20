import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const baseUrl = 'https://technoroom-store.vercel.app';

    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/catalog.html`
    ];

    products.forEach(product => {
      urls.push(
        `${baseUrl}/product.html?id=${product.id}`
      );
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `
  <url>
    <loc>${url}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`).join('')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (error) {
    res.status(500).send('Sitemap generation failed');
  }
}
