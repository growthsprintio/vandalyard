/* ============================================================
   VANDAL YARD — Supabase Client
   ============================================================ */

const SUPABASE_URL = 'https://egsijprifrepfxwxyowg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2lqcHJpZnJlcGZ4d3h5b3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDY4NDcsImV4cCI6MjA5NzkyMjg0N30.ehl42kXLszDkpkN0tRfMm_gxJ3fPNBFG1W9jPScDC3A';

const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

const db = {
  async getPieces(page, perPage) {
    const from = page * perPage;
    const to = from + perPage - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pieces?select=*&order=created_at.desc&offset=${from}&limit=${perPage}`,
      { headers: supabaseHeaders }
    );
    return res.json();
  },

  async getTotalCount() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pieces?select=id`,
      { headers: { ...supabaseHeaders, 'Prefer': 'count=exact' } }
    );
    const count = res.headers.get('content-range');
    if (count) {
      const parts = count.split('/');
      return parseInt(parts[1]) || 0;
    }
    const data = await res.json();
    return data.length;
  },

  async insertPiece(piece) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pieces`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(piece),
    });
    return res.json();
  },

  async deletePiece(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pieces?id=eq.${id}`, {
      method: 'DELETE',
      headers: supabaseHeaders,
    });
    return res.ok;
  },

  async deleteAllPieces() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pieces?id=neq.null`, {
      method: 'DELETE',
      headers: supabaseHeaders,
    });
    return res.ok;
  },

  async uploadImage(filename, blob) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/pieces/${filename}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'image/jpeg',
      },
      body: blob,
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/pieces/${filename}`;
  },

  async deleteImage(filename) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/pieces/${filename}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      },
    });
  },

  // ── BLOG ──

  // Public: only live posts (published, or scheduled whose time has arrived)
  async getLivePosts({ category = null, limit = 50, offset = 0 } = {}) {
    const now = new Date().toISOString();
    let q = `${SUPABASE_URL}/rest/v1/blog_posts?select=*`
      + `&or=(status.eq.published,and(status.eq.scheduled,publish_date.lte.${now}))`
      + `&publish_date=lte.${now}`
      + `&order=publish_date.desc&offset=${offset}&limit=${limit}`;
    if (category) q += `&category=eq.${encodeURIComponent(category)}`;
    const res = await fetch(q, { headers: supabaseHeaders });
    return res.ok ? res.json() : [];
  },

  async getPostBySlug(category, slug) {
    const now = new Date().toISOString();
    const q = `${SUPABASE_URL}/rest/v1/blog_posts?select=*`
      + `&category=eq.${encodeURIComponent(category)}`
      + `&slug=eq.${encodeURIComponent(slug)}`
      + `&or=(status.eq.published,and(status.eq.scheduled,publish_date.lte.${now}))`
      + `&limit=1`;
    const res = await fetch(q, { headers: supabaseHeaders });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  },

  // Admin: all posts regardless of status
  async getAllPosts() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=*&order=updated_at.desc`,
      { headers: supabaseHeaders }
    );
    return res.ok ? res.json() : [];
  },

  async getPostById(id) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=*&id=eq.${id}&limit=1`,
      { headers: supabaseHeaders }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  },

  async createPost(post) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
      method: 'POST', headers: supabaseHeaders, body: JSON.stringify(post),
    });
    return res.ok ? (await res.json())[0] : null;
  },

  async updatePost(id, patch) {
    patch.updated_at = new Date().toISOString();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${id}`, {
      method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify(patch),
    });
    return res.ok ? (await res.json())[0] : null;
  },

  async deletePost(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${id}`, {
      method: 'DELETE', headers: supabaseHeaders,
    });
    return res.ok;
  },

  // ── SITE SETTINGS (key/value) ──
  async getSettings() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=key,value`, { headers: supabaseHeaders });
    if (!res.ok) return {};
    const rows = await res.json();
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    return out;
  },

  async saveSetting(key, value) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, value: value == null ? '' : String(value), updated_at: new Date().toISOString() }),
    });
    return res.ok;
  },

  async saveSettings(obj) {
    const rows = Object.entries(obj).map(([key, value]) => ({
      key, value: value == null ? '' : String(value), updated_at: new Date().toISOString(),
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    return res.ok;
  },

  // Upload a blog image to the 'pieces' bucket under a blog/ prefix
  async uploadBlogImage(filename, blob, contentType) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/pieces/blog/${filename}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': contentType || 'image/jpeg',
      },
      body: blob,
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/pieces/blog/${filename}`;
  },
};
