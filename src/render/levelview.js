import { disposeScene } from './dispose.js';
const _UP = new THREE.Vector3(0, 1, 0);
// Builds and animates the 3D scene for a running level.
import * as THREE from 'three';
import { createMoonMaterial } from '../../art/terrain/moonMaterial.js';
import { createMarsMaterial } from '../../art/terrain/marsMaterial.js';
import { buildEnvironment } from './env.js';
import { FLAME_LIST } from '../shop.js';
import { createColdGasThrusters } from '../../art/fx/coldGasThrusters.js';
import { createBoostFlame } from '../../art/fx/boostFlame.js';
import { buildCar, buildVehicle, animateUnderglow, buildTraffic, buildProp, buildRobot, buildArch, buildKicker, buildPad, buildBillboard, buildRocket, PAINTS } from './models.js';
import { roadTexture, noiseNormalMap, detailTexture, windowsTexture } from './textures.js';
import { Particles } from './particles.js';
import { mergeStatic, mergeVehicle, PropInstances } from './batch.js';
import { terrainArrays } from '../terrain.js';
import { poseAt, sampleAt, nearest, ROAD_W } from '../track.js';
import { rng } from '../noise.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _yq = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
const JOKES = [
  ['HONK IF YOU', 'LOVE LOOPS'], ['MARS', 'NOW WITH 38% GRAVITY!'], ['0 COLD PIZZAS', 'DELIVERED BY ROADSTER'], ['THIS BILLBOARD', 'INTENTIONALLY LEFT AWESOME'],
  ['CAUTION', 'COWS MAY BE FAST'], ['FREE PARKING', 'ON THE MOON*  *no air'], ['SLOW DOWN?', 'NEVER HEARD OF IT'], ['DONUT DISTURB', 'FLY THROUGH ME'],
];

const _white = new THREE.Color(1, 1, 1);
const hsl = h => { const c = new THREE.Color().setHSL(h, 1, 0.55); return [c.r, c.g, c.b]; };
export class LevelView {
  constructor(gfx, sim, opts) {
    this.gfx = gfx; this.sim = sim; this.opts = opts; const q = gfx.q;
    const scene = this.scene = new THREE.Scene();
    const tr = sim.tr; this.tr = tr;
    const center = tr.samples[Math.floor(tr.samples.length / 2)].p;
    this.env = buildEnvironment(scene, gfx.renderer, sim.level.env, q, center);
    gfx.renderer.toneMappingExposure = this.env.exposure;
    const ground = this.env.e.ground;
    this.rand = rng(7);
    this.buildTerrain(q, ground);
    this.buildRoad(ground);
    this.buildDecor(q, ground);
    this.buildEntities();
    this.addP = new Particles(Math.round(2600 * q.particles) + 200, true);
    this.norP = new Particles(Math.round(2200 * q.particles) + 200, false);
    scene.add(this.addP.points, this.norP.points);
    this.cam = { mode: opts.camMode || 'chase', pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), shake: 0, fov: 62, init: false, droneT: 0 };
    this.time = 0;
    try { gfx.renderer.compile(scene, gfx.camera); } catch (e) { console.warn('precompile skipped', e); } // art/perf: compile all level shaders at load, not mid-race (stutter)
  }

  // ---------- terrain ----------
  buildTerrain(q, ground) {
    const T = this.sim.terrain; const ta = terrainArrays(T, q.terrainRes);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(ta.pos, 3)); g.setIndex(new THREE.BufferAttribute(ta.idx, 1)); g.computeVertexNormals();
    const n = ta.pos.length / 3, col = new Float32Array(n * 3), uv = new Float32Array(n * 2), nrm = g.attributes.normal.array;
    const pal = {
      desert: [[0.78, 0.6, 0.4], [0.62, 0.42, 0.26], [0.55, 0.55, 0.38], [0.85, 0.75, 0.6]], canyon: [[0.72, 0.45, 0.28], [0.55, 0.3, 0.18], [0.6, 0.5, 0.35], [0.85, 0.6, 0.42]],
      coast: [[0.42, 0.52, 0.3], [0.5, 0.45, 0.35], [0.35, 0.45, 0.25], [0.85, 0.8, 0.65]], city: [[0.12, 0.12, 0.15], [0.1, 0.1, 0.12], [0.14, 0.14, 0.16], [0.2, 0.2, 0.22]],
      moon: [[0.55, 0.55, 0.56], [0.32, 0.32, 0.33], [0.45, 0.45, 0.46], [0.7, 0.7, 0.72]], mars: [[0.72, 0.38, 0.22], [0.5, 0.24, 0.14], [0.62, 0.34, 0.2], [0.85, 0.55, 0.38]],
    }[ground];
    let ymin = 1e9, ymax = -1e9; for (let i = 0; i < n; i++) { ymin = Math.min(ymin, ta.pos[i * 3 + 1]); ymax = Math.max(ymax, ta.pos[i * 3 + 1]); }
    for (let i = 0; i < n; i++) {
      const x = ta.pos[i * 3], y = ta.pos[i * 3 + 1], z = ta.pos[i * 3 + 2]; const slope = 1 - nrm[i * 3 + 1];
      const hN = (y - ymin) / Math.max(1, ymax - ymin); const nz = (Math.sin(x * 0.013) * Math.cos(z * 0.011) + 1) * 0.5;
      let c = pal[0].map((v, k) => v * (1 - nz * 0.25) + pal[2][k] * nz * 0.25);
      c = c.map((v, k) => v + (pal[1][k] - v) * Math.min(1, slope * 2.6)); // cliffs darker / banded
      if (ground === 'canyon' || ground === 'mars' || ground === 'desert') { const band = Math.sin(y * 0.5) * 0.5 + 0.5; c = c.map((v, k) => v * (0.9 + band * 0.12 * Math.min(1, slope * 3))); }
      if (hN > 0.8 && ground !== 'city') c = c.map((v, k) => v + (pal[3][k] - v) * (hN - 0.8) * 2.5);
      if (ground === 'coast' && T.ocean && y < T.ocean.y + 3) c = [0.86, 0.8, 0.62];
      col[i * 3] = c[0] ** 2.2; col[i * 3 + 1] = c[1] ** 2.2; col[i * 3 + 2] = c[2] ** 2.2; // palette is sRGB, vertex colours are linear uv[i * 2] = x / 16; uv[i * 2 + 1] = z / 16;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const nm = noiseNormalMap(ground === 'moon' ? 10 : 7, ground === 'moon' ? 3 : 2);
    let mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: detailTexture(ground), normalMap: nm, normalScale: new THREE.Vector2(0.8, 0.8) });
    // art pack: procedural regolith / Martian dust materials (world-space detail)
    try { if (ground === 'moon') mat = createMoonMaterial({ quality: this.gfx.qName }); else if (ground === 'mars') mat = createMarsMaterial({ quality: this.gfx.qName, dustAmount: this.sim.level.storm ? 0.8 : 0.45 }); } catch (e) { console.warn('terrain material fallback', e); }
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; this.scene.add(mesh); this.terrainMesh = mesh;
    if (T.ocean && this.env.water) this.env.water.position.y = T.ocean.y;
  }

  // ---------- road ----------
  buildRoad(ground) {
    const r = this.sim.road, style = this.env.e.road;
    const mk = (pos, idx, uv) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const rt = roadTexture(style);
    const neon = style === 'neon'; // art: low normal strength + rougher, less env so asphalt stops reading as rippling blue water / splotchy neon puddles
    const roadMat = new THREE.MeshStandardMaterial({ map: rt, roughness: neon ? 0.55 : 0.9, metalness: neon ? 0.15 : 0.0, envMapIntensity: neon ? 0.7 : 0.45, normalMap: noiseNormalMap(20, 1.2), normalScale: new THREE.Vector2(neon ? 0.08 : 0.12, neon ? 0.08 : 0.12), side: THREE.DoubleSide });
    const road = new THREE.Mesh(mk(r.top.pos, r.top.idx, r.top.uv), roadMat); road.receiveShadow = true; road.castShadow = true; this.scene.add(road);
    const wallCol = { neon: 0xff2bd6, moon: 0xb8c4d8, mars: 0xe0e0e0, spaceport: 0xe6e9ee, asphalt: 0xe8e8e8 }[style] || 0xdddddd;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallCol, roughness: 0.4, metalness: 0.5, emissive: style === 'neon' ? 0x7a0a66 : 0x000000, side: THREE.DoubleSide });
    const walls = new THREE.Mesh(mk(r.walls.pos, r.walls.idx), wallMat); walls.castShadow = true; walls.receiveShadow = true; this.scene.add(walls);
    const under = new THREE.Mesh(mk(r.under.pos, r.under.idx), new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide })); under.castShadow = true; this.scene.add(under);
    // glowing edge strip on wall tops
    const sm = this.tr.samples, hw = ROAD_W / 2, strip = [], sidx = [];
    let prev = false;
    for (const a of sm) { if (!a.solid) { prev = false; continue; }
      for (const sd of [1, -1]) { const b = a.p.clone().addScaledVector(a.X, sd * (hw + 0.17)).addScaledVector(a.U, 1.22); strip.push(b.x, b.y, b.z, b.x + a.U.x * 0.12, b.y + a.U.y * 0.12, b.z + a.U.z * 0.12); }
      const vi = strip.length / 3 - 4; if (prev) for (let o = 0; o < 4; o += 2) sidx.push(vi - 4 + o, vi - 3 + o, vi + o, vi - 3 + o, vi + 1 + o, vi + o); prev = true; }
    const stripCol = { neon: 0x29e7ff, moon: 0x7fd4ff, mars: 0xffa040, spaceport: 0x00e5ff, asphalt: 0xff3040 }[style] || 0x00e5ff;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(strip, 3)); sg.setIndex(sidx);
    this.scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: stripCol, side: THREE.DoubleSide, toneMapped: false })));
    // arches, pads, kickers
    const place = (obj, s, x = 0, h = 0) => { const P = poseAt(this.tr, s, x, h); obj.position.copy(P.p); obj.quaternion.copy(P.q); mergeStatic(obj); this.scene.add(obj); return obj; };
    this.camBlockers = []; /* arches have no physics collider, so the camera raycasts them directly */
    this.camBlockers.push(place(buildArch('START', '#39ff6a'), this.sim.startS + 6));
    this.camBlockers.push(place(buildArch('FINISH', '#ffd23f'), this.tr.finishS));
    this.tr.checkpoints.slice(1).forEach((s, i) => this.camBlockers.push(place(buildArch('CHECKPOINT ' + (i + 1), '#00e5ff'), s)));
    for (const f of this.tr.features) if (f.type === 'gap') { const pad = buildPad(f.padR); place(pad, f.padS, 0, 0.04); }
    for (const k of this.sim.kickers) { const m = buildKicker(); m.position.copy(k.p); m.quaternion.copy(k.q); mergeStatic(m); this.scene.add(m); }
    // spaceport finale rocket
    if (this.sim.level.spaceport) { const rk = buildRocket(1); place(rk, this.tr.length - 2, 0, -1.0); rk.translateZ(14); this.rocket = rk; }
  }

  // ---------- decor ----------
  buildDecor(q, ground) {
    const T = this.sim.terrain, tr = this.tr, R = this.rand, b = T.bounds;
    const farFromTrack = (x, z, d) => { const nr = nearest(tr, new THREE.Vector3(x, 0, z)); const s = tr.samples[nr.i]; return Math.hypot(s.p.x - x, s.p.z - z) > d; };
    const scatter = (geo, mat, count, minD, scaleFn, yOff = 0) => {
      const im = new THREE.InstancedMesh(geo, mat, count); let k = 0, tries = 0;
      while (k < count && tries < count * 6) { tries++;
        const near = R() < 0.7; let x, z;
        if (near) { const s = tr.samples[Math.floor(R() * tr.samples.length)]; const a = R() * Math.PI * 2, d = minD + R() * 380; x = s.p.x + Math.cos(a) * d; z = s.p.z + Math.sin(a) * d; }
        else { x = b.x0 + R() * (b.x1 - b.x0); z = b.z0 + R() * (b.z1 - b.z0); }
        if (!farFromTrack(x, z, minD)) continue;
        const y = T.heightAt(x, z); if (T.ocean && y < T.ocean.y + 1) continue;
        const sc = scaleFn(); _e.set(R() * 0.3, R() * 6.28, R() * 0.3); _q.setFromEuler(_e); _m.compose(_p.set(x, y + yOff * sc.y, z), _q, sc); im.setMatrixAt(k++, _m);
      }
      im.count = k; im.castShadow = true; im.receiveShadow = true; this.scene.add(im); return im;
    };
    const dq = q.decor;
    const rockCol = { desert: 0x8a6a4a, canyon: 0x7a4a2e, coast: 0x6a6a62, city: 0x333338, moon: 0x6a6a6c, mars: 0x7a3a22 }[ground];
    const rockGeo = new THREE.DodecahedronGeometry(1, 1); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.8 + Math.random() * 0.4; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); } rockGeo.computeVertexNormals(); }
    if (ground !== 'city') scatter(rockGeo, new THREE.MeshStandardMaterial({ color: rockCol, roughness: 0.95, flatShading: true }), Math.round(500 * dq), 16, () => { const s = 0.6 + Math.pow(R(), 3) * 7; return new THREE.Vector3(s, s, s); }, 0.2);
    if (ground === 'desert' || ground === 'canyon') {
      const parts = []; const c1 = new THREE.CylinderGeometry(0.35, 0.4, 5, 8); c1.translate(0, 2.5, 0); parts.push(c1);
      const a1 = new THREE.CylinderGeometry(0.25, 0.25, 2, 8); a1.translate(0.8, 3, 0); parts.push(a1); const a2 = new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8); a2.translate(-0.8, 2.4, 0); parts.push(a2);
      const h1 = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8); h1.rotateZ(Math.PI / 2); h1.translate(0.45, 2.1, 0); parts.push(h1); const h2 = h1.clone(); h2.translate(-0.9, -0.4, 0); parts.push(h2);
      const geo = mergeAll(parts); scatter(geo, new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 }), Math.round(260 * dq), 14, () => { const s = 0.8 + R() * 0.8; return new THREE.Vector3(s, s, s); });
    }
    if (ground === 'coast') { const tree = mergeAll([new THREE.CylinderGeometry(0.3, 0.4, 4, 6).translate(0, 2, 0), new THREE.ConeGeometry(2, 5, 8).translate(0, 6, 0)]); scatter(tree, new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.9, flatShading: true }), Math.round(400 * dq), 15, () => { const s = 0.8 + R() * 0.9; return new THREE.Vector3(s, s, s); }); }
    if (ground === 'city') {
      const tex = windowsTexture();
      const mat = new THREE.MeshStandardMaterial({ color: 0x1a1c26, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.5 });
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const count = Math.round(520 * dq); const im = new THREE.InstancedMesh(geo, mat, count); let k = 0, tries = 0;
      while (k < count && tries < count * 8) { tries++;
        const s = tr.samples[Math.floor(R() * tr.samples.length)]; const a = R() * Math.PI * 2, d = 40 + R() * 500; const x = s.p.x + Math.cos(a) * d, z = s.p.z + Math.sin(a) * d;
        if (!farFromTrack(x, z, 34)) continue; const y = T.heightAt(x, z);
        const w = 12 + R() * 22, h = 20 + Math.pow(R(), 2) * 160; _q.setFromEuler(_e.set(0, Math.floor(R() * 4) * Math.PI / 2, 0)); _m.compose(_p.set(x, y - 1, z), _q, _s.set(w, h, w * (0.6 + R() * 0.8))); im.setMatrixAt(k++, _m);
      }
      _s.set(1, 1, 1); im.count = k; im.castShadow = q.shadows >= 2048; im.receiveShadow = true; this.scene.add(im);
      // neon billboards
    }
    if (ground === 'moon') {
      const lander = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 1, roughness: 0.35 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 2.4, 8), gold); body.position.y = 2.6; lander.add(body);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 })); top.position.y = 4.6; lander.add(top);
      for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4), new THREE.MeshStandardMaterial({ color: 0x999999 })); const a = k * Math.PI / 2; leg.position.set(Math.cos(a) * 2.6, 1.3, Math.sin(a) * 2.6); leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); lander.add(leg); }
      const s = tr.samples[Math.floor(tr.samples.length * 0.3)]; const x = s.p.x + s.X.x * 30, z = s.p.z + s.X.z * 30; lander.position.set(x, T.heightAt(x, z), z); this.scene.add(lander);
      if (this.env.e.lamps) { const lampGeo = mergeAll([new THREE.CylinderGeometry(0.1, 0.12, 6).translate(0, 3, 0)]); const lm = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }), 400); const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fdcff, toneMapped: false }), 400); let k = 0;
        for (let i = 0; i < tr.samples.length && k < 400; i += 45) { const a = tr.samples[i]; if (!a.solid || a.U.y < 0.95) continue; for (const sd of [1, -1]) { if (k >= 400) break; const p = a.p.clone().addScaledVector(a.X, sd * (ROAD_W / 2 + 1.5)); _m.compose(p, _q.identity(), _s.set(1, 1, 1)); lm.setMatrixAt(k, _m); _m.compose(p.clone().add(new THREE.Vector3(0, 6.2, 0)), _q, _s); bulb.setMatrixAt(k, _m); k++; } }
        lm.count = bulb.count = k; this.scene.add(lm, bulb); }
    }
    if (ground === 'mars' || ground === 'moon') { // habitat domes
      for (let k = 0; k < 3; k++) { const s = tr.samples[Math.floor(tr.samples.length * (0.2 + k * 0.3))]; const x = s.p.x - s.X.x * (60 + k * 20), z = s.p.z - s.X.z * (60 + k * 20);
        const dome = buildProp('base'); dome.scale.setScalar(2 + k * 0.6); dome.position.set(x, T.heightAt(x, z), z); mergeStatic(dome); this.scene.add(dome); }
    }
    // joke billboards (Easter egg) along the road
    const nb = ground === 'moon' ? 2 : 3;
    for (let k = 0; k < nb; k++) {
      const s0 = this.sim.safeS(400 + k * (tr.finishS - 600) / nb); const j = JOKES[(k + this.sim.level.id.charCodeAt(1)) % JOKES.length];
      const bb = buildBillboard(j[0], j[1], k % 2 ? ['#ff8a00', '#ff2a6d'] : ['#00c6ff', '#7a2cff']); const P = poseAt(tr, s0, (k % 2 ? 1 : -1) * (ROAD_W / 2 + 14), 0);
      bb.position.copy(P.p); bb.position.y = T.heightAt(P.p.x, P.p.z); bb.lookAt(poseAt(tr, s0 - 60, 0, 0).p.setY(bb.position.y)); mergeStatic(bb); this.scene.add(bb);
    }
    // spaceport: towers and parked rockets
    if (this.sim.level.spaceport) for (let k = 0; k < 4; k++) {
      const s = tr.samples[Math.floor(tr.samples.length * (0.15 + k * 0.2))]; const x = s.p.x + s.X.x * (90 + k * 25), z = s.p.z + s.X.z * (90 + k * 25);
      const rk = buildRocket(0.8 + this.rand() * 0.4); rk.position.set(x, T.heightAt(x, z), z); mergeStatic(rk); this.scene.add(rk);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 80, 5), new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.7, roughness: 0.5, wireframe: false })); tower.position.set(x + 9, rk.position.y + 40, z); tower.castShadow = true; this.scene.add(tower);
    }
  }

  // ---------- dynamic entities ----------
  buildEntities() {
    const sim = this.sim, sc = this.scene;
    this.car = buildVehicle(sim.veh.id, this.opts.custom || {}, { wheelPos: sim.wheelPos, quality: this.gfx.qName || 'high' }); mergeVehicle(this.car);
    { // landing-target marker: where the car will touch down (ballistic prediction from the sim)
      const g = new THREE.RingGeometry(1.5, 2.1, 40); g.rotateX(-Math.PI / 2); const gi = new THREE.CircleGeometry(0.35, 16); gi.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x40e0ff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
      this.landMark = new THREE.Group(); this.landMark.add(new THREE.Mesh(g, mat), new THREE.Mesh(gi, mat)); this.landMark.visible = false; this.landMark.renderOrder = 5; this.landMat = mat; sc.add(this.landMark);
    }
    if (sim.veh.rcs) { try { this.coldGas = createColdGasThrusters(this.car, { quality: this.gfx.qName || 'high', scene: sc }); } catch (e) { console.warn('cold-gas fx fallback', e); } }
    this.flame = FLAME_LIST.find(f => f.id === (this.opts.custom || {}).flame) || FLAME_LIST[0];
    try { const hauler = sim.veh.id === 'hauler'; this.flameFx = createBoostFlame(this.car, { quality: this.gfx.qName || 'high', mounts: this.car.userData.nozzles, radius: hauler ? 0.13 : 0.11, length: hauler ? 1.6 : 1.4 }); this.flameCol = [new THREE.Color(), new THREE.Color(), new THREE.Color()]; } catch (e) { console.warn('boost flame fx fallback', e); } // art: shaped plasma jet
    this.trail = (this.opts.custom || {}).trail || 'none'; sc.add(this.car);
    if (this.env.e.ground === 'city' || this.env.e.lamps || sim.level.env === 'moonnight') {
      const spot = new THREE.SpotLight(0xe8f4ff, 60, 90, 0.5, 0.5, 1.5); spot.position.set(0, 0.2, 2.0); spot.target.position.set(0, -1, 22); this.car.add(spot, spot.target);
    }
    // coins
    const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 24); coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshPhysicalMaterial({ color: 0xffc533, metalness: 1, roughness: 0.18, emissive: 0x6a4a00, emissiveIntensity: 0.6, clearcoat: 1 });
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, sim.coinsList.length); this.coins.castShadow = true; sc.add(this.coins); this.coins.frustumCulled = false;
    sim.coinsList.forEach(c => { const P = poseAt(this.tr, c.s, c.x, c.h); c.q = P.q.clone(); });
    // pickups (battery / nitro ...): one InstancedMesh per kind and material instead of a group of meshes each
    this.pickInst = new Map(); this.pickSlot = sim.pickups.map(pk => { let e = this.pickInst.get(pk.kind); if (!e) this.pickInst.set(pk.kind, e = { n: 0 }); return e.n++; });
    for (const [kind, e] of this.pickInst) { e.inst = new PropInstances(buildProp(kind), e.n); sc.add(e.inst.group); }
    this.traffic = sim.traffic.map(t => { const m = buildTraffic(t.type, t.color); if (m.userData.legs) mergeStatic(m, m.userData.legs); else mergeVehicle(m); sc.add(m); return m; });
    const aiPaints = ['white', 'blue', 'gold', 'cyan', 'green', 'purple', 'orange'];
    this.ai = sim.ai.map((a, k) => { const m = buildCar({ paint: aiPaints[(k + sim.level.diff) % aiPaints.length], finish: 'metallic', rims: ['spoke5', 'turbine', 'mesh'][k % 3] }, { wheelPos: sim.wheelPos }); mergeVehicle(m); sc.add(m); return m; });
    this.quest = sim.questItems.map(o => { const m = buildProp(o.kind === 'house' || o.kind === 'ufo' || o.kind === 'base' ? o.kind : o.kind); m.position.copy(o.p); m.quaternion.copy(o.q); if (o.kind === 'ring') { m.rotation.set(0, 0, 0); m.quaternion.copy(o.q); } sc.add(m); return m; });
    if (sim.cow) this.cowMesh = this.quest[this.quest.length - 1];
    // quest beacons (vertical light beam over pickups/dropoffs)
    this.beams = [];
    for (const o of sim.questItems) if (o.kind !== 'mailbox') { const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 120, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.position.copy(o.p).add(new THREE.Vector3(0, 60, 0)); sc.add(beam); this.beams.push({ beam, o }); }
    // ghost car
    if (sim.ghost) { this.ghostCar = buildVehicle(sim.veh.id, { paint: 'cyan' }, { wheelPos: sim.wheelPos, quality: 'low' }); this.ghostCar.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0x3fd8ff, transparent: true, opacity: 0.28, depthWrite: false }); o.castShadow = false; } }); sc.add(this.ghostCar); }
    // pit-crew robots at checkpoints
    this.robots = [];
    const nR = Math.min(3, sim.robots);
    if (nR > 0) this.tr.checkpoints.slice(1).forEach((s, ci) => { for (let k = 0; k < nR; k++) { const r = buildRobot([0x00e5ff, 0x39ff6a, 0xffb000][k]); const P = poseAt(this.tr, s + 4 + k * 3, (ci % 2 ? 1 : -1) * (ROAD_W / 2 + 2.2), 0); r.position.copy(P.p); r.quaternion.copy(P.q); r.rotateY((ci % 2 ? -1 : 1) * Math.PI / 2); sc.add(r); this.robots.push(r); } });
    // meteors / devils / egg
    this.meteorMeshes = new Map();
    this.devilMeshes = sim.devils.map(() => null);
    if (sim.egg) { const egg = buildCar({ paint: 'red', finish: 'gloss' }); egg.scale.setScalar(1.6); egg.position.copy(sim.egg.p); const bot = buildRobot(0xff4040); bot.scale.setScalar(0.8); bot.position.set(0, -0.5, 0); bot.rotation.x = -0.5; egg.add(bot); sc.add(egg); this.egg = egg; }
  }

  // ---------- per-frame ----------
  update(dt, alpha, input, fx) {
    const sim = this.sim, t = (this.time += dt);
    // player car
    sim.renderPose(_p, _q); this.car.position.copy(_p); this.car.quaternion.copy(_q);
    const vc = sim.vc, wheels = this.car.userData.wheels;
    for (let i = 0; i < 4; i++) { const w = wheels[i]; const susp = vc.wheelSuspensionLength(i) ?? 0.34; w.position.y = sim.wheelPos[i][1] - susp; w.rotation.y = vc.wheelSteering(i) || 0; w.userData.spin.rotation.x = vc.wheelRotation(i) || 0; }
    const braking = (input.brake || 0) > 0.1 && sim.fspeed > 1; this.car.userData.tailMat.emissiveIntensity = braking ? (sim.veh.rcs ? 12 : 6) : (sim.veh.rcs ? 3 : 2.2);
    animateUnderglow(this.car, t); const sp = this.car.userData.spoiler?.userData.active; if (sp) sp.rotation.x = -0.12 - (braking ? 0.7 : 0) - (sim.boosting ? 0.15 : 0);
    this.car.visible = !(sim.crashT > 0 && sim.crashT < 1.3);
    // traffic & ai
    sim.traffic.forEach((tf, k) => { const m = this.traffic[k]; m.position.lerpVectors(tf.pp, tf.p, alpha); m.quaternion.slerpQuaternions(tf.pq, tf.q, alpha); });
    sim.ai.forEach((a, k) => { const m = this.ai[k]; m.position.lerpVectors(a.pp, a.p, alpha); m.quaternion.slerpQuaternions(a.pq, a.q, alpha); m.position.addScaledVector(_v.set(0, 1, 0).applyQuaternion(m.quaternion), 0.68); m.userData.wheels.forEach(w => { w.userData.spin.rotation.x = a.wheelRot; }); });
    // ghost replay
    if (this.ghostCar && sim.ghost) { const fr = sim.ghost.frames; const ft = sim.raceTime * 10; const i = Math.min(fr.length - 2, Math.floor(ft)); const f = Math.min(1, ft - i); const a = fr[Math.max(0, i)], b = fr[Math.max(0, i + 1)];
      if (a && b) { this.ghostCar.position.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); _q.set(a[3], a[4], a[5], a[6]); _yq.set(b[3], b[4], b[5], b[6]); this.ghostCar.quaternion.copy(_q).slerp(_yq, f); } this.ghostCar.visible = sim.state !== 'countdown' || true; }
    // coins (only near ones updated)
    const ps = sim.prog.s; const spin = t * 3;
    sim.coinsList.forEach((c, k) => {
      if (c.taken || Math.abs(c.s - ps) > 420) { _m.makeScale(0, 0, 0); this.coins.setMatrixAt(k, _m); return; }
      _q.copy(c.q).multiply(_yq.setFromAxisAngle(_Y, spin + k)); _m.compose(c.p, _q, _s.set(1, 1, 1)); this.coins.setMatrixAt(k, _m);
    });
    this.coins.instanceMatrix.needsUpdate = true;
    sim.pickups.forEach((pk, k) => { const e = this.pickInst.get(pk.kind).inst, i = this.pickSlot[k]; if (pk.taken || Math.abs(pk.s - ps) > 420) { e.hide(i); return; } _yq.setFromAxisAngle(_Y, t * 2); _v.copy(pk.p); _v.y += Math.sin(t * 3 + k) * 0.2; _m.compose(_v, _yq, _s.set(1, 1, 1)); e.set(i, _m); });
    for (const e of this.pickInst.values()) e.inst.commit();
    // quest props
    sim.questItems.forEach((o, k) => { const m = this.quest[k];
      if (o.kind === 'mailbox' && o.rb) { const tt = o.rb.translation(), rr = o.rb.rotation(); m.position.set(tt.x, tt.y - 0.1, tt.z); m.quaternion.set(rr.x, rr.y, rr.z, rr.w); }
      else if (o.kind === 'cow') { m.position.copy(o.p); m.quaternion.copy(o.q); (m.userData.legs || []).forEach((l, i) => { l.rotation.x = Math.sin((o.anim || 0) * 1.2 + i * Math.PI) * 0.6; }); m.position.y += Math.abs(Math.sin((o.anim || 0) * 1.2)) * 0.3; }
      else if (o.role === 'pickup' || ['cheese', 'potato'].includes(o.kind)) { m.visible = !o.taken; m.rotation.y = t * 1.5; }
    });
    this.beams.forEach(b => { b.beam.visible = !b.o.taken && !(sim.quest.done || sim.quest.failed) && (b.o.role !== 'drop' || sim.quest.active); });
    this.robots.forEach((r, k) => r.userData.animate(t + k, Math.abs(r.position.distanceTo(this.car.position)) < 60 ? 'wave' : 'work'));
    if (this.egg) { this.egg.rotation.y = t * 0.15; this.egg.rotation.z = Math.sin(t * 0.3) * 0.3; }
    if (this.rocket) this.rocket.rotation.y += 0;
    // meteors
    const live = new Set();
    for (const m of sim.meteors) { live.add(m); let v = this.meteorMeshes.get(m);
      if (!v) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0xff5a10, emissiveIntensity: 1.5, flatShading: true }));
        const ring = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.6, m.r, 40), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })); const P = poseAt(this.tr, m.s, m.x, 0.08); ring.position.copy(P.p); ring.quaternion.copy(P.q); ring.rotateX(-Math.PI / 2);
        this.scene.add(rock, ring); v = { rock, ring }; this.meteorMeshes.set(m, v); }
      const k = m.t / m.T; v.rock.position.copy(m.p).add(_v.set(-40 * k, 160 * k, 30 * k)); v.rock.rotation.x += dt * 4; v.ring.material.opacity = 0.35 + 0.35 * Math.sin(t * 20);
      for (let i = 0; i < 3; i++) this.addP.emit(v.rock.position, _v.set(Math.random() - 0.5, 2, Math.random() - 0.5), { color: [1, 0.5, 0.15], size: 3, life: 0.6, grow: 2 });
    }
    for (const [m, v] of this.meteorMeshes) if (!live.has(m)) { this.scene.remove(v.rock, v.ring); this.meteorMeshes.delete(m); }
    // dust devils
    sim.devils.forEach((d, k) => { if (Math.abs(d.s - ps) > 350) return; for (let i = 0; i < 4; i++) { const a = t * 6 + i * 1.6 + k, hgt = Math.random() * 24, r = 1.5 + hgt * 0.25; const p = d.p.clone().add(new THREE.Vector3(Math.cos(a) * r, hgt, Math.sin(a) * r)); this.norP.emit(p, new THREE.Vector3(-Math.sin(a) * 8, 3, Math.cos(a) * 8), { color: [0.75, 0.45, 0.28], size: 2.2 + hgt * 0.1, life: 1.2, alpha: d.used ? 0.25 : 0.55, drag: 0.3 }); } });
    { const L = sim.landing, lm = this.landMark;
      if (lm) { lm.visible = !!(L && !sim.grounded && sim.air > 0.25 && L.t > 0.08);
        if (lm.visible) { lm.position.copy(L.p).addScaledVector(L.n, 0.08); lm.quaternion.setFromUnitVectors(_UP, L.n); const k = 1 + Math.min(1.5, L.t * 0.5); lm.scale.set(k, 1, k);
          this.landMat.color.setHex(L.vImp > 14 * Math.sqrt(sim.veh.tough) ? 0xff3030 : L.onPad ? 0x39ff6a : 0x40e0ff); this.landMat.opacity = 0.55 + 0.35 * Math.sin(this.time * 10) ** 2; } } }
    this.effects(dt, input, fx);
    if (this.env.update) this.env.update(dt, t);
    this.env.follow(this.car.position);
    this.addP.update(dt, this.gfx.vh); this.norP.update(dt, this.gfx.vh); if (this.coldGas) this.coldGas.update(dt);
    this.updateCamera(dt, fx);
  }

  trailFx(car, q, fwd, up) {
    const sim = this.sim, tr = this.trail; if (tr === 'none' || sim.speed < 22) return;
    const back = car.position.clone().addScaledVector(fwd, sim.veh.rcs ? -2.7 : -2.15).addScaledVector(up, -0.15), v = sim.prevVel.clone().multiplyScalar(0.92), t = this.time;
    if (tr === 'streak') for (const sx of [-0.7, 0.7]) this.addP.emit(back.clone().addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(q), sx), v, { color: [1, 0.15, 0.2], size: 0.5, life: 0.45, alpha: 0.9 });
    else if (tr === 'sparks') for (let k = 0; k < 3; k++) this.addP.emit(back, v.clone().multiplyScalar(0.7), { color: [1, 0.75, 0.3], size: 0.25, life: 0.6, spread: 6, gravity: 9 });
    else if (tr === 'smoke') this.norP.emit(back, new THREE.Vector3(0, 1, 0), { color: [0.3 + 0.7 * Math.abs(Math.sin(t)), 0.3, 0.9], size: 2, life: 1.6, grow: 3, alpha: 0.45, drag: 1 });
    else if (tr === 'stars') for (let k = 0; k < 2; k++) this.addP.emit(back, v.clone().multiplyScalar(0.8), { color: [1, 1, 0.7], size: 0.45, life: 0.9, spread: 2.5 });
    else if (tr === 'lightning') { if (Math.random() < 0.6) this.addP.emit(back.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() - 0.5, 0)), v, { color: [0.55, 0.8, 1], size: 0.6, life: 0.12, spread: 10 }); }
    else if (tr === 'rainbow') for (let k = 0; k < 6; k++) this.addP.emit(back.clone().addScaledVector(up, (k - 2.5) * 0.12), v, { color: hsl(k / 6), size: 0.4, life: 0.5, alpha: 0.9 });
  }
  rcsFx(car, q, up) {
    // cold-gas RCS: white expanding puffs from the active ports (not fire)
    const sim = this.sim, r = sim.rcs, ports = car.userData.rcsPorts; if (!ports) return;
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const puff = (i, dir, n = 2) => { const p = ports[i].clone().applyQuaternion(q).add(car.position); for (let k = 0; k < n; k++) this.norP.emit(p, dir.clone().multiplyScalar(11 + Math.random() * 4).add(sim.prevVel), { color: [0.95, 0.97, 1], size: 0.55, life: 0.35, grow: 4.5, alpha: 0.75, spread: 1.6, drag: 3 }); this.addP.emit(p, dir.clone().multiplyScalar(18).add(sim.prevVel), { color: [0.75, 0.85, 1], size: 0.4, life: 0.1, alpha: 0.7, spread: 0.8 }); };
    let any = false;
    const cg = this.coldGas;
    if (cg) {
      if (r.lift) { cg.hover(1); any = true; }
      if (Math.abs(r.px) > 0.05) { cg.fire(new THREE.Vector3(0, Math.sign(r.px), Math.sign(r.px) * 0.6), Math.min(1, Math.abs(r.px)) * 1.2); any = true; }
      if (Math.abs(r.py) > 0.05) { cg.fire(new THREE.Vector3(Math.sign(r.py), 0.25, 0), Math.min(1, Math.abs(r.py)) * 1.2); any = true; }
      this.rcsActive = any; return;
    }
    if (r.lift) { any = true; for (const i of [4, 5, 6, 7, 9]) puff(i, up.clone().negate(), i === 9 ? 3 : 2); }
    if (Math.abs(r.px) > 0.05) { any = true; const s = Math.sign(r.px); puff(s > 0 ? 0 : 2, up.clone().multiplyScalar(s)); puff(s > 0 ? 1 : 3, up.clone().multiplyScalar(s)); puff(s > 0 ? 6 : 4, up.clone().multiplyScalar(-s), 1); puff(s > 0 ? 7 : 5, up.clone().multiplyScalar(-s), 1); }
    if (Math.abs(r.py) > 0.05) { any = true; const s = Math.sign(r.py); puff(s > 0 ? 0 : 1, right.clone().multiplyScalar(s > 0 ? 1 : -1)); puff(s > 0 ? 2 : 3, right.clone().multiplyScalar(s > 0 ? 1 : -1)); puff(8, up, 1); }
    this.rcsActive = any;
  }
  effects(dt, input, fx) {
    const sim = this.sim, car = this.car, q = car.quaternion;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const ground = this.env.e.ground, planetG = sim.g;
    const dustCol = { desert: [0.8, 0.65, 0.45], canyon: [0.75, 0.5, 0.32], coast: [0.7, 0.68, 0.6], city: [0.5, 0.5, 0.55], moon: [0.62, 0.62, 0.64], mars: [0.78, 0.45, 0.28] }[ground];
    const back = car.position.clone().addScaledVector(fwd, -2.0).addScaledVector(up, -0.55);
    const fl = this.flame, tt = this.time; const c1 = fl.rainbow ? hsl((tt * 0.6) % 1) : fl.c1, c2 = fl.rainbow ? hsl((tt * 0.6 + 0.5) % 1) : fl.c2;
    if (this.flameFx) { const [a, b, o] = this.flameCol; b.setRGB(...c1); a.setRGB(...c2).lerp(_white, 0.55); o.copy(b).multiplyScalar(0.55); this.flameFx.setColors(a, b, o); this.flameFx.setIntensity(sim.boosting ? 1 : 0); this.flameFx.update(dt); }
    if (sim.boosting) for (const nz of car.userData.nozzles) { const p = nz.clone().applyQuaternion(q).add(car.position); for (let k = 0; k < (this.flameFx ? 1 : 3); k++) this.addP.emit(p, fwd.clone().multiplyScalar(-14).add(new THREE.Vector3().copy(sim.prevVel).multiplyScalar(0.9)), { color: c1, size: this.flameFx ? 0.45 : 1.1, life: this.flameFx ? 0.14 : 0.22, grow: -2, spread: 2, alpha: 0.9 }); if (!this.flameFx) this.addP.emit(p, sim.prevVel.clone().multiplyScalar(0.95), { color: c2, size: 0.7, life: 0.12 }); }
    this.trailFx(car, q, fwd, up);
    if (sim.veh.rcs) this.rcsFx(car, q, up);
    else if (sim.thrusting) for (const nz of car.userData.nozzles) { const p = nz.clone().applyQuaternion(q).add(car.position).addScaledVector(up, -0.3); for (let k = 0; k < 4; k++) this.addP.emit(p, up.clone().multiplyScalar(-16).add(sim.prevVel), { color: [0.3, 0.95, 1], size: 1.4, life: 0.25, grow: 2, spread: 3 }); }
    if (sim.grounded && sim.speed > 9 && ground !== 'city') { const n = ground === 'moon' || ground === 'mars' ? 2 : 1; for (let k = 0; k < n; k++) this.norP.emit(back, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3).add(sim.prevVel.clone().multiplyScalar(0.25)), { color: dustCol, size: 1.6, life: ground === 'moon' ? 2.2 : 1.1, grow: 2.2, alpha: 0.35, drag: ground === 'moon' ? 0.05 : 1.2, gravity: ground === 'moon' ? planetG : 0.5 }); }
    if (sim.drifting) for (let k = 0; k < 2; k++) this.norP.emit(back, new THREE.Vector3(0, 1.5, 0), { color: [0.85, 0.85, 0.88], size: 2, life: 1.4, grow: 3, alpha: 0.3, spread: 2 });
    if (sim.scrape && sim.speed > 6) { const p = car.position.clone().addScaledVector(up, -0.5); for (let k = 0; k < 6; k++) this.addP.emit(p, sim.prevVel.clone().multiplyScalar(0.6), { color: [1, 0.7, 0.25], size: 0.35, life: 0.35, spread: 12, gravity: 9 }); }
    for (const e of fx) {
      if (e.type === 'coin') this.addP.burst(e.p, 10, 6, { color: [1, 0.85, 0.3], size: 0.6, life: 0.5 });
      else if (e.type === 'battery' || e.type === 'nitro') this.addP.burst(e.p, 24, 9, { color: e.type === 'battery' ? [0.3, 1, 0.5] : [0.4, 0.7, 1], size: 0.8, life: 0.7 });
      else if (e.type === 'land') { this.norP.burst(car.position.clone().addScaledVector(up, -0.6), Math.round(10 + e.strength * 30), 6 + e.strength * 8, { color: dustCol, size: 2.2, life: 1.3, grow: 2.5, alpha: 0.45, up: 0.3, drag: ground === 'moon' ? 0.1 : 1.5, gravity: planetG * 0.4 }); this.cam.shake = Math.max(this.cam.shake, e.strength * 0.6); }
      else if (e.type === 'crash') { this.addP.burst(e.p, 90, 18, { color: [1, 0.55, 0.15], size: 1.6, life: 0.9, grow: 3, up: 0.4 }); this.norP.burst(e.p, 50, 8, { color: [0.15, 0.15, 0.16], size: 4, life: 2.2, grow: 4, alpha: 0.6, up: 0.6, gravity: -1 }); this.addP.burst(e.p, 40, 25, { color: [1, 0.85, 0.5], size: 0.4, life: 1.2, gravity: planetG }); this.cam.shake = 1.4; }
      else if (e.type === 'hit') this.cam.shake = Math.max(this.cam.shake, e.strength * 0.8);
      else if (e.type === 'mailbox') { this.addP.burst(e.p, 20, 10, { color: [1, 1, 1], size: 0.4, life: 1, gravity: 9.8 }); }
      else if (e.type === 'meteorImpact') { this.addP.burst(e.p, 70, 22, { color: [1, 0.5, 0.15], size: 2, life: 0.8, grow: 3, up: 0.5 }); this.norP.burst(e.p, 40, 12, { color: [0.6, 0.6, 0.62], size: 3, life: 2.5, grow: 3, alpha: 0.6, up: 0.8, gravity: sim.g, drag: 0.1 }); this.cam.shake = Math.max(this.cam.shake, Math.max(0, 1 - e.d / 60)); }
      else if (e.type === 'devil') this.cam.shake = 0.5;
      else if (e.type === 'questDone' || e.type === 'easterEgg' || e.type === 'perfect') this.addP.burst(car.position.clone().addScaledVector(up, 2), 80, 14, { color: [1, 0.85, 0.3], size: 0.8, life: 1.2, up: 0.5, gravity: 4 });
    }
    // storm dust around the camera
    if (this.env.e.storm || this.sim.level.storm) { const n = Math.round(6 * (this.sim.level.storm || 1)); for (let k = 0; k < n; k++) { const p = this.gfx.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, (Math.random() - 0.3) * 20, (Math.random() - 0.5) * 80)); this.norP.emit(p, new THREE.Vector3(18, -1, 6), { color: [0.72, 0.45, 0.28], size: 6, life: 2, alpha: 0.18, drag: 0 }); } }
  }

  updateCamera(dt, fx) {
    const c = this.cam, sim = this.sim, car = this.car, cam = this.gfx.camera;
    const q = car.quaternion; const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const sm = sim.tr.samples[sim.prog.i];
    // camera "up": follow the track in loops/walls, world up otherwise
    const wantUp = (sm.magnet || sim.rail) && sim.grounded ? sm.U.clone() : new THREE.Vector3(0, 1, 0);
    c.up.lerp(wantUp, 1 - Math.exp(-dt * 5)).normalize();
    // heading: use velocity direction when fast (smoother in air), else car forward
    const vel = sim.prevVel.clone(); const hv = vel.length() > 8 && vel.dot(fwd) > 0 && !sim.reversing ? vel.normalize() : fwd.clone(); // reversing: stay behind the car, never swing round to face it
    if (!sim.grounded) hv.lerp(fwd, 0.2).normalize();
    const speedK = Math.min(1, sim.speed / 60);
    let pos, look, fovT = 62 + speedK * 14 + (sim.boosting ? 8 : 0);
    const mode = this.slowmo ? 'cinema' : c.mode;
    if (mode === 'hood') { pos = car.position.clone().addScaledVector(up, sim.veh.rcs ? 0.95 : 0.62).addScaledVector(fwd, 0.1); look = pos.clone().addScaledVector(fwd, 20); c.pos.copy(pos); fovT += 6; }
    else if (mode === 'drone') {
      c.droneT += dt; const side = new THREE.Vector3().crossVectors(c.up, hv).normalize();
      pos = car.position.clone().addScaledVector(hv, -16).addScaledVector(c.up, 11 + Math.sin(c.droneT * 0.7) * 1.2).addScaledVector(side, Math.sin(c.droneT * 0.4) * 6);
      look = car.position.clone().addScaledVector(hv, 6);
      c.pos.lerp(pos, 1 - Math.exp(-dt * 2.2));
    } else if (mode === 'cinema') {
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hv).normalize();
      pos = car.position.clone().addScaledVector(side, 9).addScaledVector(hv, 4).add(new THREE.Vector3(0, 2.5, 0));
      look = car.position.clone(); c.pos.lerp(pos, 1 - Math.exp(-dt * 3)); fovT = 50;
    } else {
      const big = sim.veh.rcs ? 1.3 : 1; const dist = (mode === 'close' ? 5.2 : 7.4 + speedK * 1.6) * big, hgt = (mode === 'close' ? 1.7 : 2.5) * big;
      pos = car.position.clone().addScaledVector(hv, -dist).addScaledVector(c.up, hgt);
      look = car.position.clone().addScaledVector(hv, 4).addScaledVector(c.up, 0.8);
      if (!c.init) c.pos.copy(pos);
      c.pos.lerp(pos, 1 - Math.exp(-dt * (sim.grounded ? 9 : 5)));
    }
    if (mode !== 'hood' && sim.terrain?.heightAt) { /* camera collision: pull in toward the car when terrain sits between them, and never sink below the ground */
      const T = sim.terrain, cp = car.position, tmp = new THREE.Vector3(); let keep = 1;
      for (let k = 3; k <= 10; k++) { const t = k / 10; tmp.lerpVectors(cp, c.pos, t); if (T.heightAt(tmp.x, tmp.z) > tmp.y + 0.2) { keep = Math.max(0.25, (k - 1) / 10); break; } }
      /* track pieces: Rapier ray against static colliders (road, walls, loops, ramps, kickers) + three.js ray against arches, from just above the car */
      const org = cp.clone().addScaledVector(c.up, 1.0), toCam = c.pos.clone().sub(org), dl = toCam.length();
      if (dl > 0.5) { let f = sim.camClear ? sim.camClear(org, c.pos) : 1;
        if (this.camBlockers?.length) { this._rc ??= new THREE.Raycaster(); this._rc.camera = this.gfx.camera; this._rc.set(org, toCam.clone().divideScalar(dl)); this._rc.far = dl; const h = this._rc.intersectObjects(this.camBlockers, true)[0]; if (h) f = Math.min(f, h.distance / dl); }
        if (f < 1) { const k2 = Math.max(0.2, f - 0.6 / dl); const np = org.clone().addScaledVector(toCam, k2); c.pos.copy(np); } }
      if (keep < 1) c.pos.lerpVectors(cp, c.pos, keep);
      const gy = T.heightAt(c.pos.x, c.pos.z) + 0.8; if (c.pos.y < gy) c.pos.y = gy; }
    if (!c.init) { c.look.copy(look); c.init = true; }
    c.look.lerp(look, 1 - Math.exp(-dt * 14));
    c.shake = Math.max(0, c.shake - dt * 2.2);
    const sh = this.opts.shake === false ? 0 : c.shake * c.shake * 0.5;
    cam.position.copy(c.pos).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
    cam.up.copy(c.up); cam.lookAt(c.look);
    c.fov += (fovT - c.fov) * (1 - Math.exp(-dt * 4)); cam.fov = c.fov; cam.updateProjectionMatrix();
    if (this.gfx.vig) { this.gfx.vig.uniforms.speedLines.value = sim.boosting ? 1 : Math.max(0, speedK - 0.75) * 2; this.gfx.vig.uniforms.chroma.value = 0; /* art: no chromatic aberration (blur on device) */ this.gfx.vig.uniforms.time.value = this.time; }
  }

  // photo mode free camera
  photoCamera(state) { const cam = this.gfx.camera; const target = this.car.position; const r = state.dist; cam.position.set(target.x + Math.cos(state.yaw) * Math.cos(state.pitch) * r, target.y + Math.sin(state.pitch) * r + 0.6, target.z + Math.sin(state.yaw) * Math.cos(state.pitch) * r); cam.up.set(0, 1, 0); cam.lookAt(target.x, target.y + 0.5, target.z); cam.fov = state.fov; cam.updateProjectionMatrix(); this.env.follow(target); }

  minimapPath() {
    if (this._mm) return this._mm; const pts = []; for (let i = 0; i < this.tr.samples.length; i += 6) { const s = this.tr.samples[i]; pts.push([s.p.x, s.p.z, s.gap ? 1 : 0]); } return (this._mm = pts);
  }

  dispose() {
    if (this._disposed) return; this._disposed = true;
    this.thrusters?.dispose?.();
    disposeScene(this.scene, [this.env.envRT]); this.env.envRT = null;
  }
}

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function mergeAll(geos) { return mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g)); }
