// VOLT Ferrox: original faceted brushed-stainless electric pickup (procedural, no logos).
// Design: three-box faceted wedge. Low chamfered nose with a full-width light bar,
// separate narrower cab with a flat roof and steep rake (shoulder ledge either side),
// flat bed with slatted tonneau, hexagonal wheel arches with black flares, tall stance.
// Intentionally NOT a single-apex "sail" roofline. API mirrors createHypercar.
//
//   import { createPickup, syncPickupWheels } from './art/truck/createPickup.js';
//   const truck = createPickup({ quality: 'ultra' });
//   scene.add(truck);                                  // origin == Rapier chassis body origin
//   syncPickupWheels(truck, vc, truck.userData.wheelPos);
//   truck.userData.setLights({ brake: true });
//   truck.userData.dispose();
//
// Frame: +Z forward, +Y up, +X = vehicle LEFT. Wheels 0 FL, 1 FR, 2 RL, 3 RR.
// Suggested Rapier setup: chassis cuboid(1.0, 0.42, 2.6) at (0, 0.2, 0); wheels at
// PICKUP_DEFAULTS.wheelPos, radius 0.44, suspension rest 0.40, axle (-1,0,0).
import {
  Group, Object3D, Mesh, Shape, ExtrudeGeometry, BoxGeometry, BufferGeometry, Float32BufferAttribute,
  MeshPhysicalMaterial, MeshStandardMaterial, Color, Vector3, DataTexture, RGBAFormat, RepeatWrapping,
  LinearFilter, LinearMipmapLinearFilter, CylinderGeometry, TorusGeometry, Path,
} from 'three';
import { createWheel, createWheelMaterials, createCaliper } from '../custom/wheels.js';

export const PICKUP_NAME = 'VOLT Ferrox';
export const PICKUP_DEFAULTS = {
  quality: 'ultra',
  steel: 0xb5b6b8,
  accent: 0x2ee6ff,
  caliper: 0xff5a1f,
  rim: 0x1b1d21,
  wheelDesign: 'offroad',
  wheelRadius: 0.44,
  wheelWidth: 0.34,
  wheelPos: [[0.9, -0.02, 1.75], [-0.9, -0.02, 1.75], [0.9, -0.02, -1.75], [-0.9, -0.02, -1.75]],
  restLength: 0.40,
  groundY: -0.86,          // wheelPos.y - restLength - wheelRadius
  halfWidth: 1.02,
  castShadow: true,
  roofLightBar: null,      // null = auto (ultra/high)
};
const Q = {
  // aniso stays off: three's anisotropic BRDF here relies on a derivative-built tangent frame (ExtrudeGeometry has no
  // tangents), which on the flat side caps bent the reflection vector into the wrong env region -> streaky blue flanks.
  // The fine horizontal grain now comes from the roughness map alone, which reads the same on every panel.
  ultra: { physical: true, aniso: false, brushed: true, details: 2 },
  high: { physical: true, aniso: false, brushed: true, details: 2 },
  medium: { physical: true, aniso: false, brushed: false, details: 1 },
  low: { physical: false, aniso: false, brushed: false, details: 0 },
};

function brushedTexture() {
  // Fine, uniform brushing grain along U (= vehicle length on every panel, see profileSolid UVs).
  // Neutral grey, narrow value range (0.86..1.0) so it only modulates roughness subtly; no low-frequency
  // waves (those read as wood grain) and no bump use (per-row normal noise produced streaky grazing highlights).
  const W = 512, H = 512, d = new Uint8Array(W * H * 4);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = new Float32Array(H); for (let y = 0; y < H; y++) rows[y] = rnd();
  for (let y = 0; y < H; y++) {
    const r = 0.6 * rows[y] + 0.4 * (rows[(y + 1) % H] + rows[(y + H - 1) % H]) * 0.5;
    for (let x = 0; x < W; x++) {
      const v = 0.86 + 0.11 * r + (rnd() - 0.5) * 0.03;
      const c = Math.max(0, Math.min(255, v * 255));
      const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
    }
  }
  const t = new DataTexture(d, W, H, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8; t.repeat.set(0.5, 4); t.needsUpdate = true;   // long streaks along U, ~0.5 mm rows across V
  return t;
}

// extrude a side profile [(z,y)...] symmetrically across X with a single-segment chamfer
function profileSolid(pts, halfWidth, chamfer, holes = []) {
  const sh = new Shape(pts.map(([z, y]) => ({ x: z, y })));
  for (const h of holes) sh.holes.push(new Path(h.map(([z, y]) => ({ x: z, y }))));
  const bt = chamfer * 1.1;
  const g = new ExtrudeGeometry(sh, { depth: 2 * (halfWidth - bt), bevelEnabled: chamfer > 0, bevelThickness: bt, bevelSize: chamfer, bevelOffset: -chamfer, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);                 // shape x -> +Z, extrude -> -X
  g.translate(halfWidth - bt, 0, 0);       // centre across X
  return g;
}

function quad(a, b, c, d) { // 4 Vector3 (CCW from outside)
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d].flatMap(v => (v.isVector3 ? [v.x, v.y, v.z] : v)), 3));
  g.computeVertexNormals(); return g;
}
function polyX(pts, x, flip) { // flat polygon in the YZ plane at given x
  const sh = new Shape(pts.map(([z, y]) => ({ x: z, y })));
  const g = new ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(x + (flip ? 0.004 : 0), 0, 0); return g;
}

const hexArch = (wz, grow = 0) => [[wz + 0.62 + grow, 0.40], [wz + 0.52 + grow, 0.80 + grow * 0.6], [wz + 0.26 + grow * 0.6, 0.98 + grow], [wz - 0.26 - grow * 0.6, 0.98 + grow], [wz - 0.52 - grow, 0.80 + grow * 0.6], [wz - 0.62 - grow, 0.40]];

export function createPickup(options = {}) {
  const o = { ...PICKUP_DEFAULTS, ...options };
  const q = Q[o.quality] || Q.high;
  const disposables = new Set(); const track = (x) => { disposables.add(x); return x; };
  const P = q.physical ? MeshPhysicalMaterial : MeshStandardMaterial;

  const brushed = q.brushed ? track(brushedTexture()) : null;
  const steel = track(new P({
    color: o.steel, metalness: 1, roughness: 0.5, envMapIntensity: 1.0,
    roughnessMap: brushed,
    ...(q.aniso ? { anisotropy: 0.45, anisotropyRotation: 0 } : {}),
    ...(q.physical ? { clearcoat: 0.0 } : {}),
  }));
  steel.name = 'FerroxStainless';
  const glass = track(new P({ color: 0x06080b, metalness: 0, roughness: 0.08, envMapIntensity: 1.0, ...(q.physical ? { clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 0.6 } : {}) }));
  const plastic = track(new MeshStandardMaterial({ color: 0x17181b, roughness: 0.72, metalness: 0.05 }));
  const graphite = track(new P({ color: 0x23262b, roughness: 0.5, metalness: 0.4 }));
  const seam = track(new MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }));
  const head = track(new MeshStandardMaterial({ color: 0xffffff, emissive: new Color(0xe6f7ff), emissiveIntensity: 4.5 }));
  const tail = track(new MeshStandardMaterial({ color: 0x300000, emissive: new Color(0xff1a2a), emissiveIntensity: 3 }));
  const accentGlow = track(new MeshStandardMaterial({ color: 0x111111, emissive: new Color(o.accent), emissiveIntensity: 6 }));
  const tow = track(new MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.4, metalness: 0.3 }));
  const wheelMats = track(createWheelMaterials({ quality: o.quality, rim: o.rim, accent: o.accent, caliper: o.caliper }));

  const root = new Group(); root.name = 'VoltFerroxPickup';
  const body = new Group(); body.name = 'body'; body.position.y = o.groundY; root.add(body);
  const add = (geo, mat, name, parent = body) => { track(geo); const m = new Mesh(geo, mat); m.name = name; m.castShadow = o.castShadow; m.receiveShadow = true; parent.add(m); return m; };
  const HW = o.halfWidth, fz = o.wheelPos[0][2], rz = o.wheelPos[2][2];

  // ---- lower body (hood + doors + bed sides) ----
  // continuous outline: front bumper -> front arch -> rocker -> rear arch -> tailgate -> bed rail -> hood -> nose
  const outline = [[2.55, 0.46], ...hexArch(fz), [-1.13, 0.42], ...hexArch(rz), [-2.6, 0.46], [-2.72, 0.62], [-2.72, 1.16], [-2.62, 1.24], [-0.95, 1.24], [1.45, 1.2], [2.62, 1.06], [2.72, 0.8]];
  add(profileSolid(outline, HW, 0.06), steel, 'lowerBody');
  // inner wheel tubs (hide the see-through arches)
  for (const wz of [fz, rz]) { const t = add(new BoxGeometry(HW * 2 - 0.5, 0.62, 1.2), plastic, 'wheelTub'); t.position.set(0, 0.72, wz); }

  // ---- cab (narrower => shoulder ledge) ----
  const cabHW = 0.86;
  const cab = [[1.4, 1.18], [0.45, 1.92], [-0.55, 1.95], [-0.86, 1.7], [-0.93, 1.18]];
  add(profileSolid(cab, cabHW, 0.07), steel, 'cab');
  // glass: windshield, rear window, side windows
  const nWs = new Vector3(0, 0.95, 0.74).normalize().multiplyScalar(0.012);
  const ws = (t, x) => new Vector3(x, 1.18 + (1.92 - 1.18) * t, 1.4 + (0.45 - 1.4) * t).add(nWs);
  add(quad(ws(0.08, -0.78), ws(0.08, 0.78), ws(0.94, 0.74), ws(0.94, -0.74)), glass, 'windshield');
  const nR = new Vector3(0, 0.13, -0.99).normalize().multiplyScalar(0.012);
  const rw = (t, x) => new Vector3(x, 1.18 + (1.7 - 1.18) * t, -0.93 + (-0.86 + 0.93) * t).add(nR);
  add(quad(rw(0.25, 0.62), rw(0.25, -0.62), rw(0.9, -0.6), rw(0.9, 0.6)), glass, 'rearWindow');
  const sideWin = [[1.22, 1.3], [0.5, 1.84], [-0.5, 1.87], [-0.76, 1.66], [-0.82, 1.3]];
  for (const sg of [1, -1]) {
    add(polyX(sideWin, sg * (cabHW + 0.001) - (sg < 0 ? 0.004 : 0)), glass, 'sideWindow');
    const bp = add(new BoxGeometry(0.012, 0.6, 0.09), steel, 'bPillar'); bp.position.set(sg * (cabHW + 0.006), 1.57, 0.18);
  }

  // ---- bed: rail caps + slatted tonneau ----
  for (const sg of [1, -1]) { const r = add(new BoxGeometry(0.12, 0.05, 1.72), graphite, 'bedRail'); r.position.set(sg * (HW - 0.08), 1.265, -1.8); }
  if (q.details >= 1) {
    const n = q.details >= 2 ? 12 : 6, len = 1.62, w = len / n;
    const slat = track(new BoxGeometry(HW * 2 - 0.3, 0.025, w - 0.012));
    for (let i = 0; i < n; i++) { const s = new Mesh(slat, graphite); s.position.set(0, 1.255, -0.98 - w / 2 - i * w); s.receiveShadow = true; s.name = 'tonneauSlat'; body.add(s); }
  } else { const t = add(new BoxGeometry(HW * 2 - 0.3, 0.025, 1.62), graphite, 'tonneau'); t.position.set(0, 1.255, -1.79); }

  // ---- fender flares (hex bands) ----
  for (const wz of [fz, rz]) for (const sg of [1, -1]) {
    const outer = hexArch(wz, 0.09), inner = hexArch(wz, 0.0);
    const band = [...outer, ...inner.slice().reverse()];
    const g = profileSolid(band, 0.045, 0.0); g.translate(sg * (HW + 0.02), 0, 0);
    add(g, plastic, 'fenderFlare');
  }

  // ---- lights ----
  const faceA = Math.atan2(2.72 - 2.62, 1.06 - 0.8); // nose face lean
  const bar = add(new BoxGeometry(HW * 1.86, 0.032, 0.02), head, 'frontLightBar'); bar.position.set(0, 0.97, 2.715); bar.rotation.x = -faceA;
  const tbar = add(new BoxGeometry(HW * 1.86, 0.035, 0.02), tail, 'tailLightBar'); tbar.position.set(0, 1.12, -2.735);
  const roofBar = o.roofLightBar ?? q.details >= 2;
  if (roofBar) {
    const rb = add(new BoxGeometry(1.3, 0.05, 0.07), graphite, 'roofBar'); rb.position.set(0, 1.97, 0.42);
    const pod = track(new BoxGeometry(0.11, 0.03, 0.012));
    for (let i = 0; i < 8; i++) { const p = new Mesh(pod, head); p.position.set(-0.56 + i * 0.16, 1.97, 0.457); p.name = 'roofLed'; body.add(p); }
  }
  // accent: thin cyan strip under the light bar (brand cue)
  const acc = add(new BoxGeometry(HW * 1.2, 0.01, 0.01), accentGlow, 'accentStrip'); acc.position.set(0, 0.9, 2.735); acc.rotation.x = -faceA;

  // ---- bumpers, skid plates, steps, mirrors, seams ----
  const skidF = add(new BoxGeometry(1.7, 0.16, 0.34), plastic, 'skidFront'); skidF.position.set(0, 0.48, 2.55); skidF.rotation.x = 0.25;
  const skidR = add(new BoxGeometry(1.8, 0.16, 0.25), plastic, 'bumperRear'); skidR.position.set(0, 0.52, -2.66);
  if (q.details >= 1) {
    for (const sg of [1, -1]) {
      const hk = add(new TorusGeometry(0.05, 0.016, 6, 12), tow, 'towHook'); hk.position.set(sg * 0.55, 0.5, 2.74);
      const step = add(new BoxGeometry(0.16, 0.05, 2.0), plastic, 'sideStep'); step.position.set(sg * (HW - 0.02), 0.4, 0);
      const mir = add(new BoxGeometry(0.2, 0.12, 0.07), steel, 'mirror'); mir.position.set(sg * (cabHW + 0.13), 1.36, 1.22); mir.rotation.y = sg * 0.15;
      for (const z of [1.12, 0.16, -0.94]) { const s = add(new BoxGeometry(0.004, 0.66, 0.006), seam, 'seam'); s.position.set(sg * (HW + 0.001), 0.82, z); }
    }
  }

  // ---- wheels ----
  const names = ['FL', 'FR', 'RL', 'RR'], wheels = [];
  o.wheelPos.forEach((p, i) => {
    const side = Math.sign(p[0]) || 1, front = i < 2;
    const pivot = new Object3D(); pivot.name = 'wheel_' + names[i];
    pivot.position.set(p[0], p[1] - o.restLength, p[2]);
    const spin = new Object3D(); spin.name = 'wheel_' + names[i] + '_spin';
    const vis = createWheel({ design: o.wheelDesign, radius: o.wheelRadius, width: o.wheelWidth, side, quality: o.quality, mats: wheelMats });
    spin.add(vis.object); pivot.add(spin);
    const cal = createCaliper({ discX: vis.discX, discR: vis.discR, side, front, quality: o.quality, material: wheelMats.caliper });
    track(cal.geometry); cal.name = 'caliper_' + names[i]; pivot.add(cal);
    root.add(pivot);
    wheels.push({ name: names[i], pivot, spin, caliper: cal, visual: vis, side, front, width: o.wheelWidth, radius: o.wheelRadius, restY: pivot.position.y });
  });

  const gy = o.groundY, state = { head: true, brake: false };
  const mats = { steel, paint: steel, glass, plastic, graphite, head, tail, accentGlow, wheel: wheelMats };
  Object.assign(root.userData, {
    kind: 'pickup', name: PICKUP_NAME, quality: o.quality, wheels, materials: mats, wheelPos: o.wheelPos,
    paintMaterials: [steel], wheelMaterials: wheelMats,
    mounts: {
      spoiler: { position: new Vector3(0, gy + 1.27, -2.62), width: 1.9, deckY: gy + 1.24 },
      boost: [new Vector3(0.62, gy + 0.6, -2.8), new Vector3(-0.62, gy + 0.6, -2.8)],
      underglow: { y: gy + 0.03, width: 2.0, length: 5.0 },
      thrusters: [
        new Vector3(HW - 0.05, gy + 1.18, 2.5), new Vector3(-HW + 0.05, gy + 1.18, 2.5),
        new Vector3(HW - 0.05, gy + 1.2, -2.62), new Vector3(-HW + 0.05, gy + 1.2, -2.62),
        new Vector3(HW - 0.05, gy + 0.5, 2.45), new Vector3(-HW + 0.05, gy + 0.5, 2.45),
        new Vector3(HW - 0.05, gy + 0.5, -2.55), new Vector3(-HW + 0.05, gy + 0.5, -2.55),
        new Vector3(0, gy + 1.98, -0.2), new Vector3(0, gy + 0.4, 0),
      ],
    },
    setPaint(hex) { steel.color.set(hex); },
    setLights({ head: h = state.head, brake = state.brake } = {}) { state.head = h; state.brake = brake; head.emissiveIntensity = h ? 4.5 : 0.3; tail.emissiveIntensity = brake ? 12 : 3; },
    setBrakeHeat(t) { const k = Math.min(1, Math.max(0, t)); wheelMats.disc.emissiveIntensity = k * k * 4; },
    setSteer(a) { wheels[0].pivot.rotation.y = a; wheels[1].pivot.rotation.y = a; },
    spinWheels(d) { for (const w of wheels) w.spin.rotation.x += d; },
    dispose() {
      root.userData.custom?.dispose?.();
      for (const w of wheels) w.visual.dispose();
      root.removeFromParent();
      for (const d of disposables) d.dispose?.();
      disposables.clear();
    },
  });
  return root;
}

// Identical contract to syncHypercarWheels.
export function syncPickupWheels(truck, vc, wheelPos = PICKUP_DEFAULTS.wheelPos, spinSign = 1) {
  const wheels = truck.userData.wheels;
  for (let i = 0; i < wheels.length; i++) {
    const w = wheels[i], p = wheelPos[i];
    const len = vc.wheelSuspensionLength(i);
    w.pivot.position.set(p[0], p[1] - (len ?? PICKUP_DEFAULTS.restLength), p[2]);
    w.pivot.rotation.y = vc.wheelSteering(i) ?? 0;
    w.spin.rotation.x = spinSign * (vc.wheelRotation(i) ?? 0);
  }
}
