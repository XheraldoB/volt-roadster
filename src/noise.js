// Small deterministic value/gradient noise + RNG helpers.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const P = new Uint8Array(512);
(() => { const r = rng(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; })();
const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); };
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
export function perlin(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y), A = P[X] + Y, B = P[X + 1] + Y;
  const l = (a, b, t) => a + t * (b - a);
  return l(l(grad(P[A], x, y), grad(P[B], x - 1, y), u), l(grad(P[A + 1], x, y - 1), grad(P[B + 1], x - 1, y - 1), u), v) * 0.25;
}
export function fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * perlin(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}
export function ridged(x, y, oct = 4) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(perlin(x * f, y * f) * 2)); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
