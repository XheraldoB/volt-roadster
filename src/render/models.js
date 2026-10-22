// Procedural low-poly-but-pretty models: the Volt Roadster, traffic, robots, props.
import * as THREE from 'three';
import { createHelperRobot, createRobotIdle } from '../../art/robot/createHelperRobot.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wrapTexture, textTexture, windowsTexture } from './textures.js';
import { PAINT_LIST, FINISH_LIST, WRAP_LIST, RIM_LIST } from '../shop.js';
import { createPickup } from '../../art/truck/createPickup.js';

const M = (o) => new THREE.MeshStandardMaterial(o);
const smooth = t => t * t * (3 - 2 * t);
const interp = (pts, z) => { // piecewise-smooth interpolation over [z, value] pairs sorted by z ascending
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * smooth((z - a[0]) / (b[0] - a[0])); }
  return pts[pts.length - 1][1];
};

// Superellipse-ring loft: stations along z, each ring with half width, bottom, top, exponent.
function loft(stations, ringN = 28, upperOnly = false) {
  const pos = [], uv = [], idx = [];
  const zs = stations.map(s => s.z); const zmin = Math.min(...zs), zmax = Math.max(...zs);
  stations.forEach((st, si) => {
    for (let k = 0; k <= ringN; k++) {
      const t = upperOnly ? Math.PI * k / ringN : 2 * Math.PI * k / ringN - Math.PI / 2;
      const c = Math.cos(t), s = Math.sin(t), n = st.n || 3;
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      const cy = (st.top + st.bot) / 2, hh = (st.top - st.bot) / 2;
      const wTop = st.wt ?? st.w; const w = ey > 0 ? st.w + (wTop - st.w) * ey : st.w;
      pos.push(ex * w, upperOnly ? st.bot + Math.max(0, ey) * (st.top - st.bot) : cy + ey * hh, st.z);
      uv.push((st.z - zmin) / (zmax - zmin), k / ringN);
    }
  });
  const R = ringN + 1;
  for (let i = 0; i < stations.length - 1; i++) for (let k = 0; k < ringN; k++) {
    const a = i * R + k, b = a + 1, c = a + R, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export const PAINTS = PAINT_LIST, FINISHES = FINISH_LIST, WRAPS = WRAP_LIST, RIMS = RIM_LIST;

// --- Volt-Bot helper (art pack VOLT-B model with our animate(t, mode) API) ---
export function buildRobot(accent = 0x00e5ff, quality = 'medium') {
  let bot, idle;
  try { bot = createHelperRobot({ quality, accent }); idle = createRobotIdle(bot, { seed: Math.floor(Math.random() * 9) + 1 }); } catch (e) { return buildRobotLegacy(accent); }
  let last = null;
  bot.userData.animate = (t, mode) => {
    const dt = last == null ? 0.016 : Math.min(0.1, Math.max(0, t - last)); last = t;
    idle.setWave(mode === 'wave'); idle.update(dt);
    const j = bot.userData.joints;
    if (mode === 'walk' && j) { const a = Math.sin(t * 7) * 0.55; j.hipL.rotation.x = a; j.hipR.rotation.x = -a; j.kneeL.rotation.x = Math.max(0, -a) * 0.9; j.kneeR.rotation.x = Math.max(0, a) * 0.9; j.shoulderL.rotation.x = -a * 0.6; j.shoulderR.rotation.x = a * 0.6; }
    else if (mode === 'work' && j) { const a = Math.sin(t * 5); j.shoulderR.rotation.x = -1.1 + a * 0.35; j.elbowR.rotation.x = -0.6 + a * 0.3; j.spine.rotation.x = 0.25; }
  };
  return bot;
}

// --- the car ---
export function buildCar(custom = {}, opts = {}) {
  const paint = PAINTS.find(p => p.id === custom.paint) || PAINTS[0];
  const fin = FINISHES.find(f => f.id === custom.finish) || FINISHES[1];
  const group = new THREE.Group(); group.name = 'car';
  const GY = -0.72; // ground level in chassis space
  const paintMat = new THREE.MeshPhysicalMaterial({ color: paint.color, metalness: fin.metalness, roughness: fin.roughness, clearcoat: fin.clearcoat, clearcoatRoughness: 0.04, envMapIntensity: 1.25, iridescence: paint.shift ? 1 : (fin.iridescence || 0), iridescenceIOR: fin.iridescenceIOR || (paint.shift ? 2.0 : 1.5), sheen: fin.sheen || 0, sheenColor: new THREE.Color(paint.color) });
  if (custom.wrap && custom.wrap !== 'none') paintMat.map = wrapTexture(custom.wrap, custom.wrapColor || '#111111', '#ffffff');
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0f14, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.86, clearcoat: 1, envMapIntensity: 1.6 });
  const black = M({ color: 0x0b0b0d, roughness: 0.55, metalness: 0.3 });
  const carbon = M({ color: 0x141418, roughness: 0.35, metalness: 0.5 });
  // lower body
  const st = [];
  for (let i = 0; i <= 26; i++) {
    const z = -2.2 + 4.42 * i / 26;
    const wheel = Math.max(Math.exp(-(((z - 1.38) / 0.42) ** 2)), Math.exp(-(((z + 1.36) / 0.45) ** 2)));
    const w = interp([[-2.2, 0.8], [-2.0, 0.93], [-1.4, 0.97], [0, 0.9], [1.4, 0.95], [1.95, 0.86], [2.22, 0.55]], z) + 0.06 * wheel;
    const top = interp([[-2.2, -0.02], [-2.05, 0.1], [-1.6, 0.08], [-1.0, 0.07], [0.6, 0.05], [1.3, -0.04], [1.9, -0.14], [2.22, -0.3]], z) + 0.05 * wheel;
    const bot = interp([[-2.2, -0.28], [-1.9, -0.45], [1.8, -0.47], [2.22, -0.4]], z);
    st.push({ z, w, wt: w * 0.86, top, bot, n: 3.4 });
  }
  const body = new THREE.Mesh(loft(st, 36), paintMat); body.castShadow = true; body.receiveShadow = true; group.add(body);
  // caps
  const capF = new THREE.Mesh(new THREE.CircleGeometry(1, 24), paintMat); capF.scale.set(0.55, 0.06, 1); capF.position.set(0, -0.35, 2.22); group.add(capF);
  // cabin (glass canopy, roadster targa)
  const cs = [];
  for (let i = 0; i <= 18; i++) {
    const z = -1.5 + 2.5 * i / 18;
    const top = interp([[-1.5, 0.08], [-1.15, 0.24], [-0.55, 0.42], [0.05, 0.43], [0.55, 0.26], [1.0, 0.06]], z);
    const w = interp([[-1.5, 0.6], [-0.4, 0.72], [0.4, 0.72], [1.0, 0.66]], z);
    cs.push({ z, w, wt: w * 0.66, top, bot: 0.04, n: 2.6 });
  }
  const cabin = new THREE.Mesh(loft(cs, 20, true), glass); cabin.castShadow = true; group.add(cabin);
  // (roof plate removed: the canopy silhouette carries the roof)
  const bodyTop = z => interp([[-2.2, -0.02], [-2.05, 0.1], [-1.6, 0.08], [-1.0, 0.07], [0.6, 0.05], [1.3, -0.04], [1.9, -0.14], [2.22, -0.3]], z);
  // headlights (slim emissive slits)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 3.2 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.1), headMat); hl.position.set(sx * 0.6, bodyTop(2.0) - 0.035, 2.0); hl.rotation.set(0.5, sx * 0.42, sx * -0.12); // follows the nose slope (B9) group.add(hl);
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.06), headMat); drl.position.set(sx * 0.66, bodyTop(1.95) - 0.07, 1.95); drl.rotation.set(0.5, sx * 0.5, 0); group.add(drl);
    // side intake + mirror
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.6), black); intake.position.set(sx * 0.925, -0.15, -0.7); group.add(intake);
    // B9: slim black camera-mirror pods flush on the canopy base (the old body-colour cubes read as floating blocks)
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), black); mir.position.set(sx * 0.7, 0.08, 0.6); mir.rotation.y = sx * 0.12; group.add(mir);
  }
  // full-width tail light bar
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1020, emissiveIntensity: 2.2 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.05), tailMat); tail.position.set(0, 0.04, -2.19); group.add(tail);
  const brakeLight = tail; group.userData.tailMat = tailMat;
  // front intake + diffuser
  const fi = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), black); fi.position.set(0, -0.36, 2.14); group.add(fi);
  const dif = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.3), carbon); dif.position.set(0, -0.4, -2.05); dif.rotation.x = -0.35; group.add(dif);
  for (let k = -2; k <= 2; k++) { const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.34), carbon); fin2.position.set(k * 0.3, -0.42, -2.02); group.add(fin2); }
  // thruster nozzles (hidden behind rear plate)
  const nozMat = M({ color: 0x333338, metalness: 0.9, roughness: 0.3 });
  for (const sx of [-0.45, 0.45]) { const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 14, 1, true), nozMat); nz.rotation.x = Math.PI / 2; nz.position.set(sx, -0.2, -2.2); group.add(nz); }
  group.userData.nozzles = [new THREE.Vector3(-0.45, -0.2, -2.3), new THREE.Vector3(0.45, -0.2, -2.3)];
  addUnderglow(group, custom, -0.62, 2.0, 4.2);
  addSpoiler(group, custom.spoiler, paintMat, carbon, 0.14, -1.92, 1.6);
  // wheels
  group.userData.wheels = [];
  const wp = opts.wheelPos || [[0.86, -0.02, 1.38], [-0.86, -0.02, 1.38], [0.88, -0.02, -1.36], [-0.88, -0.02, -1.36]];
  wp.forEach((p, i) => { const w = buildWheel(custom, i % 2 === 0 ? 1 : -1); w.position.set(p[0], -0.36, p[2]); group.add(w); group.userData.wheels.push(w); });
  group.userData.paintMat = paintMat; group.userData.headMat = headMat;
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return group;
}

function buildWheel(custom, side) {
  const g = new THREE.Group(); const spin = new THREE.Group(); g.add(spin); g.userData.spin = spin;
  const rimColor = custom.rimColor || '#c8ccd2';
  const tireMat = M({ color: 0x111113, roughness: 0.92 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: rimColor, metalness: 0.9, roughness: 0.22, clearcoat: 0.6 });
  // tire via lathe
  const prof = []; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; prof.push(new THREE.Vector2(0.26 + 0.1 * Math.cos(a), 0.15 * Math.sin(a))); }
  const tire = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), tireMat); tire.rotation.z = Math.PI / 2; spin.add(tire);
  const face = side * 0.1;
  const rimType = custom.rims || 'aero';
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.22, 28, 1, true), M({ color: 0x2a2a2e, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide })); barrel.rotation.z = Math.PI / 2; spin.add(barrel);
  const rimType2 = rimType;
  if (rimType === 'blade' || rimType === 'forged' || rimType === 'hologram') {
    const n = rimType === 'blade' ? 18 : rimType === 'forged' ? 20 : 8;
    const hm = rimType === 'hologram' ? new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: custom.rimColor || 0x00e5ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.55, toneMapped: false }) : rimMat;
    if (rimType === 'blade') { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.02, 32), M({ color: 0x15151a, metalness: 0.7, roughness: 0.3 })); disc.rotation.z = Math.PI / 2; disc.position.x = face; spin.add(disc); }
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, rimType === 'blade' ? 0.2 : 0.22, rimType === 'forged' ? 0.022 : 0.05), hm); b.position.set(face + side * 0.012, Math.cos(a) * 0.12, Math.sin(a) * 0.12); b.rotation.x = -a + (rimType === 'blade' ? 0.9 : 0); spin.add(b); }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.016, 8, 32), hm); lip.rotation.y = Math.PI / 2; lip.position.x = face; spin.add(lip);
  } else   if (rimType === 'aero' || rimType === 'turbine') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.02, 32), rimMat); disc.rotation.z = Math.PI / 2; disc.position.x = face; spin.add(disc);
    const n = rimType === 'turbine' ? 12 : 5;
    for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, rimType === 'turbine' ? 0.16 : 0.05, 0.03), M({ color: 0x1a1a1e, metalness: 0.6, roughness: 0.4 })); const a = k / n * Math.PI * 2; b.position.set(face + side * 0.012, Math.cos(a) * 0.15, Math.sin(a) * 0.15); b.rotation.x = -a + (rimType === 'turbine' ? 0.6 : 0); spin.add(b); }
  } else if (rimType === 'spoke5' || rimType === 'mesh' || rimType === 'neon') {
    const n = rimType === 'mesh' ? 14 : 5;
    for (let k = 0; k < n; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, rimType === 'mesh' ? 0.025 : 0.06), rimMat); sp.rotation.x = k / n * Math.PI; sp.position.x = face; spin.add(sp); }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 8, 32), rimType === 'neon' ? new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: custom.rimColor || 0x00e5ff, emissiveIntensity: 3 }) : rimMat);
    lip.rotation.y = Math.PI / 2; lip.position.x = face; spin.add(lip);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), rimMat); hub.rotation.z = Math.PI / 2; hub.position.x = face + side * 0.01; spin.add(hub);
  // brake disc + caliper (doesn't spin)
  const discB = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 24), M({ color: 0x777777, metalness: 0.9, roughness: 0.35 })); discB.rotation.z = Math.PI / 2; discB.position.x = side * 0.02; g.add(discB);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.16), M({ color: custom.caliper || 0xd01818, roughness: 0.4 })); cal.position.set(side * 0.05, 0.12, -0.08); g.add(cal);
  return g;
}

// --- traffic ---
const trafficColors = [0xe8e8e8, 0x2b5fd9, 0xd9a62b, 0x2bd96a, 0x8f8f96, 0xd93a2b, 0x5a2bd9, 0x222222];
export function buildTraffic(type, colorSeed) {
  const g = new THREE.Group();
  const col = trafficColors[Math.floor(colorSeed * trafficColors.length)];
  const body = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.5, roughness: 0.35, clearcoat: 0.8 });
  const glass = M({ color: 0x111820, metalness: 0.6, roughness: 0.1 });
  const tire = M({ color: 0x111111, roughness: 0.9 });
  const d = { sedan: [1.8, 0.7, 4.4, 0.6], van: [2.0, 1.6, 5.0, 0.5], truck: [2.4, 2.8, 9, 0.3], bus: [2.5, 2.8, 11, 0.2] }[type];
  const lower = new THREE.Mesh(new THREE.BoxGeometry(d[0], d[1] * (type === 'sedan' ? 1 : 0.85), d[2]), body); lower.position.y = 0.35 + d[1] * 0.45; g.add(lower);
  if (type === 'sedan') { const cab = new THREE.Mesh(new THREE.BoxGeometry(d[0] * 0.86, 0.55, d[2] * 0.5), glass); cab.position.set(0, 0.35 + d[1] + 0.2, -0.2); g.add(cab); }
  else if (type === 'truck') { const cab = new THREE.Mesh(new THREE.BoxGeometry(d[0], 2.2, 2.2), body); cab.position.set(0, 1.4, d[2] / 2 + 0.6); g.add(cab); const w = new THREE.Mesh(new THREE.BoxGeometry(d[0] * 0.9, 0.8, 0.05), glass); w.position.set(0, 1.9, d[2] / 2 + 1.72); g.add(w); lower.material = M({ color: 0xdddddd, roughness: 0.6 }); }
  else { const w = new THREE.Mesh(new THREE.BoxGeometry(d[0] + 0.02, 0.6, d[2] * 0.85), glass); w.position.set(0, 0.35 + d[1] * 0.75, 0); g.add(w); }
  const wz = d[2] * 0.36; for (const sx of [-1, 1]) for (const sz of [-wz, wz]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14), tire); t.rotation.z = Math.PI / 2; t.position.set(sx * d[0] / 2, 0.36, sz); g.add(t); }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(d[0] * 0.8, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x400, emissive: 0xff2020, emissiveIntensity: 2 })); tl.position.set(0, 0.8, -d[2] / 2 - 0.02); g.add(tl);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// --- Volt-Bot helper robot (original design) ---
export function buildRobotLegacy(accent = 0x00e5ff) {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, roughness: 0.3, metalness: 0.1, clearcoat: 0.8 });
  const dark = M({ color: 0x15171c, roughness: 0.4, metalness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x002030, emissive: accent, emissiveIntensity: 2.5 });
  const cap = (r, l, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), mat);
  const torso = cap(0.26, 0.42, shell); torso.position.y = 1.2; torso.scale.set(1.15, 1, 0.8); g.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), glow); chest.position.set(0, 1.32, 0.215); g.add(chest);
  const pelvis = cap(0.17, 0.12, dark); pelvis.rotation.z = Math.PI / 2; pelvis.position.y = 0.86; g.add(pelvis);
  const head = new THREE.Group(); head.position.y = 1.72; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), shell); skull.scale.set(1, 1.12, 1.02); head.add(skull);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 12, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.42), new THREE.MeshPhysicalMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.8, clearcoat: 1 }));
  visor.position.z = 0.03; head.add(visor);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.02), glow); eye.position.set(0, 0.01, 0.168); head.add(eye);
  const neck = cap(0.06, 0.08, dark); neck.position.y = 1.56; g.add(neck);
  const limb = (side, arm) => {
    const root = new THREE.Group(); root.position.set(side * (arm ? 0.36 : 0.13), arm ? 1.45 : 0.82, 0); g.add(root);
    const upper = cap(arm ? 0.07 : 0.09, arm ? 0.28 : 0.32, shell); upper.position.y = arm ? -0.2 : -0.24; root.add(upper);
    const joint = new THREE.Group(); joint.position.y = arm ? -0.4 : -0.46; root.add(joint);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(arm ? 0.065 : 0.08, 10, 8), dark); joint.add(knee);
    const lower = cap(arm ? 0.06 : 0.08, arm ? 0.26 : 0.3, arm ? dark : shell); lower.position.y = arm ? -0.18 : -0.22; joint.add(lower);
    if (!arm) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.26), dark); foot.position.set(0, -0.4, 0.05); joint.add(foot); }
    else { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), dark); hand.position.y = -0.36; joint.add(hand); }
    return { root, joint };
  };
  const parts = { armL: limb(-1, true), armR: limb(1, true), legL: limb(-1, false), legR: limb(1, false), head };
  g.userData.parts = parts;
  g.userData.animate = (t, mode = 'walk') => {
    const s = Math.sin(t * 6), c = Math.cos(t * 6);
    if (mode === 'walk') {
      parts.legL.root.rotation.x = s * 0.45; parts.legR.root.rotation.x = -s * 0.45;
      parts.legL.joint.rotation.x = Math.max(0, -c) * 0.6; parts.legR.joint.rotation.x = Math.max(0, c) * 0.6;
      parts.armL.root.rotation.x = -s * 0.35; parts.armR.root.rotation.x = s * 0.35; parts.armL.joint.rotation.x = -0.3; parts.armR.joint.rotation.x = -0.3;
      g.children[0].position.y = 1.2 + Math.abs(c) * 0.03;
    } else if (mode === 'wave') {
      parts.armR.root.rotation.z = 2.6 + Math.sin(t * 8) * 0.3; parts.armR.joint.rotation.z = 0.3;
      parts.armL.root.rotation.x = 0; parts.legL.root.rotation.x = 0; parts.legR.root.rotation.x = 0; head.rotation.y = Math.sin(t * 2) * 0.3;
    } else if (mode === 'work') {
      parts.armL.root.rotation.x = -1.2 + Math.sin(t * 9) * 0.25; parts.armR.root.rotation.x = -1.2 - Math.sin(t * 9) * 0.25; head.rotation.x = 0.3;
    }
  };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// --- quest props ---
export function buildProp(kind) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const glowMat = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });
  switch (kind) {
    case 'mailbox': add(new THREE.BoxGeometry(0.1, 1.1, 0.1), M({ color: 0x5a3b22 }), 0, -0.15, 0); add(new THREE.CapsuleGeometry(0.22, 0.35, 4, 10), M({ color: 0x2255cc, metalness: 0.5, roughness: 0.4 }), 0, 0.5, 0).rotation.x = Math.PI / 2; add(new THREE.BoxGeometry(0.04, 0.2, 0.12), M({ color: 0xff2222 }), 0.25, 0.65, 0); break;
    case 'pizza': { add(new THREE.BoxGeometry(1.4, 0.16, 1.4), M({ color: 0xd8b383, roughness: 0.9 })); const lid = add(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: textTexture([{ text: '🍕', size: 300 }], { w: 512, h: 512, bg: '#d8b383' }) }), 0, 0.085, 0); lid.rotation.x = -Math.PI / 2; break; }
    case 'satellite': add(new THREE.BoxGeometry(0.8, 0.8, 0.8), M({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 })); for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.6, 0.04, 0.7), M({ color: 0x1a2a6c, metalness: 0.6, roughness: 0.2 }), s * 1.3, 0, 0); add(new THREE.ConeGeometry(0.3, 0.3, 16, 1, true), M({ color: 0xeeeeee, side: THREE.DoubleSide }), 0, 0.55, 0); break;
    case 'alien': add(new THREE.CapsuleGeometry(0.35, 0.5, 4, 12), M({ color: 0x5be35b, roughness: 0.4 }), 0, 0.6, 0); add(new THREE.SphereGeometry(0.45, 16, 12), M({ color: 0x5be35b }), 0, 1.35, 0); for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.14, 12, 8), M({ color: 0x050505, roughness: 0.05 }), s * 0.18, 1.4, 0.36).scale.set(1, 1.5, 0.6); break;
    case 'ice': add(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, roughness: 0.05, transmission: 0.6, thickness: 0.5, transparent: true, opacity: 0.85 }), 0, 0.2, 0).rotation.z = Math.PI / 2; break;
    case 'cheese': { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.2, 0); sh.lineTo(0, 0.7); sh.lineTo(0, 0); add(new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }), M({ color: 0xffd23f, roughness: 0.6 }), -0.4, -0.3, -0.3); break; }
    case 'potato': { const geo = new THREE.SphereGeometry(0.55, 14, 10); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 + 0.15 * Math.sin(p.getX(i) * 9) * Math.cos(p.getY(i) * 7); p.setXYZ(i, p.getX(i) * f * 1.35, p.getY(i) * f * 0.85, p.getZ(i) * f); } geo.computeVertexNormals(); add(geo, M({ color: 0x9c6b3c, roughness: 0.95 })); break; }
    case 'ring': { add(new THREE.TorusGeometry(7, 1.6, 20, 48), M({ color: 0xe0a060, roughness: 0.7 })); const fr = add(new THREE.TorusGeometry(7, 1.65, 20, 48, Math.PI * 2), new THREE.MeshStandardMaterial({ color: 0xff6fb5, roughness: 0.4, emissive: 0x401020 })); fr.scale.set(1.01, 1.01, 0.62); fr.position.z = 0.55;
      for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, r = 7 + (Math.random() - 0.5) * 2; const sp = add(new THREE.CapsuleGeometry(0.08, 0.3, 2, 4), glowMat([0xffee55, 0x55ccff, 0xffffff, 0x77ff77][k % 4], 0.8), Math.cos(a) * r, Math.sin(a) * r, 1.4); sp.rotation.z = Math.random() * 3; }
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.4, 0.5, 60, 8), M({ color: 0x777777, metalness: 0.7 }), s * 9, -36, 0); break; }
    case 'cow': { const white = M({ color: 0xf4f4f4, roughness: 0.8 }), blk = M({ color: 0x151515, roughness: 0.8 });
      add(new THREE.BoxGeometry(1.0, 1.0, 2.0), white, 0, 1.2, 0); for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(1.02, 0.4, 0.5), blk, 0, 1.3 + (k % 2) * 0.2, -0.7 + k * 0.35).scale.set(1, 1, 0.8);
      add(new THREE.BoxGeometry(0.7, 0.7, 0.8), white, 0, 1.5, 1.25); add(new THREE.BoxGeometry(0.6, 0.35, 0.3), M({ color: 0xffb0b0 }), 0, 1.3, 1.7);
      for (const s of [-1, 1]) { add(new THREE.ConeGeometry(0.07, 0.3, 6), M({ color: 0xeeeecc }), s * 0.3, 1.95, 1.2); }
      g.userData.legs = []; for (const sx of [-0.35, 0.35]) for (const sz of [-0.75, 0.75]) { const l = add(new THREE.BoxGeometry(0.22, 0.8, 0.22), white, sx, 0.4, sz); g.userData.legs.push(l); }
      const bell = add(new THREE.SphereGeometry(0.1, 8, 6), M({ color: 0xd4af37, metalness: 1, roughness: 0.3 }), 0, 1.05, 1.5); break; }
    case 'rover': { const body = M({ color: 0xcfcfcf, metalness: 0.6, roughness: 0.4 }); add(new THREE.BoxGeometry(1.6, 0.6, 2.2), body, 0, 1.0, 0); add(new THREE.CylinderGeometry(0.06, 0.06, 1.2), body, 0.4, 1.8, 0.6); add(new THREE.BoxGeometry(0.5, 0.3, 0.3), M({ color: 0x333333 }), 0.4, 2.4, 0.6); add(new THREE.BoxGeometry(2.2, 0.04, 1.2), M({ color: 0x1a2a6c, metalness: 0.5 }), 0, 1.35, -0.4);
      for (const sx of [-1, 1]) for (const sz of [-0.9, 0, 0.9]) add(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), M({ color: 0x555555 }), sx * 1.0, 0.3, sz).rotation.z = Math.PI / 2; break; }
    case 'house': { add(new THREE.BoxGeometry(6, 4, 6), M({ color: 0xf0e0c0 }), 0, 2, 0); const roof = add(new THREE.ConeGeometry(5, 3, 4), M({ color: 0xb03a2e }), 0, 5.5, 0); roof.rotation.y = Math.PI / 4;
      const sign = add(new THREE.PlaneGeometry(4, 1.4), new THREE.MeshStandardMaterial({ map: textTexture([{ text: 'PIZZA DROP', size: 110 }], { w: 1024, h: 360, bg: '#c62828' }), emissive: 0x330000 }), 0, 3, -3.02); sign.rotation.y = Math.PI; break; }
    case 'ufo': { add(new THREE.SphereGeometry(4, 24, 8), new THREE.MeshStandardMaterial({ color: 0xaab0c0, metalness: 0.9, roughness: 0.25 }), 0, 4, 0).scale.set(1, 0.25, 1); add(new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.6, emissive: 0x115533 }), 0, 4.6, 0);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(new THREE.SphereGeometry(0.2, 8, 6), glowMat(k % 2 ? 0xff3366 : 0x33ffcc, 3), Math.cos(a) * 3.6, 3.9, Math.sin(a) * 3.6); } break; }
    case 'base': { add(new THREE.CylinderGeometry(4, 4, 3, 24), M({ color: 0xe8e8e8, metalness: 0.3 }), 0, 1.5, 0); add(new THREE.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x99ccff, transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 3, 0); break; }
    case 'battery': { add(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), M({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3 })); add(new THREE.CylinderGeometry(0.52, 0.52, 0.5, 16), glowMat(0x39ff6a, 2.5), 0, -0.2, 0); add(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), M({ color: 0xcccccc, metalness: 1 }), 0, 0.68, 0); break; }
    case 'nitro': { add(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 16), M({ color: 0x1460ff, metalness: 0.7, roughness: 0.25 })); add(new THREE.CylinderGeometry(0.44, 0.44, 0.2, 16), glowMat(0x7fd4ff, 3), 0, 0.3, 0); add(new THREE.ConeGeometry(0.42, 0.4, 16), M({ color: 0xdddddd, metalness: 1 }), 0, 0.85, 0); break; }
    case 'suitcase': add(new THREE.BoxGeometry(1.1, 0.8, 0.35), M({ color: [0xd03a2a, 0x2a6ad0, 0xe0b020][Math.floor(Math.random() * 3)], roughness: 0.5 }), 0, 0.4, 0); add(new THREE.TorusGeometry(0.18, 0.04, 6, 12, Math.PI), M({ color: 0x222222 }), 0, 0.82, 0); for (const sx of [-0.35, 0.35]) add(new THREE.BoxGeometry(0.08, 0.82, 0.37), M({ color: 0x8a5a2a }), sx, 0.4, 0); break;
    case 'core': add(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 16), new THREE.MeshPhysicalMaterial({ color: 0x80ffe0, emissive: 0x20c0a0, emissiveIntensity: 1.6, roughness: 0.1, transmission: 0.4, thickness: 0.5 }), 0, 0.7, 0); for (const y of [0.05, 1.35]) add(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16), M({ color: 0x888888, metalness: 0.9 }), 0, y, 0); break;
    case 'antenna': add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), M({ color: 0xcccccc, metalness: 0.9 }), 0, 0.8, 0); { const d = add(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.6, side: THREE.DoubleSide }), 0, 1.4, 0); d.rotation.x = Math.PI; } add(new THREE.SphereGeometry(0.08, 8, 6), glowMat(0xff3030, 3), 0, 1.65, 0); break;
    default: add(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xffc533, emissive: 0xff9000, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.4 }), 0, 0.5, 0); add(new THREE.OctahedronGeometry(0.35), glowMat(0x00e5ff, 2.5), 0, 1.4, 0);
  }
  return g;
}

export function buildRocket(scale = 1) {
  const g = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.22, clearcoat: 0.3 });
  const dark = M({ color: 0x1b1d22, metalness: 0.7, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 60, 40), steel); body.position.y = 30; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(4.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), steel); nose.scale.y = 2.6; nose.position.y = 60; g.add(nose);
  for (let k = 0; k < 4; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 5), steel); const a = k / 4 * Math.PI * 2 + Math.PI / 4; fin.position.set(Math.cos(a) * 5.2, 6, Math.sin(a) * 5.2); fin.rotation.y = -a; g.add(fin); }
  for (let k = 0; k < 2; k++) { const flap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 4), steel); const a = k * Math.PI; flap.position.set(Math.cos(a) * 5, 62, Math.sin(a) * 5); flap.rotation.y = -a; g.add(flap); }
  for (let k = 0; k < 7; k++) { const a = k / 6 * Math.PI * 2; const r = k === 6 ? 0 : 2.6; const e = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 1.6, 14, 1, true), dark); e.position.set(Math.cos(a) * r, -0.6, Math.sin(a) * r); g.add(e); }
  // cargo door with ramp (for the spaceport finale)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.2), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x223355, emissiveIntensity: 0.6 })); door.position.set(0, 8, 4.52); g.add(door);
  g.scale.setScalar(scale); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.enginesY = -1.4 * scale;
  return g;
}

export function buildBillboard(text, sub, colors = ['#ff3d7f', '#7a2cff']) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshStandardMaterial({ map: textTexture([{ text, size: 92 }, { text: sub || '', size: 52, weight: 600 }], { grad: colors }), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null }));
  board.material.emissiveMap = board.material.map; board.position.y = 9; g.add(board);
  const back = new THREE.Mesh(new THREE.BoxGeometry(16.4, 7.4, 0.3), M({ color: 0x222 })); back.position.set(0, 9, -0.2); g.add(back);
  for (const s of [-5, 5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 9, 8), M({ color: 0x555, metalness: 0.7 })); p.position.set(s, 4.5, -0.3); g.add(p); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildArch(text, color = '#00e5ff') {
  const g = new THREE.Group();
  const mat = M({ color: 0x1a1a22, metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), mat); p.position.set(s * 8.2, 4, 0); g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(17.2, 1.8, 0.8), new THREE.MeshStandardMaterial({ map: textTexture([{ text, size: 120 }], { w: 1024, h: 128, bg: '#0b0b12', color }), emissive: 0xffffff, emissiveIntensity: 0.6 }));
  top.material.emissiveMap = top.material.map; top.position.y = 8.6; g.add(top);
  return g;
}

export function buildKicker() {
  const sh = new THREE.Shape(); sh.moveTo(-4, 0); sh.lineTo(4, 0); sh.lineTo(4, 1.7); sh.lineTo(-4, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false }); geo.translate(0, 0, -2); geo.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb400, roughness: 0.5, metalness: 0.3 }));
  const stripes = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 })); m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}

export function buildPad(r = 9) {
  const g = new THREE.Group();
  const ring = (ri, ro, c, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 48), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.x = -Math.PI / 2; g.add(m); return m; };
  ring(r - 0.5, r, 0xffffff, 1.2); ring(r * 0.55 - 0.4, r * 0.55, 0xffcc00, 1.5); ring(1.6, 2.5, 0xff2a6d, 2.2);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshStandardMaterial({ color: 0xff2a6d, emissive: 0xff2a6d, emissiveIntensity: 2.5, polygonOffset: true, polygonOffsetFactor: -2 })); dot.rotation.x = -Math.PI / 2; g.add(dot);
  return g;
}

export function buildTrophy(color = 0xd4af37, shape = 0) {
  const g = new THREE.Group(); const gold = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.18, clearcoat: 1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), M({ color: 0x2b2b2b })); base.position.y = 0.1; g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 12), gold); stem.position.y = 0.35; g.add(stem);
  const cup = shape % 3 === 0 ? new THREE.Mesh(new THREE.LatheGeometry([0, 0.1, 0.2, 0.25, 0.26].map((r, i) => new THREE.Vector2(r, i * 0.1)), 20), gold)
    : shape % 3 === 1 ? new THREE.Mesh(new THREE.OctahedronGeometry(0.22), gold) : new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.04, 48, 8), gold);
  cup.position.y = 0.6; g.add(cup); return g;
}

export { mergeGeometries };

// ---------- customization parts shared by both vehicles ----------
export function addUnderglow(group, custom, y, w, l) {
  const ug = custom.underglow; if (!ug || ug === 'none') return;
  const special = ug === 'rainbow' || ug === 'pulse'; const col = special ? '#00e5ff' : ug;
  const light = new THREE.PointLight(col, 4, 7, 2); light.position.set(0, y + 0.1, 0); group.add(light);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = y - 0.08; group.add(strip);
  group.userData.underglow = { light, strip, mode: special ? ug : 'solid' };
}
export function animateUnderglow(group, t, beat = 0) {
  const u = group.userData.underglow; if (!u || u.mode === 'solid') return;
  if (u.mode === 'rainbow') { const c = new THREE.Color().setHSL((t * 0.25) % 1, 1, 0.55); u.light.color.copy(c); u.strip.material.color.copy(c); }
  else { const k = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + beat)); u.light.intensity = 4 * k; u.strip.material.opacity = 0.45 * k; }
}
export function addSpoiler(group, kind, paintMat, carbonMat, deckY, z, width) {
  if (!kind || kind === 'none') return;
  const g = new THREE.Group(); g.name = 'spoiler'; g.position.set(0, deckY, z); group.add(g);
  const blade = (w, d, y, zz, tilt, mat = carbonMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d), mat); m.position.set(0, y, zz); m.rotation.x = tilt; m.castShadow = true; g.add(m); return m; };
  const post = (x, h, zz = 0, mat = carbonMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.16), mat); m.position.set(x, h / 2, zz); g.add(m); return m; };
  if (kind === 'lip') blade(width * 0.9, 0.12, 0.02, -0.05, -0.25, paintMat);
  else if (kind === 'ducktail') { const m = blade(width * 0.95, 0.32, 0.06, -0.08, -0.35, paintMat); m.scale.y = 2; }
  else if (kind === 'wing' || kind === 'swan' || kind === 'dual' || kind === 'active') {
    const h = kind === 'swan' ? 0.42 : 0.32; const sx = width * 0.32;
    if (kind === 'swan') { for (const x of [-sx, sx]) { const p1 = post(x, h, -0.05); p1.rotation.x = 0.35; } } else { post(-sx, h); post(sx, h); }
    const top = blade(width, 0.36, h + 0.02, -0.04, -0.12);
    for (const x of [-width / 2, width / 2]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.44), carbonMat); ep.position.set(x, h, -0.04); g.add(ep); }
    if (kind === 'dual') blade(width * 0.96, 0.2, h + 0.15, -0.16, -0.32, paintMat);
    if (kind === 'active') { top.material = paintMat; g.userData.active = top; }
  }
  group.userData.spoiler = g;
}

// Vehicle factory: 'roadster' -> our procedural hypercar, 'hauler' -> art-pack stainless pickup (VOLT Ferrox).
export function buildVehicle(vehicleId, custom = {}, opts = {}) {
  if (vehicleId !== 'hauler') return buildCar(custom, opts);
  let truck;
  try { const po = { quality: opts.quality || 'high' }; if (opts.wheelPos) po.wheelPos = opts.wheelPos; truck = createPickup(po); }
  catch (e) { console.warn('pickup model failed', e); return buildCar(custom, opts); }
  const ud = truck.userData;
  const paint = PAINT_LIST.find(p => p.id === custom.paint);
  const fin = FINISH_LIST.find(f => f.id === custom.finish);
  const steel = ud.materials.steel;
  if (paint && paint.id !== 'steel') steel.color.set(paint.color);
  if (fin && custom.finish !== 'brushed') { steel.metalness = Math.max(0.35, fin.metalness); steel.roughness = fin.roughness; if ('clearcoat' in steel) steel.clearcoat = fin.clearcoat; if ('iridescence' in steel) { steel.iridescence = paint?.shift ? 1 : (fin.iridescence || 0); steel.iridescenceIOR = fin.iridescenceIOR || 1.6; } }
  if (!fin || custom.finish === 'brushed') { steel.metalness = Math.min(steel.metalness, 0.72); steel.roughness = Math.max(steel.roughness, 0.3); } // keeps raw steel readable under black space skies
  if (custom.wrap && custom.wrap !== 'none') { steel.map = wrapTexture(custom.wrap, custom.wrapColor || '#111111', '#ffffff'); steel.needsUpdate = true; }
  // adapt to the LevelView/showroom wheel contract: wheels[i].position/.rotation + userData.spin
  const wheels = ud.wheels;
  ud.artWheels = wheels;
  ud.wheels = wheels.map(w => { w.pivot.userData.spin = w.spin; return w.pivot; });
  ud.tailMat = ud.materials.tail; ud.headMat = ud.materials.head; ud.paintMat = steel;
  ud.nozzles = ud.mounts.boost.map(v => v.clone());
  ud.rcsPorts = ud.mounts.thrusters.map(v => v.clone());
  const gy = -0.86;
  addUnderglow(truck, custom, gy + 0.1, 2.0, 5.0);
  const sp = ud.mounts.spoiler; addSpoiler(truck, custom.spoiler, steel, new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.35, metalness: 0.5 }), sp.deckY, sp.position.z + 0.1, sp.width);
  truck.name = 'car'; return truck;
}
