/* ============================================================
   VANDAL YARD — Shared site footer (injected)
   Used on content pages (wall, blog, about, legal).
   Not used on the full-screen studio (go-paint).
   ============================================================ */
(function () {
  const year = new Date().getFullYear();
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <a href="/" class="brand">Vandal Yard</a>
        <p>Free, anonymous digital graffiti. Paint a train, a wall or a rooftop and throw it up for the yard to see.</p>
        <a class="site-footer-cta" href="/go-paint.html">Grab a can &rarr;</a>
      </div>
      <nav class="site-footer-cols" aria-label="Footer">
        <div>
          <h2>Paint</h2>
          <a href="/go-paint.html">Go paint</a>
          <a href="/">The wall</a>
        </div>
        <div>
          <h2>Read</h2>
          <a href="/blog">Blog</a>
          <a href="/about.html">About</a>
          <a href="/contact.html">Contact</a>
        </div>
        <div>
          <h2>Legal</h2>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <button type="button" class="site-footer-linkbtn" data-cookie-settings>Cookie settings</button>
        </div>
      </nav>
    </div>
    <div class="site-footer-base">
      <span>&copy; ${year} Vandal Yard</span>
      <span>Paint freely. Stay respectful.</span>
    </div>`;

  footer.querySelector('[data-cookie-settings]').addEventListener('click', () => {
    if (window.vyConsent) window.vyConsent.open();
  });

  const mount = document.getElementById('app') || document.body;
  mount.appendChild(footer);
  document.body.classList.add('has-site-footer');
})();
