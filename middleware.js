/* ============================================================
   VANDAL YARD — Edge middleware
   Optional IP allowlist for admin pages.

   Set Vercel env var ADMIN_ALLOW_IPS to a comma-separated list of
   IPs that may reach the admin pages, e.g. "1.2.3.4, 5.6.7.8".
   - If unset/empty → fail OPEN (everyone can reach the pages, but
     they still require the ADMIN_SECRET to do anything).
   - If set → everyone else gets a 404 (the pages appear not to exist).
   ============================================================ */

export const config = {
  matcher: ['/admin.html', '/admin-blog.html', '/admin-seo.html'],
};

export default function middleware(request) {
  const raw = (process.env.ADMIN_ALLOW_IPS || '').trim();
  if (!raw) return; // not configured → allow through (secret still gates actions)

  const allow = raw.split(',').map(s => s.trim()).filter(Boolean);
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = (fwd.split(',')[0] || request.headers.get('x-real-ip') || '').trim();

  if (ip && allow.includes(ip)) return; // allowed

  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain' },
  });
}
