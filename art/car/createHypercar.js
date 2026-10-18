// Volt Roadster - original procedural Roadster-style electric hypercar.
// Drop-in Three.js module (three r186). No textures, no logos, no trademarks.
//
//   import { createHypercar, syncHypercarWheels } from './art/car/createHypercar.js';
//   const car = createHypercar({ quality: 'ultra', paint: 0xc8102e });
//   scene.add(car);                                   // car origin == Rapier chassis body origin
//   syncHypercarWheels(car, sim.vc, sim.wheelPos);    // each frame after the physics step
//   car.userData.setLights({ brake: input.brake > 0 });
//   car.userData.dispose();                           // free GPU resources
//
// Frame: +Z forward, +Y up, +X = vehicle LEFT (matches src/sim.js wheel layout).
// Wheel pivots: car.userData.wheels[i] = { name, pivot, spin } with i = 0 FL, 1 FR, 2 RL, 3 RR
//   pivot -> steering (rotation.y) + suspension travel (position.y)
//   spin  -> wheel roll (rotation.x). Calipers ride on the pivot so they do not spin.
import {
  Group, Object3D, Mesh, BufferGeometry, BufferAttribute, Float32BufferAttribute,
  MeshPhysicalMaterial, MeshStandardMaterial, Color, Vector3, CatmullRomCurve3,
  TubeGeometry, TorusGeometry, CylinderGeometry, LatheGeometry, BoxGeometry,
  SphereGeometry, CapsuleGeometry, ExtrudeGeometry, Shape, Vector2, DataTexture,
  RepeatWrapping, RGBAFormat, LinearFilter, LinearMipmapLinearFilter, DoubleSide,
} from 'three';
import { createWheel, createWheelMaterials, createCaliper } from '../custom/wheels.js';

export const HYPERCAR_DEFAULTS = {
  quality: 'ultra',            // 'ultra' | 'high' | 'medium' | 'low'
  paint: 0xb3121f,             // body colour (deep candy red)
  accent: 0x2ee6ff,            // LED / caliper accent
  caliper: 0xff5a1f,
  rim: 0x22252b,
  length: 4.3,                 // matches chassis collider (2 x 2.15)
  halfWidth: 0.95,
  groundY: -0.72,              // ground height in body frame at rest (wheelPos.y - restLength - radius)
  wheelRadius: 0.36,
  wheelPos: [[0.86, -0.02, 1.38], [-0.86, -0.02, 1.38], [0.88, -0.02, -1.36], [-0.88, -0.02, -1.36]],
  restLength: 0.34,
  castShadow: true,
  envMapIntensity: 1.0,
  wheelDesign: 'turbine',
};

const QUALITY = {
  ultra:  { st: 220, ring: 96, wheelSeg: 64, spokes: 10, tread: true,  details: true,  physical: true },
  high:   { st: 160, ring: 72, wheelSeg: 48, spokes: 10, tread: true,  details: true,  physical: true },
  medium: { st: 110, ring: 48, wheelSeg: 32, spokes: 5,  tread: false, details: true,  physical: true },
  low:    { st: 64,  ring: 28, wheelSeg: 20, spokes: 5,  tread: false, details: false, physical: false },
};

// ---------- small math helpers ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x) => Math.exp(-x * x);
// monotone cubic-ish keyframe interpolation (Catmull-Rom on [s,v] pairs)
function keys(pairs) {
  return (s) => {
    if (s <= pairs[0][0]) return pairs[0][1];
    const n = pairs.length;
    if (s >= pairs[n - 1][0]) return pairs[n - 1][1];
    let i = 0; while (s > pairs[i + 1][0]) i++;
    const p0 = pairs[Math.max(0, i - 1)][1], p1 = pairs[i][1], p2 = pairs[i + 1][1], p3 = pairs[Math.min(n - 1, i + 2)][1];
    const t = (s - pairs[i][0]) / (pairs[i + 1][0] - pairs[i][0]);
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// ---------- body design language ----------
// s = 0 at the tail, 1 at the nose. All heights in metres above ground.
const HW = keys([[0, 0.84], [0.05, 0.91], [0.2, 0.965], [0.33, 0.955], [0.52, 0.9], [0.72, 0.935], [0.86, 0.915], [0.95, 0.82], [0.99, 0.6], [1, 0.46]]);
const YB = keys([[0, 0.36], [0.05, 0.22], [0.12, 0.19], [0.88, 0.17], [0.96, 0.19], [1, 0.24]]);
const YT = keys([[0, 0.69], [0.035, 0.80], [0.07, 0.835], [0.2, 0.83], [0.34, 0.815], [0.5, 0.79], [0.66, 0.72], [0.78, 0.61], [0.88, 0.53], [0.95, 0.45], [1, 0.36]]);
const SH = keys([[0, 0.5], [0.3, 0.46], [0.6, 0.44], [0.9, 0.5], [1, 0.55]]);      // shoulder height fraction
const NT = keys([[0, 3.2], [0.3, 2.8], [0.6, 2.6], [0.9, 2.4], [1, 2.2]]);          // top superellipse exponent

function makeBodySampler(o) {
  const L = o.length, z0 = -L / 2;
  const wz = o.wheelPos.map(p => p[2]);
  const fz = (wz[0] + wz[1]) / 2, rz = (wz[2] + wz[3]) / 2;
  const sx = o.halfWidth / 0.95;
  // returns raw (pre-carve) surface point
  return function surf(s, th) {
    const z = z0 + s * L;
    const hw = HW(s) * sx, yb = YB(s), yt0 = YT(s);
    const c = Math.cos(th), sn = Math.sin(th);
    const top = sn >= 0;
    const ax = Math.abs(c);
    // fender bulges: raise the shoulders over the wheels (low hood, muscular fenders)
    const side = sstep(0.25, 0.95, ax);
    const bump = side * (0.2 * gauss((z - fz) / 0.62) + 0.05 * gauss((z - rz) / 0.75));
    const yt = yt0 + (top ? bump : 0);
    const ym = yb + (yt0 - yb) * SH(s);
    const nT = NT(s), nB = 5.5;
    const n = top ? nT : nB;
    let x = hw * spow(c, 2 / n);
    let y = top ? ym + (yt - ym) * Math.pow(Math.abs(sn), 2 / nT) : ym - (ym - yb) * Math.pow(Math.abs(sn), 2 / nB);
    // door scallop: subtle concave sculpt between the axles, lower half of the side
    const band = gauss((y - (yb + 0.12)) / 0.12) * gauss((z - (fz + rz) / 2 + 0.15) / 0.75);
    x *= 1 - 0.045 * band * ax;
    // tumblehome at the shoulders
    if (top) x *= 1 - 0.04 * Math.pow(Math.abs(sn), 3);
    return [x, y, z];
  };
}

function buildBodyGeometry(o, Q, surf) {
  const S = Q.st, N = Q.ring;
  const pos = new Float32Array((S + 1) * N * 3);
  const col = new Float32Array((S + 1) * N * 3);
  const archR = 0.415, archIn = 0.655 * (o.halfWidth / 0.95);
  const wheels = o.wheelPos.map(p => ({ z: p[2], y: o.wheelRadius }));
  let k = 0;
  for (let i = 0; i <= S; i++) {
    // denser stations near the ends for crisp nose / tail
    const u = i / S; const s = u - Math.sin(u * Math.PI * 2) * 0.03;
    for (let j = 0; j < N; j++) {
      const th = (j / N) * Math.PI * 2;
      let [x, y, z] = surf(s, th);
      let dark = 0;
      for (const w of wheels) {
        const d = Math.hypot(z - w.z, y - w.y);
        if (d < archR && Math.abs(x) > archIn) {
          // wheel well: push the skin in to form the arch liner
          const e = sstep(archR, archR - 0.012, d);
          x = Math.sign(x) * (archIn + (Math.abs(x) - archIn) * (1 - e));
          dark = Math.max(dark, e);
        }
      }
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      const v = 1 - dark * 0.96; col[k] = v; col[k + 1] = v; col[k + 2] = v;
      k += 3;
    }
  }
  const idx = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < N; j++) {
    const a = i * N + j, b = i * N + (j + 1) % N, c = (i + 1) * N + j, d = (i + 1) * N + (j + 1) % N;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function capGeometry(surf, s, N, flip, inset = 1, dz = 0) {
  const pts = [];
  let cx = 0, cy = 0;
  for (let j = 0; j < N; j++) { const p = surf(s, (j / N) * Math.PI * 2); pts.push(p); cx += p[0]; cy += p[1]; }
  cx /= N; cy /= N;
  const z = pts[0][2] + dz;
  const pos = [cx, cy, z];
  for (const p of pts) pos.push(cx + (p[0] - cx) * inset, cy + (p[1] - cy) * inset, z);
  const idx = [];
  for (let j = 0; j < N; j++) { const a = 1 + j, b = 1 + (j + 1) % N; if (flip) idx.push(0, b, a); else idx.push(0, a, b); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Glass canopy: an open upper-half loft that sits on the body shoulders.
function buildCanopyGeometry(o, Q, surf) {
  const S = Math.round(Q.st * 0.6), N = Math.round(Q.ring / 2);
  const zf = 0.98, zr = -1.62, L = o.length, z0 = -L / 2;
  const roof = keys([[0, 0.0], [0.1, 0.12], [0.3, 0.33], [0.42, 0.37], [0.6, 0.33], [0.8, 0.2], [0.93, 0.07], [1, 0.0]]);
  const half = keys([[0, 0.6], [0.25, 0.68], [0.5, 0.69], [0.75, 0.6], [0.92, 0.47], [1, 0.4]]);
  const sx = o.halfWidth / 0.95;
  const pos = [];
  for (let i = 0; i <= S; i++) {
    const u = i / S;
    const z = zf + (zr - zf) * u;
    const s = (z - z0) / L;
    const base = YT(s) - 0.035;
    const h = roof(u) * 1.0 + 0.004, hw = half(u) * sx;
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * Math.PI;
      const c = Math.cos(th), sn = Math.sin(th);
      pos.push(hw * spow(c, 2 / 2.3), base + h * Math.pow(sn, 2 / 2.6) + (1 - sn) * -0.02, z);
    }
  }
  const idx = [];
  const R = N + 1;
  for (let i = 0; i < S; i++) for (let j = 0; j < N; j++) {
    const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
    // stations run front->back here, so winding is reversed vs. the body
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// tube following points on (just above) the body skin
function stripOnBody(surf, list, radius, lift, seg) {
  const pts = list.map(([s, th, sideSign = 1]) => {
    const p = surf(s, th);
    // outward normal approx by finite difference around the ring
    const p1 = surf(s, th + 0.01), p2 = surf(Math.min(1, s + 0.002), th);
    const a = new Vector3(p1[0] - p[0], p1[1] - p[1], p1[2] - p[2]);
    const b = new Vector3(p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]);
    const n = new Vector3().crossVectors(a, b).normalize(); // outward
    return new Vector3(p[0] * sideSign, p[1], p[2]).addScaledVector(n.set(n.x * sideSign, n.y, n.z), lift);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), seg, radius, 8, false);
}

export function createHypercar(options = {}) {
  const o = { ...HYPERCAR_DEFAULTS, ...options };
  const Q = QUALITY[o.quality] || QUALITY.high;
  const disposables = new Set();
  const track = (x) => { disposables.add(x); return x; };

  const Phys = Q.physical ? MeshPhysicalMaterial : MeshStandardMaterial;
  const paint = track(new Phys({
    color: new Color(o.paint), metalness: 0.45, roughness: 0.3, vertexColors: true, envMapIntensity: o.envMapIntensity,
    ...(Q.physical ? { clearcoat: 1, clearcoatRoughness: 0.035, sheen: o.quality === 'ultra' ? 0.25 : 0, sheenColor: new Color(o.paint).offsetHSL(0, 0, 0.2), sheenRoughness: 0.4 } : {}),
  }));
  const paintFlat = track(paint.clone()); paintFlat.vertexColors = false;
  const glass = track(new Phys({
    // roughness/clearcoatRoughness > 0 spread the sun/softbox highlight so it no longer spikes into bloom
    color: 0x05070a, metalness: 0.0, roughness: 0.09, envMapIntensity: 1.1 * o.envMapIntensity,
    ...(Q.physical ? { clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 0.6, ior: 1.5 } : {}),
  }));
  const carbon = track(new Phys({ color: 0x0d0e10, metalness: 0.2, roughness: 0.42, ...(Q.physical ? { clearcoat: 0.7, clearcoatRoughness: 0.15 } : {}) }));
  const trim = track(new MeshStandardMaterial({ color: 0x07080a, metalness: 0.6, roughness: 0.3 }));
  const head = track(new MeshStandardMaterial({ color: 0xffffff, emissive: new Color(0xdff6ff), emissiveIntensity: 6, roughness: 0.2 }));
  const tail = track(new MeshStandardMaterial({ color: 0x330000, emissive: new Color(0xff1a2a), emissiveIntensity: 3, roughness: 0.3 }));
  const accentGlow = track(new MeshStandardMaterial({ color: 0x111111, emissive: new Color(o.accent), emissiveIntensity: 6 }));
  const wheelMats = track(createWheelMaterials({ quality: o.quality, rim: o.rim, accent: o.accent, caliper: o.caliper }));
  const mats = { paint, paintFlat, glass, carbon, trim, head, tail, accentGlow, tyre: wheelMats.tyre, rim: wheelMats.rim, rimInner: wheelMats.rimInner, disc: wheelMats.disc, caliper: wheelMats.caliper, wheel: wheelMats };

  const root = new Group(); root.name = 'VoltHypercar';
  const body = new Group(); body.name = 'body'; body.position.y = o.groundY; root.add(body);
  const surf = makeBodySampler(o);

  const add = (geo, mat, name, parent = body) => { track(geo); const m = new Mesh(geo, mat); m.name = name; m.castShadow = o.castShadow; m.receiveShadow = true; parent.add(m); return m; };

  // sculpted shell + Kamm tail + nose caps
  add(buildBodyGeometry(o, Q, surf), paint, 'shell');
  add(capGeometry(surf, 0, Q.ring, true), paintFlat, 'tailCap');
  add(capGeometry(surf, 1, Q.ring, false), carbon, 'noseCap');
  add(buildCanopyGeometry(o, Q, surf), glass, 'canopy');

  // wheel-arch lips: a tube that follows the carve edge ON the skin (gloss black)
  const sideXAt = (sv, y) => { // outer skin x on the right side at height y (numeric search)
    let best = 0, bd = 1e9;
    let top = -1e9;
    for (let k = 0; k <= 64; k++) { const th = -Math.PI / 2 + Math.PI * k / 64; const p = surf(sv, th); top = Math.max(top, p[1]); const d = Math.abs(p[1] - y); if (d < bd) { bd = d; best = p[0]; } }
    return [best, top];
  };
  for (const p of o.wheelPos) {
    const pts = [];
    const ra = 0.415, N = 40;
    for (let k = 0; k <= N; k++) {
      const phi = -0.12 + (Math.PI + 0.24) * k / N;          // from rear-low over the top to front-low
      const z = p[2] - Math.cos(phi) * ra, y = o.wheelRadius + Math.sin(phi) * ra;
      const sv = (z + o.length / 2) / o.length;
      const [sx, top] = sideXAt(sv, y);
      const x = Math.max(sx, 0.66) - 0.012;
      pts.push(new Vector3(Math.sign(p[0]) * x, Math.min(y, top - 0.012), z));
    }
    add(new TubeGeometry(new CatmullRomCurve3(pts), 48, 0.024, 6, false), trim, 'archLip');
  }

  // LED signature: slim upper-corner headlight blades + full-width front light bar + tail light blade
  const lseg = Math.max(24, Math.round(Q.st / 3));
  for (const sg of [1, -1]) {
    add(stripOnBody(surf, [[0.875, 0.34, sg], [0.91, 0.30, sg], [0.945, 0.27, sg], [0.975, 0.25, sg]], 0.022, 0.004, lseg), trim, 'headHousing');
    add(stripOnBody(surf, [[0.88, 0.34, sg], [0.91, 0.30, sg], [0.945, 0.27, sg], [0.972, 0.25, sg]], 0.011, 0.016, lseg), head, 'headlight');
  }
  const bar = []; for (let t = 0; t <= 12; t++) bar.push([0.968, 0.42 + (Math.PI - 0.84) * t / 12]);
  add(stripOnBody(surf, bar, 0.0055, 0.008, lseg), head, 'frontBar');
  {
    const pts = []; const N = 28;
    const c = surf(0, Math.PI / 2), cb = surf(0, -Math.PI / 2); const cy = (c[1] + cb[1]) / 2;
    for (let t = 0; t <= N; t++) { const th = 0.12 + (Math.PI - 0.24) * t / N; const p = surf(0, th); pts.push(new Vector3(p[0] * 0.93, cy + (p[1] - cy) * 0.86, p[2] - 0.006)); }
    const g = new TubeGeometry(new CatmullRomCurve3(pts), lseg, 0.016, 8, false);
    add(g, tail, 'taillight');
  }

  // aero + details
  if (Q.details) {
    const zf = o.length / 2, zr = -o.length / 2;
    const splitter = add(new BoxGeometry(1.15, 0.022, 0.3), carbon, 'splitter'); splitter.position.set(0, 0.165, zf - 0.33);
    const diff = add(new BoxGeometry(1.3, 0.025, 0.5), carbon, 'diffuser'); diff.position.set(0, 0.235, zr + 0.36); diff.rotation.x = -0.22;
    const finGeo = track(new BoxGeometry(0.012, 0.075, 0.4));
    for (let i = -3; i <= 3; i++) { const f = new Mesh(finGeo, carbon); f.position.set(i * 0.19, 0.25, zr + 0.38); f.rotation.x = -0.22; body.add(f); }
    for (const sg of [1, -1]) {
      const skirtLen = Math.abs(o.wheelPos[0][2] - o.wheelPos[2][2]) - 0.9;
      const sk = add(new BoxGeometry(0.06, 0.06, skirtLen), carbon, 'skirt');
      sk.position.set(sg * (o.halfWidth * 0.9), 0.2, (o.wheelPos[0][2] + o.wheelPos[2][2]) / 2);
      // camera-style mirror pods
      const stalk = add(new BoxGeometry(0.12, 0.02, 0.05), carbon, 'mirrorStalk'); stalk.position.set(sg * 0.72, 0.84, 0.62);
      const pod = add(new CapsuleGeometry(0.03, 0.09, 4, 12).rotateX(Math.PI / 2), paintFlat, 'mirrorPod'); pod.position.set(sg * 0.8, 0.85, 0.6);
      // side intake blade behind the doors
      const blade = add(new BoxGeometry(0.02, 0.09, 0.42), trim, 'sideIntake');
      const s = (o.wheelPos[2][2] + 0.62 + o.length / 2) / o.length; const p = surf(s, 0.12);
      blade.position.set(sg * (p[0] - 0.006), 0.5, p[2]); blade.rotation.y = sg * -0.12;
    }
    // lower front intake (gloss black inset)
    const intake = add(new CapsuleGeometry(0.06, 1.0, 4, 16).rotateZ(Math.PI / 2), trim, 'intake');
    const ip = surf(0.985, -Math.PI / 2 + 0.6); intake.position.set(0, ip[1] + 0.02, ip[2] - 0.01); intake.scale.set(1, 0.7, 0.5);
  }

  // wheels with named pivots in the BODY frame (same frame as Rapier wheel chassis connection points)
  const names = ['FL', 'FR', 'RL', 'RR'];
  const wheels = [];
  o.wheelPos.forEach((p, i) => {
    const side = Math.sign(p[0]) || 1, front = i < 2;
    const pivot = new Object3D(); pivot.name = 'wheel_' + names[i];
    pivot.position.set(p[0], p[1] - o.restLength, p[2]);
    const spin = new Object3D(); spin.name = 'wheel_' + names[i] + '_spin';
    const width = front ? 0.28 : 0.31;
    const vis = createWheel({ design: o.wheelDesign, radius: o.wheelRadius, width, side, quality: o.quality, mats: wheelMats });
    spin.add(vis.object); pivot.add(spin);
    const cal = createCaliper({ discX: vis.discX, discR: vis.discR, side, front, quality: o.quality, material: wheelMats.caliper });
    track(cal.geometry); cal.name = 'caliper_' + names[i];
    pivot.add(cal);
    root.add(pivot);
    wheels.push({ name: names[i], pivot, spin, caliper: cal, visual: vis, side, front, width, radius: o.wheelRadius, restY: pivot.position.y });
  });

  // public API
  const state = { brake: false, head: true, heat: 0 };
  root.userData.wheels = wheels;
  root.userData.materials = mats;
  root.userData.setPaint = (hex) => { paint.color.set(hex); paintFlat.color.set(hex); if (paint.sheenColor) paint.sheenColor.set(hex).offsetHSL(0, 0, 0.2); };
  root.userData.setLights = ({ head: h = state.head, brake = state.brake } = {}) => {
    state.head = h; state.brake = brake;
    mats.head.emissiveIntensity = h ? 6 : 0.3;
    mats.tail.emissiveIntensity = brake ? 12 : 3;
  };
  root.userData.setBrakeHeat = (t) => { state.heat = clamp(t, 0, 1); mats.disc.emissiveIntensity = state.heat * state.heat * 4; };
  root.userData.setSteer = (a) => { wheels[0].pivot.rotation.y = a; wheels[1].pivot.rotation.y = a; };
  root.userData.spinWheels = (dAngle) => { for (const w of wheels) w.spin.rotation.x += dAngle; };
  // attachment points (body frame) used by art/custom + art/fx modules
  const gy = o.groundY, zr = -o.length / 2, zf = o.length / 2;
  root.userData.kind = 'hypercar'; root.userData.quality = o.quality;
  root.userData.paintMaterials = [paint, paintFlat];
  root.userData.wheelMaterials = wheelMats;
  root.userData.mounts = {
    spoiler: { position: new Vector3(0, gy + 0.84, zr + 0.32), width: 1.55, deckY: gy + 0.83 },
    boost: [new Vector3(0.38, gy + 0.36, zr - 0.02), new Vector3(-0.38, gy + 0.36, zr - 0.02)],
    underglow: { y: gy + 0.03, width: 1.9, length: 4.0 },
    thrusters: [
      new Vector3(0.9, gy + 0.55, zf - 0.45), new Vector3(-0.9, gy + 0.55, zf - 0.45),
      new Vector3(0.9, gy + 0.6, zr + 0.4), new Vector3(-0.9, gy + 0.6, zr + 0.4),
      new Vector3(0, gy + 1.12, -0.3), new Vector3(0, gy + 0.18, 0),
    ],
  };
  root.userData.dispose = () => {
    root.userData.custom?.dispose?.();
    for (const w of wheels) w.visual.dispose();
    root.removeFromParent();
    for (const d of disposables) d.dispose?.();
    disposables.clear();
  };
  return root;
}

// Copy Rapier DynamicRayCastVehicleController wheel state onto the visual pivots.
// spinSign: flip to -1 if the wheels appear to roll backwards in your setup.
export function syncHypercarWheels(car, vc, wheelPos = HYPERCAR_DEFAULTS.wheelPos, spinSign = 1) {
  const wheels = car.userData.wheels;
  for (let i = 0; i < wheels.length; i++) {
    const w = wheels[i], p = wheelPos[i];
    const len = vc.wheelSuspensionLength(i);
    w.pivot.position.set(p[0], p[1] - (len ?? HYPERCAR_DEFAULTS.restLength), p[2]);
    w.pivot.rotation.y = vc.wheelSteering(i) ?? 0;
    w.spin.rotation.x = spinSign * (vc.wheelRotation(i) ?? 0);
  }
}
