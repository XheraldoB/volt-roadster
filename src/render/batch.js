// Draw-call reduction: bake static sub-meshes of a prop/vehicle into one mesh per material,
// and render many copies of a prop as InstancedMeshes (one per material).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
function norm(g) { // same attribute set for merging: position + normal + uv, non-indexed
  let o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') o.deleteAttribute(k);
  if (!o.attributes.normal) o.computeVertexNormals();
  if (!o.attributes.uv) o.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(o.attributes.position.count * 2), 2));
  o.morphAttributes = {}; o.clearGroups(); return o;
}
const mergeable = o => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.geometry && o.geometry.attributes.position && !o.morphTargetInfluences;

// Collect the meshes under root that are not inside a kept subtree, grouped by material, as geometries in root space.
function collect(root, keep) {
  root.updateMatrixWorld(true); _inv.copy(root.matrixWorld).invert();
  const byMat = new Map(); const victims = [];
  const walk = o => { if (keep.has(o)) return; if (o !== root && mergeable(o) && o.visible) { _m.multiplyMatrices(_inv, o.matrixWorld); const g = norm(o.geometry); g.applyMatrix4(_m);
      let e = byMat.get(o.material); if (!e) byMat.set(o.material, e = { geos: [], cast: false, recv: false, order: o.renderOrder }); e.geos.push(g); e.cast ||= o.castShadow; e.recv ||= o.receiveShadow; victims.push(o); }
    for (const c of o.children.slice()) walk(c); };
  walk(root); return { byMat, victims };
}

/** Merge the static meshes of `root` (excluding `keep` subtrees) into one mesh per material. Returns the number of meshes removed. */
export function mergeStatic(root, keep = []) {
  const K = new Set(keep.filter(Boolean)); const { byMat, victims } = collect(root, K);
  if (victims.length < 2) return 0;
  for (const v of victims) { v.parent && v.parent.remove(v); }
  for (const [mat, e] of byMat) { const g = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false); e.geos.forEach(x => x !== g && x.dispose());
    const m = new THREE.Mesh(g, mat); m.castShadow = e.cast; m.receiveShadow = e.recv; m.renderOrder = e.order; m.name = 'merged'; root.add(m); }
  // empty groups left behind are harmless; prune them so traversal stays cheap
  const prune = o => { for (const c of o.children.slice()) { prune(c); if (!c.isMesh && !c.isLight && !c.isCamera && c.children.length === 0 && !K.has(c) && c.type === 'Group') o.remove(c); } }; prune(root);
  return victims.length - byMat.size;
}

/** Many copies of one prop template, drawn as one InstancedMesh per material. */
export class PropInstances {
  constructor(template, count) {
    const { byMat } = collect(template, new Set());
    this.group = new THREE.Group(); this.group.name = 'instances'; this.meshes = [];
    for (const [mat, e] of byMat) { const g = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false); const im = new THREE.InstancedMesh(g, mat, Math.max(1, count));
      im.castShadow = e.cast; im.receiveShadow = e.recv; im.frustumCulled = false; im.count = count; this.meshes.push(im); this.group.add(im); }
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  set(i, matrix) { for (const im of this.meshes) im.setMatrixAt(i, matrix); }
  hide(i) { this.set(i, this.hidden); }
  commit() { for (const im of this.meshes) im.instanceMatrix.needsUpdate = true; }
}

/** Vehicles: merge each wheel's static parts, then the body, keeping animated parts (wheels, spoiler, underglow) separate. */
export function mergeVehicle(car) {
  const ud = car.userData, wheels = ud.wheels || [];
  for (const w of wheels) { const spin = w.userData && w.userData.spin; if (spin) mergeStatic(spin); mergeStatic(w, spin ? [spin] : []); }
  const keep = [...wheels, ud.spoiler, ud.underglow && ud.underglow.strip].filter(o => o && o.isObject3D);
  return mergeStatic(car, keep);
}
