import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const client = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const listing = document.querySelector('#articlesList');
const home = document.querySelector('.home-main');
const navigation = document.querySelector('.home-top nav');
if (navigation) {
  const link = document.createElement('a');
  link.href = 'articles.html';
  link.textContent = 'Статті та новини';
  navigation.append(link);
}
const card = article => {
  const date = article.published_at ? new Intl.DateTimeFormat('uk-UA', {dateStyle:'long'}).format(new Date(article.published_at)) : '';
  const image = /^https?:\/\//i.test(article.image_url || '') ? '<img src="'+escapeText(article.image_url)+'" alt="'+escapeText(article.title)+'" loading="lazy">' : 'TECHNOROOM';
  return '<a class="article-card" href="article.html?slug='+encodeURIComponent(article.slug)+'"><div class="article-card-visual">'+image+'</div><div class="article-card-copy">'+(date?'<time datetime="'+escapeText(article.published_at)+'">'+escapeText(date)+'</time>':'')+'<h3>'+escapeText(article.title)+'</h3>'+(article.excerpt?'<p>'+escapeText(article.excerpt)+'</p>':'')+'<span class="read-more">Читати статтю →</span></div></a>';
};
if (listing || home) {
  let request = client.from('articles').select('title,slug,excerpt,image_url,published_at').eq('is_published',true).order('published_at',{ascending:false}).order('created_at',{ascending:false});
  if (home) request = request.limit(3);
  const {data,error} = await request;
  if (listing) {
    listing.innerHTML = error ? '<p class="articles-empty">Не вдалося завантажити статті. Спробуйте оновити сторінку.</p>' : data?.length ? '<div class="articles-grid">'+data.map(card).join('')+'</div>' : '<p class="articles-empty">Скоро тут з’являться новини, огляди й поради від TECHNOROOM.</p>';
  } else if (!error && data?.length) {
    const section = document.createElement('section');
    section.className = 'articles-section home-wide';
    section.innerHTML = '<div class="articles-heading"><div><h2>Статті та новини</h2><p>Огляди техніки, корисні поради й пропозиції TECHNOROOM</p></div><a href="articles.html">Усі статті →</a></div><div class="articles-grid">'+data.map(card).join('')+'</div>';
    home.append(section);
  }
}
