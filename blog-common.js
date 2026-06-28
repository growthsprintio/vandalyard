/* ============================================================
   VANDAL YARD — Blog / SEO shared helpers
   ============================================================ */

const SITE = {
  name: 'Vandal Yard',
  origin: location.origin,              // e.g. https://vandalyard.vercel.app
  defaultOgImage: '/og-default.png',
  twitter: '@vandalyard',
};

// AdSense publisher id. Leave empty until you have one — slots render as
// reserved (invisible) placeholders so there's no layout shift, and no
// AdSense script loads (zero performance/privacy cost until configured).
const ADSENSE_CLIENT = ''; // e.g. 'ca-pub-1234567890123456'

// ── Text / date utilities ──

function escHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function fmtCategory(cat) {
  if (!cat) return '';
  return cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function slugify(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Strip HTML to plain text (for meta descriptions / excerpts)
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

// ── SEO: inject/update <head> tags ──

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function applySEO(opts) {
  const title = opts.metaTitle || opts.title;
  if (title) document.title = title;
  setMeta('name', 'description', opts.metaDescription);
  setLink('canonical', opts.canonical || (SITE.origin + location.pathname));

  // Open Graph
  setMeta('property', 'og:type', opts.ogType || 'website');
  setMeta('property', 'og:site_name', SITE.name);
  setMeta('property', 'og:title', opts.ogTitle || title);
  setMeta('property', 'og:description', opts.ogDescription || opts.metaDescription);
  setMeta('property', 'og:url', opts.canonical || (SITE.origin + location.pathname));
  setMeta('property', 'og:image', opts.ogImage || (SITE.origin + SITE.defaultOgImage));

  // Twitter
  setMeta('name', 'twitter:card', opts.ogImage ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', opts.ogTitle || title);
  setMeta('name', 'twitter:description', opts.ogDescription || opts.metaDescription);
  setMeta('name', 'twitter:image', opts.ogImage || (SITE.origin + SITE.defaultOgImage));
}

// JSON-LD injection
function injectJsonLd(obj, id) {
  let s = document.getElementById(id || 'jsonld');
  if (!s) {
    s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id || 'jsonld';
    document.head.appendChild(s);
  }
  s.textContent = JSON.stringify(obj);
}

function articleJsonLd(post, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    image: post.featured_image ? [post.featured_image] : undefined,
    datePublished: post.publish_date,
    dateModified: post.updated_at || post.publish_date,
    author: { '@type': 'Person', name: post.author || 'Anonymous' },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: SITE.origin + '/icon.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: fmtCategory(post.category),
    keywords: (post.tags || []).join(', '),
  };
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE.origin + it.url,
    })),
  };
}

// ── Post URL + card helpers ──

function postUrl(post) {
  return `/blog/${encodeURIComponent(post.category)}/${encodeURIComponent(post.slug)}`;
}

function categoryUrl(cat) {
  return `/blog/${encodeURIComponent(cat)}`;
}

function postCardHtml(post) {
  const img = post.featured_image
    ? `<img class="post-card-img" src="${escHtml(post.featured_image)}" alt="${escHtml(post.featured_alt || post.title)}" loading="lazy">`
    : `<div class="post-card-img post-card-noimg"></div>`;
  const desc = post.excerpt || stripHtml(post.body).slice(0, 140);
  return `
    <a class="post-card" href="${postUrl(post)}">
      ${img}
      <div class="post-card-body">
        <span class="post-card-cat">${escHtml(fmtCategory(post.category))}</span>
        <h3 class="post-card-title">${escHtml(post.title)}</h3>
        <p class="post-card-excerpt">${escHtml(desc)}</p>
        <span class="post-card-date">${escHtml(fmtDate(post.publish_date))}</span>
      </div>
    </a>`;
}

// ── AdSense slot ──
// Renders a reserved ad container (fixed min-height → no layout shift).
// If ADSENSE_CLIENT is set, loads the AdSense script once and fills slots.
function adSlot(slotId, label) {
  return `
    <div class="ad-slot" data-ad-slot="${slotId || ''}" aria-hidden="true">
      <span class="ad-slot-label">${label || 'Advertisement'}</span>
    </div>`;
}

let _adsenseLoaded = false;
function initAds() {
  if (!ADSENSE_CLIENT) return; // not configured — leave reserved placeholders
  if (!_adsenseLoaded) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
    _adsenseLoaded = true;
  }
  document.querySelectorAll('.ad-slot').forEach(el => {
    if (el.dataset.filled) return;
    el.dataset.filled = '1';
    el.innerHTML = `<ins class="adsbygoogle" style="display:block"
        data-ad-client="${ADSENSE_CLIENT}"
        data-ad-slot="${el.dataset.adSlot}"
        data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  });
}
