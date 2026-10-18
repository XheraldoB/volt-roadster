// Generates the PWA icons as PNG with no dependencies (runs before every build, so the repo stays text-only).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(W, px) { const raw = Buffer.alloc((W * 4 + 1) * W); for (let y = 0; y < W; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
const bolt = [[0.58, 0.12], [0.3, 0.55], [0.48, 0.55], [0.4, 0.88], [0.72, 0.42], [0.53, 0.42], [0.64, 0.12]];
function icon(W) {
  const px = Buffer.alloc(W * W * 4), S = 3;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = (x + (sx + 0.5) / S) / W, v = (y + (sy + 0.5) / S) / W;
      // background: deep space gradient + horizon glow + road
      let cr = 10 + 40 * v, cg = 8 + 10 * v, cb = 36 + 50 * (1 - v);
      const glow = Math.exp(-((v - 0.72) ** 2) / 0.004); cr += 255 * glow * 0.6; cg += 47 * glow; cb += 146 * glow * 0.6;
      if (v > 0.72) { const half = 0.05 + (v - 0.72) * 1.4; if (Math.abs(u - 0.5) < half) { cr = 30; cg = 32; cb = 40; if (Math.abs(u - 0.5) < 0.012 + (v - 0.72) * 0.05 && Math.floor(v * 40) % 2) { cr = 255; cg = 210; cb = 80; } } }
      const d = Math.hypot(u - 0.5, v - 0.47); if (d < 0.36 && d > 0.33) { cr = 0; cg = 229; cb = 255; }
      if (inPoly(u, v, bolt)) { const k = (v - 0.12) / 0.76; cr = 0 + 255 * k; cg = 229 - 180 * k; cb = 255 - 109 * k; }
      r += cr; g += cg; b += cb;
    }
    const i = (y * W + x) * 4; px[i] = Math.min(255, r / S / S); px[i + 1] = Math.min(255, g / S / S); px[i + 2] = Math.min(255, b / S / S); px[i + 3] = 255;
  }
  return png(W, px);
}
mkdirSync('public/icons', { recursive: true });
for (const W of [192, 512]) writeFileSync(`public/icons/icon-${W}.png`, icon(W));
console.log('icons generated');
