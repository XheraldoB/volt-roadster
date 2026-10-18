// Procedural canvas textures (no external assets = no licensing issues).
import * as THREE from 'three';
import { fbm, rng } from '../noise.js';

const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function roadTexture(style = 'asphalt') {
  const key = 'road' + style; if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 512), g = c.getContext('2d'); const r = rng(7);
  const base = { asphalt: [47, 46, 45], moon: [96, 96, 100], mars: [92, 58, 46], neon: [22, 22, 32], spaceport: [52, 54, 60] }[style] || [40, 40, 44];
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  // edge lines + dashed lanes
  const edge = style === 'neon' ? '#ff2bd6' : style === 'moon' ? '#e8e8f0' : style === 'mars' ? '#ffd27a' : '#f2f2f2';
  g.fillStyle = edge; g.fillRect(14, 0, 10, 512); g.fillRect(488, 0, 10, 512);
  g.fillStyle = style === 'neon' ? '#29e7ff' : '#f5c84c';
  for (const x of [176, 336]) for (let y = 0; y < 512; y += 128) g.fillRect(x - 4, y, 8, 64);
  // curbs
  for (let y = 0; y < 512; y += 64) { g.fillStyle = (y / 64) % 2 ? '#d22' : '#eee'; g.fillRect(0, y, 12, 64); g.fillRect(500, y, 12, 64); }
  const t = tex(c, [1, 1]); cache.set(key, t); return t;
}

export function noiseNormalMap(scale = 8, strength = 2.5) {
  const key = 'nrm' + scale + strength; if (cache.has(key)) return cache.get(key);
  const N = 256, c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N);
  const H = (x, y) => fbm((x / N) * scale, (y / N) * scale, 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength * 10, dy = (H(x, y + 1) - H(x, y - 1)) * strength * 10;
    const l = Math.hypot(dx, dy, 1); const i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = tex(c, [1, 1], false); cache.set(key, t); return t;
}

export function detailTexture(planet) {
  const key = 'det' + planet; if (cache.has(key)) return cache.get(key);
  const N = 256, c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = 0.75 + fbm(x / 24, y / 24, 4) * 0.5 + fbm(x / 6, y / 6, 2) * 0.15; const i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v * 255)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = tex(c, [1, 1], false); cache.set(key, t); return t;
}

export function glowSprite() {
  if (cache.has('glow')) return cache.get('glow');
  const c = canvas(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); cache.set('glow', t); return t;
}

export function windowsTexture() {
  if (cache.has('win')) return cache.get('win');
  const c = canvas(128, 256), g = c.getContext('2d'); const r = rng(3);
  g.fillStyle = '#0b0d18'; g.fillRect(0, 0, 128, 256);
  for (let y = 4; y < 256; y += 12) for (let x = 4; x < 128; x += 10) {
    if (r() < 0.55) { const hue = r() < 0.7 ? '255,210,140' : r() < 0.5 ? '120,200,255' : '255,90,200'; g.fillStyle = `rgba(${hue},${0.5 + r() * 0.5})`; g.fillRect(x, y, 6, 7); }
  }
  const t = tex(c, [1, 1]); cache.set('win', t); return t;
}

export function textTexture(lines, opts = {}) {
  const w = opts.w || 1024, h = opts.h || 512; const c = canvas(w, h), g = c.getContext('2d');
  const bg = opts.bg || '#111'; g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (opts.grad) { const gr = g.createLinearGradient(0, 0, w, h); opts.grad.forEach((col, i) => gr.addColorStop(i / (opts.grad.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.fillStyle = opts.color || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => { const size = ln.size || 80; g.font = `${ln.weight || 900} ${size}px system-ui, sans-serif`; g.fillStyle = ln.color || opts.color || '#fff'; g.fillText(ln.text, w / 2, h * (i + 1) / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Car wraps: drawn in body UV space (u = along length 0 rear..1 front, v = around the body ring)
export function wrapTexture(kind, color2 = '#111', color3 = '#fff') {
  const key = 'wrap' + kind + color2 + color3; if (cache.has(key)) return cache.get(key);
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'); const r = rng(11);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); // white = base paint shows through (map multiplies)
  if (kind === 'stripes') { g.fillStyle = color2; g.fillRect(0, H * 0.70, W, H * 0.06); g.fillRect(0, H * 0.79, W, H * 0.06); }
  else if (kind === 'carbon') { for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#2a2a2e' : '#151517'; g.fillRect(x, y, 8, 8); } }
  else if (kind === 'flames') {
    for (let k = 0; k < 14; k++) { const v = H * (0.15 + 0.7 * r()); g.fillStyle = k % 2 ? color2 : '#ff7a00'; g.beginPath(); g.moveTo(W, v - 40); g.bezierCurveTo(W * 0.75, v - 60, W * (0.55 + r() * 0.2), v + 30, W * (0.35 + r() * 0.2), v); g.bezierCurveTo(W * 0.6, v + 20, W * 0.8, v + 50, W, v + 40); g.fill(); }
  } else if (kind === 'lightning') {
    g.strokeStyle = color2; g.lineWidth = 14; g.lineJoin = 'miter';
    for (const v0 of [0.3, 0.55]) { g.beginPath(); let x = 0, y = H * v0; g.moveTo(x, y); while (x < W) { x += 60 + r() * 60; y = H * v0 + (r() - 0.5) * 90; g.lineTo(x, y); } g.stroke(); }
  } else if (kind === 'camo') {
    const cols = [color2, '#556b2f', '#8b8b5a', '#2f3b1f'];
    for (let k = 0; k < 220; k++) { g.fillStyle = cols[k % cols.length]; g.beginPath(); g.ellipse(r() * W, r() * H, 20 + r() * 60, 12 + r() * 40, r() * 3, 0, 7); g.fill(); }
  } else if (kind === 'digital') {
    for (let x = 0; x < W; x += 16) for (let y = 0; y < H; y += 16) if (r() < x / W) { g.fillStyle = r() < 0.5 ? color2 : color3; g.fillRect(x, y, 16, 16); }
  } else if (kind === 'checker') { for (let y = 0; y < H; y += 64) for (let x = W * 0.6; x < W; x += 64) if (((x + y) / 64) % 2 < 1) { g.fillStyle = color2; g.fillRect(x, y, 64, 64); } }
  else if (kind === 'galaxy') {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1a0638'); gr.addColorStop(0.5, '#3a0f7a'); gr.addColorStop(1, '#06204a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 40; k++) { const rg = g.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 120); rg.addColorStop(0, `rgba(${200 + r() * 55 | 0},${80 + r() * 120 | 0},255,0.35)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,255,255,${r()})`; const sz = r() < 0.05 ? 3 : 1.5; g.fillRect(r() * W, r() * H, sz, sz); }
  } else if (kind === 'circuit') {
    g.fillStyle = '#0d2a1a'; g.fillRect(0, 0, W, H); g.strokeStyle = color2 === '#111111' ? '#39ff6a' : color2; g.lineWidth = 3;
    for (let k = 0; k < 120; k++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { if (r() < 0.5) x += (r() - 0.5) * 200; else y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  } else if (kind === 'tiger') {
    g.fillStyle = '#ff8a00'; g.fillRect(0, 0, W, H); g.fillStyle = color2;
    for (let k = 0; k < 34; k++) { const x = k / 34 * W + r() * 20; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 40, H * 0.3, x - 30, H * 0.5, x + 20 + r() * 30, H * (0.55 + r() * 0.4)); g.lineTo(x + 18, H * 0.3); g.lineTo(x + 22, 0); g.fill(); }
  } else if (kind === 'retrowave') {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ff2f92'); gr.addColorStop(0.5, '#7a2cff'); gr.addColorStop(1, '#0b0630'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#00e5ff'; g.lineWidth = 3; for (let y = H * 0.55; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, H * 0.55); g.lineTo(x + (x - W / 2) * 0.6, H); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(W * 0.5, H * 0.42, 90, Math.PI, 0); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache.set(key, t); return t;
}

export function starsTexture() {
  if (cache.has('stars')) return cache.get('stars');
  const c = canvas(2048, 1024), g = c.getContext('2d'); const r = rng(99);
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 4000; i++) { const s = r(); g.fillStyle = `rgba(255,255,255,${0.3 + s * 0.7})`; const sz = s > 0.985 ? 2.2 : s > 0.9 ? 1.4 : 0.8; g.fillRect(r() * 2048, r() * 1024, sz, sz); }
  // milky way band
  for (let i = 0; i < 9000; i++) { const x = r() * 2048; const y = 512 + Math.sin(x / 2048 * Math.PI * 2) * 220 + (r() - 0.5) * 160 * r(); g.fillStyle = `rgba(200,210,255,${0.08 * r()})`; g.fillRect(x, y, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; cache.set('stars', t); return t;
}

export function planetTexture(kind) {
  const key = 'pl' + kind; if (cache.has(key)) return cache.get(key);
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x / 60, y / 60, 5), i = (y * W + x) * 4; let col;
    if (kind === 'earth') { const lat = Math.abs(y / H - 0.5) * 2; col = lat > 0.85 ? [240, 245, 255] : n > 0.08 ? [70 + n * 200, 120 + n * 120, 60] : [20, 60 + n * 60, 140 + n * 80]; const cl = fbm(x / 30 + 9, y / 30, 4); if (cl > 0.12) col = col.map(v => v + (255 - v) * Math.min(1, (cl - 0.12) * 4)); }
    else if (kind === 'mars') col = [170 + n * 120, 80 + n * 60, 50 + n * 30];
    else col = [140 + n * 100, 140 + n * 100, 145 + n * 100];
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
