/* VANDAL YARD — Blog CMS logic */
(function () {
  // ── Auth (shared password with wall admin) ──
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h.toString();
  }
  const ADMIN_HASH = simpleHash('vandalyard2025');
  const SESSION_KEY = 'vandalyard_admin_session';

  const $ = id => document.getElementById(id);
  const loginGate = $('loginGate'), listView = $('listView'), editView = $('editView');

  function loggedIn() { return sessionStorage.getItem(SESSION_KEY) === ADMIN_HASH; }
  function showLogin() { loginGate.classList.remove('hidden'); listView.classList.add('hidden'); editView.classList.add('hidden'); }
  function showList() { loginGate.classList.add('hidden'); listView.classList.remove('hidden'); editView.classList.add('hidden'); renderList(); }
  function showEditor() { loginGate.classList.add('hidden'); listView.classList.add('hidden'); editView.classList.remove('hidden'); }

  $('loginBtn').addEventListener('click', login);
  $('pass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  function login() {
    if (simpleHash($('pass').value) === ADMIN_HASH) {
      sessionStorage.setItem(SESSION_KEY, ADMIN_HASH);
      $('loginErr').textContent = '';
      showList();
    } else {
      $('loginErr').textContent = 'Wrong password.';
      $('pass').value = '';
    }
  }
  $('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });

  // ── Post list ──
  async function renderList() {
    const posts = await db.getAllPosts();
    const list = $('postList'), empty = $('listEmpty');
    if (!posts.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    list.innerHTML = posts.map(p => {
      const thumb = p.featured_image
        ? `<img class="cms-row-thumb" src="${escHtml(p.featured_image)}" alt="">`
        : `<div class="cms-row-thumb"></div>`;
      return `<div class="cms-row" data-id="${p.id}">
        ${thumb}
        <div class="cms-row-info">
          <div class="cms-row-title">${escHtml(p.title)}</div>
          <div class="cms-row-meta">
            <span class="cms-badge badge-${p.status}">${p.status.toUpperCase()}</span>
            /blog/${escHtml(p.category)}/${escHtml(p.slug)} &middot; ${fmtDate(p.publish_date)}
          </div>
        </div>
        <button class="cms-btn edit-btn" data-id="${p.id}">EDIT</button>
        <a class="cms-btn" href="/blog/${encodeURIComponent(p.category)}/${encodeURIComponent(p.slug)}" target="_blank">VIEW</a>
      </div>`;
    }).join('');
    list.querySelectorAll('.edit-btn').forEach(b =>
      b.addEventListener('click', () => openEditor(b.dataset.id)));
  }

  $('newPostBtn').addEventListener('click', () => openEditor(null));
  $('backBtn').addEventListener('click', showList);

  // ── Editor ──
  let editingId = null;

  const fields = ['title','body','excerpt','status','publish_date','author','category','slug','tags',
    'featured_image','featured_alt','meta_title','meta_description','canonical_url',
    'og_title','og_description','og_image'];

  function setVal(name, v) { const el = $('f_' + name); if (el) el.value = v == null ? '' : v; }
  function getVal(name) { const el = $('f_' + name); return el ? el.value.trim() : ''; }

  async function openEditor(id) {
    editingId = id;
    $('deleteBtn').classList.toggle('hidden', !id);
    $('editorTitle').textContent = id ? 'EDIT POST' : 'NEW POST';

    // populate category datalist
    const all = await db.getAllPosts();
    const cats = [...new Set(all.map(p => p.category))];
    $('catList').innerHTML = cats.map(c => `<option value="${escHtml(c)}">`).join('');

    if (id) {
      const p = await db.getPostById(id);
      setVal('title', p.title); setVal('body', p.body); setVal('excerpt', p.excerpt);
      setVal('status', p.status); setVal('author', p.author || 'Anonymous');
      setVal('category', p.category); setVal('slug', p.slug);
      setVal('tags', (p.tags || []).join(', '));
      setVal('featured_image', p.featured_image); setVal('featured_alt', p.featured_alt);
      setVal('meta_title', p.meta_title); setVal('meta_description', p.meta_description);
      setVal('canonical_url', p.canonical_url);
      setVal('og_title', p.og_title); setVal('og_description', p.og_description); setVal('og_image', p.og_image);
      setVal('publish_date', toLocalInput(p.publish_date));
    } else {
      fields.forEach(f => setVal(f, ''));
      setVal('author', 'Anonymous');
      setVal('status', 'draft');
      setVal('category', 'culture');
      setVal('publish_date', toLocalInput(new Date().toISOString()));
    }
    syncPreview();
    showEditor();
  }

  // datetime helpers
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(v) { return v ? new Date(v).toISOString() : new Date().toISOString(); }

  // Auto-slug from title (only if slug empty or untouched)
  let slugTouched = false;
  $('f_slug').addEventListener('input', () => { slugTouched = true; });
  $('f_title').addEventListener('input', () => {
    if (!slugTouched) $('f_slug').value = slugify($('f_title').value);
    syncPreview();
  });
  ['f_category','f_slug','f_meta_title','f_meta_description','f_excerpt','f_featured_image',
   'f_og_title','f_og_description','f_og_image'].forEach(id => {
    $(id).addEventListener('input', syncPreview);
  });

  function syncPreview() {
    const cat = getVal('category') || 'category';
    const slug = getVal('slug') || 'slug';
    $('catEcho').textContent = cat;
    $('serpUrl').textContent = `vandalyard.vercel.app › blog › ${cat}`;
    const mt = getVal('meta_title') || getVal('title') || 'Post title';
    const md = getVal('meta_description') || getVal('excerpt') || 'Meta description preview…';
    $('serpTitle').textContent = mt;
    $('serpDesc').textContent = md.slice(0, 160);

    // char counts
    countField('mtCount', getVal('meta_title').length || getVal('title').length, 60);
    countField('mdCount', (getVal('meta_description') || getVal('excerpt')).length, 160);

    // OG preview
    const ogt = getVal('og_title') || mt;
    const ogd = getVal('og_description') || md;
    const ogi = getVal('og_image') || getVal('featured_image');
    $('ogTitle').textContent = ogt;
    $('ogDesc').textContent = ogd.slice(0, 120);
    const ogImg = $('ogImg');
    if (ogi) { ogImg.src = ogi; ogImg.style.display = 'block'; } else { ogImg.style.display = 'none'; }

    // featured thumb
    const fi = getVal('featured_image');
    const tp = $('thumbPreview');
    if (fi) { tp.src = fi; tp.classList.remove('hidden'); } else { tp.classList.add('hidden'); }
  }

  function countField(elId, len, max) {
    const el = $(elId);
    el.textContent = `${len}/${max}`;
    el.className = 'char-count ' + (len === 0 ? '' : len <= max ? 'char-ok' : 'char-bad');
  }

  // ── Body editor toolbar ──
  document.querySelectorAll('.editor-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta = $('f_body');
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e);
      let ins = '';
      if (btn.dataset.link) {
        const url = prompt('Link URL (use /blog/... or /index.html for internal links):', 'https://');
        if (!url) return;
        ins = `<a href="${url}">${sel || 'link text'}</a>`;
      } else {
        const tag = btn.dataset.wrap;
        if (tag === 'ul') ins = `<ul>\n  <li>${sel || 'item'}</li>\n</ul>`;
        else ins = `<${tag}>${sel || ''}</${tag}>`;
      }
      ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
      ta.focus();
      syncPreview();
    });
  });

  // ── Featured image upload ──
  $('f_image_file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}.${ext}`;
    $('f_featured_image').value = 'uploading…';
    const url = await db.uploadBlogImage(name, file, file.type);
    $('f_featured_image').value = url || '';
    if (!url) alert('Image upload failed.');
    syncPreview();
  });

  // ── Save ──
  function collect(status) {
    const tags = getVal('tags').split(',').map(t => t.trim()).filter(Boolean);
    return {
      title: getVal('title') || 'Untitled',
      slug: getVal('slug') || slugify(getVal('title')) || ('post-' + Date.now().toString(36)),
      category: slugify(getVal('category')) || 'news',
      tags,
      excerpt: getVal('excerpt'),
      body: getVal('body'),
      featured_image: getVal('featured_image'),
      featured_alt: getVal('featured_alt'),
      author: getVal('author') || 'Anonymous',
      status: status || getVal('status'),
      publish_date: fromLocalInput(getVal('publish_date')),
      meta_title: getVal('meta_title'),
      meta_description: getVal('meta_description'),
      og_title: getVal('og_title'),
      og_description: getVal('og_description'),
      og_image: getVal('og_image'),
      canonical_url: getVal('canonical_url'),
    };
  }

  async function save(forceStatus) {
    const data = collect(forceStatus);
    if (forceStatus) $('f_status').value = forceStatus;
    let result;
    if (editingId) result = await db.updatePost(editingId, data);
    else result = await db.createPost(data);
    if (!result) { alert('Save failed. Check Supabase setup.'); return; }
    showList();
  }

  $('saveDraftBtn').addEventListener('click', () => save('draft'));
  $('publishBtn').addEventListener('click', () => {
    // If scheduled date is in the future and status is scheduled, keep scheduled; else publish now
    const st = getVal('status');
    save(st === 'scheduled' ? 'scheduled' : 'published');
  });

  $('deleteBtn').addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('Delete this post permanently?')) return;
    await db.deletePost(editingId);
    showList();
  });

  // ── Init ──
  if (loggedIn()) showList(); else showLogin();
})();
