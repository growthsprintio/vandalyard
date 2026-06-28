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
        <span class="wall-piece-title">${escHtml(piece.title)}</span>
        <div class="wall-piece-meta">
          <span class="wall-piece-artist">${escHtml(piece.artist)}</span><br>
          ${timeAgo(piece.created_at)}
        </div>
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

renderGallery();
