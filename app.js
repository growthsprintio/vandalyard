/* ============================================================
   VANDAL YARD — Paint Studio Engine
   ============================================================ */

// ── Color presets ──

const COLORS = [
  '#FFFFFF', '#C0C0C0', '#808080', '#000000',
  '#FF0000', '#CC3333', '#FF6600', '#FFCC00',
  '#33CC33', '#006600', '#0099FF', '#0033CC',
  '#9933FF', '#FF00FF', '#FF69B4', '#8B4513',
];

// ── Cap configs ──

const CAPS = {
  thin:   { radius: 3 },
  medium: { radius: 8 },
  fat:    { radius: 14 },
  flare:  { radius: 22 },
};

// ── Surface definitions ──

const SURFACES = {
  train:     { label: 'Classic Train',   generate: generateTrainSurface,     mask: generateTrainMask },
  wall:      { label: 'Brick Wall',      generate: generateWallSurface,      mask: generateWallMask },
  freight:   { label: 'Freight Boxcar',  generate: generateFreightSurface,   mask: generateFreightMask },
  billboard: { label: 'City Billboard',  generate: generateBillboardSurface, mask: generateBillboardMask },
  overpass:  { label: 'Highway Overpass', generate: generateOverpassSurface,  mask: generateOverpassMask },
  watertower:{ label: 'Water Tower',      generate: generateWaterTowerSurface, mask: generateWaterTowerMask },
};

// ── App state ──

const state = {
  color: '#FFFFFF',
  cap: 'medium',
  opacity: 0.85,
  brush: 'spray',
  surface: 'train',
  showGrid: false,
  showMask: false,
  strokes: [],
  current: null,
  painting: false,
  lastPoint: null,
  velocity: 0,
};

// ── DOM refs ──

const bgCanvas     = document.getElementById('bgCanvas');
const paintCanvas  = document.getElementById('paintCanvas');
const gridCanvas   = document.getElementById('gridCanvas');
const maskCanvasEl = document.getElementById('maskCanvas');
const canvasWrap   = document.getElementById('canvasWrap');
const cursorRing   = document.getElementById('cursorRing');

const bgCtx    = bgCanvas.getContext('2d');
const paintCtx = paintCanvas.getContext('2d');
const gridCtx  = gridCanvas.getContext('2d');
const maskCtx  = maskCanvasEl.getContext('2d');

// Offscreen mask for hit-testing (not displayed)
let maskData = null;

// ══════════════════════════════════
//  SURFACE GENERATORS
// ══════════════════════════════════

function noise(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function applyNoise(ctx, x, y, w, h, intensity) {
  const imgData = ctx.getImageData(x, y, w, h);
  const d = imgData.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const n = (noise(px, py, 42) - 0.5) * intensity;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
      d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
    }
  }
  ctx.putImageData(imgData, x, y);
}

function weatherStreaks(ctx, x, y, w, h, count, color) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const sx = x + Math.random() * w;
    const sy = y + Math.random() * h * 0.3;
    const len = 15 + Math.random() * 80;
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + len);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 0.5, sy, 1 + Math.random(), len);
  }
  ctx.restore();
  ctx.globalAlpha = 1.0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWheel(ctx, cx, cy, outerR) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.arc(cx + 2, cy + 2, outerR + 1, 0, Math.PI * 2); ctx.fill();

  // Tire / outer rim
  let g = ctx.createRadialGradient(cx - outerR * 0.2, cy - outerR * 0.2, outerR * 0.2, cx, cy, outerR);
  g.addColorStop(0, '#4a4a4a');
  g.addColorStop(0.5, '#2a2a2a');
  g.addColorStop(0.85, '#1a1a1a');
  g.addColorStop(1, '#333');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.fill();

  // Flange
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();

  // Inner face
  g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, outerR * 0.65);
  g.addColorStop(0, '#6a6a6a');
  g.addColorStop(0.5, '#4a4a4a');
  g.addColorStop(1, '#333');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.65, 0, Math.PI * 2); ctx.fill();

  // Spokes
  ctx.strokeStyle = 'rgba(80,80,80,0.5)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * outerR * 0.2, cy + Math.sin(a) * outerR * 0.2);
    ctx.lineTo(cx + Math.cos(a) * outerR * 0.6, cy + Math.sin(a) * outerR * 0.6);
    ctx.stroke();
  }

  // Hub cap
  g = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, outerR * 0.2);
  g.addColorStop(0, '#888');
  g.addColorStop(0.7, '#555');
  g.addColorStop(1, '#444');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, outerR * 0.2, 0, Math.PI * 2); ctx.fill();

  // Center bolt
  ctx.fillStyle = '#777';
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
}

function drawBogie(ctx, bx, by, bw, wheelR) {
  // Side frame
  const frameGrad = ctx.createLinearGradient(bx, by - 8, bx, by + 6);
  frameGrad.addColorStop(0, '#3a3a3a');
  frameGrad.addColorStop(0.5, '#2a2a2a');
  frameGrad.addColorStop(1, '#1e1e1e');
  ctx.fillStyle = frameGrad;

  // Frame shape — tapers at ends
  ctx.beginPath();
  ctx.moveTo(bx - 5, by + 2);
  ctx.lineTo(bx + 8, by - 10);
  ctx.lineTo(bx + bw - 8, by - 10);
  ctx.lineTo(bx + bw + 5, by + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Spring assemblies
  for (const sx of [bx + bw * 0.3, bx + bw * 0.7]) {
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(sx, by - 12 + i * 3, 5, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
  }

  // Bolster / center plate area
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(bx + bw * 0.35, by - 18, bw * 0.3, 10);

  // Axle
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(bx + wheelR, by + wheelR * 0.6, bw - wheelR * 2, 4);

  // Wheels
  drawWheel(ctx, bx + wheelR + 2, by + wheelR * 0.8, wheelR);
  drawWheel(ctx, bx + bw - wheelR - 2, by + wheelR * 0.8, wheelR);
}

function drawCoupler(ctx, x, y, direction) {
  // direction: 1 = pointing right, -1 = pointing left
  const d = direction;
  ctx.fillStyle = '#2a2a2a';
  // Shank
  ctx.fillRect(x, y, 30 * d, 10);
  // Knuckle
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(x + 28 * d, y - 3);
  ctx.lineTo(x + 38 * d, y + 2);
  ctx.lineTo(x + 38 * d, y + 8);
  ctx.lineTo(x + 28 * d, y + 13);
  ctx.closePath();
  ctx.fill();
  // Pin
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(x + 18 * d, y + 5, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// ── TRAIN SURFACE (VandalSquad-style boxcar) ──

function generateTrainSurface(ctx, w, h) {
  // ── Dark studio/yard background (like LRPD renders) ──
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1a1e');
  bg.addColorStop(0.5, '#222226');
  bg.addColorStop(0.75, '#1e1e22');
  bg.addColorStop(1, '#161618');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.5, w * 0.7);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // ── Ground / ballast ──
  const groundY = h * 0.82;
  const gnd = ctx.createLinearGradient(0, groundY, 0, h);
  gnd.addColorStop(0, '#3a3530');
  gnd.addColorStop(0.15, '#302c28');
  gnd.addColorStop(1, '#1a1816');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Dense gravel
  for (let i = 0; i < 1200; i++) {
    const gx = Math.random() * w;
    const gy = groundY + 4 + Math.random() * (h - groundY - 4);
    const s = 35 + Math.floor(Math.random() * 30);
    const warm = Math.random() > 0.5 ? 8 : 0;
    ctx.fillStyle = `rgb(${s + warm},${s + warm - 3},${s})`;
    ctx.fillRect(gx, gy, 1 + Math.random() * 3, 1 + Math.random() * 1.5);
  }

  // Rail ties
  const railTop = h * 0.84;
  for (let x = 4; x < w; x += 22) {
    ctx.fillStyle = '#3a2e22';
    ctx.fillRect(x, railTop - 2, 8, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, railTop - 2, 8, 2);
  }

  // Rails
  for (const ry of [railTop + 1, railTop + 15]) {
    const rg = ctx.createLinearGradient(0, ry, 0, ry + 4);
    rg.addColorStop(0, '#999');
    rg.addColorStop(0.2, '#b0b0b0');
    rg.addColorStop(0.5, '#8a8a8a');
    rg.addColorStop(1, '#666');
    ctx.fillStyle = rg;
    ctx.fillRect(0, ry, w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, ry, w, 1);
  }

  // ── Boxcar dimensions (VandalSquad proportions — wide & low) ──
  const margin = w * 0.06;
  const tX = margin, tW = w - margin * 2;
  const tY = h * 0.15, tH = h * 0.58;
  const tB = tY + tH; // bottom of car body

  // ── Underframe shadow ──
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(tX + 20, tB, tW - 40, 18);

  // ── Main car body ──
  // Base: clean metallic silver-grey (like the reference)
  const body = ctx.createLinearGradient(0, tY, 0, tB);
  body.addColorStop(0, '#b8b8b8');
  body.addColorStop(0.02, '#c2c2c2');
  body.addColorStop(0.08, '#b5b5b5');
  body.addColorStop(0.35, '#a8a8a8');
  body.addColorStop(0.65, '#9e9e9e');
  body.addColorStop(0.92, '#929292');
  body.addColorStop(1, '#848484');
  ctx.fillStyle = body;
  ctx.fillRect(tX, tY, tW, tH);

  // ── Corrugated panel ridges ──
  const panelW = 16;
  for (let x = tX; x < tX + tW; x += panelW) {
    // Left shadow of each ridge
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, tY, 1, tH);
    // Center highlight
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x + panelW * 0.4, tY, 1, tH);
    // Right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(x + panelW - 1, tY, 1, tH);
  }

  // ── Horizontal structural members ──
  // Top chord
  const topChord = ctx.createLinearGradient(0, tY, 0, tY + 14);
  topChord.addColorStop(0, '#8a8a8a');
  topChord.addColorStop(0.2, '#aaa');
  topChord.addColorStop(0.8, '#999');
  topChord.addColorStop(1, '#888');
  ctx.fillStyle = topChord;
  ctx.fillRect(tX, tY, tW, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(tX, tY, tW, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(tX, tY + 13, tW, 1);

  // Bottom chord / sill
  const botSill = ctx.createLinearGradient(0, tB - 16, 0, tB);
  botSill.addColorStop(0, '#888');
  botSill.addColorStop(0.3, '#7a7a7a');
  botSill.addColorStop(1, '#666');
  ctx.fillStyle = botSill;
  ctx.fillRect(tX, tB - 16, tW, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(tX, tB - 16, tW, 1);

  // Mid-height horizontal seam
  const midY = tY + tH * 0.48;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(tX, midY, tW, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(tX, midY + 1.5, tW, 1);

  // ── Vertical structural posts ──
  const postPositions = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];
  for (const ratio of postPositions) {
    const px = tX + tW * ratio;
    const postW = ratio === 0 || ratio === 1 ? 8 : 5;
    const postGrad = ctx.createLinearGradient(px - postW / 2, 0, px + postW / 2, 0);
    postGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
    postGrad.addColorStop(0.3, 'rgba(120,120,120,0.15)');
    postGrad.addColorStop(0.5, 'rgba(160,160,160,0.1)');
    postGrad.addColorStop(0.7, 'rgba(120,120,120,0.15)');
    postGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = postGrad;
    ctx.fillRect(px - postW / 2, tY + 14, postW, tH - 30);
  }

  // ── Rivet lines along top and bottom chords ──
  for (let x = tX + 10; x < tX + tW - 5; x += 18) {
    for (const ry of [tY + 7, tB - 8]) {
      // Rivet highlight
      ctx.fillStyle = 'rgba(200,200,200,0.4)';
      ctx.beginPath(); ctx.arc(x, ry - 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
      // Rivet body
      ctx.fillStyle = 'rgba(140,140,140,0.6)';
      ctx.beginPath(); ctx.arc(x, ry, 1.8, 0, Math.PI * 2); ctx.fill();
      // Rivet shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(x + 0.5, ry + 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Metal noise ──
  applyNoise(ctx, Math.floor(tX), Math.floor(tY), Math.floor(tW), Math.floor(tH), 10);

  // ── Subtle weathering ──
  weatherStreaks(ctx, tX, tY, tW, tH, 30, 'rgba(80,60,40,1)');

  // Light dirt accumulation at bottom
  const dirtGrad = ctx.createLinearGradient(0, tB - 40, 0, tB);
  dirtGrad.addColorStop(0, 'transparent');
  dirtGrad.addColorStop(1, 'rgba(60,50,35,0.12)');
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(tX, tB - 40, tW, 40);

  // ── Door (wide sliding, centered) ──
  const doorW = tW * 0.18;
  const doorX = tX + (tW - doorW) / 2;
  const doorY = tY + 16;
  const doorH = tH - 34;

  // Door recess shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(doorX - 3, doorY - 2, doorW + 6, doorH + 4);

  // Door body
  const dGrad = ctx.createLinearGradient(doorX, 0, doorX + doorW, 0);
  dGrad.addColorStop(0, '#8a8a8a');
  dGrad.addColorStop(0.3, '#959595');
  dGrad.addColorStop(0.7, '#909090');
  dGrad.addColorStop(1, '#858585');
  ctx.fillStyle = dGrad;
  ctx.fillRect(doorX, doorY, doorW, doorH);

  // Door track (top rail)
  const trackGrad = ctx.createLinearGradient(0, doorY - 6, 0, doorY - 1);
  trackGrad.addColorStop(0, '#aaa');
  trackGrad.addColorStop(1, '#777');
  ctx.fillStyle = trackGrad;
  ctx.fillRect(doorX - doorW * 0.3, doorY - 6, doorW * 1.6, 5);

  // Door panels (vertical divisions)
  for (let dx = doorX + doorW * 0.33; dx < doorX + doorW; dx += doorW * 0.33) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(dx, doorY, 1.5, doorH);
  }

  // Door latch hardware
  ctx.fillStyle = '#aaa';
  ctx.fillRect(doorX + doorW - 14, doorY + doorH * 0.38, 5, 22);
  ctx.fillStyle = '#888';
  ctx.fillRect(doorX + doorW - 16, doorY + doorH * 0.38 + 8, 9, 4);

  // Door frame
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(doorX, doorY, doorW, doorH);

  // ── Car number / reporting marks (stencil style like reference) ──
  ctx.fillStyle = 'rgba(40,40,40,0.6)';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('24 09002', tX + tW - 130, tY + 34);

  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = 'rgba(40,40,40,0.4)';
  ctx.fillText('CAPY  210000', tX + tW - 130, tB - 30);
  ctx.fillText('LD LMT 142000', tX + tW - 130, tB - 18);
  ctx.fillText('LT WT  58200', tX + 25, tB - 18);

  // ── Roof ──
  const roofGrad = ctx.createLinearGradient(0, tY - 12, 0, tY);
  roofGrad.addColorStop(0, '#777');
  roofGrad.addColorStop(0.4, '#999');
  roofGrad.addColorStop(1, '#8a8a8a');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(tX - 2, tY);
  ctx.lineTo(tX + 3, tY - 10);
  ctx.quadraticCurveTo(tX + 15, tY - 14, tX + 30, tY - 14);
  ctx.lineTo(tX + tW - 30, tY - 14);
  ctx.quadraticCurveTo(tX + tW - 15, tY - 14, tX + tW - 3, tY - 10);
  ctx.lineTo(tX + tW + 2, tY);
  ctx.closePath();
  ctx.fill();
  // Roof highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tX + 30, tY - 14);
  ctx.lineTo(tX + tW - 30, tY - 14);
  ctx.stroke();

  // Roof walkway (running board)
  ctx.fillStyle = 'rgba(80,80,80,0.5)';
  ctx.fillRect(tX + 40, tY - 16, tW - 80, 3);

  // ── Underframe detail ──
  const ufY = tB + 2;
  // Center sill
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(tX + tW * 0.2, ufY, tW * 0.6, 6);
  // Cross members
  for (let x = tX + tW * 0.15; x < tX + tW * 0.85; x += tW * 0.1) {
    ctx.fillStyle = '#333';
    ctx.fillRect(x, ufY, 3, 10);
  }

  // ── Bogies ──
  const wheelR = 26;
  const bogieW = 120;
  const bogieY = tB + 12;
  drawBogie(ctx, tX + 45, bogieY, bogieW, wheelR);
  drawBogie(ctx, tX + tW - 45 - bogieW, bogieY, bogieW, wheelR);

  // ── Couplers ──
  drawCoupler(ctx, tX - 8, tB - 4, -1);
  drawCoupler(ctx, tX + tW + 8, tB - 4, 1);

  // ── Ground shadow under car ──
  const shadow = ctx.createLinearGradient(0, bogieY + wheelR + 8, 0, bogieY + wheelR + 30);
  shadow.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadow.addColorStop(1, 'transparent');
  ctx.fillStyle = shadow;
  ctx.fillRect(tX - 20, bogieY + wheelR + 8, tW + 40, 22);

  // ── Studio-style ground line ──
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
}

function generateTrainMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const margin = w * 0.06;
  const tX = margin, tW = w - margin * 2;
  const tY = h * 0.15, tH = h * 0.58;
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(tX, tY, tW, tH);
}

// ── BRICK WALL SURFACE (studio-lit, detailed) ──

function generateWallSurface(ctx, w, h) {
  // Dark background
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, w, h);

  // Wall area
  const wallBottom = h * 0.85;
  const bW = 52, bH = 24, mW = 3;
  const mortarColor = '#5a4e3e';

  // Mortar base
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, w, wallBottom);

  // Bricks with realistic variation + 3D shading
  for (let row = 0; row * (bH + mW) < wallBottom; row++) {
    const off = (row % 2) * (bW / 2 + 1);
    const y = row * (bH + mW);
    for (let col = -1; col * (bW + mW) < w + bW; col++) {
      const x = col * (bW + mW) + off;
      const n1 = noise(col, row, 7), n2 = noise(col, row, 13), n3 = noise(col, row, 31);

      // Color families: reds, dark reds, brownish, occasional pale
      let r, g, b;
      if (n3 > 0.85) { r = 170; g = 140; b = 120; } // pale/old brick
      else if (n3 > 0.5) { r = 145; g = 65; b = 50; } // classic red
      else if (n3 > 0.2) { r = 130; g = 55; b = 40; } // dark red
      else { r = 110; g = 50; b = 38; } // very dark

      const v = (n1 - 0.5) * 25;
      const bv = (n2 - 0.5) * 15;
      r = Math.max(40, Math.min(220, r + v + bv));
      g = Math.max(20, Math.min(160, g + v * 0.4 + bv));
      b = Math.max(15, Math.min(140, b + bv * 0.5));

      // 3D brick with top-lit gradient
      const bg = ctx.createLinearGradient(x, y, x, y + bH);
      bg.addColorStop(0, `rgb(${r + 15},${g + 10},${b + 8})`);
      bg.addColorStop(0.08, `rgb(${r + 8},${g + 5},${b + 3})`);
      bg.addColorStop(0.5, `rgb(${r},${g},${b})`);
      bg.addColorStop(0.92, `rgb(${r - 10},${g - 8},${b - 5})`);
      bg.addColorStop(1, `rgb(${r - 20},${g - 15},${b - 10})`);
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, bW, bH);

      // Edge highlights/shadows for depth
      ctx.fillStyle = `rgba(255,220,180,0.05)`;
      ctx.fillRect(x + 1, y, bW - 2, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x, y, 1, bH);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x, y + bH - 1, bW, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(x + bW - 1, y, 1, bH);

      // Surface texture variation (per-brick noise)
      if (n1 > 0.6) {
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        for (let py = y + 3; py < y + bH - 3; py += 3) {
          ctx.fillRect(x + 2 + Math.random() * (bW - 4), py, 2, 1);
        }
      }

      // Occasional chip
      if (noise(col, row, 99) > 0.93) {
        ctx.fillStyle = mortarColor;
        const cx = x + 3 + Math.random() * (bW - 8);
        const cy = y + Math.random() * 4;
        ctx.fillRect(cx, cy, 3 + Math.random() * 5, 2 + Math.random() * 3);
      }
    }
  }

  // Mortar shadow lines (horizontal)
  for (let row = 0; row * (bH + mW) < wallBottom; row++) {
    const y = row * (bH + mW) + bH;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y + mW - 1, w, 1);
  }

  // Wall aging — dark stains
  for (let i = 0; i < 20; i++) {
    const sx = Math.random() * w, sy = Math.random() * wallBottom;
    const sr = 20 + Math.random() * 60;
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    st.addColorStop(0, 'rgba(0,0,0,0.07)');
    st.addColorStop(1, 'transparent');
    ctx.fillStyle = st;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  // Water streaks
  weatherStreaks(ctx, 0, 0, w, wallBottom, 35, 'rgba(20,15,10,1)');

  // ── Sidewalk / ground ──
  const swGrad = ctx.createLinearGradient(0, wallBottom, 0, h);
  swGrad.addColorStop(0, '#6a6a68');
  swGrad.addColorStop(0.04, '#5e5e5c');
  swGrad.addColorStop(0.5, '#505050');
  swGrad.addColorStop(1, '#3a3a38');
  ctx.fillStyle = swGrad;
  ctx.fillRect(0, wallBottom, w, h - wallBottom);

  // Curb highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, wallBottom, w, 2);

  // Sidewalk cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.8;
  for (let x = w * 0.18; x < w; x += w * 0.22) {
    ctx.beginPath();
    ctx.moveTo(x, wallBottom + 4);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 20, wallBottom + (h - wallBottom) * 0.5,
      x + (Math.random() - 0.5) * 15, h);
    ctx.stroke();
  }

  // Sidewalk noise
  applyNoise(ctx, 0, Math.floor(wallBottom), w, Math.floor(h - wallBottom), 8);

  // Subtle spotlight from above
  const spot = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, h * 0.3, w * 0.6);
  spot.addColorStop(0, 'rgba(255,240,200,0.04)');
  spot.addColorStop(1, 'transparent');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, wallBottom);
}

function generateWallMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(0, 0, w, h * 0.85);
}

// ── FREIGHT BOXCAR SURFACE (rusty, VandalSquad-style) ──

function generateFreightSurface(ctx, w, h) {
  // Dark studio background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#18181c');
  bg.addColorStop(0.5, '#1e1e22');
  bg.addColorStop(1, '#141416');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.5, w * 0.7);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Ground
  const groundY = h * 0.83;
  const gnd = ctx.createLinearGradient(0, groundY, 0, h);
  gnd.addColorStop(0, '#32302a');
  gnd.addColorStop(0.2, '#2a2822');
  gnd.addColorStop(1, '#1a1816');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Gravel
  for (let i = 0; i < 1000; i++) {
    const gx = Math.random() * w;
    const gy = groundY + 5 + Math.random() * (h - groundY - 5);
    const s = 30 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${s + 10},${s + 6},${s})`;
    ctx.fillRect(gx, gy, 1 + Math.random() * 3, 1 + Math.random() * 1.5);
  }

  // Rail ties
  const railTop = h * 0.85;
  for (let x = 4; x < w; x += 22) {
    ctx.fillStyle = '#382a1e';
    ctx.fillRect(x, railTop - 3, 9, 22);
  }

  // Rails
  for (const ry of [railTop, railTop + 15]) {
    const rg = ctx.createLinearGradient(0, ry, 0, ry + 4);
    rg.addColorStop(0, '#8a8a8a');
    rg.addColorStop(0.3, '#aaa');
    rg.addColorStop(1, '#666');
    ctx.fillStyle = rg;
    ctx.fillRect(0, ry, w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, ry, w, 1);
  }

  // ── Boxcar ──
  const margin = w * 0.04;
  const cX = margin, cW = w - margin * 2;
  const cY = h * 0.12, cH = h * 0.62;
  const cB = cY + cH;

  // Underframe shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(cX + 20, cB, cW - 40, 16);

  // Body — deep rusty oxide red/brown
  const carBody = ctx.createLinearGradient(0, cY, 0, cB);
  carBody.addColorStop(0, '#7a4535');
  carBody.addColorStop(0.03, '#6e3d2e');
  carBody.addColorStop(0.15, '#643828');
  carBody.addColorStop(0.5, '#5a3022');
  carBody.addColorStop(0.85, '#50281c');
  carBody.addColorStop(1, '#442015');
  ctx.fillStyle = carBody;
  ctx.fillRect(cX, cY, cW, cH);

  // Corrugated ridges
  const ridgeW = 14;
  for (let x = cX; x < cX + cW; x += ridgeW) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, cY, 1, cH);
    ctx.fillStyle = 'rgba(255,180,120,0.025)';
    ctx.fillRect(x + 1, cY, 1, cH);
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(x + ridgeW - 1, cY, 1, cH);
  }

  // Metal noise
  applyNoise(ctx, Math.floor(cX), Math.floor(cY), Math.floor(cW), Math.floor(cH), 12);

  // Top chord
  const topBeam = ctx.createLinearGradient(0, cY, 0, cY + 14);
  topBeam.addColorStop(0, '#5a3020');
  topBeam.addColorStop(0.3, '#6a3828');
  topBeam.addColorStop(1, '#553022');
  ctx.fillStyle = topBeam;
  ctx.fillRect(cX, cY, cW, 14);
  ctx.fillStyle = 'rgba(255,200,150,0.04)';
  ctx.fillRect(cX, cY, cW, 1);

  // Bottom sill
  const botBeam = ctx.createLinearGradient(0, cB - 16, 0, cB);
  botBeam.addColorStop(0, '#4a2518');
  botBeam.addColorStop(1, '#3a1a10');
  ctx.fillStyle = botBeam;
  ctx.fillRect(cX, cB - 16, cW, 16);

  // Horizontal mid-seam
  const midY = cY + cH * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(cX, midY, cW, 1.5);
  ctx.fillStyle = 'rgba(255,200,150,0.02)';
  ctx.fillRect(cX, midY + 1.5, cW, 1);

  // Vertical posts
  const vPosts = [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 1.0];
  for (const r of vPosts) {
    const px = cX + cW * r;
    const pw = r === 0 || r === 1 ? 7 : 4;
    const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
    pg.addColorStop(0, 'rgba(0,0,0,0.1)');
    pg.addColorStop(0.4, 'rgba(100,60,40,0.12)');
    pg.addColorStop(0.6, 'rgba(120,80,50,0.06)');
    pg.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = pg;
    ctx.fillRect(px - pw / 2, cY + 14, pw, cH - 30);
  }

  // Rivet rows
  for (let x = cX + 8; x < cX + cW - 5; x += 16) {
    for (const ry of [cY + 7, cB - 8]) {
      ctx.fillStyle = 'rgba(140,90,60,0.5)';
      ctx.beginPath(); ctx.arc(x, ry - 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(x + 0.5, ry + 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Rust patches
  for (let i = 0; i < 30; i++) {
    const rx = cX + Math.random() * cW, ry = cY + Math.random() * cH;
    const rr = 5 + Math.random() * 30;
    const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
    rg.addColorStop(0, 'rgba(100,45,15,0.15)');
    rg.addColorStop(0.5, 'rgba(70,30,10,0.08)');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(rx, ry, rr, rr * 0.5, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  // Weather streaks
  weatherStreaks(ctx, cX, cY, cW, cH, 45, 'rgba(40,20,8,1)');

  // Dirt at bottom
  const dirt = ctx.createLinearGradient(0, cB - 35, 0, cB);
  dirt.addColorStop(0, 'transparent');
  dirt.addColorStop(1, 'rgba(30,20,10,0.15)');
  ctx.fillStyle = dirt;
  ctx.fillRect(cX, cB - 35, cW, 35);

  // ── Sliding door ──
  const doorW = cW * 0.2, doorX = cX + (cW - doorW) / 2;
  const doorY = cY + 16, doorH = cH - 34;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(doorX - 3, doorY - 2, doorW + 6, doorH + 4);

  const dGrad = ctx.createLinearGradient(doorX, 0, doorX + doorW, 0);
  dGrad.addColorStop(0, '#4e2818');
  dGrad.addColorStop(0.4, '#553020');
  dGrad.addColorStop(0.7, '#502a1c');
  dGrad.addColorStop(1, '#482218');
  ctx.fillStyle = dGrad;
  ctx.fillRect(doorX, doorY, doorW, doorH);

  // Door track
  const dtGrad = ctx.createLinearGradient(0, doorY - 6, 0, doorY - 1);
  dtGrad.addColorStop(0, '#999');
  dtGrad.addColorStop(1, '#666');
  ctx.fillStyle = dtGrad;
  ctx.fillRect(doorX - doorW * 0.3, doorY - 6, doorW * 1.6, 5);

  // Door divisions
  for (let dx = doorX + doorW * 0.33; dx < doorX + doorW; dx += doorW * 0.33) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(dx, doorY, 1.5, doorH);
  }

  // Door latch
  ctx.fillStyle = '#999';
  ctx.fillRect(doorX + doorW - 12, doorY + doorH * 0.4, 5, 18);
  ctx.fillStyle = '#777';
  ctx.fillRect(doorX + doorW - 14, doorY + doorH * 0.4 + 6, 9, 3);

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(doorX, doorY, doorW, doorH);

  // ── Reporting marks ──
  ctx.fillStyle = 'rgba(220,200,170,0.25)';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('BNSF 724019', cX + 30, cB - 22);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = 'rgba(220,200,170,0.15)';
  ctx.fillText('LD LMT 142000', cX + 30, cB - 42);
  ctx.fillText('LT WT  58200', cX + 30, cB - 55);
  ctx.fillText('CAPY  210000', cX + cW - 150, cB - 22);

  // Hazmat placard (diamond)
  const plX = cX + cW - 80, plY = cY + 28;
  ctx.save();
  ctx.translate(plX, plY);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(220,200,170,0.15)';
  ctx.fillRect(-12, -12, 24, 24);
  ctx.strokeStyle = 'rgba(220,200,170,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-12, -12, 24, 24);
  ctx.restore();

  // ── Roof ──
  const roofGrad = ctx.createLinearGradient(0, cY - 12, 0, cY);
  roofGrad.addColorStop(0, '#4a2818');
  roofGrad.addColorStop(0.5, '#5a3222');
  roofGrad.addColorStop(1, '#503020');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(cX - 2, cY);
  ctx.lineTo(cX + 3, cY - 10);
  ctx.quadraticCurveTo(cX + 15, cY - 14, cX + 25, cY - 14);
  ctx.lineTo(cX + cW - 25, cY - 14);
  ctx.quadraticCurveTo(cX + cW - 15, cY - 14, cX + cW - 3, cY - 10);
  ctx.lineTo(cX + cW + 2, cY);
  ctx.closePath();
  ctx.fill();

  // ── Underframe ──
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(cX + cW * 0.18, cB + 2, cW * 0.64, 5);
  for (let x = cX + cW * 0.12; x < cX + cW * 0.88; x += cW * 0.08) {
    ctx.fillStyle = '#282828';
    ctx.fillRect(x, cB + 2, 3, 10);
  }

  // ── Bogies ──
  const wheelR = 24;
  const bogieW = 110;
  const bogieY = cB + 12;
  drawBogie(ctx, cX + 40, bogieY, bogieW, wheelR);
  drawBogie(ctx, cX + cW - 40 - bogieW, bogieY, bogieW, wheelR);

  // ── Couplers ──
  drawCoupler(ctx, cX - 6, cB - 2, -1);
  drawCoupler(ctx, cX + cW + 6, cB - 2, 1);

  // Ground shadow
  const shadow = ctx.createLinearGradient(0, bogieY + wheelR + 6, 0, bogieY + wheelR + 25);
  shadow.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadow.addColorStop(1, 'transparent');
  ctx.fillStyle = shadow;
  ctx.fillRect(cX - 20, bogieY + wheelR + 6, cW + 40, 20);
}

function generateFreightMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const margin = w * 0.04;
  const cX = margin, cW = w - margin * 2;
  const cY = h * 0.12, cH = h * 0.62;
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(cX, cY, cW, cH);
}

// ── CITY BILLBOARD SURFACE ──

function generateBillboardSurface(ctx, w, h) {
  // ── Night sky with gradient ──
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  sky.addColorStop(0, '#0a0c18');
  sky.addColorStop(0.3, '#111528');
  sky.addColorStop(0.6, '#1a1e30');
  sky.addColorStop(1, '#222638');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 50; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.45;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h * 0.3, 0.3 + Math.random() * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // ── City skyline (background buildings) ──
  const skylineY = h * 0.35;

  // Far buildings (dark, blurry)
  for (let i = 0; i < 18; i++) {
    const bx = Math.random() * w;
    const bw = 15 + Math.random() * 45;
    const bh = 30 + Math.random() * 120;
    const shade = 18 + Math.floor(Math.random() * 15);
    ctx.fillStyle = `rgb(${shade + 5},${shade + 3},${shade + 10})`;
    ctx.fillRect(bx, skylineY - bh, bw, bh + 10);

    // Lit windows
    ctx.fillStyle = `rgba(255,220,120,${0.1 + Math.random() * 0.25})`;
    for (let wy = skylineY - bh + 6; wy < skylineY - 5; wy += 8 + Math.random() * 4) {
      for (let wx = bx + 3; wx < bx + bw - 4; wx += 5 + Math.random() * 3) {
        if (Math.random() > 0.4) {
          ctx.fillRect(wx, wy, 2, 2.5);
        }
      }
    }
  }

  // Closer buildings (slightly brighter)
  for (let i = 0; i < 10; i++) {
    const bx = Math.random() * w;
    const bw = 25 + Math.random() * 60;
    const bh = 40 + Math.random() * 80;
    const shade = 22 + Math.floor(Math.random() * 12);
    ctx.fillStyle = `rgb(${shade + 4},${shade + 2},${shade + 8})`;
    ctx.fillRect(bx, skylineY - bh + 30, bw, bh);

    ctx.fillStyle = `rgba(255,210,100,${0.15 + Math.random() * 0.3})`;
    for (let wy = skylineY - bh + 36; wy < skylineY + 25; wy += 7 + Math.random() * 3) {
      for (let wx = bx + 4; wx < bx + bw - 5; wx += 6 + Math.random() * 4) {
        if (Math.random() > 0.35) {
          ctx.fillRect(wx, wy, 2.5, 3);
        }
      }
    }
  }

  // City glow on horizon
  const glow = ctx.createRadialGradient(w * 0.5, skylineY + 20, 0, w * 0.5, skylineY, w * 0.6);
  glow.addColorStop(0, 'rgba(255,180,80,0.06)');
  glow.addColorStop(0.5, 'rgba(255,150,60,0.03)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h * 0.6);

  // ── Ground / street level ──
  const groundY = h * 0.82;
  const gnd = ctx.createLinearGradient(0, groundY, 0, h);
  gnd.addColorStop(0, '#2a2a2e');
  gnd.addColorStop(0.3, '#222226');
  gnd.addColorStop(1, '#181818');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Sidewalk edge
  ctx.fillStyle = '#3a3a3e';
  ctx.fillRect(0, groundY, w, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, groundY, w, 1);

  // ── Billboard structure ──
  const bbW = w * 0.72;
  const bbH = h * 0.38;
  const bbX = (w - bbW) / 2;
  const bbY = h * 0.12;
  const bbB = bbY + bbH;

  // Support poles (two steel I-beams)
  const poleW = 10;
  const pole1X = bbX + bbW * 0.25;
  const pole2X = bbX + bbW * 0.75;

  for (const px of [pole1X, pole2X]) {
    // Pole shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px - poleW / 2 + 2, bbB + 2, poleW, groundY - bbB);

    // Main pole
    const poleGrad = ctx.createLinearGradient(px - poleW / 2, 0, px + poleW / 2, 0);
    poleGrad.addColorStop(0, '#4a4a4a');
    poleGrad.addColorStop(0.2, '#6a6a6a');
    poleGrad.addColorStop(0.5, '#777');
    poleGrad.addColorStop(0.8, '#5a5a5a');
    poleGrad.addColorStop(1, '#444');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(px - poleW / 2, bbB, poleW, groundY - bbB);

    // Flanges (I-beam edges)
    ctx.fillStyle = '#555';
    ctx.fillRect(px - poleW / 2 - 3, bbB, 3, groundY - bbB);
    ctx.fillRect(px + poleW / 2, bbB, 3, groundY - bbB);

    // Bolts on pole
    for (let by = bbB + 15; by < groundY - 10; by += 30) {
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(px, by, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Cross bracing between poles
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pole1X, bbB + 10);
  ctx.lineTo(pole2X, groundY - 15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pole2X, bbB + 10);
  ctx.lineTo(pole1X, groundY - 15);
  ctx.stroke();

  // Horizontal brace
  ctx.fillStyle = '#555';
  ctx.fillRect(pole1X - poleW / 2, bbB + 5, pole2X - pole1X + poleW, 4);

  // ── Billboard frame ──
  // Frame shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(bbX + 4, bbY + 4, bbW, bbH);

  // Outer frame
  const frameGrad = ctx.createLinearGradient(0, bbY, 0, bbB);
  frameGrad.addColorStop(0, '#5a5a5a');
  frameGrad.addColorStop(0.1, '#6a6a6a');
  frameGrad.addColorStop(0.9, '#505050');
  frameGrad.addColorStop(1, '#444');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(bbX - 6, bbY - 6, bbW + 12, bbH + 12);

  // Inner rim highlight
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(bbX - 6, bbY - 6, bbW + 12, 2);

  // ── Billboard face (paintable area) ──
  const faceGrad = ctx.createLinearGradient(0, bbY, 0, bbB);
  faceGrad.addColorStop(0, '#e8e4e0');
  faceGrad.addColorStop(0.5, '#ddd8d4');
  faceGrad.addColorStop(1, '#d0ccc8');
  ctx.fillStyle = faceGrad;
  ctx.fillRect(bbX, bbY, bbW, bbH);

  // Weathered paper texture on billboard
  for (let i = 0; i < 200; i++) {
    const sx = bbX + Math.random() * bbW;
    const sy = bbY + Math.random() * bbH;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(sx, sy, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }

  // Subtle seams (paper panels)
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  for (let x = bbX + bbW * 0.25; x < bbX + bbW; x += bbW * 0.25) {
    ctx.beginPath();
    ctx.moveTo(x, bbY);
    ctx.lineTo(x, bbB);
    ctx.stroke();
  }

  // Old torn poster remnant (faint)
  ctx.fillStyle = 'rgba(150,130,110,0.08)';
  ctx.fillRect(bbX + bbW * 0.6, bbY + 10, bbW * 0.15, bbH * 0.3);

  // Stains / water marks
  for (let i = 0; i < 8; i++) {
    const sx = bbX + Math.random() * bbW;
    const sy = bbY + Math.random() * bbH;
    const sr = 10 + Math.random() * 25;
    const stain = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    stain.addColorStop(0, 'rgba(140,120,90,0.06)');
    stain.addColorStop(1, 'transparent');
    ctx.fillStyle = stain;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  // ── Spotlights (top-mounted) ──
  for (const lx of [bbX + bbW * 0.2, bbX + bbW * 0.5, bbX + bbW * 0.8]) {
    // Light housing
    ctx.fillStyle = '#444';
    ctx.fillRect(lx - 6, bbY - 18, 12, 14);
    ctx.fillStyle = '#555';
    ctx.fillRect(lx - 4, bbY - 20, 8, 6);

    // Light beam cone
    const beam = ctx.createLinearGradient(lx, bbY, lx, bbB);
    beam.addColorStop(0, 'rgba(255,240,200,0.06)');
    beam.addColorStop(0.5, 'rgba(255,240,200,0.02)');
    beam.addColorStop(1, 'transparent');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - 8, bbY);
    ctx.lineTo(lx - 40, bbB);
    ctx.lineTo(lx + 40, bbB);
    ctx.lineTo(lx + 8, bbY);
    ctx.closePath();
    ctx.fill();
  }

  // ── Sign text (faded old ad) ──
  ctx.fillStyle = 'rgba(100,80,60,0.06)';
  ctx.font = `bold ${Math.floor(bbH * 0.15)}px "Arial", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('YOUR AD HERE', bbX + bbW / 2, bbY + bbH * 0.55);
  ctx.textAlign = 'start';

  // ── Street details ──
  // Street lamp (left side)
  const lampX = bbX - 40;
  ctx.fillStyle = '#333';
  ctx.fillRect(lampX - 2, h * 0.3, 4, groundY - h * 0.3);
  // Lamp head
  ctx.fillStyle = '#444';
  ctx.fillRect(lampX - 8, h * 0.3 - 4, 16, 6);
  // Lamp glow
  const lampGlow = ctx.createRadialGradient(lampX, h * 0.3, 0, lampX, h * 0.3, 40);
  lampGlow.addColorStop(0, 'rgba(255,200,100,0.1)');
  lampGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = lampGlow;
  ctx.beginPath();
  ctx.arc(lampX, h * 0.3, 40, 0, Math.PI * 2);
  ctx.fill();

  // Ground shadow under billboard
  const bShadow = ctx.createLinearGradient(0, groundY, 0, groundY + 25);
  bShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
  bShadow.addColorStop(1, 'transparent');
  ctx.fillStyle = bShadow;
  ctx.fillRect(bbX - 30, groundY, bbW + 60, 25);

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.4, h * 0.25, w / 2, h * 0.5, w * 0.65);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function generateBillboardMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const bbW = w * 0.72;
  const bbH = h * 0.38;
  const bbX = (w - bbW) / 2;
  const bbY = h * 0.12;
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(bbX, bbY, bbW, bbH);
}

// ── HIGHWAY OVERPASS SURFACE (procedural concrete) ──

// Shared layout so the mask matches the drawing exactly
function overpassLayout(w, h) {
  return {
    deckY: h * 0.06, deckH: h * 0.13,           // overpass deck + girder
    wallX: w * 0.08, wallY: h * 0.19,           // big concrete abutment wall (paint zone)
    wallW: w * 0.84, wallH: h * 0.61,
    groundY: h * 0.80,
  };
}

function generateOverpassSurface(ctx, w, h) {
  const L = overpassLayout(w, h);

  // ── Dusk sky behind the structure ──
  const sky = ctx.createLinearGradient(0, 0, 0, L.deckY + L.deckH);
  sky.addColorStop(0, '#2a2030');
  sky.addColorStop(0.5, '#3a2c38');
  sky.addColorStop(1, '#4a3a40');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, L.deckY + L.deckH);

  // Distant city haze glow
  const glow = ctx.createRadialGradient(w * 0.7, L.deckY, 0, w * 0.7, L.deckY, w * 0.5);
  glow.addColorStop(0, 'rgba(255,160,90,0.12)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, L.deckY + L.deckH);

  // ── Overpass deck girder (spans full width) ──
  const girder = ctx.createLinearGradient(0, L.deckY, 0, L.deckY + L.deckH);
  girder.addColorStop(0, '#8a8a8a');
  girder.addColorStop(0.1, '#9a9a96');
  girder.addColorStop(0.5, '#82827e');
  girder.addColorStop(1, '#6a6a66');
  ctx.fillStyle = girder;
  ctx.fillRect(0, L.deckY, w, L.deckH);

  // Guardrail posts on top of deck
  ctx.fillStyle = '#5a5a58';
  for (let x = 6; x < w; x += 34) ctx.fillRect(x, L.deckY - 10, 4, 11);
  // Guardrail beam
  ctx.fillStyle = '#777';
  ctx.fillRect(0, L.deckY - 11, w, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, L.deckY - 11, w, 1);

  // Deck shadow casting onto wall
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, L.deckY + L.deckH, w, 10);

  // ── Support pillars (left + right) ──
  const pillarW = w * 0.09;
  for (const px of [L.wallX - pillarW * 0.4, L.wallX + L.wallW - pillarW * 0.6]) {
    const pg = ctx.createLinearGradient(px, 0, px + pillarW, 0);
    pg.addColorStop(0, '#6e6e6a');
    pg.addColorStop(0.3, '#86867f');
    pg.addColorStop(0.6, '#79796f');
    pg.addColorStop(1, '#5e5e58');
    ctx.fillStyle = pg;
    ctx.fillRect(px, L.wallY, pillarW, L.groundY - L.wallY + h * 0.04);
    // edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px + pillarW - 2, L.wallY, 2, L.groundY - L.wallY);
  }

  // ── Main concrete abutment wall (paint surface) ──
  const wall = ctx.createLinearGradient(0, L.wallY, 0, L.wallY + L.wallH);
  wall.addColorStop(0, '#9a9a93');
  wall.addColorStop(0.04, '#a2a29a');
  wall.addColorStop(0.4, '#94948c');
  wall.addColorStop(0.8, '#8a8a82');
  wall.addColorStop(1, '#7c7c74');
  ctx.fillStyle = wall;
  ctx.fillRect(L.wallX, L.wallY, L.wallW, L.wallH);

  // Concrete form-panel seams (vertical)
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1;
  const panels = 4;
  for (let i = 1; i < panels; i++) {
    const x = L.wallX + (L.wallW / panels) * i;
    ctx.beginPath(); ctx.moveTo(x, L.wallY); ctx.lineTo(x, L.wallY + L.wallH); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.moveTo(x + 1, L.wallY); ctx.lineTo(x + 1, L.wallY + L.wallH); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  }
  // Horizontal pour line
  const pourY = L.wallY + L.wallH * 0.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.moveTo(L.wallX, pourY); ctx.lineTo(L.wallX + L.wallW, pourY); ctx.stroke();

  // Form-tie holes (grid of small recesses)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let gy = L.wallY + L.wallH * 0.18; gy < L.wallY + L.wallH; gy += L.wallH * 0.32) {
    for (let gx = L.wallX + L.wallW * 0.12; gx < L.wallX + L.wallW; gx += L.wallW * 0.25) {
      ctx.beginPath(); ctx.arc(gx, gy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Concrete grain
  applyNoise(ctx, Math.floor(L.wallX), Math.floor(L.wallY), Math.floor(L.wallW), Math.floor(L.wallH), 12);

  // Weathering — rust/water streaks down the wall
  weatherStreaks(ctx, L.wallX, L.wallY, L.wallW, L.wallH, 30, 'rgba(50,40,30,1)');

  // Efflorescence / stains
  for (let i = 0; i < 14; i++) {
    const sx = L.wallX + Math.random() * L.wallW;
    const sy = L.wallY + Math.random() * L.wallH;
    const sr = 14 + Math.random() * 40;
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    st.addColorStop(0, Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(230,230,225,0.05)');
    st.addColorStop(1, 'transparent');
    ctx.fillStyle = st;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  // Grime gradient at the base of the wall
  const grime = ctx.createLinearGradient(0, L.wallY + L.wallH - 50, 0, L.wallY + L.wallH);
  grime.addColorStop(0, 'transparent');
  grime.addColorStop(1, 'rgba(30,28,24,0.3)');
  ctx.fillStyle = grime;
  ctx.fillRect(L.wallX, L.wallY + L.wallH - 50, L.wallW, 50);

  // ── Ground / road ──
  const road = ctx.createLinearGradient(0, L.groundY, 0, h);
  road.addColorStop(0, '#2c2c30');
  road.addColorStop(0.2, '#242428');
  road.addColorStop(1, '#1a1a1e');
  ctx.fillStyle = road;
  ctx.fillRect(0, L.groundY, w, h - L.groundY);

  // Curb line
  ctx.fillStyle = '#3a3a3e';
  ctx.fillRect(0, L.groundY, w, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, L.groundY, w, 1);

  // Asphalt speckle
  for (let i = 0; i < 400; i++) {
    const gx = Math.random() * w;
    const gy = L.groundY + 6 + Math.random() * (h - L.groundY - 6);
    const s = 28 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${s},${s},${s + 4})`;
    ctx.fillRect(gx, gy, 1 + Math.random() * 2, 1);
  }

  // Faint road dashes receding
  ctx.fillStyle = 'rgba(200,190,120,0.18)';
  for (let i = 0; i < 4; i++) {
    const dy = L.groundY + 20 + i * (h - L.groundY) * 0.22;
    ctx.fillRect(w * 0.48, dy, w * 0.04, 5 + i * 2);
  }

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.5, w * 0.7);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function generateOverpassMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const L = overpassLayout(w, h);
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(L.wallX, L.wallY, L.wallW, L.wallH);
}

// ── WATER TOWER SURFACE (procedural elevated tank) ──

// Shared layout so the mask matches the tank body exactly
function waterTowerLayout(w, h) {
  const tankX = w * 0.24, tankW = w * 0.52;
  const tankY = h * 0.18, tankH = h * 0.34;   // cylindrical body (paint zone)
  return { tankX, tankW, tankY, tankH, groundY: h * 0.84 };
}

function generateWaterTowerSurface(ctx, w, h) {
  const L = waterTowerLayout(w, h);
  const cx = L.tankX + L.tankW / 2;

  // ── Sky ──
  const sky = ctx.createLinearGradient(0, 0, 0, L.groundY);
  sky.addColorStop(0, '#1d2b3a');
  sky.addColorStop(0.45, '#2f4456');
  sky.addColorStop(0.8, '#546a78');
  sky.addColorStop(1, '#7d8a92');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, L.groundY);

  // Sun haze low on horizon
  const haze = ctx.createRadialGradient(w * 0.5, L.groundY, 0, w * 0.5, L.groundY, w * 0.55);
  haze.addColorStop(0, 'rgba(255,200,150,0.18)');
  haze.addColorStop(1, 'transparent');
  ctx.fillStyle = haze;
  ctx.fillRect(0, L.groundY - h * 0.3, w, h * 0.3);

  // Drifting clouds
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 5; i++) {
    const clx = (i * 137) % w, cly = h * (0.1 + (i % 3) * 0.12);
    ctx.beginPath();
    ctx.ellipse(clx, cly, 60 + i * 12, 14 + i * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Support legs (4 splayed, behind tank) ──
  const legTop = L.tankY + L.tankH + h * 0.06;
  const legSpread = L.tankW * 0.62;
  ctx.strokeStyle = '#3a3f44';
  ctx.lineWidth = Math.max(4, w * 0.008);
  const legXs = [cx - legSpread, cx - legSpread * 0.34, cx + legSpread * 0.34, cx + legSpread];
  const legTopXs = [cx - L.tankW * 0.32, cx - L.tankW * 0.12, cx + L.tankW * 0.12, cx + L.tankW * 0.32];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(legTopXs[i], legTop);
    ctx.lineTo(legXs[i], L.groundY);
    ctx.stroke();
  }
  // Cross bracing (X patterns between legs)
  ctx.strokeStyle = '#33383d';
  ctx.lineWidth = Math.max(2, w * 0.004);
  for (let band = 0; band < 2; band++) {
    const t0 = 0.3 + band * 0.35, t1 = 0.65 + band * 0.35;
    for (let i = 0; i < 3; i++) {
      const ax0 = legTopXs[i] + (legXs[i] - legTopXs[i]) * t0, ay0 = legTop + (L.groundY - legTop) * t0;
      const bx0 = legTopXs[i+1] + (legXs[i+1] - legTopXs[i+1]) * t1, by0 = legTop + (L.groundY - legTop) * t1;
      const ax1 = legTopXs[i+1] + (legXs[i+1] - legTopXs[i+1]) * t0, ay1 = ay0;
      const bx1 = legTopXs[i] + (legXs[i] - legTopXs[i]) * t1, by1 = by0;
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(bx0, by0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(bx1, by1); ctx.stroke();
    }
  }
  // Horizontal strut ring
  ctx.strokeStyle = '#3a3f44';
  ctx.lineWidth = Math.max(3, w * 0.005);
  const ringT = 0.5;
  ctx.beginPath();
  ctx.moveTo(legTopXs[0] + (legXs[0]-legTopXs[0])*ringT, legTop + (L.groundY-legTop)*ringT);
  ctx.lineTo(legTopXs[3] + (legXs[3]-legTopXs[3])*ringT, legTop + (L.groundY-legTop)*ringT);
  ctx.stroke();

  // ── Conical roof ──
  const roofApexY = L.tankY - h * 0.10;
  const roof = ctx.createLinearGradient(L.tankX, roofApexY, L.tankX + L.tankW, L.tankY);
  roof.addColorStop(0, '#4a5560');
  roof.addColorStop(0.5, '#6a7884');
  roof.addColorStop(1, '#3e4750');
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(cx, roofApexY);
  ctx.lineTo(L.tankX - w * 0.01, L.tankY + 4);
  ctx.lineTo(L.tankX + L.tankW + w * 0.01, L.tankY + 4);
  ctx.closePath();
  ctx.fill();
  // Roof seams
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const fx = L.tankX + (L.tankW) * (i / 5);
    ctx.beginPath(); ctx.moveTo(cx, roofApexY); ctx.lineTo(fx, L.tankY + 3); ctx.stroke();
  }
  // Finial
  ctx.fillStyle = '#888';
  ctx.fillRect(cx - 2, roofApexY - 10, 4, 12);
  ctx.beginPath(); ctx.arc(cx, roofApexY - 12, 4, 0, Math.PI * 2); ctx.fill();

  // ── Tapered bottom (cone under tank) ──
  const botY = L.tankY + L.tankH;
  const taper = ctx.createLinearGradient(L.tankX, botY, L.tankX + L.tankW, botY);
  taper.addColorStop(0, '#454a50');
  taper.addColorStop(0.5, '#5e656c');
  taper.addColorStop(1, '#3c4046');
  ctx.fillStyle = taper;
  ctx.beginPath();
  ctx.moveTo(L.tankX, botY - 2);
  ctx.lineTo(L.tankX + L.tankW, botY - 2);
  ctx.lineTo(cx + L.tankW * 0.12, legTop);
  ctx.lineTo(cx - L.tankW * 0.12, legTop);
  ctx.closePath();
  ctx.fill();

  // ── Tank body (curved paint surface) ──
  const body = ctx.createLinearGradient(L.tankX, 0, L.tankX + L.tankW, 0);
  body.addColorStop(0, '#5a626a');     // shaded left edge
  body.addColorStop(0.18, '#7a838c');
  body.addColorStop(0.5, '#9aa3ac');   // lit center (curvature highlight)
  body.addColorStop(0.82, '#79828b');
  body.addColorStop(1, '#565d64');     // shaded right edge
  ctx.fillStyle = body;
  ctx.fillRect(L.tankX, L.tankY, L.tankW, L.tankH);

  // Top & bottom rim ellipse shading
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(L.tankX, L.tankY, L.tankW, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(L.tankX, botY - 4, L.tankW, 4);

  // Horizontal weld bands
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const by = L.tankY + (L.tankH / 3) * i;
    ctx.beginPath(); ctx.moveTo(L.tankX, by); ctx.lineTo(L.tankX + L.tankW, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(L.tankX, by + 1); ctx.lineTo(L.tankX + L.tankW, by + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  }

  // Vertical plate seams with rivets
  for (let i = 1; i < 5; i++) {
    const sx = L.tankX + (L.tankW / 5) * i;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.moveTo(sx, L.tankY); ctx.lineTo(sx, botY); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let ry = L.tankY + 8; ry < botY; ry += 18) {
      ctx.beginPath(); ctx.arc(sx, ry, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Metal grain
  applyNoise(ctx, Math.floor(L.tankX), Math.floor(L.tankY), Math.floor(L.tankW), Math.floor(L.tankH), 10);

  // Rust streaks running down
  weatherStreaks(ctx, L.tankX, L.tankY, L.tankW, L.tankH, 26, 'rgba(90,50,25,1)');

  // Faded town name (stencil)
  ctx.fillStyle = 'rgba(40,45,50,0.18)';
  ctx.font = `bold ${Math.floor(L.tankH * 0.22)}px "Arial", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('SPRINGDALE', cx, L.tankY + L.tankH * 0.58);
  ctx.textAlign = 'start';

  // Catwalk railing around tank base
  ctx.strokeStyle = '#33383d';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(L.tankX - 4, botY); ctx.lineTo(L.tankX + L.tankW + 4, botY); ctx.stroke();
  for (let x = L.tankX; x <= L.tankX + L.tankW; x += L.tankW / 12) {
    ctx.beginPath(); ctx.moveTo(x, botY); ctx.lineTo(x, botY + 7); ctx.stroke();
  }

  // ── Ground ──
  const grd = ctx.createLinearGradient(0, L.groundY, 0, h);
  grd.addColorStop(0, '#3a3a30');
  grd.addColorStop(0.3, '#2e2e26');
  grd.addColorStop(1, '#1a1a14');
  ctx.fillStyle = grd;
  ctx.fillRect(0, L.groundY, w, h - L.groundY);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, L.groundY, w, 1);
  // grass/dirt speckle
  for (let i = 0; i < 300; i++) {
    const gx = Math.random() * w, gy = L.groundY + 4 + Math.random() * (h - L.groundY - 4);
    const s = 35 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgb(${s},${s + 6},${s - 8})`;
    ctx.fillRect(gx, gy, 1 + Math.random() * 2, 1);
  }

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.28, w / 2, h * 0.5, w * 0.72);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function generateWaterTowerMask(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const L = waterTowerLayout(w, h);
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(L.tankX, L.tankY, L.tankW, L.tankH);
}

// ══════════════════════════════════
//  CANVAS MANAGEMENT
// ══════════════════════════════════

function resizeCanvases() {
  const rect = canvasWrap.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);

  for (const c of [bgCanvas, paintCanvas, gridCanvas, maskCanvasEl]) {
    c.width = w;
    c.height = h;
  }

  drawBackground();
  buildMask();
  repaintStrokes();
  drawGrid();
}

// Cache of loaded surface images; redraws when an image finishes loading
const surfaceImages = {};
function getSurfaceImage(src) {
  if (surfaceImages[src]) return surfaceImages[src];
  const img = new Image();
  img.onload = () => { drawBackground(); buildMask(); repaintStrokes(); };
  img.src = src;
  surfaceImages[src] = img;
  return img;
}

// "contain" letterbox rect for an image inside w×h
function computeContainRect(iw, ih, w, h) {
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

function drawBackground() {
  const w = bgCanvas.width, h = bgCanvas.height;
  bgCtx.clearRect(0, 0, w, h);
  const s = SURFACES[state.surface];

  if (s.image) {
    const img = getSurfaceImage(s.image);
    bgCtx.fillStyle = '#0e0e12';
    bgCtx.fillRect(0, 0, w, h);
    if (img.complete && img.naturalWidth) {
      const r = computeContainRect(img.naturalWidth, img.naturalHeight, w, h);
      bgCtx.drawImage(img, r.x, r.y, r.w, r.h);
    }
    return;
  }

  s.generate(bgCtx, w, h);
}

function buildMask() {
  const w = maskCanvasEl.width, h = maskCanvasEl.height;
  maskCtx.clearRect(0, 0, w, h);
  const s = SURFACES[state.surface];

  if (s.image) {
    const img = getSurfaceImage(s.image);
    if (img.complete && img.naturalWidth) {
      const r = computeContainRect(img.naturalWidth, img.naturalHeight, w, h);
      maskCtx.fillStyle = '#00FF00';
      for (const z of s.paintZones) {
        maskCtx.fillRect(r.x + z.x * r.w, r.y + z.y * r.h, z.w * r.w, z.h * r.h);
      }
    }
    maskData = maskCtx.getImageData(0, 0, w, h);
    return;
  }

  s.mask(maskCtx, w, h);
  maskData = maskCtx.getImageData(0, 0, w, h);
}

function isInPaintZone(x, y) {
  if (!maskData) return true;
  const px = Math.floor(x), py = Math.floor(y);
  if (px < 0 || py < 0 || px >= maskData.width || py >= maskData.height) return false;
  const idx = (py * maskData.width + px) * 4;
  return maskData.data[idx + 1] > 128; // green channel
}

function drawGrid() {
  const w = gridCanvas.width, h = gridCanvas.height;
  gridCtx.clearRect(0, 0, w, h);
  if (!state.showGrid) return;

  gridCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  gridCtx.lineWidth = 1;
  for (let x = 60; x < w; x += 60) {
    gridCtx.beginPath(); gridCtx.moveTo(x, 0); gridCtx.lineTo(x, h); gridCtx.stroke();
  }
}

// ══════════════════════════════════
//  PALETTE
// ══════════════════════════════════

const paletteEl = document.getElementById('palette');
const colorPicker = document.getElementById('colorPicker');
const colorHex = document.getElementById('colorHex');

function buildPalette() {
  paletteEl.innerHTML = '';
  COLORS.forEach(color => {
    const el = document.createElement('div');
    el.className = 'swatch' + (color === state.color ? ' active' : '');
    el.style.background = color;
    el.addEventListener('click', () => selectColor(color, el));
    paletteEl.appendChild(el);
  });
}

function selectColor(color, swatchEl) {
  state.color = color;
  colorPicker.value = color.length === 7 ? color : '#FF0000';
  colorHex.textContent = color;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  if (swatchEl) swatchEl.classList.add('active');
}

colorPicker.addEventListener('input', () => {
  const c = colorPicker.value.toUpperCase();
  state.color = c;
  colorHex.textContent = c;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
});

// ══════════════════════════════════
//  PAINTING ENGINE
// ══════════════════════════════════

function getCapRadius() { return CAPS[state.cap].radius; }

function drawDab(ctx, x, y, radius, color, opacity, brush, velocity) {
  if (!isInPaintZone(x, y)) return;

  if (brush === 'marker') {
    ctx.globalAlpha = Math.min(opacity + 0.15, 1.0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    return;
  }

  if (brush === 'chisel') {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 6);
    ctx.fillRect(-radius * 1.2, -radius * 0.25, radius * 2.4, radius * 0.5);
    ctx.restore();
    ctx.globalAlpha = 1.0;
    return;
  }

  // Flare cap — wide elliptical fan spray, soft edges, heavy coverage
  if (state.cap === 'flare') {
    const spread = radius * 1.4;
    const height = radius * 0.5;
    const dabs = Math.max(8, Math.floor(radius * 3));
    for (let i = 0; i < dabs; i++) {
      // Elliptical distribution — wide horizontally, narrow vertically
      const ax = (Math.random() - 0.5) * 2;
      const ay = (Math.random() - 0.5) * 2;
      const dx = x + ax * spread;
      const dy = y + ay * height;
      if (!isInPaintZone(dx, dy)) continue;

      // Distance from center for fade
      const distNorm = Math.sqrt((ax * ax) + (ay * ay));
      const edgeFade = Math.max(0, 1.0 - distNorm * 0.7);
      const r = 0.8 + Math.random() * 2.5;
      ctx.globalAlpha = opacity * (0.15 + Math.random() * 0.35) * edgeFade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dense center core
    const coreDabs = Math.floor(dabs * 0.4);
    for (let i = 0; i < coreDabs; i++) {
      const dx = x + (Math.random() - 0.5) * spread * 0.3;
      const dy = y + (Math.random() - 0.5) * height * 0.4;
      if (!isInPaintZone(dx, dy)) continue;
      ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    return;
  }

  // Spray brush — pressure-sensitive with denser center
  const speed = velocity || 1;
  const densityMult = Math.max(0.5, Math.min(2.0, 1.5 / speed));
  const dabs = Math.max(4, Math.floor(radius * 2 * densityMult));

  for (let i = 0; i < dabs; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Bias distance toward center for denser core
    const rawDist = Math.random();
    const dist = rawDist * rawDist * radius;
    const dx = x + Math.cos(angle) * dist;
    const dy = y + Math.sin(angle) * dist;

    if (!isInPaintZone(dx, dy)) continue;

    const r = 0.5 + Math.random() * 1.8;
    // Fade opacity toward edges
    const edgeFade = 1.0 - (dist / radius) * 0.6;
    ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.7) * edgeFade;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// Drip effect — triggered when moving slowly with fat cap
function addDrip(ctx, x, y, color, opacity) {
  if (!isInPaintZone(x, y)) return;
  const dripLen = 10 + Math.random() * 30;
  const dripW = 1 + Math.random() * 2;
  ctx.globalAlpha = opacity * 0.5;
  ctx.fillStyle = color;
  for (let dy = 0; dy < dripLen; dy++) {
    if (!isInPaintZone(x, y + dy)) break;
    ctx.globalAlpha = opacity * 0.5 * (1 - dy / dripLen);
    ctx.beginPath();
    ctx.arc(x + (Math.random() - 0.5) * 0.5, y + dy, dripW * (1 - dy / dripLen * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  for (let i = 0; i < pts.length; i++) {
    drawDab(ctx, pts[i].x, pts[i].y, stroke.radius, stroke.color, stroke.opacity, stroke.brush, pts[i].v || 1);
  }
  if (stroke.drips) {
    stroke.drips.forEach(d => addDrip(ctx, d.x, d.y, stroke.color, stroke.opacity));
  }
}

function interpolatePoints(p0, p1, spacing) {
  const pts = [];
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.floor(dist / spacing));
  const v = dist / Math.max(steps, 1);
  for (let i = 1; i <= steps; i++) {
    pts.push({ x: p0.x + (dx * i) / steps, y: p0.y + (dy * i) / steps, v });
  }
  return pts;
}

function repaintStrokes() {
  paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
  state.strokes.forEach(s => drawStroke(paintCtx, s));
}

// ── Bucket fill ──

function bucketFill(x, y, color, opacity) {
  if (!isInPaintZone(x, y)) return;

  const w = paintCanvas.width, h = paintCanvas.height;
  paintCtx.globalAlpha = opacity;
  paintCtx.fillStyle = color;

  // Fill entire paint zone rather than flood-fill (simpler, fast)
  for (let py = 0; py < h; py += 2) {
    for (let px = 0; px < w; px += 2) {
      if (isInPaintZone(px, py)) {
        paintCtx.fillRect(px, py, 2, 2);
      }
    }
  }
  paintCtx.globalAlpha = 1.0;
}

// ══════════════════════════════════
//  POINTER EVENTS
// ══════════════════════════════════

function getPos(e) {
  const rect = paintCanvas.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: cx - rect.left, y: cy - rect.top };
}

function onPointerDown(e) {
  if (e.button && e.button !== 0) return;
  e.preventDefault();

  const pos = getPos(e);

  state.painting = true;
  state.lastPoint = pos;
  state.velocity = 0;

  state.current = {
    color: state.color,
    radius: getCapRadius(),
    opacity: state.opacity,
    brush: state.brush,
    points: [{ ...pos, v: 0 }],
    drips: [],
  };

  drawDab(paintCtx, pos.x, pos.y, state.current.radius, state.current.color, state.current.opacity, state.current.brush, 0);
}

function onPointerMove(e) {
  const pos = getPos(e);
  updateCursor(pos);

  if (!state.painting || !state.current) return;
  e.preventDefault();

  const last = state.current.points[state.current.points.length - 1];
  const dx = pos.x - last.x, dy = pos.y - last.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  state.velocity = dist;

  const spacing = Math.max(1.5, state.current.radius * 0.25);
  const interp = interpolatePoints(last, pos, spacing);

  interp.forEach(p => {
    state.current.points.push(p);
    drawDab(paintCtx, p.x, p.y, state.current.radius, state.current.color, state.current.opacity, state.current.brush, p.v);
  });

  // Drip chance when moving slowly with fat cap
  if (state.cap === 'fat' && dist < 3 && state.brush === 'spray' && Math.random() < 0.08) {
    const drip = { x: pos.x + (Math.random() - 0.5) * 4, y: pos.y };
    state.current.drips.push(drip);
    addDrip(paintCtx, drip.x, drip.y, state.current.color, state.current.opacity);
  }
}

function onPointerUp() {
  if (!state.painting) return;
  state.painting = false;
  if (state.current && state.current.points.length > 0) {
    state.strokes.push(state.current);
  }
  state.current = null;
}

// ── Cursor ──

function updateCursor(pos) {
  const r = getCapRadius();
  let size;
  if (state.brush === 'chisel') size = r * 2.4 + 2;
  else if (state.cap === 'flare') { size = r * 2.8 + 2; }
  else size = r * 2 + 2;

  cursorRing.style.display = 'block';
  cursorRing.style.width = size + 'px';
  cursorRing.style.height = size + 'px';
  cursorRing.style.left = (pos.x - size / 2) + 'px';
  cursorRing.style.top = (pos.y - size / 2) + 'px';

  cursorRing.style.borderColor = 'rgba(255,255,255,0.4)';
  if (state.cap === 'flare') {
    cursorRing.style.borderRadius = '50% / 35%';
  } else {
    cursorRing.style.borderRadius = '50%';
  }
}

// ══════════════════════════════════
//  ACTIONS
// ══════════════════════════════════

function undo() {
  if (state.strokes.length === 0) return;
  const last = state.strokes.pop();
  if (last.type === 'snapshot') {
    // Bucket fill undo — restore the snapshot then replay remaining strokes
    paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    paintCtx.putImageData(last.imageData, 0, 0);
  } else {
    repaintStrokes();
  }
}

function clearCanvas() {
  if (state.strokes.length === 0) return;
  if (!confirm('Clear all graffiti?')) return;
  state.strokes = [];
  repaintStrokes();
}

function compositeImage() {
  const w = bgCanvas.width, h = bgCanvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tCtx = tmp.getContext('2d');
  tCtx.drawImage(bgCanvas, 0, 0);
  tCtx.drawImage(paintCanvas, 0, 0);
  return tmp;
}

function downloadPiece() {
  const tmp = compositeImage();
  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-' + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0');

  const link = document.createElement('a');
  link.download = `vandalyard-piece-${ts}.png`;
  link.href = tmp.toDataURL('image/png');
  link.click();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function changeSurface(val) {
  if (val === state.surface) return;
  if (state.strokes.length > 0 && !confirm('Changing surface clears your graffiti. Continue?')) {
    document.getElementById('surfaceSelect').value = state.surface;
    return;
  }
  state.surface = val;
  state.strokes = [];
  drawBackground();
  buildMask();
  repaintStrokes();
  drawGrid();
}

// ══════════════════════════════════
//  POST TO WALL (localStorage gallery)
// ══════════════════════════════════

const postModal    = document.getElementById('postModal');
const postPreview  = document.getElementById('postPreview');
const postTitle    = document.getElementById('postTitle');
const postArtist   = document.getElementById('postArtist');
const postCancel   = document.getElementById('postCancel');
const postSubmit   = document.getElementById('postSubmit');

function openPostModal() {
  if (state.strokes.length === 0) {
    alert('Paint something first!');
    return;
  }
  const tmp = compositeImage();
  const pCtx = postPreview.getContext('2d');
  const aspect = tmp.width / tmp.height;
  postPreview.width = Math.min(360, tmp.width);
  postPreview.height = postPreview.width / aspect;
  pCtx.drawImage(tmp, 0, 0, postPreview.width, postPreview.height);

  postTitle.value = '';
  postArtist.value = localStorage.getItem('vandalyard_artist') || '';
  postModal.classList.remove('hidden');
  postTitle.focus();
}

function closePostModal() {
  postModal.classList.add('hidden');
}

async function submitPost() {
  const title = postTitle.value.trim() || 'Untitled';
  const artist = postArtist.value.trim() || 'Anonymous';
  localStorage.setItem('vandalyard_artist', artist);

  postSubmit.disabled = true;
  postSubmit.textContent = 'POSTING...';

  try {
    const tmp = compositeImage();
    const blob = await new Promise(r => tmp.toBlob(r, 'image/jpeg', 0.75));
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const filename = `${id}.jpg`;

    const imageUrl = await db.uploadImage(filename, blob);
    if (!imageUrl) throw new Error('Image upload failed');

    await db.insertPiece({
      id,
      title,
      artist,
      surface: state.surface,
      image_url: imageUrl,
    });

    closePostModal();
    state.strokes = [];
    repaintStrokes();
  } catch (err) {
    alert('Failed to post: ' + err.message);
  } finally {
    postSubmit.disabled = false;
    postSubmit.textContent = 'POST IT';
  }
}

// ══════════════════════════════════
//  INIT & EVENT BINDING
// ══════════════════════════════════

function init() {
  buildPalette();

  // Canvas pointer events
  paintCanvas.addEventListener('mousedown', onPointerDown);
  paintCanvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  paintCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
  paintCanvas.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);
  canvasWrap.addEventListener('mouseleave', () => { cursorRing.style.display = 'none'; });
  paintCanvas.addEventListener('contextmenu', e => e.preventDefault());

  // Surface
  document.getElementById('surfaceSelect').addEventListener('change', e => changeSurface(e.target.value));

  // Cap buttons
  document.querySelectorAll('.cap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.cap = btn.dataset.cap;
      document.querySelectorAll('.cap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Brush buttons
  document.querySelectorAll('.brush-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.brush = btn.dataset.brush;
      document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Opacity
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  opacitySlider.addEventListener('input', () => {
    state.opacity = opacitySlider.value / 100;
    opacityValue.textContent = opacitySlider.value + '%';
  });

  // Grid
  document.getElementById('gridToggle').addEventListener('change', e => {
    state.showGrid = e.target.checked;
    drawGrid();
  });

  // Mask visibility toggle
  document.getElementById('maskToggle').addEventListener('change', e => {
    state.showMask = e.target.checked;
    maskCanvasEl.classList.toggle('visible', state.showMask);
  });

  // Utility buttons
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnClear').addEventListener('click', clearCanvas);
  document.getElementById('btnDownload').addEventListener('click', downloadPiece);
  document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('btnPost').addEventListener('click', openPostModal);

  // Post modal
  postCancel.addEventListener('click', closePostModal);
  postSubmit.addEventListener('click', submitPost);
  document.querySelector('.modal-backdrop')?.addEventListener('click', closePostModal);

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case '1': document.querySelector('[data-cap="thin"]').click(); break;
      case '2': document.querySelector('[data-cap="medium"]').click(); break;
      case '3': document.querySelector('[data-cap="fat"]').click(); break;
      case 'z': if (!e.ctrlKey && !e.metaKey) undo(); break;
      case 'c': if (!e.ctrlKey && !e.metaKey) clearCanvas(); break;
      case '4': document.querySelector('[data-cap="flare"]').click(); break;
      case 's': if (!e.ctrlKey) { e.preventDefault(); document.querySelector('[data-brush="spray"]').click(); } break;
      case 'm': document.querySelector('[data-brush="marker"]').click(); break;
    }
  });

  // Resize
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();
}

init();
