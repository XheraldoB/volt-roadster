// Terrain height field shaped around the track (cuts, fills, canyons, craters, volcano).
import { fbm, ridged, rng, smoothstep, lerp } from './noise.js';
import { ROAD_W } from './track.js';

export function makeTerrain(tr, level) {
  const planet = level.planet, env = level.env;
  const sm = tr.samples;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, ymin = 1e9;
  for (const s of sm) { if (s.runoff) continue; /* bounds (and the seeded features built from them) ignore the B31 run-off */ x0 = Math.min(x0, s.p.x); x1 = Math.max(x1, s.p.x); z0 = Math.min(z0, s.p.z); z1 = Math.max(z1, s.p.z); ymin = Math.min(ymin, s.p.y); }
  const M = 700; const bounds = { x0: x0 - M, x1: x1 + M, z0: z0 - M, z1: z1 + M };
  const R = rng(level.id.charCodeAt(0) * 31 + level.id.charCodeAt(1) * 7);
  // subsampled sample index grid
  const cell = 40, grid = new Map();
  for (let i = 0; i < sm.length; i += 2) {
    const s = sm[i]; if (!s.gap && s.U.y < 0.85) continue; // skip loop/wall tops
    const k = Math.floor(s.p.x / cell) + ',' + Math.floor(s.p.z / cell);
    let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(s);
  }
  // features
  const craters = [];
  const canyons = [];
  for (const f of tr.features) if (f.type === 'gap') {
    const a = sm.find(s => s.s >= f.s0), b = sm.find(s => s.s >= f.s1) || sm[sm.length - 1];
    const mid = a.p.clone().lerp(b.p, 0.5);
    const floor = Math.min(a.p.y, b.p.y) - (f.cliff ? 30 : planet === 'moon' ? 70 : 55);
    if (planet === 'moon' && !f.cliff) craters.push({ x: mid.x, z: mid.z, r: f.len * 0.42, d: 60, hole: true, floor });
    else canyons.push({ mid, dir: { x: a.X.x, z: a.X.z }, half: 900, w: Math.max(18, f.len * 0.36), floor, cliff: f.cliff, along: { x: a.T.x, z: a.T.z } });
  }
  if (planet === 'moon') for (let i = 0; i < 70; i++) craters.push({ x: lerp(bounds.x0, bounds.x1, R()), z: lerp(bounds.z0, bounds.z1, R()), r: 15 + Math.pow(R(), 2.2) * 160, d: 0 });
  let volcano = null;
  if (planet === 'mars') {
    let top = sm[0]; for (const s of sm) if (s.p.y > top.p.y && s.U.y > 0.9) top = s;
    if (level.volcano === 'summit' || (!level.volcano && level.id === 'r3')) volcano = { x: top.p.x + top.X.x * 260, z: top.p.z + top.X.z * 260, h: top.p.y + 140, r: 900 };
    else volcano = { x: (x0 + x1) / 2 + 1400, z: (z0 + z1) / 2 + 600, h: 380, r: 1100 };
  }
  const ocean = env === 'sunset' ? { y: ymin - 14 } : null;
  const hw = ROAD_W / 2;

  function natural(x, z) {
    let h;
    if (planet === 'earth') {
      h = fbm(x / 520, z / 520, 5) * 70 + ridged(x / 260, z / 260, 4) * 26 - 12;
      if (env === 'night') h = fbm(x / 700, z / 700, 3) * 10;
      if (ocean) { const c = (x - (x0 + x1) / 2) / 400; h = h * 0.8 - Math.max(0, c) * 60 + 8; }
    } else if (planet === 'moon') {
      h = fbm(x / 600, z / 600, 6) * 34;
      for (const c of craters) {
        if (c.hole) continue;
        const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d > 1.6) continue;
        const depth = c.r * 0.22;
        h += d < 1 ? -depth * (1 - d * d) + depth * 0.25 * d ** 6 : depth * 0.25 * Math.exp(-(((d - 1) * 4) ** 2));
      }
    } else {
      h = fbm(x / 600, z / 600, 5) * 55 + ridged(x / 300, z / 300, 4) * 34 - 20;
      if (volcano) { const d = Math.hypot(x - volcano.x, z - volcano.z) / volcano.r; if (d < 1.4) { const cone = Math.max(0, 1 - d) ** 1.6 * volcano.h; const cald = d < 0.12 ? (0.12 - d) * volcano.h * 2.5 : 0; h = Math.max(h, cone - cald + h * 0.3); } }
    }
    return h;
  }

  function heightAt(x, z) {
    let h = natural(x, z);
    // canyons (crosswise trenches) and holes
    for (const c of canyons) {
      const dx = x - c.mid.x, dz = z - c.mid.z;
      const across = Math.abs(dx * c.along.x + dz * c.along.z); // distance along track dir
      const along = Math.abs(dx * c.dir.x + dz * c.dir.z);
      if (along > c.half) continue;
      const wob = (fbm(x / 90, z / 90, 3)) * c.w * 0.5;
      const w = c.w + wob + along * 0.02;
      const t = 1 - smoothstep(w * 0.55, w * 1.15, across);
      if (t > 0) h = lerp(h, Math.min(h, c.floor + across * 0.15), t * (1 - smoothstep(c.half * 0.7, c.half, along)));
    }
    for (const c of craters) if (c.hole) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d > 1.5) continue;
      const t = 1 - smoothstep(0.75, 1.15, d); h = lerp(h, c.floor, t);
      if (d >= 1 && d < 1.5) h += 3 * Math.exp(-(((d - 1.1) * 6) ** 2));
    }
    // track influence
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    let best = null, bd = 1e18;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = grid.get((cx + a) + ',' + (cz + b)); if (!arr) continue;
      for (const s of arr) { const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    }
    if (best && best.gap) {
      const d = Math.sqrt(bd); const depth = best.cliff ? 26 : planet === 'moon' ? 60 : 42;
      const w = 1 - smoothstep(hw + 14, hw + 70, d);
      if (w > 0) h = lerp(h, Math.min(h, best.p.y - depth - Math.max(0, (best.p.y - ymin) * 0.2)), w);
    } else if (best) {
      const d = Math.sqrt(bd); const target = best.p.y - 0.7;
      const diff = Math.abs(h - target);
      const w = 1 - smoothstep(hw + 5, hw + 10 + diff * 1.4 + 8, d);
      if (w > 0) h = lerp(h, target, w);
    }
    return h;
  }
  return { bounds, heightAt, natural, ocean, volcano, craters, canyons };
}

export function terrainArrays(T, res) {
  const { x0, x1, z0, z1 } = T.bounds;
  const nx = res, nz = Math.max(16, Math.round(res * (z1 - z0) / (x1 - x0)));
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  let k = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
    pos[k++] = x; pos[k++] = T.heightAt(x, z); pos[k++] = z;
  }
  const idx = new Uint32Array(nx * nz * 6); k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  return { pos, idx, nx, nz };
}
