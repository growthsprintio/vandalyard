/* Vercel serverless function → /robots.txt
   Built from site_settings so it's controllable from the SEO admin. */

const SUPABASE_URL = 'https://egsijprifrepfxwxyowg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2lqcHJpZnJlcGZ4d3h5b3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDY4NDcsImV4cCI6MjA5NzkyMjg0N30.ehl42kXLszDkpkN0tRfMm_gxJ3fPNBFG1W9jPScDC3A';

async function getSettings() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=key,value`,
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    if (!r.ok) return {};
    const rows = await r.json();
    const o = {}; rows.forEach(x => o[x.key] = x.value); return o;
  } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  const origin = `https://${req.headers.host}`;
  const s = await getSettings();
  const indexSite = s.index_site !== 'false'; // default: allow indexing

  const lines = ['User-agent: *'];
  if (indexSite) {
    lines.push('Allow: /');
  } else {
    lines.push('Disallow: /');
  }

  // Always keep admin/tooling out of the index
  lines.push('Disallow: /admin.html');
  lines.push('Disallow: /admin-blog.html');
  lines.push('Disallow: /admin-seo.html');

  // Custom extra rules from the SEO admin
  if (s.robots_extra) {
    String(s.robots_extra).split('\n').forEach(l => { if (l.trim()) lines.push(l.trim()); });
  }

  const sitemapBase = s.canonical_domain && s.canonical_domain.trim() ? s.canonical_domain.replace(/\/$/, '') : origin;
  lines.push('');
  lines.push(`Sitemap: ${sitemapBase}/sitemap.xml`);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(lines.join('\n') + '\n');
};
