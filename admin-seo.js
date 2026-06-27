/* VANDAL YARD — SEO settings admin */
(function () {
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h.toString();
  }
  const ADMIN_HASH = simpleHash('vandalyard2025');
  const SESSION_KEY = 'vandalyard_admin_session';
  const $ = id => document.getElementById(id);

  const loginGate = $('loginGate'), panel = $('panel');

  // text/textarea fields
  const TEXT_FIELDS = ['robots_extra', 'site_name', 'title_suffix', 'default_meta_description',
    'default_og_image', 'canonical_domain', 'twitter_handle',
    'google_site_verification', 'bing_site_verification', 'ga_measurement_id'];

  function loggedIn() { return sessionStorage.getItem(SESSION_KEY) === ADMIN_HASH; }
  function show() { loginGate.classList.add('hidden'); panel.classList.remove('hidden'); load(); }
  function hide() { loginGate.classList.remove('hidden'); panel.classList.add('hidden'); }

  $('loginBtn').addEventListener('click', login);
  $('pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  function login() {
    if (simpleHash($('pass').value) === ADMIN_HASH) {
      sessionStorage.setItem(SESSION_KEY, ADMIN_HASH);
      $('loginErr').textContent = '';
      show();
    } else { $('loginErr').textContent = 'Wrong password.'; $('pass').value = ''; }
  }

  async function load() {
    const s = await db.getSettings();
    TEXT_FIELDS.forEach(f => { const el = $('f_' + f); if (el) el.value = s[f] || ''; });
    $('f_index_site').checked = s.index_site !== 'false';
  }

  async function save(statusEl) {
    const data = {};
    TEXT_FIELDS.forEach(f => { data[f] = $('f_' + f).value.trim(); });
    data.index_site = $('f_index_site').checked ? 'true' : 'false';
    statusEl.textContent = 'Saving…';
    const ok = await db.saveSettings(data);
    statusEl.textContent = ok ? 'Saved ✓' : 'Save failed — check Supabase setup';
    statusEl.style.color = ok ? '#7ee2a0' : '#f28b82';
    if (ok) setTimeout(() => { statusEl.textContent = ''; }, 2500);
  }

  $('saveBtn').addEventListener('click', () => save($('saveStatus')));
  $('saveBtn2').addEventListener('click', () => save($('saveStatus2')));

  if (loggedIn()) show(); else hide();
})();
