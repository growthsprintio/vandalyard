/* VANDAL YARD — SEO settings admin */
(function () {
  const $ = id => document.getElementById(id);
  const loginGate = $('loginGate'), panel = $('panel');

  const TEXT_FIELDS = ['robots_extra', 'site_name', 'title_suffix', 'default_meta_description',
    'default_og_image', 'canonical_domain', 'twitter_handle',
    'google_site_verification', 'bing_site_verification', 'ga_measurement_id'];

  function show() { loginGate.classList.add('hidden'); panel.classList.remove('hidden'); load(); }
  function hide() { loginGate.classList.remove('hidden'); panel.classList.add('hidden'); }

  $('loginBtn').addEventListener('click', login);
  $('pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  async function login() {
    sessionStorage.setItem(ADMIN_SECRET_KEY, $('pass').value);
    try {
      await adminApi('ping');
      $('loginErr').textContent = '';
      show();
    } catch (e) {
      sessionStorage.removeItem(ADMIN_SECRET_KEY);
      $('loginErr').textContent = 'Wrong password.';
      $('pass').value = '';
    }
  }

  async function load() {
    const s = await db.getSettings();   // public read is fine
    TEXT_FIELDS.forEach(f => { const el = $('f_' + f); if (el) el.value = s[f] || ''; });
    $('f_index_site').checked = s.index_site !== 'false';
  }

  async function save(statusEl) {
    const data = {};
    TEXT_FIELDS.forEach(f => { data[f] = $('f_' + f).value.trim(); });
    data.index_site = $('f_index_site').checked ? 'true' : 'false';
    statusEl.textContent = 'Saving…';
    try {
      await adminApi('settings.save', { settings: data });
      statusEl.textContent = 'Saved ✓'; statusEl.style.color = '#7ee2a0';
      setTimeout(() => { statusEl.textContent = ''; }, 2500);
    } catch (e) {
      statusEl.textContent = 'Save failed: ' + e.message; statusEl.style.color = '#f28b82';
    }
  }

  $('saveBtn').addEventListener('click', () => save($('saveStatus')));
  $('saveBtn2').addEventListener('click', () => save($('saveStatus2')));

  (async () => {
    if (sessionStorage.getItem(ADMIN_SECRET_KEY)) {
      try { await adminApi('ping'); show(); return; } catch {}
    }
    hide();
  })();
})();
