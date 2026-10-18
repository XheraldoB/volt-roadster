// Cold-gas RCS thrusters: nozzle clusters on the vehicle (corners, roof, belly) and short
// white puffs of expanding gas. One InstancedMesh for blocks, one for nozzles, one Points
// pool for all puffs (budget per quality). Works on the pickup, the hypercar or any Group.
//
//   import { createColdGasThrusters } from './art/fx/coldGasThrusters.js';
//   const rcs = createColdGasThrusters(truck, { quality: 'ultra', scene });
//   rcs.fire(new THREE.Vector3(1, 0, 0), 1);   // thrust direction in VEHICLE frame (gas exits opposite)
//   rcs.hover(0.8);                            // call every frame while hovering (belly + lower jets)
//   rcs.update(dt);                            // every frame
//   rcs.dispose();
// fire(dir, strength, duration = 0.12): one-shot puff (re-call each frame for continuous thrust).
import {
  Group, InstancedMesh, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Object3D, Vector3, Quaternion, Matrix4,
  BufferGeometry, BufferAttribute, DynamicDrawUsage, Points, ShaderMaterial, NormalBlending, Color, Vector2,
} from 'three';

export const THRUSTER_BUDGET = { ultra: 1600, high: 1000, medium: 500, low: 160 };

const VS = `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(aSize * uScale / -mv.z, 0., 256.); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform vec3 uColor; varying float vA;
void main(){ vec2 c = gl_PointCoord * 2. - 1.; float r = dot(c, c); if (r > 1.) discard;
  float soft = (1. - r) * (1. - r); gl_FragColor = vec4(uColor, vA * soft);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function defaultMounts(target) {
  const m = target.userData?.mounts?.thrusters;
  if (m) return m;
  // fallback: bounding-box corners + top + bottom (vehicle frame)
  const pts = []; target.updateMatrixWorld(true);
  const inv = new Matrix4().copy(target.matrixWorld).invert(); const box = { min: new Vector3(1e9, 1e9, 1e9), max: new Vector3(-1e9, -1e9, -1e9) };
  const v = new Vector3();
  target.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { v.set(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv); box.min.min(v); box.max.max(v); } } });
  const { min, max } = box, cy = (min.y + max.y) / 2;
  for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) pts.push(new Vector3(x * 0.95, cy, z * 0.95));
  pts.push(new Vector3(0, max.y, 0), new Vector3(0, min.y + 0.1, 0));
  return pts;
}

export function createColdGasThrusters(target, opts = {}) {
  const quality = opts.quality || target.userData?.quality || 'high';
  const budget = opts.budget ?? THRUSTER_BUDGET[quality] ?? 1000;
  const mounts = opts.mounts || defaultMounts(target);
  const showNozzles = opts.showNozzles ?? true;
  const group = new Group(); group.name = 'rcsClusters'; target.add(group);

  // ---- nozzle layout ----
  const ys = mounts.map(p => p.y), midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const nozzles = []; // { pos: Vector3 (vehicle frame), dir: Vector3 outward }
  for (const p of mounts) {
    const dirs = [];
    if (Math.abs(p.x) > 0.3) dirs.push(new Vector3(Math.sign(p.x), 0, 0));
    if (Math.abs(p.z) > 0.6) dirs.push(new Vector3(0, 0, Math.sign(p.z)));
    dirs.push(new Vector3(0, p.y >= midY ? 1 : -1, 0));
    for (const d of dirs) nozzles.push({ pos: p.clone().addScaledVector(d, 0.07), dir: d, cluster: p });
  }
  const s = opts.nozzleScale ?? 1;
  const blockGeo = new BoxGeometry(0.11 * s, 0.09 * s, 0.11 * s), nozGeo = new CylinderGeometry(0.014 * s, 0.032 * s, 0.06 * s, 10, 1, true);
  const blockMat = new MeshStandardMaterial({ color: 0x24272c, metalness: 0.7, roughness: 0.4 });
  const nozMat = new MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.25, side: 2 });
  let blocks = null, noz = null;
  if (showNozzles) {
    blocks = new InstancedMesh(blockGeo, blockMat, mounts.length); noz = new InstancedMesh(nozGeo, nozMat, nozzles.length);
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), one = new Vector3(1, 1, 1);
    mounts.forEach((p, i) => blocks.setMatrixAt(i, m.compose(p, q.identity(), one)));
    nozzles.forEach((n, i) => noz.setMatrixAt(i, m.compose(n.pos, q.setFromUnitVectors(up, n.dir), one)));
    blocks.castShadow = noz.castShadow = true;
    group.add(blocks, noz);
  }

  // ---- particle pool (world space) ----
  const pos = new Float32Array(budget * 3), vel = new Float32Array(budget * 3), size = new Float32Array(budget), alpha = new Float32Array(budget);
  const life = new Float32Array(budget), maxLife = new Float32Array(budget), grow = new Float32Array(budget);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
  geo.setAttribute('aSize', new BufferAttribute(size, 1).setUsage(DynamicDrawUsage));
  geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1).setUsage(DynamicDrawUsage));
  const mat = new ShaderMaterial({ uniforms: { uColor: { value: new Color(opts.color ?? 0xf2f6ff) }, uScale: { value: 800 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: NormalBlending });
  const points = new Points(geo, mat); points.frustumCulled = false; points.name = 'rcsPuffs'; points.renderOrder = 4;
  const tmpV2 = new Vector2();
  points.onBeforeRender = (renderer, scene, camera) => { const h = renderer.getDrawingBufferSize(tmpV2).y; mat.uniforms.uScale.value = camera.isPerspectiveCamera ? h / (2 * Math.tan((camera.fov * Math.PI) / 360)) : h; };
  let attached = false;
  const attach = () => { if (attached) return; let root = opts.scene || target; while (!opts.scene && root.parent) root = root.parent; root.add(points); attached = true; };
  if (opts.scene) attach();

  let head = 0, alive = 0;
  const commands = []; // { dir, strength, t }
  const acc = new Float32Array(nozzles.length);
  const wq = new Quaternion(), wp = new Vector3(), wd = new Vector3(), lastPos = new Vector3(), vVel = new Vector3(); let hasLast = false;
  const rnd = () => Math.random() - 0.5;

  function emit(n, strength) {
    const i = head; head = (head + 1) % budget;
    wp.copy(n.pos).applyMatrix4(target.matrixWorld);
    wd.copy(n.dir).applyQuaternion(wq);
    const sp = (12 + Math.random() * 8) * (0.5 + 0.5 * strength);
    pos[i * 3] = wp.x; pos[i * 3 + 1] = wp.y; pos[i * 3 + 2] = wp.z;
    vel[i * 3] = wd.x * sp + rnd() * 3 + vVel.x; vel[i * 3 + 1] = wd.y * sp + rnd() * 3 + vVel.y; vel[i * 3 + 2] = wd.z * sp + rnd() * 3 + vVel.z;
    maxLife[i] = 0.28 + Math.random() * 0.3; life[i] = maxLife[i];
    size[i] = 0.06; grow[i] = 1.6 + Math.random() * 1.6;
  }

  const api = {
    group, points, nozzles, budget,
    get activeCount() { return alive; },
    fire(dir, strength = 1, duration = 0.12) { const d = dir.clone(); if (d.lengthSq() < 1e-8) return; commands.push({ dir: d.normalize(), strength: Math.max(0, Math.min(2, strength)), t: duration }); },
    hover(strength = 1) { commands.push({ dir: new Vector3(0, 1, 0), strength: Math.max(0, Math.min(2, strength)), t: 0 }); },
    update(dt) {
      if (dt <= 0) return; attach();
      target.updateMatrixWorld(); target.getWorldQuaternion(wq);
      const cur = new Vector3().setFromMatrixPosition(target.matrixWorld);
      if (hasLast) vVel.subVectors(cur, lastPos).divideScalar(dt).multiplyScalar(0.9); lastPos.copy(cur); hasLast = true;
      // emit from nozzles facing away from the commanded thrust
      for (let c = commands.length - 1; c >= 0; c--) {
        const cmd = commands[c];
        for (let k = 0; k < nozzles.length; k++) {
          const w = -nozzles[k].dir.dot(cmd.dir); if (w < 0.35) continue;
          acc[k] += dt * 260 * cmd.strength * w * (budget / 1000);
          while (acc[k] >= 1) { acc[k] -= 1; emit(nozzles[k], cmd.strength); }
        }
        cmd.t -= dt; if (cmd.t <= 0) commands.splice(c, 1);
      }
      // integrate: fast exit, strong drag (rapid expansion), fade
      const drag = Math.exp(-7 * dt); alive = 0;
      for (let i = 0; i < budget; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        life[i] -= dt; alive++;
        const t = 1 - Math.max(0, life[i]) / maxLife[i];
        vel[i * 3] *= drag; vel[i * 3 + 1] = vel[i * 3 + 1] * drag; vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        size[i] += grow[i] * dt;
        alpha[i] = 0.75 * Math.pow(1 - t, 1.6) * Math.min(1, t * 12 + 0.3);
      }
      geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
    },
    dispose() { group.removeFromParent(); points.removeFromParent(); blockGeo.dispose(); nozGeo.dispose(); blockMat.dispose(); nozMat.dispose(); geo.dispose(); mat.dispose(); blocks?.dispose(); noz?.dispose(); },
  };
  return api;
}
export const create = createColdGasThrusters; // alias matching the requested create(truckOrGroup, opts) signature
