/* VANDAL YARD — Blog home */
(async function () {
  applySEO({
    title: 'Blog — Vandal Yard',
    metaTitle: 'Blog — Graffiti Culture & Digital Art | Vandal Yard',
    metaDescription: 'Graffiti culture, digital art technique, and dispatches from the wall. A free, anonymous place to paint.',
    canonical: SITE.origin + '/blog',
  });
  injectJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Vandal Yard Journal',
    url: SITE.origin + '/blog',
    description: 'Graffiti culture, digital art technique, and dispatches from the wall.',
  });

  const grid = document.getElementById('postGrid');
  const empty = document.getElementById('blogEmpty');
  const chips = document.getElementById('categoryChips');
  document.getElementById('adTop').innerHTML = adSlot('blog-top', 'Advertisement');

  const posts = await db.getLivePosts({ limit: 60 });

  if (!posts.length) {
    empty.classList.remove('hidden');
  } else {
    grid.innerHTML = posts.map(postCardHtml).join('');
    // category chips from live posts
    const cats = [...new Set(posts.map(p => p.category))];
    chips.innerHTML = cats.map(c =>
      `<a class="category-chip" href="${categoryUrl(c)}">${escHtml(fmtCategory(c))}</a>`
    ).join('');
  }

  initAds();
})();
