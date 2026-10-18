// Shared wheel designs for the hypercar and the pickup (and anything else with wheel pivots).
// A wheel "visual" is the rolling part only (tyre, rim, disc). Calipers live on the pivot.
//
//   const mats = createWheelMaterials({ quality: 'ultra', rim: 0x22252b, accent: 0x2ee6ff });
//   const w = createWheel({ design: 'turbine', radius: 0.36, width: 0.28, side: +1, quality: 'ultra', mats });
//   pivotSpin.add(w.object);   // w.discX = disc plane x (for caliper placement);  w.dispose()
import {
  Object3D, Mesh, LatheGeometry, CylinderGeometry, TorusGeometry, ExtrudeGeometry, Shape, Vector2,
  BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial, Color, DataTexture, RGBAFormat,
  RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, DoubleSide, Matrix4,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const WHEEL_DESIGNS = [
  { id: 'turbine', name: 'Turbine', preview: '#2a2d33', desc: '10 twisted aero spokes' },
  { id: 'aero', name: 'Aero Disc', preview: '#c8ccd2', desc: 'Flush aero cover with vents' },
  { id: 'yspoke', name: 'Y-Spoke', preview: '#9aa1a8', desc: 'Five forged Y spokes' },
  { id: 'mesh', name: 'Lattice', preview: '#d4a017', desc: 'Cross-laced lattice' },
  { id: 'offroad', name: 'Beadlock', preview: '#1b1d21', desc: 'Off-road beadlock + knobby tyre' },
  { id: 'neon', name: 'Neon Ring', preview: '#2ee6ff', desc: 'Thin spokes + glowing lip' },
];

const SEG = { ultra: 64, high: 48, medium: 32, low: 20 };

function treadTexture(kind) {
  const W = 64, H = 256, d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H; let h = 255;
    if (kind === 'offroad') { // chunky staggered blocks
      const row = Math.floor(v * 32), off = row % 2 ? 0.25 : 0;
      const bu = ((u + off) * 4) % 1, bv = (v * 32) % 1;
      h = bu > 0.12 && bu < 0.88 && bv > 0.15 && bv < 0.85 ? 255 : 20;
    } else {
      const groove = [0.2, 0.4, 0.6, 0.8].some(g => Math.abs(u - g) < 0.025);
      const sipe = Math.abs(((v * 24 + Math.abs(u - 0.5) * 3) % 1) - 0.5) < 0.06 && u > 0.08 && u < 0.92;
      h = groove ? 0 : sipe ? 90 : 255;
    }
    const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = h; d[i + 3] = 255;
  }
  const t = new DataTexture(d, W, H, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  t.repeat.set(1, 6);
  return t;
}

export function createWheelMaterials({ quality = 'high', rim = 0x22252b, accent = 0x2ee6ff, caliper = 0xff5a1f } = {}) {
  const phys = quality !== 'low';
  const P = phys ? MeshPhysicalMaterial : MeshStandardMaterial;
  const tex = quality === 'ultra' || quality === 'high' ? { road: treadTexture('road'), offroad: treadTexture('offroad') } : {};
  const m = {
    tyre: new MeshStandardMaterial({ color: 0x141414, roughness: 0.88, bumpMap: tex.road || null, bumpScale: 1.5, side: DoubleSide }),
    tyreOff: new MeshStandardMaterial({ color: 0x161616, roughness: 0.92, bumpMap: tex.offroad || null, bumpScale: 4, side: DoubleSide }),
    rim: new P({ color: rim, metalness: 1, roughness: 0.22, ...(phys ? { clearcoat: 0.5 } : {}) }),
    rimInner: new MeshStandardMaterial({ color: 0x15171a, metalness: 0.8, roughness: 0.45 }),
    disc: new MeshStandardMaterial({ color: 0x8c8f94, metalness: 1, roughness: 0.38, emissive: new Color(0xff3300), emissiveIntensity: 0 }),
    glow: new MeshStandardMaterial({ color: 0x111111, emissive: new Color(accent), emissiveIntensity: 3 }),
    caliper: new P({ color: caliper, metalness: 0.3, roughness: 0.3, ...(phys ? { clearcoat: 1 } : {}) }),
    bolt: new MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.3 }),
  };
  m.dispose = () => { for (const k in m) if (m[k]?.isMaterial) m[k].dispose(); for (const k in tex) tex[k].dispose(); };
  return m;
}

const rotX = (g, a) => g.applyMatrix4(new Matrix4().makeRotationX(a));

function spokeShape(w0, w1, r0, r1) {
  const s = new Shape(); s.moveTo(-w0, r0); s.lineTo(w0, r0); s.lineTo(w1, r1); s.lineTo(-w1 * 1.2, r1); s.closePath(); return s;
}
// extrude a 2D (u = tangential, v = radial) shape into a spoke lying in the wheel's YZ plane, facing +/-X
function spoke(shape, depth, x, bevel) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel, bevelThickness: depth * 0.2, bevelSize: depth * 0.15, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(Math.PI / 2); g.translate(x, 0, 0); return g;
}

export function createWheel({ design = 'turbine', radius = 0.36, width = 0.28, side = 1, quality = 'high', mats }) {
  const own = !mats; mats = mats || createWheelMaterials({ quality });
  const seg = SEG[quality] || 48, bevel = quality !== 'low';
  const R = radius, off = design === 'offroad';
  const rimR = R * (off ? 0.6 : 0.708), hw = width / 2;
  const object = new Object3D(); object.name = 'wheelVisual'; object.userData.design = design;
  const geos = [];
  const add = (g, m, name) => { geos.push(g); const me = new Mesh(g, m); me.name = name; me.castShadow = true; object.add(me); return me; };
  // tyre
  const sw = off ? 0.03 : 0.012; // rounder shoulders for off-road
  const prof = [[rimR, -hw + 0.01], [rimR + (R - rimR) * 0.5, -hw], [R - 0.03 - sw, -hw + 0.012], [R - 0.004, -hw + 0.04 + sw], [R, -hw + 0.07 + sw],
    [R, hw - 0.07 - sw], [R - 0.004, hw - 0.04 - sw], [R - 0.03 - sw, hw - 0.012], [rimR + (R - rimR) * 0.5, hw], [rimR, hw - 0.01]].map(([r, y]) => new Vector2(r, y));
  add(new LatheGeometry(prof, seg).rotateZ(Math.PI / 2), off ? mats.tyreOff : mats.tyre, 'tyre');
  add(new CylinderGeometry(rimR, rimR, width * 0.86, seg, 1, true).rotateZ(Math.PI / 2), mats.rimInner, 'barrel');
  const face = side * (hw - 0.035);
  // disc + hat
  const discX = face - side * (0.11 + (off ? 0.03 : 0));
  const discR = rimR * 0.9;
  const dg = mergeGeometries([
    new CylinderGeometry(discR, discR, 0.03, seg).rotateZ(Math.PI / 2).translate(discX, 0, 0),
  ]);
  add(dg, mats.disc, 'disc');
  add(new CylinderGeometry(rimR * 0.4, rimR * 0.4, 0.06, 24).rotateZ(Math.PI / 2).translate(discX + side * 0.02, 0, 0), mats.rimInner, 'hat');
  // rim face parts (merged per material)
  const rimParts = [], glowParts = [], boltParts = [];
  rimParts.push(new TorusGeometry(rimR - 0.004, off ? 0.022 : 0.011, 6, seg).rotateY(Math.PI / 2).translate(face, 0, 0));
  rimParts.push(new CylinderGeometry(rimR * 0.27, rimR * 0.29, 0.05, 24).rotateZ(Math.PI / 2).translate(face - side * 0.02, 0, 0));
  const sx = face - side * 0.035, k = rimR / 0.255;
  if (design === 'turbine') {
    const sh = spokeShape(0.028 * k, 0.017 * k, 0.055 * k, rimR - 0.01);
    for (let i = 0; i < 10; i++) { const g = spoke(sh, 0.03, sx, bevel); g.applyMatrix4(new Matrix4().makeRotationY(side * 0.12)); rotX(g, (i / 10) * Math.PI * 2); rimParts.push(g); }
  } else if (design === 'aero') {
    rimParts.push(new CylinderGeometry(rimR * 0.97, rimR * 0.97, 0.02, seg).rotateZ(Math.PI / 2).translate(face - side * 0.01, 0, 0));
    for (let i = 0; i < 5; i++) { const g = new BoxGeometry(0.012, rimR * 0.32, 0.035).translate(face + side * 0.004, rimR * 0.62, 0); rotX(g, (i / 5) * Math.PI * 2 + 0.3); glowParts.push(g); }
  } else if (design === 'yspoke') {
    const stem = spokeShape(0.03 * k, 0.024 * k, 0.05 * k, rimR * 0.55);
    const br = spokeShape(0.016 * k, 0.012 * k, rimR * 0.5, rimR - 0.01);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const g = spoke(stem, 0.035, sx, bevel); rotX(g, a); rimParts.push(g);
      for (const t of [-0.2, 0.2]) { const b = spoke(br, 0.03, sx, bevel); rotX(b, a + t); rimParts.push(b); }
    }
  } else if (design === 'mesh') {
    const thin = spokeShape(0.008 * k, 0.007 * k, 0.05 * k, rimR - 0.01);
    for (let i = 0; i < 14; i++) for (const t of [-0.35, 0.35]) {
      const g = new ExtrudeGeometry(thin, { depth: 0.018, bevelEnabled: false });
      // lean the spoke tangentially so pairs cross into a lattice
      g.applyMatrix4(new Matrix4().makeShear(0, 0, t, 0, 0, 0)); g.rotateY(Math.PI / 2); g.translate(sx + side * (t > 0 ? 0 : -0.012), 0, 0);
      rotX(g, (i / 14) * Math.PI * 2); rimParts.push(g);
    }
  } else if (design === 'offroad') {
    rimParts.push(new CylinderGeometry(rimR * 0.92, rimR * 0.92, 0.025, seg).rotateZ(Math.PI / 2).translate(face - side * 0.02, 0, 0));
    for (let i = 0; i < 8; i++) { const g = new CylinderGeometry(rimR * 0.13, rimR * 0.13, 0.03, 16).rotateZ(Math.PI / 2).translate(face - side * 0.012, rimR * 0.6, 0); rotX(g, (i / 8) * Math.PI * 2); glowParts.push(g); }
    for (let i = 0; i < 16; i++) { const g = new CylinderGeometry(0.009, 0.009, 0.03, 6).rotateZ(Math.PI / 2).translate(face + side * 0.012, rimR - 0.012, 0); rotX(g, (i / 16) * Math.PI * 2); boltParts.push(g); }
  } else if (design === 'neon') {
    const sh = spokeShape(0.012 * k, 0.01 * k, 0.05 * k, rimR - 0.01);
    for (let i = 0; i < 6; i++) { const g = spoke(sh, 0.025, sx, bevel); rotX(g, (i / 6) * Math.PI * 2); rimParts.push(g); }
    glowParts.push(new TorusGeometry(rimR - 0.02, 0.008, 6, seg).rotateY(Math.PI / 2).translate(face + side * 0.006, 0, 0));
  }
  // centre cap glow (all designs)
  glowParts.push(new CylinderGeometry(0.035 * k, 0.035 * k, 0.012, 20).rotateZ(Math.PI / 2).translate(face + side * 0.008, 0, 0));
  const merge = (arr) => { const nonIndexed = arr.map(g => (g.index ? g.toNonIndexed() : g)); arr.forEach(g => g.dispose()); const m = mergeGeometries(nonIndexed.map(g => { const c = g; for (const n of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(n)) c.deleteAttribute(n); return c; })); nonIndexed.forEach(g => g.dispose()); return m; };
  add(merge(rimParts), mats.rim, 'rimFace');
  // offroad "holes" read as dark recesses; others use the accent glow material
  if (glowParts.length) add(merge(glowParts), design === 'offroad' ? mats.rimInner : mats.glow, 'rimAccent');
  if (boltParts.length) add(merge(boltParts), mats.bolt, 'bolts');
  return { object, discX, discR, rimR, dispose() { object.removeFromParent(); geos.forEach(g => g.dispose()); if (own) mats.dispose(); } };
}

// Caliper sized to a wheel; add to the PIVOT (not the spin node).
export function createCaliper({ discX, discR = 0.23, side = 1, front = true, quality = 'high', material }) {
  const sh = new Shape();
  const r0 = discR * 0.72, r1 = discR * 1.1, a0 = -0.55, a1 = 0.55;
  sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); sh.closePath();
  const g = new ExtrudeGeometry(sh, { depth: 0.075, bevelEnabled: quality !== 'low', bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -0.0375); g.rotateY(Math.PI / 2);
  const m = new Mesh(g, material); m.castShadow = true;
  m.rotation.x = front ? -0.75 : -Math.PI + 0.75; m.position.x = discX - side * 0.005;
  return m;
}
