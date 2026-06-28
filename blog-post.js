/* VANDAL YARD — Single blog post */
(async function () {
  const parts = location.pathname.split('/').filter(Boolean); // ['blog', cat, slug]
  const category = decodeURIComponent(parts[1] || '');
  const slug = decodeURIComponent(parts[2] || '');

  const article = document.getElementById('article');
  const notFound = document.getElementById('notFound');

  const post = (category && slug) ? await db.getPostBySlug(category, slug) : null;

  if (!post) {
    notFound.classList.remove('hidden');
    applySEO({
      title: 'Not found — Vandal Yard Blog',
      metaTitle: 'Post not found — Vandal Yard',
      metaDescription: 'This post could not be found.',
    });
    // Discourage indexing of the empty state
    setMeta('name', 'robots', 'noindex');
    return;
  }

  const url = SITE.origin + postUrl(post);
  const niceCat = fmtCategory(post.category);

  // ── SEO ──
  applySEO({
    title: post.title,
    metaTitle: post.meta_title || `${post.title} | Vandal Yard`,
    metaDescription: post.meta_description || post.excerpt || stripHtml(post.body).slice(0, 155),
    canonical: post.canonical_url || url,
    ogType: 'article',
    ogTitle: post.og_title || post.meta_title || post.title,
    ogDescription: post.og_description || post.meta_description || post.excerpt,
    ogImage: post.og_image || post.featured_image,
  });

  injectJsonLd(articleJsonLd(post, url), 'jsonld-article');

  // ── Breadcrumbs ──
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: niceCat, url: categoryUrl(post.category) },
    { name: post.title, url: postUrl(post) },
  ];
  document.getElementById('breadcrumbs').innerHTML = crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<a href="${c.url}">${escHtml(c.name)}</a><span class="crumb-sep">/</span>`
      : `<span class="crumb-current">${escHtml(c.name)}</span>`
  ).join('');
  injectJsonLd(breadcrumbJsonLd(crumbs), 'jsonld-breadcrumb');

  // ── Render article ──
  const catLink = document.getElementById('artCat');
  catLink.textContent = niceCat;
  catLink.href = categoryUrl(post.category);
  document.getElementById('artTitle').textContent = post.title;
  document.getElementById('artAuthor').textContent = post.author || 'Anonymous';
  const dt = document.getElementById('artDate');
  dt.textContent = fmtDate(post.publish_date);
  dt.setAttribute('datetime', post.publish_date);

  if (post.featured_image) {
    const img = document.getElementById('artImage');
    img.src = post.featured_image;
    img.alt = post.featured_alt || post.title;
    img.classList.remove('hidden');
  }

  const isDesktop = window.matchMedia('(min-width: 960px)').matches;

  // Desktop: top ad lives in the sticky sidebar with the TOC.
  // Mobile: keep the inline top ad placement.
  if (isDesktop) {
    document.getElementById('adSide').innerHTML = adSlot('blog-post-side', 'Advertisement');
  } else {
    document.getElementById('adTop').innerHTML = adSlot('blog-post-top', 'Advertisement');
  }
  document.getElementById('adBottom').innerHTML = adSlot('blog-post-bottom', 'Advertisement');

  // Body: stored as HTML. Insert a mid-article ad after the 3rd block.
  document.getElementById('artBody').innerHTML = injectMidAd(post.body || '');

  // Build the table of contents from headings (desktop sidebar)
  buildTOC();

  // Tags
  if (post.tags && post.tags.length) {
    document.getElementById('artTags').innerHTML =
      '<span class="tags-label">Tags:</span> ' +
      post.tags.map(t => `<span class="tag-pill">${escHtml(t)}</span>`).join('');
  }

  article.classList.remove('hidden');

  // ── Related posts (internal linking) ──
  const related = (await db.getLivePosts({ category: post.category, limit: 4 }))
    .filter(p => p.id !== post.id).slice(0, 3);
  if (related.length) {
    document.getElementById('relatedGrid').innerHTML = related.map(postCardHtml).join('');
    document.getElementById('related').classList.remove('hidden');
  }

  initAds();

  // Build a table of contents from h2/h3 headings in the article body
  function buildTOC() {
    const sidebar = document.getElementById('postSidebar');
    const toc = document.getElementById('toc');
    const headings = document.querySelectorAll('#artBody h2, #artBody h3');
    if (headings.length < 2) {
      // Not enough structure for a TOC — hide the card, keep the ad
      document.querySelector('.toc-card')?.classList.add('hidden');
      return;
    }
    let html = '';
    headings.forEach((h, i) => {
      const id = h.id || ('section-' + i);
      h.id = id;
      const level = h.tagName === 'H3' ? ' toc-sub' : '';
      html += `<a href="#${id}" class="toc-link${level}" data-target="${id}">${escHtml(h.textContent)}</a>`;
    });
    toc.innerHTML = html;

    // Smooth scroll + active highlight
    toc.querySelectorAll('.toc-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const el = document.getElementById(a.dataset.target);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
      });
    });

    const links = [...toc.querySelectorAll('.toc-link')];
    const spy = () => {
      let current = links[0];
      headings.forEach((h, i) => {
        if (h.getBoundingClientRect().top - 90 <= 0) current = links[i];
      });
      links.forEach(l => l.classList.toggle('active', l === current));
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  // Insert a native in-content ad slot after the Nth paragraph/block
  function injectMidAd(html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const blocks = Array.from(wrap.children);
    if (blocks.length >= 6) {
      const ad = document.createElement('div');
      ad.innerHTML = adSlot('blog-post-mid', 'Advertisement');
      blocks[2].after(ad.firstElementChild);
    }
    return wrap.innerHTML;
  }
})();
