// Volt Roadster - original humanoid helper robot ("VOLT-B"), procedural, no textures.
// Original design: rounded white shell panels, graphite joints, black glass face visor
// with a cyan LED eye bar and a chest power ring. Not a copy of any real product.
//
//   import { createHelperRobot, createRobotIdle } from './art/robot/createHelperRobot.js';
//   const bot = createHelperRobot({ quality: 'high', accent: 0x2ee6ff });
//   scene.add(bot);
//   const idle = createRobotIdle(bot, { seed: 3 });
//   // per frame: idle.update(dt);  idle.setWave(true) to wave at the player
//   bot.userData.joints.head.rotation.y = 0.4;   // drive any joint directly
//   bot.userData.dispose();
//
// Origin at the feet, facing +Z, ~1.78 m tall.
// Joints (Object3D, rotate them): hips, spine, chest, neck, head,
//   shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R  (object names: joint_<name>)
import {
  Group, Object3D, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Color,
  SphereGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, BoxGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const ROBOT_DEFAULTS = {
  quality: 'high',          // 'ultra' | 'high' | 'medium' | 'low'
  shell: 0xeef1f5,
  joint: 0x1f2227,
  accent: 0x2ee6ff,
  scale: 1,
  castShadow: true,
};

const Q = {
  ultra: { seg: 24, rb: 4, fingers: true, physical: true },
  high: { seg: 18, rb: 3, fingers: true, physical: true },
  medium: { seg: 12, rb: 2, fingers: false, physical: true },
  low: { seg: 8, rb: 1, fingers: false, physical: false },
};

export function createHelperRobot(options = {}) {
  const o = { ...ROBOT_DEFAULTS, ...options };
  const q = Q[o.quality] || Q.high;
  const geos = new Set(), matsSet = new Set();
  const G = (g) => { geos.add(g); return g; };
  const M = (m) => { matsSet.add(m); return m; };
  const Phys = q.physical ? MeshPhysicalMaterial : MeshStandardMaterial;

  const shell = M(new Phys({ color: o.shell, roughness: 0.28, metalness: 0.0, ...(q.physical ? { clearcoat: 0.8, clearcoatRoughness: 0.12 } : {}) }));
  const joint = M(new MeshStandardMaterial({ color: o.joint, roughness: 0.38, metalness: 0.85 }));
  const rubber = M(new MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 }));
  const visor = M(new Phys({ color: 0x020305, roughness: 0.04, metalness: 0.1, ...(q.physical ? { clearcoat: 1, clearcoatRoughness: 0 } : {}) }));
  const glow = M(new MeshStandardMaterial({ color: 0x050505, emissive: new Color(o.accent), emissiveIntensity: 4 }));

  const root = new Group(); root.name = 'VoltHelperRobot'; root.scale.setScalar(o.scale);
  const joints = {};
  const J = (name, parent, x, y, z) => { const j = new Object3D(); j.name = 'joint_' + name; j.position.set(x, y, z); parent.add(j); joints[name] = j; return j; };
  const part = (geo, mat, parent, x = 0, y = 0, z = 0, name) => {
    const m = new Mesh(G(geo), mat); m.position.set(x, y, z); m.castShadow = o.castShadow; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m;
  };
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, q.rb, r);
  const cap = (r, len) => new CapsuleGeometry(r, len, Math.max(2, q.seg / 4), q.seg);
  const ball = (r) => new SphereGeometry(r, q.seg, Math.max(6, q.seg / 2));

  // pelvis / torso
  const hips = J('hips', root, 0, 0.98, 0);
  part(rbox(0.34, 0.16, 0.21, 0.06), shell, hips, 0, -0.01, 0, 'pelvis');
  const spine = J('spine', hips, 0, 0.08, 0);
  part(cap(0.105, 0.1), joint, spine, 0, 0.07, 0, 'abdomen');
  for (let i = 0; i < 3; i++) part(new TorusGeometry(0.108, 0.012, 6, q.seg * 2).rotateX(Math.PI / 2), rubber, spine, 0, 0.02 + i * 0.05, 0);
  const chest = J('chest', spine, 0, 0.17, 0);
  part(rbox(0.44, 0.38, 0.25, 0.09), shell, chest, 0, 0.2, 0, 'torso');
  part(rbox(0.3, 0.16, 0.05, 0.03), visor, chest, 0, 0.23, 0.12, 'chestPanel');
  part(new TorusGeometry(0.038, 0.007, 8, q.seg * 2), glow, chest, 0, 0.23, 0.148, 'powerRing');
  part(rbox(0.3, 0.12, 0.08, 0.035), shell, chest, 0, 0.18, -0.15, 'backpack');
  part(new BoxGeometry(0.2, 0.012, 0.012), glow, chest, 0, 0.21, -0.192, 'backLed');
  // neck / head
  const neck = J('neck', chest, 0, 0.41, 0);
  part(new CylinderGeometry(0.045, 0.055, 0.08, q.seg), joint, neck, 0, 0.03, 0, 'neckTube');
  const head = J('head', neck, 0, 0.08, 0);
  part(rbox(0.2, 0.24, 0.22, 0.08), shell, head, 0, 0.11, 0, 'skull');
  part(rbox(0.185, 0.13, 0.06, 0.05), visor, head, 0, 0.115, 0.085, 'faceVisor');
  part(rbox(0.12, 0.018, 0.012, 0.008), glow, head, 0, 0.13, 0.117, 'eyeBar');
  for (const s of [1, -1]) part(new CylinderGeometry(0.035, 0.035, 0.02, q.seg).rotateZ(Math.PI / 2), joint, head, s * 0.105, 0.11, 0, 'ear');

  // arms
  for (const [S, sx] of [['L', 1], ['R', -1]]) {
    const sh = J('shoulder' + S, chest, sx * 0.265, 0.33, 0);
    part(ball(0.075), joint, sh, 0, 0, 0);
    part(rbox(0.13, 0.1, 0.15, 0.045), shell, sh, sx * 0.015, 0.03, 0, 'shoulderPad');
    part(cap(0.055, 0.17), shell, sh, 0, -0.16, 0, 'upperArm');
    const el = J('elbow' + S, sh, 0, -0.3, 0);
    part(ball(0.05), joint, el, 0, 0, 0);
    part(cap(0.048, 0.16), shell, el, 0, -0.13, 0, 'forearm');
    part(new TorusGeometry(0.05, 0.006, 6, q.seg * 2).rotateX(Math.PI / 2), glow, el, 0, -0.22, 0, 'wristLed');
    const wr = J('wrist' + S, el, 0, -0.27, 0);
    part(rbox(0.045, 0.09, 0.08, 0.02), joint, wr, 0, -0.05, 0, 'palm');
    if (q.fingers) {
      for (let f = 0; f < 3; f++) part(rbox(0.018, 0.06, 0.018, 0.008), joint, wr, 0, -0.12, -0.025 + f * 0.025, 'finger');
      part(rbox(0.018, 0.045, 0.018, 0.008), joint, wr, 0, -0.06, 0.05, 'thumb');
    }
  }
  // legs
  for (const [S, sx] of [['L', 1], ['R', -1]]) {
    const hp = J('hip' + S, hips, sx * 0.11, -0.06, 0);
    part(ball(0.07), joint, hp, 0, 0, 0);
    part(cap(0.072, 0.24), shell, hp, 0, -0.21, 0, 'thigh');
    const kn = J('knee' + S, hp, 0, -0.43, 0);
    part(ball(0.058), joint, kn, 0, 0, 0);
    part(rbox(0.09, 0.08, 0.06, 0.025), shell, kn, 0, 0.0, 0.05, 'kneeCap');
    part(cap(0.06, 0.26), shell, kn, 0, -0.2, 0, 'shin');
    const an = J('ankle' + S, kn, 0, -0.42, 0);
    part(ball(0.042), joint, an, 0, 0, 0);
    part(rbox(0.11, 0.07, 0.25, 0.03), shell, an, 0, -0.035, 0.04, 'foot');
    part(rbox(0.112, 0.02, 0.252, 0.01), rubber, an, 0, -0.06, 0.04, 'sole');
  }
  // neutral rest pose
  joints.shoulderL.rotation.z = 0.09; joints.shoulderR.rotation.z = -0.09;
  joints.elbowL.rotation.x = -0.18; joints.elbowR.rotation.x = -0.18;

  root.userData.joints = joints;
  root.userData.materials = { shell, joint, rubber, visor, glow };
  root.userData.setAccent = (hex) => glow.emissive.set(hex);
  root.userData.dispose = () => { root.removeFromParent(); geos.forEach(g => g.dispose()); matsSet.forEach(m => m.dispose()); geos.clear(); matsSet.clear(); };
  return root;
}

// Lightweight procedural idle: breathing, weight shift, head look-around, arm sway,
// LED blink. Optional wave gesture. Call update(dt) each frame.
export function createRobotIdle(robot, { seed = 1, intensity = 1 } = {}) {
  const j = robot.userData.joints, glow = robot.userData.materials.glow;
  const base = {}; for (const k in j) base[k] = { r: j[k].rotation.clone(), p: j[k].position.clone() };
  let t = seed * 13.37, wave = 0, waveTarget = 0, blink = 0;
  const n = (f, ph) => Math.sin(t * f + ph + seed) * 0.6 + Math.sin(t * f * 2.31 + ph * 1.7 + seed * 2) * 0.4;
  return {
    setWave(on) { waveTarget = on ? 1 : 0; },
    update(dt) {
      t += dt; wave += (waveTarget - wave) * Math.min(1, dt * 5);
      const k = intensity, br = Math.sin(t * 1.6);
      const R = (name) => { j[name].rotation.copy(base[name].r); return j[name].rotation; };
      j.hips.position.y = base.hips.p.y - 0.006 * k * (0.5 + 0.5 * Math.sin(t * 0.9));
      R('hips').z = 0.025 * k * Math.sin(t * 0.45);
      R('spine').z = -0.02 * k * Math.sin(t * 0.45);
      R('chest').x = -0.025 * k * br;
      const look = R('head'); look.y = 0.45 * k * n(0.23, 0); look.x = 0.08 * k * n(0.31, 2);
      R('neck').y = look.y * 0.3;
      R('shoulderL').z += 0.03 * k * br; R('shoulderL').x = 0.05 * k * n(0.4, 1);
      R('shoulderR').z -= 0.03 * k * br; R('shoulderR').x = 0.05 * k * n(0.4, 3);
      R('elbowL'); R('elbowR'); R('wristL'); R('wristR');
      R('hipL').z = -0.025 * k * Math.sin(t * 0.45); R('hipR').z = -0.025 * k * Math.sin(t * 0.45);
      R('kneeL').x = 0.04 * k * (0.5 + 0.5 * Math.sin(t * 0.45)); R('kneeR').x = 0.04 * k * (0.5 - 0.5 * Math.sin(t * 0.45));
      R('ankleL'); R('ankleR');
      if (wave > 0.001) { // right arm wave
        j.shoulderR.rotation.z = -0.09 - 2.5 * wave;
        j.elbowR.rotation.z = -0.4 * wave * (1 + 0.5 * Math.sin(t * 9));
        j.elbowR.rotation.x = -0.18 * (1 - wave);
        look.y = look.y * (1 - wave);
      }
      // LED blink every ~4 s
      blink = (t % 4.1) < 0.12 ? 0.15 : 1;
      glow.emissiveIntensity = 4 * blink * (0.85 + 0.15 * Math.sin(t * 3));
    },
    reset() { for (const k in j) { j[k].rotation.copy(base[k].r); j[k].position.copy(base[k].p); } },
  };
}
