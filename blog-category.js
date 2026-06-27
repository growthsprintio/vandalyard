/* VANDAL YARD — Blog category archive */
(async function () {
  // /blog/:category  → take the segment after /blog/
  const parts = location.pathname.split('/').filter(Boolean); // ['blog','category']
  const category = decodeURIComponent(parts[1] || '');
  const niceName = fmtCategory(category);

  document.getElementById('catTitle').textContent = niceName;

  applySEO({
    title: `${niceName} — Vandal Yard Blog`,
    metaTitle: `${niceName} Articles | Vandal Yard Blog`,
    metaDescription: `Read ${niceName} posts on the Vandal Yard blog — graffiti culture and digital art.`,
    canonical: SITE.origin + categoryUrl(category),
  });

  // Breadcrumbs
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: niceName, url: categoryUrl(category) },
  ];
  document.getElementById('breadcrumbs').innerHTML = crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<a href="${c.url}">${escHtml(c.name)}</a><span class="crumb-sep">/</span>`
      : `<span class="crumb-current">${escHtml(c.name)}</span>`
  ).join('');
  injectJsonLd(breadcrumbJsonLd(crumbs), 'jsonld-breadcrumb');

  document.getElementById('adTop').innerHTML = adSlot('blog-cat-top', 'Advertisement');

  const posts = await db.getLivePosts({ category, limit: 60 });
  const grid = document.getElementById('postGrid');
  const empty = document.getElementById('blogEmpty');
  const count = document.getElementById('catCount');

  if (!posts.length) {
    empty.classList.remove('hidden');
  } else {
    count.textContent = `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`;
    grid.innerHTML = posts.map(postCardHtml).join('');
  }

  injectJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: niceName,
    url: SITE.origin + categoryUrl(category),
  }, 'jsonld-collection');

  initAds();
})();
