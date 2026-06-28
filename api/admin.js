/* ============================================================
   VANDAL YARD — Gated admin API (serverless)
   All privileged writes go through here. Auth = ADMIN_SECRET.
   Writes use the Supabase service-role key (bypasses RLS), so
   the public anon key can stay read/insert-only.

   Required Vercel env vars:
     SUPABASE_SERVICE_ROLE  — service_role key (Supabase → Settings → API)
     ADMIN_SECRET           — a strong password you choose
   ============================================================ */

const SUPABASE_URL = 'https://egsijprifrepfxwxyowg.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function sbHeaders(extra) {
  return Object.assign({
    apikey: SERVICE,
    Authorization: 'Bearer ' + SERVICE,
    'Content-Type': 'application/json',
  }, extra || {});
}

function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}

async function sbFetch(path, opts) {
  const res = await fetch(`${SUPABASE_URL}${path}`, opts);
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { ok: res.ok, status: res.status, json };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  if (!SERVICE || !ADMIN_SECRET) {
    res.status(500).json({ error: 'server not configured (missing SUPABASE_SERVICE_ROLE or ADMIN_SECRET)' });
    return;
  }

  // ── Auth gate ──
  const secret = req.headers['x-admin-secret'] || (req.headers.authorization || '').replace('Bearer ', '');
  if (!secret || secret !== ADMIN_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }

  const body = await readBody(req);
  const action = body.action;

  try {
    switch (action) {
      case 'ping':
        return res.status(200).json({ ok: true });

      // ── Blog ──
      case 'blog.list': {
        const r = await sbFetch('/rest/v1/blog_posts?select=*&order=updated_at.desc', { headers: sbHeaders() });
        return res.status(200).json(r.json || []);
      }
      case 'blog.get': {
        const r = await sbFetch(`/rest/v1/blog_posts?select=*&id=eq.${encodeURIComponent(body.id)}&limit=1`, { headers: sbHeaders() });
        return res.status(200).json((r.json && r.json[0]) || null);
      }
      case 'blog.create': {
        const r = await sbFetch('/rest/v1/blog_posts', {
          method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body.post || {}),
        });
        return res.status(r.ok ? 200 : 400).json(r.ok ? (r.json && r.json[0]) : { error: r.json });
      }
      case 'blog.update': {
        const patch = body.patch || {};
        patch.updated_at = new Date().toISOString();
        const r = await sbFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(body.id)}`, {
          method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(patch),
        });
        return res.status(r.ok ? 200 : 400).json(r.ok ? (r.json && r.json[0]) : { error: r.json });
      }
      case 'blog.delete': {
        const r = await sbFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: sbHeaders() });
        return res.status(r.ok ? 200 : 400).json({ ok: r.ok });
      }

      // ── Settings ──
      case 'settings.save': {
        const rows = Object.entries(body.settings || {}).map(([key, value]) => ({
          key, value: value == null ? '' : String(value), updated_at: new Date().toISOString(),
        }));
        const r = await sbFetch('/rest/v1/site_settings', {
          method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows),
        });
        return res.status(r.ok ? 200 : 400).json({ ok: r.ok });
      }

      // ── Wall pieces ──
      case 'piece.delete': {
        await sbFetch(`/rest/v1/pieces?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: sbHeaders() });
        if (body.filename) {
          await sbFetch(`/storage/v1/object/pieces/${encodeURIComponent(body.filename)}`, {
            method: 'DELETE', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
          });
        }
        return res.status(200).json({ ok: true });
      }
      case 'piece.deleteAll': {
        await sbFetch('/rest/v1/pieces?id=neq.00000000', { method: 'DELETE', headers: sbHeaders() });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'unknown action' });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
