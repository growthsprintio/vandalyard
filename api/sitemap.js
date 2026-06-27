/* Vercel serverless function → /sitemap.xml
   Builds a sitemap from static pages + live blog posts/categories. */

const SUPABASE_URL = 'https://egsijprifrepfxwxyowg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2lqcHJpZnJlcGZ4d3h5b3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDY4NDcsImV4cCI6MjA5NzkyMjg0N30.ehl42kXLszDkpkN0tRfMm_gxJ3fPNBFG1W9jPScDC3A';

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'hourly' },
  { loc: '/go-paint.html', priority: '0.9', changefreq: 'weekly' },
  { loc: '/about.html', priority: '0.7', changefreq: 'monthly' },
  { loc: '/blog', priority: '0.8', changefreq: 'daily' },
  { loc: '/terms.html', priority: '0.3', changefreq: 'yearly' },
];

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports = async (req, res) => {
  const origin = `https://${req.headers.host}`;
  const now = new Date().toISOString();

  let posts = [];
  try {
    const q = `${SUPABASE_URL}/rest/v1/blog_posts?select=category,slug,updated_at,publish_date`
      + `&or=(status.eq.published,and(status.eq.scheduled,publish_date.lte.${now}))`
      + `&publish_date=lte.${now}&order=publish_date.desc&limit=1000`;
    const r = await fetch(q, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    if (r.ok) posts = await r.json();
  } catch (e) { /* fall through with static-only sitemap */ }

  const categories = [...new Set(posts.map(p => p.category))];

  const urls = [];
  for (const p of STATIC_PAGES) {
    urls.push(`<url><loc>${origin}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
  }
  for (const c of categories) {
    urls.push(`<url><loc>${origin}/blog/${encodeURIComponent(c)}</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`);
  }
  for (const post of posts) {
    const loc = `${origin}/blog/${encodeURIComponent(post.category)}/${encodeURIComponent(post.slug)}`;
    const lastmod = (post.updated_at || post.publish_date || now).slice(0, 10);
    urls.push(`<url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
};
