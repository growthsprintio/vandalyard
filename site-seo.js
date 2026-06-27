/* ============================================================
   VANDAL YARD — Global SEO application (public pages)
   Reads site_settings and applies verification tags, analytics,
   and a global noindex switch. Order-independent / additive.
   ============================================================ */
(async function () {
  function meta(attr, key, content) {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  let s = {};
  try { s = (typeof db !== 'undefined' && db.getSettings) ? await db.getSettings() : {}; }
  catch (e) { s = {}; }

  // Global noindex switch
  if (s.index_site === 'false') {
    meta('name', 'robots', 'noindex, nofollow');
  }

  // Search engine verification
  meta('name', 'google-site-verification', s.google_site_verification);
  meta('name', 'msvalidate.01', s.bing_site_verification);

  // Default OG image if a page didn't set one
  if (s.default_og_image && !document.head.querySelector('meta[property="og:image"]')) {
    meta('property', 'og:image', s.default_og_image);
  }

  // Google Analytics (GA4)
  if (s.ga_measurement_id && /^G-/.test(s.ga_measurement_id)) {
    const id = s.ga_measurement_id.trim();
    const g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id);
  }
})();
