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
};
