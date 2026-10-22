// Track builder: turns a list of segment specs into a sampled centerline with
// orientation frames, plus gameplay flags (gaps, loops, pads, checkpoints...).
// Pure math (three.js core only) so it runs headless in tests.
import { Vector3, Quaternion, Euler } from 'three';

export const ROAD_W = 14;      // road width (m)
export const WALL_H = 1.2;     // barrier height (m)
export const RUNOFF = 160;      // B31: run-off road past the finish (m)
const DS = 1;                  // sample spacing (m)

const smooth = u => u * u * (3 - 2 * u);
const easeTurn = u => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI); // zero curvature at ends
const plateau = (u, e = 0.2) => (u < e ? smooth(u / e) : u > 1 - e ? smooth((1 - u) / e) : 1);
const D2R = Math.PI / 180;

export function buildTrack(def, gravity) {
  const samples = [];
  const pos = new Vector3(0, def.startY ?? 6, 0);
  let yaw = def.startYaw ?? 0, pitch = 0, roll = 0;
  const eul = new Euler(0, 0, 0, 'YXZ');
  const q = new Quaternion();
  const fwd = new Vector3();
  const features = []; // loops, pads, gaps etc. for scoring + decoration
  let s = 0;

  const frame = () => { eul.set(pitch, yaw, roll, 'YXZ'); q.setFromEuler(eul); return q; };
  const push = (seg, flags = {}) => {
    const qq = frame().clone();
    samples.push({
      i: samples.length, s, p: pos.clone(), q: qq,
      T: new Vector3(0, 0, 1).applyQuaternion(qq),
      U: new Vector3(0, 1, 0).applyQuaternion(qq),
      X: new Vector3(1, 0, 0).applyQuaternion(qq), // left
      solid: true, gap: false, magnet: false, seg, ...flags,
    });
  };
  const step = (len = DS) => {
    frame(); fwd.set(0, 0, 1).applyQuaternion(q);
    pos.addScaledVector(fwd, len); s += len;
  };

  push(0, { start: true });
  def.segments.forEach((sg, si) => {
    const t = sg.t;
    if (t === 'straight') {
      const n = Math.round(sg.len / DS);
      for (let k = 0; k < n; k++) { step(); push(si); }
      if (sg.traffic || sg.kickers) features.push({ type: 'traffic', s0: s - sg.len, s1: s, count: sg.traffic || 0, kickers: sg.kickers || 0 });
    } else if (t === 'turn' || t === 'wall') {
      const n = Math.round(sg.len / DS), y0 = yaw, ang = sg.ang * D2R;
      const bank = (sg.bank ?? (t === 'wall' ? 78 : 0)) * D2R * -Math.sign(ang);
      for (let k = 1; k <= n; k++) {
        const u = k / n;
        yaw = y0 + ang * easeTurn(u);
        roll = bank * (t === 'wall' ? plateau(u, 0.22) : Math.sin(Math.PI * u));
        step(); push(si, { magnet: t === 'wall' && Math.abs(roll) > 0.35, wall: t === 'wall' });
      }
      roll = 0;
      if (t === 'wall') features.push({ type: 'wall', s0: s - sg.len, s1: s });
    } else if (t === 'hill' || t === 'bump') {
      const n = Math.round(sg.len / DS);
      for (let k = 1; k <= n; k++) {
        const u = (k - 0.5) / n;
        const slope = t === 'hill' ? sg.h * Math.PI / (2 * sg.len) * Math.sin(Math.PI * u)
                                   : sg.h * Math.PI / sg.len * Math.sin(2 * Math.PI * u);
        pitch = -Math.atan(slope);
        step(); push(si);
      }
      pitch = 0;
    } else if (t === 'loop') {
      const r = sg.r, len = 2 * Math.PI * r * 1.12, n = Math.round(len / DS);
      const X0 = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw);
      const shift = sg.shift ?? ROAD_W * 1.2;
      const s0 = s; let prevSh = 0;
      for (let k = 1; k <= n; k++) {
        const u = k / n;
        pitch = -2 * Math.PI * easeTurn(u);
        step(len / n);
        const sh = shift * (1 - Math.cos(Math.PI * u)) / 2; pos.addScaledVector(X0, sh - prevSh); prevSh = sh;
        push(si, { magnet: u > 0.08 && u < 0.92, loop: true });
      }
      pitch = 0;
      features.push({ type: 'loop', s0, s1: s, r, name: sg.name });
    } else if (t === 'cork') {
      const n = Math.round(sg.len / DS), dir = sg.dir ?? 1, s0 = s;
      for (let k = 1; k <= n; k++) {
        const u = (k - 0.5) / n;
        roll = dir * 2 * Math.PI * (sg.turns ?? 1) * smooth(Math.min(1, Math.max(0, (u - 0.1) / 0.8)));
        const slope = (sg.h ?? 10) * Math.PI / sg.len * Math.sin(2 * Math.PI * u);
        pitch = -Math.atan(slope);
        step(); push(si, { magnet: true, cork: true });
      }
      roll = 0; pitch = 0;
      features.push({ type: 'cork', s0, s1: s });
    } else if (t === 'ramp') {
      const n = Math.round(sg.len / DS), a = sg.ang * D2R;
      for (let k = 1; k <= n; k++) { pitch = -a * smooth(k / n); step(); push(si, { ramp: true }); }
    } else if (t === 'gap') {
      // Ballistic gap: samples follow the design trajectory (used by AI / map), no road.
      const v = sg.speed ?? 42;
      const a = -pitch, ca = Math.cos(a), ta = Math.tan(a), kk = gravity / (2 * v * v * ca * ca), drop = sg.drop ?? 3;
      sg.len = sg.len ?? (ta + Math.sqrt(ta * ta + 4 * kk * drop)) / (2 * kk);
      frame(); fwd.set(0, 0, 1).applyQuaternion(q);
      const vel = fwd.clone().multiplyScalar(v);
      const p0 = pos.clone(), s0 = s, dt = DS / v;
      let hd = 0; const hdir = new Vector3(fwd.x, 0, fwd.z).normalize();
      while (hd < sg.len) {
        vel.y -= gravity * dt; pos.addScaledVector(vel, dt); s += DS;
        hd = new Vector3(pos.x - p0.x, 0, pos.z - p0.z).length();
        pitch = -Math.atan2(vel.y, Math.hypot(vel.x, vel.z));
        push(si, { solid: false, gap: true, canyon: sg.canyon !== false, cliff: !!sg.cliff });
      }
      // landing zone: start at trajectory slope, ease back to flat
      const pl0 = Math.min(pitch, 30 * D2R), landLen = sg.land ?? 90, n = Math.round(landLen / DS), ls0 = s;
      for (let k = 1; k <= n; k++) { pitch = pl0 * (1 - smooth(Math.min(1, k / (n * 0.6)))); step(); push(si, { land: true }); }
      pitch = 0;
      const padS = ls0 + (sg.pad ?? 0.32) * landLen;
      features.push({ type: 'gap', s0, s1: ls0, len: sg.len, cliff: !!sg.cliff, padS, padR: sg.padR ?? 9, land0: ls0, land1: s, name: sg.name });
    } else if (t === 'ring') {
      features.push({ type: 'ring', s: s + (sg.at ?? 0) });
    }
  });
  // finish straight
  for (let k = 0; k < 60; k++) { step(); push(def.segments.length, { finishZone: true }); }
  // B31: flat run-off past the old track end so a finished car always has room to brake to a stop
  for (let k = 0; k < RUNOFF; k++) { step(); push(def.segments.length, { finishZone: true, runoff: true }); }

  // signed curvature toward the surface normal (for suspension load)
  for (let k = 0; k < samples.length; k++) {
    const a = samples[Math.max(0, k - 1)], b = samples[Math.min(samples.length - 1, k + 1)];
    const ds2 = b.s - a.s || 1;
    samples[k].k = samples[k].gap ? 0 : b.T.clone().sub(a.T).dot(samples[k].U) / ds2;
  }
  const roadEnd = s, length = s - RUNOFF; /* length keeps its old meaning (scoring, rocket); the road runs RUNOFF m further */
  const finishS = length - 40;
  // checkpoints every ~220 m on solid upright samples
  const checkpoints = [0];
  for (let k = 0; k < samples.length; k++) {
    const sm = samples[k];
    if (sm.s - checkpoints[checkpoints.length - 1] > (def.cpSpacing || 220) && sm.solid && !sm.magnet && !sm.ramp && !sm.land && sm.U.y > 0.97 && sm.s < finishS - 50) {
      // make sure a few samples ahead are also solid
      let ok = true; for (let j = 1; j < 25 && k + j < samples.length; j++) if (!samples[k + j].solid || samples[k + j].ramp) ok = false;
      if (ok) checkpoints.push(sm.s);
    }
  }
  const tr = { samples, length, roadEnd, finishS, checkpoints, features, def, gravity };
  tr.grid = buildGrid(samples);
  return tr;
}

function buildGrid(samples) {
  const cell = 24, map = new Map();
  for (const sm of samples) {
    const key = Math.floor(sm.p.x / cell) + ',' + Math.floor(sm.p.z / cell);
    let a = map.get(key); if (!a) map.set(key, a = []); a.push(sm.i);
  }
  return { cell, map };
}

export function sampleAt(tr, s) {
  const sm = tr.samples; const n = sm.length;
  // samples are ~1m apart but loop/gap steps vary; binary search on s
  let lo = 0, hi = n - 1;
  if (s <= 0) return sm[0]; if (s >= sm[hi].s) return sm[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sm[mid].s <= s) lo = mid; else hi = mid; }
  return sm[lo];
}

// Interpolated pose at distance s with lateral offset x (left +) and height h.
const _q = new Quaternion();
export function poseAt(tr, s, x = 0, h = 0, outP = new Vector3(), outQ = new Quaternion()) {
  const a = sampleAt(tr, s), b = tr.samples[Math.min(a.i + 1, tr.samples.length - 1)];
  const f = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 0;
  outP.lerpVectors(a.p, b.p, f);
  outQ.slerpQuaternions(a.q, b.q, f);
  const X = new Vector3(1, 0, 0).applyQuaternion(outQ), U = new Vector3(0, 1, 0).applyQuaternion(outQ);
  outP.addScaledVector(X, x).addScaledVector(U, h);
  return { p: outP, q: outQ, X, U, a };
}

// Find nearest sample to a world point, using a hint index for locality.
export function nearest(tr, p, hint = -1, window = 60) {
  const sm = tr.samples;
  let best = -1, bd = Infinity;
  if (hint >= 0) {
    const a = Math.max(0, hint - window), b = Math.min(sm.length - 1, hint + window);
    for (let i = a; i <= b; i++) { const d = sm[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = i; } }
    if (bd < 30 * 30) return { i: best, d2: bd };
  }
  const { cell, map } = tr.grid; const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
  for (let r = 1; r <= 4 && best < 0 || r <= 1; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const a = map.get((cx + dx) + ',' + (cz + dz)); if (!a) continue;
      for (const i of a) { const d = sm[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = i; } }
    }
    if (best >= 0) break;
  }
  if (best < 0) for (let i = 0; i < sm.length; i += 4) { const d = sm[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = i; } }
  return { i: best, d2: bd };
}

// Road surface + barrier geometry arrays (render + collider).
export function buildRoadArrays(tr) {
  const sm = tr.samples, hw = ROAD_W / 2;
  const top = { pos: [], uv: [], idx: [] };      // drivable surface
  const walls = { pos: [], nrm: [], idx: [] };   // barriers (both sides)
  const under = { pos: [], idx: [] };            // underside/skirt for looks
  const col = { pos: [], idx: [] };              // collider: top + walls
  const tmp = new Vector3();
  let prevSolid = false, base = 0, wbase = 0, ubase = 0, cbase = 0;
  for (let i = 0; i < sm.length; i++) {
    const a = sm[i];
    if (!a.solid) { prevSolid = false; continue; }
    const L = a.p.clone().addScaledVector(a.X, hw), R = a.p.clone().addScaledVector(a.X, -hw);
    const vi = top.pos.length / 3;
    top.pos.push(L.x, L.y, L.z, R.x, R.y, R.z);
    top.uv.push(0, a.s / ROAD_W, 1, a.s / ROAD_W);
    const wallH = a.ramp ? WALL_H * 0.6 : WALL_H;
    const Lt = L.clone().addScaledVector(a.U, wallH), Rt = R.clone().addScaledVector(a.U, wallH);
    const Lo = L.clone().addScaledVector(a.X, 0.35), Ro = R.clone().addScaledVector(a.X, -0.35);
    const Lot = Lo.clone().addScaledVector(a.U, wallH), Rot = Ro.clone().addScaledVector(a.U, wallH);
    const wi = walls.pos.length / 3;
    // per side: inner bottom, inner top, outer top, outer bottom
    walls.pos.push(L.x, L.y, L.z, Lt.x, Lt.y, Lt.z, Lot.x, Lot.y, Lot.z, Lo.x, Lo.y, Lo.z,
                   R.x, R.y, R.z, Rt.x, Rt.y, Rt.z, Rot.x, Rot.y, Rot.z, Ro.x, Ro.y, Ro.z);
    const ui = under.pos.length / 3;
    const D = a.U.clone().multiplyScalar(-0.9);
    const Lb = Lo.clone().add(D), Rb = Ro.clone().add(D);
    under.pos.push(Lo.x, Lo.y, Lo.z, Lb.x, Lb.y, Lb.z, Rb.x, Rb.y, Rb.z, Ro.x, Ro.y, Ro.z);
    const ci = col.pos.length / 3;
    col.pos.push(L.x, L.y, L.z, R.x, R.y, R.z, Lt.x, Lt.y, Lt.z, Rt.x, Rt.y, Rt.z);
    if (prevSolid) {
      const p = vi - 2;
      top.idx.push(p, p + 1, vi, p + 1, vi + 1, vi);
      const w = wi - 8;
      for (let side = 0; side < 2; side++) {
        const o = side * 4;
        for (let f = 0; f < 3; f++) {
          const a0 = w + o + f, a1 = w + o + f + 1, b0 = wi + o + f, b1 = wi + o + f + 1;
          if (side === 0) walls.idx.push(a0, b0, a1, a1, b0, b1); else walls.idx.push(a0, a1, b0, a1, b1, b0);
        }
      }
      const u = ui - 4;
      under.idx.push(u, u + 1, ui, u + 1, ui + 1, ui, u + 1, u + 2, ui + 1, u + 2, ui + 2, ui + 1, u + 2, u + 3, ui + 2, u + 3, ui + 3, ui + 2);
      const c = ci - 4;
      col.idx.push(c, c + 1, ci, c + 1, ci + 1, ci);          // road
      col.idx.push(c, ci, c + 2, c + 2, ci, ci + 2);          // left wall
      col.idx.push(c + 1, c + 3, ci + 1, c + 3, ci + 3, ci + 1); // right wall
    }
    prevSolid = true;
  }
  return { top, walls, under, col };
}
