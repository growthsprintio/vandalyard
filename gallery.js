/* ============================================================
   VANDAL YARD — Gallery / Wall (Supabase-backed)
   ============================================================ */

const PIECES_PER_PAGE = 10;
const MAX_PAGES = 5;

const galleryGrid  = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const pageNav      = document.getElementById('pageNav');

let currentPage = 0;

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function escHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Likes (one per browser, tracked in localStorage) ──
function likedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('vy_liked') || '[]')); }
  catch { return new Set(); }
}
function hasLiked(id) { return likedSet().has(id); }
function markLiked(id) {
  const s = likedSet(); s.add(id);
  localStorage.setItem('vy_liked', JSON.stringify([...s]));
}
const HEART = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2 5 5.2 5c2 0 3.3 1.1 3.8 2 .5-.9 1.8-2 3.8-2C16 5 17.6 8.3 16 11.7 15.5 12.8 12 21 12 21z"/></svg>';
function likeBtnHtml(piece) {
  const liked = hasLiked(piece.id);
  return `<button class="like-btn${liked ? ' liked' : ''}" data-id="${piece.id}" aria-label="Like this piece" ${liked ? 'aria-pressed="true"' : ''}>
    ${HEART}<span class="like-count">${piece.likes || 0}</span>
  </button>`;
}
async function handleLike(id, btn) {
  if (hasLiked(id)) return;
  markLiked(id);
  btn.classList.add('liked');
  const countEl = btn.querySelector('.like-count');
  const optimistic = (parseInt(countEl.textContent, 10) || 0) + 1;
  countEl.textContent = optimistic;
  const real = await db.likePiece(id);
  if (typeof real === 'number') countEl.textContent = real;
}

async function renderGallery() {
  const total = await db.getTotalCount();

  if (total === 0) {
    galleryGrid.innerHTML = '';
    galleryEmpty.classList.remove('hidden');
    pageNav.innerHTML = '';
    return;
  }

  galleryEmpty.classList.add('hidden');

  const totalPages = Math.min(MAX_PAGES, Math.ceil(total / PIECES_PER_PAGE));
  if (currentPage >= totalPages) currentPage = totalPages - 1;

  const pieces = await db.getPieces(currentPage, PIECES_PER_PAGE);

  galleryGrid.innerHTML = pieces.map(piece => `
    <div class="wall-piece" data-id="${piece.id}">
      <img class="wall-piece-img" src="${escHtml(piece.image_url)}" alt="${escHtml(piece.title)}" loading="lazy">
      <div class="wall-piece-info">
        <div class="wall-piece-titles">
          <span class="wall-piece-title">${escHtml(piece.title)}</span>
          <div class="wall-piece-meta">
            <span class="wall-piece-artist">${escHtml(piece.artist)}</span> &middot; ${timeAgo(piece.created_at)}
          </div>
        </div>
        ${likeBtnHtml(piece)}
      </div>
    </div>
  `).join('');

  if (totalPages > 1) {
    let html = '';
    for (let i = 0; i < totalPages; i++) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i + 1}</button>`;
    }
    pageNav.innerHTML = html;
    pageNav.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        renderGallery();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  } else {
    pageNav.innerHTML = '';
  }
}

// Lightbox
const lightbox      = document.getElementById('lightbox');
const lightboxImg   = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxMeta  = document.getElementById('lightboxMeta');

let galleryCache = [];

async function openLightboxById(id) {
  if (galleryCache.length === 0) {
    galleryCache = await db.getPieces(currentPage, PIECES_PER_PAGE);
  }
  const piece = galleryCache.find(p => p.id === id);
  if (!piece) return;

  lightboxImg.src = piece.image_url;
  lightboxImg.alt = piece.title;
  lightboxTitle.textContent = piece.title;
  lightboxMeta.textContent = piece.artist + '  ·  ' + timeAgo(piece.created_at);
  const likeWrap = document.getElementById('lightboxLike');
  if (likeWrap) {
    likeWrap.innerHTML = likeBtnHtml(piece);
    const b = likeWrap.querySelector('.like-btn');
    b.addEventListener('click', () => handleLike(piece.id, b));
  }
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
}

document.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

galleryGrid.addEventListener('click', e => {
  const like = e.target.closest('.like-btn');
  if (like) { e.stopPropagation(); handleLike(like.dataset.id, like); return; }
  const piece = e.target.closest('.wall-piece');
  if (!piece) return;
  galleryCache = []; // refresh cache
  openLightboxById(piece.dataset.id);
});

// Clean ad slot on the wall (reserved space; fills only if AdSense is configured)
if (typeof adSlot === 'function') {
  const adEl = document.getElementById('galleryAd');
  if (adEl) { adEl.innerHTML = adSlot('wall-bottom', 'Advertisement'); if (typeof initAds === 'function') initAds(); }
}

// Hero: flick a few blog featured images onto the "table" (link to posts)
async function renderHero() {
  const el = document.getElementById('heroPieces');
  if (!el) return;
  let posts = [];
  try { posts = await db.getLivePosts({ limit: 12 }); } catch { posts = []; }
  const withImg = posts.filter(p => p.featured_image).slice(0, 3);
  if (!withImg.length) { el.style.display = 'none'; return; }
  el.innerHTML = withImg.map(p =>
    `<a class="hero-flick" href="${postUrl(p)}" title="${escHtml(p.title)}">
       <img src="${escHtml(p.featured_image)}" alt="${escHtml(p.featured_alt || p.title)}" loading="eager">
     </a>`
  ).join('');
  el.removeAttribute('aria-hidden');
}
renderHero();

renderGallery();
