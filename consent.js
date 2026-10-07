/* ============================================================
   VANDAL YARD — Cookie consent (Google Consent Mode v2)
   Load synchronously as the FIRST script in <head>, before the
   AdSense and gtag tags, so consent defaults are queued first.
   - EEA/UK/CH: everything denied until the visitor chooses.
   - Elsewhere: granted by default; "Reject" turns it off.
   A saved choice always wins, everywhere.
   ============================================================ */
(function () {
  var KEY = 'vy_consent_v1';
  var EEA = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH'];

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (!window.gtag) window.gtag = gtag;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function signals(c) {
    var ads = c.ads ? 'granted' : 'denied';
    return {
      ad_storage: ads, ad_user_data: ads, ad_personalization: ads,
      analytics_storage: c.analytics ? 'granted' : 'denied',
    };
  }
  function applyAdsPersonalization(c) {
    // Legacy AdSense flag — non-personalized ads until ad consent is given
    (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = c.ads ? 0 : 1;
  }

  var saved = read();
  if (saved) {
    gtag('consent', 'default', signals(saved));
    applyAdsPersonalization(saved);
  } else {
    gtag('consent', 'default', signals({ ads: true, analytics: true }));
    gtag('consent', 'default', Object.assign(signals({ ads: false, analytics: false }), { region: EEA, wait_for_update: 500 }));
  }
  gtag('set', 'ads_data_redaction', !saved || !saved.ads);
  gtag('set', 'url_passthrough', true);

  function save(c) {
    c = { analytics: !!c.analytics, ads: !!c.ads, ts: Date.now(), v: 1 };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    gtag('consent', 'update', signals(c));
    gtag('set', 'ads_data_redaction', !c.ads);
    applyAdsPersonalization(c);
    close();
  }

  // ── Banner UI ──
  var el = null;
  function close() {
    if (!el) return;
    el.classList.remove('is-open');
    var node = el; el = null;
    setTimeout(function () { node.remove(); }, 250);
  }

  function open(startCustom) {
    if (el) return;
    var cur = read() || { analytics: true, ads: true };
    el = document.createElement('div');
    el.className = 'vy-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'vyConsentTitle');
    el.innerHTML =
      '<p class="vy-consent-title" id="vyConsentTitle">Cookies, quickly</p>' +
      '<p class="vy-consent-text">We use cookies to count visits and to show ads that keep Vandal Yard free. ' +
        'Your art and painting work fine either way. <a href="/privacy.html">Privacy policy</a></p>' +
      '<div class="vy-consent-prefs" hidden>' +
        '<label class="vy-consent-row"><span><b>Essential</b><small>Remembers this choice and your likes.</small></span>' +
          '<input type="checkbox" checked disabled></label>' +
        '<label class="vy-consent-row"><span><b>Analytics</b><small>Anonymous visit stats (Google Analytics).</small></span>' +
          '<input type="checkbox" data-k="analytics"' + (cur.analytics ? ' checked' : '') + '></label>' +
        '<label class="vy-consent-row"><span><b>Advertising</b><small>Personalized ads from Google AdSense.</small></span>' +
          '<input type="checkbox" data-k="ads"' + (cur.ads ? ' checked' : '') + '></label>' +
      '</div>' +
      '<div class="vy-consent-actions">' +
        '<button type="button" class="vy-c-btn vy-c-ghost" data-act="custom">Customize</button>' +
        '<button type="button" class="vy-c-btn vy-c-ghost" data-act="reject">Reject all</button>' +
        '<button type="button" class="vy-c-btn vy-c-solid" data-act="accept">Accept all</button>' +
      '</div>';

    var prefs = el.querySelector('.vy-consent-prefs');
    function showPrefs() {
      prefs.hidden = false;
      var b = el.querySelector('[data-act="custom"]');
      b.textContent = 'Save choices';
      b.setAttribute('data-act', 'save');
    }
    el.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'accept') save({ analytics: true, ads: true });
      else if (act === 'reject') save({ analytics: false, ads: false });
      else if (act === 'custom') showPrefs();
      else if (act === 'save') save({
        analytics: el.querySelector('[data-k="analytics"]').checked,
        ads: el.querySelector('[data-k="ads"]').checked,
      });
    });
    document.body.appendChild(el);
    if (startCustom) showPrefs();
    setTimeout(function () { if (el) el.classList.add('is-open'); }, 20);
  }

  // Public hook: footer "Cookie settings" link reopens the banner
  window.vyConsent = { open: function () { open(true); }, get: read };

  // If Google's own certified CMP (AdSense "Privacy & messaging") is active,
  // it handles consent — don't stack a second banner on top of it.
  function googleCmpActive() { return typeof window.__tcfapi === 'function'; }

  function boot() {
    if (read()) return;
    setTimeout(function () { if (!read() && !googleCmpActive()) open(false); }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
