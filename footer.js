/* ============================================================
   VANDAL YARD — Shared site footer (injected)
   Used on content pages (wall, blog, about, terms).
   Not used on the full-screen studio (go-paint).
   ============================================================ */
(function () {
  const year = new Date().getFullYear();
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer-inner">
      <nav class="site-footer-links" aria-label="Footer">
        <a href="/index.html">The Wall</a>
        <a href="/go-paint.html">Go Paint</a>
        <a href="/blog/">Blog</a>
        <a href="/about.html">About</a>
        <a href="/terms.html">Terms</a>
      </nav>
      <div class="site-footer-meta">
        &copy; ${year} Vandal Yard &middot; Anonymous digital graffiti &middot; Paint freely, stay respectful.
      </div>
    </div>`;

  const mount = document.getElementById('app') || document.body;
  mount.appendChild(footer);
  document.body.classList.add('has-site-footer');
})();
