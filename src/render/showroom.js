import { disposeScene } from './dispose.js';
// Non-race 3D scenes: garage turntable, planet bases with robots, trophy room, rocket-launch cutscene, menu backdrop.
import * as THREE from 'three';
import { buildEnvironment } from './env.js';
import { buildCar, buildVehicle, animateUnderglow, buildRobot, buildRocket, buildTrophy } from './models.js';
import { Particles } from './particles.js';
import { ACHIEVEMENTS } from '../progress.js';
import { fbm } from '../noise.js';

const PLANET_ENV = { earth: 'day', moon: 'moon', mars: 'mars' };
const GROUND = { earth: 0x8a7a5a, moon: 0x6a6a6c, mars: 0x9a4a2a };

function groundDisc(planet, r = 220) {
  const g = new THREE.RingGeometry(0.01, r, 96, 40); g.rotateX(-Math.PI / 2); // B21: radial rings so the flat 40 m centre stays flat (a fan disc interpolated rim height straight through the plots)
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const d = Math.hypot(x, z); p.setY(i, d > 40 ? fbm(x / 60, z / 60, 4) * (d - 40) * 0.25 : 0); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: GROUND[planet], roughness: 0.95 })); m.receiveShadow = true; return m;
}

export class Showroom {
  constructor(gfx) { this.gfx = gfx; this.scene = null; this.t = 0; this.kind = null; }
  clear() { if (this.scene) { this.car?.userData.dispose?.(); disposeScene(this.scene, [this._trophyRT]); this._trophyRT = null; this.env?.envRT?.dispose?.(); if (this.env) this.env.envRT = null; } this.scene = null; this.car = null; this.robots = []; this.picks = []; }

  menu(custom, planet = 'earth', vehicle = 'roadster') { // title backdrop: car on a hill at sunset-ish
    this.garage(custom, planet, true, vehicle); this.kind = 'menu';
  }
  garage(custom, planet = 'earth', menu = false, vehicle = 'roadster') {
    this.clear(); this.kind = 'garage'; const s = this.scene = new THREE.Scene();
    this.env = buildEnvironment(s, this.gfx.renderer, menu ? (planet === 'earth' ? 'sunset' : PLANET_ENV[planet]) : 'night', this.gfx.q, new THREE.Vector3());
    if (this.env.water) this.env.water.position.y = -30;
    s.fog.density = 0.004;
    if (!menu) this.studioEnv(s); // art: neutral softbox reflections (the night-city env painted cars/steel pink and smeared colour bars across the floor)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0c0d12, roughness: 0.25, metalness: 0.6, clearcoat: 1 })); floor.receiveShadow = true; s.add(floor);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.18, 64), new THREE.MeshPhysicalMaterial({ color: 0x23252d, metalness: 0.9, roughness: 0.25 })); plate.position.y = 0.09; plate.receiveShadow = true; s.add(plate); this.plate = plate;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: 0x00e5ff, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.19; s.add(ring);
    for (const [x, z, c] of [[6, 4, 0xffffff], [-6, 3, 0xbfe0ff], [0, -7, 0xffd2e8]]) { const L = new THREE.SpotLight(c, 260, 40, 0.5, 0.6, 1.5); L.position.set(x, 9, z); L.castShadow = this.gfx.q.shadows > 0; s.add(L); }
    this.setCar(custom, vehicle);
    this.camState = { yaw: 0.9, pitch: 0.18, dist: vehicle === 'hauler' ? (menu ? 11 : 10.5) : (menu ? 8.5 : 7.5), auto: true };
  }
  studioEnv(s) {
    const pm = new THREE.PMREMGenerator(this.gfx.renderer); const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x15171d, side: THREE.BackSide })));
    const box = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    box(14, 3, 0, 12, 0, new THREE.Color(3, 3, 3.1)); box(6, 8, -14, 4, 6, new THREE.Color(1.5, 1.55, 1.65)); box(6, 8, 14, 4, -6, new THREE.Color(1.3, 1.3, 1.3)); box(10, 1.2, 0, 1.5, -15, new THREE.Color(0.2, 1.1, 1.3));
    this.env.envRT?.dispose(); const rt = pm.fromScene(es, 0.03); pm.dispose(); this.env.envRT = rt; s.environment = rt.texture; s.environmentIntensity = 0.9;
  }
  setCar(custom, vehicle = this.vehicle || 'roadster') { this.vehicle = vehicle; if (this.car) { this.scene.remove(this.car); this.car.userData.dispose?.(); } this.car = buildVehicle(vehicle, custom, { quality: this.gfx.qName || 'high' }); this.car.position.y = 0.18 + (vehicle === 'hauler' ? 0.86 : 0.72); this.scene.add(this.car); if (this.camState) this.camState.dist = vehicle === 'hauler' ? 9 : (this.kind === 'menu' ? 8.5 : 7.5); }

  base(state, planet, onSelect) {
    this.clear(); this.kind = 'base'; this.planet = planet; const s = this.scene = new THREE.Scene();
    this.env = buildEnvironment(s, this.gfx.renderer, PLANET_ENV[planet], this.gfx.q, new THREE.Vector3()); s.fog.density *= 2;
    s.add(groundDisc(planet));
    // central habitat + landing pad
    const hab = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xdfe8f0, roughness: 0.2, metalness: 0.3, clearcoat: 1 })); hab.castShadow = true; s.add(hab);
    const glass = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 8, 48), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00a0c0, emissiveIntensity: 1.5 })); glass.rotation.x = Math.PI / 2; glass.position.y = 1.2; s.add(glass);
    this.plots = []; this.picks = [];
    const plots = state.plots;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + Math.PI / 6, r = 24; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.3, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c34, metalness: 0.6, roughness: 0.4 })); pad.position.set(x, 0.2, z); pad.receiveShadow = true; pad.userData.plot = i; s.add(pad); this.picks.push(pad);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(7.1, 0.08, 6, 6), new THREE.MeshBasicMaterial({ color: plots[i] ? 0x39ff6a : 0x00e5ff, toneMapped: false })); edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI / 6; edge.position.set(x, 0.42, z); s.add(edge);
      const g = new THREE.Group(); g.position.set(x, 0.4, z); g.rotation.y = -a + Math.PI / 2; s.add(g); this.plots.push({ g, edge, x, z });
      if (plots[i]) this.buildBuilding(g, plots[i]); else { const plus = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 })); plus.position.y = 2.5; plus.userData.spin = true; g.add(plus); }
    }
    // robots wander between plots
    this.robots = [];
    const nBots = Math.max(1, plots.filter(p => p && p.type === 'robotbay').reduce((a, p) => a + p.lvl, 0));
    for (let k = 0; k < nBots + 1; k++) { const r = buildRobot([0x00e5ff, 0x39ff6a, 0xffb000, 0xff4fd8][k % 4]); r.position.set((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30); s.add(r); this.robots.push({ r, target: new THREE.Vector3(), t: 0, mode: 'walk', wait: 0 }); }
    this.robots.forEach(b => this.pickTarget(b));
    this.camState = { yaw: 0.6, pitch: 0.55, dist: 62, auto: true, center: new THREE.Vector3() };
    this.onSelect = onSelect;
  }
  pickTarget(b) { const p = this.plots[Math.floor(Math.random() * this.plots.length)]; b.target.set(p.x * 0.75 + (Math.random() - 0.5) * 6, 0, p.z * 0.75 + (Math.random() - 0.5) * 6); b.mode = 'walk'; }
  buildBuilding(g, plot) {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.5, ...o });
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    const L = plot.lvl;
    switch (plot.type) {
      case 'solar': for (let k = 0; k < 2 + L * 2; k++) { const p = add(new THREE.BoxGeometry(2.6, 0.08, 1.6), M(0x0d1a4a, { metalness: 0.9, roughness: 0.15 }), -3 + (k % 3) * 3, 1.3, -2.5 + Math.floor(k / 3) * 2.6); p.rotation.x = -0.5; add(new THREE.CylinderGeometry(0.06, 0.06, 1.3), M(0x999999), p.position.x, 0.65, p.position.z); } break;
      case 'refinery': for (let k = 0; k < L + 1; k++) add(new THREE.CylinderGeometry(1.4, 1.4, 4 + k, 20), M(0xd8d8d8), -2.5 + k * 2.6, (4 + k) / 2, 0); add(new THREE.CylinderGeometry(0.4, 0.5, 9, 12), M(0x666666), 3, 4.5, -2); add(new THREE.SphereGeometry(0.5, 12, 8), M(0xffc533, { emissive: 0xffa000, emissiveIntensity: 2 }), 3, 9.2, -2); break;
      case 'robotbay': { const h = add(new THREE.CylinderGeometry(4.5, 4.5, 9, 24, 1, false, 0, Math.PI), M(0xb8c0cc), 0, 0, 0); h.rotation.z = Math.PI / 2; h.position.y = 0.1; add(new THREE.PlaneGeometry(4, 3.5), M(0x00e5ff, { emissive: 0x00a0c0, emissiveIntensity: 1.6 }), 0, 1.8, 4.52); for (let k = 0; k < L; k++) { const r = buildRobot(0x00e5ff); r.position.set(-2 + k * 2, 0, 5.6); g.add(r); r.userData.animate(k, 'wave'); } break; }
      case 'workshop': add(new THREE.BoxGeometry(9, 5, 7), M(0x4a4f5a), 0, 2.5, 0); add(new THREE.PlaneGeometry(5, 3.6), M(0x222222), 0, 1.8, 3.52); add(new THREE.BoxGeometry(9.4, 0.4, 7.4), M(0xff6a00, { emissive: 0xff4000, emissiveIntensity: 0.8 }), 0, 5.2, 0); for (let k = 0; k < L; k++) add(new THREE.TorusGeometry(0.6, 0.15, 8, 16), M(0xffc533, { metalness: 1 }), -3 + k * 1.6, 6.2, 0); break;
      case 'nitro': for (let k = 0; k < L + 1; k++) add(new THREE.SphereGeometry(2, 20, 14), M(0x1460ff, { metalness: 0.8, roughness: 0.2 }), -2.5 + k * 5, 2.3, 0); add(new THREE.CylinderGeometry(0.2, 0.2, 6), M(0x7fd4ff, { emissive: 0x7fd4ff, emissiveIntensity: 2 }), 0, 2.3, 0).rotation.z = Math.PI / 2; break;
      case 'trophy': add(new THREE.BoxGeometry(10, 0.6, 7), M(0xeeeeee), 0, 0.3, 0); for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.35, 0.35, 5, 12), M(0xf4f4f4), -4 + (k % 3) * 4, 3.1, k < 3 ? -3 : 3); add(new THREE.BoxGeometry(10.5, 0.8, 7.5), M(0xeeeeee), 0, 5.9, 0); const tr = buildTrophy(); tr.scale.setScalar(4); tr.position.set(0, 6.3, 0); g.add(tr); break;
    }
  }

  trophies(save) {
    this.clear(); this.kind = 'trophy'; const s = this.scene = new THREE.Scene();
    s.environment = null; s.background = new THREE.Color(0x07080c); s.fog = new THREE.Fog(0x07080c, 20, 60);
    const pm = new THREE.PMREMGenerator(this.gfx.renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x404050, side: THREE.BackSide })));
    for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(-6 + k * 2.4, 8, 0); es.add(l); }
    this._trophyRT = pm.fromScene(es, 0.04); s.environment = this._trophyRT.texture; pm.dispose(); es.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    s.add(new THREE.HemisphereLight(0x8090b0, 0x101015, 0.6));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x14151c, roughness: 0.2, metalness: 0.4, clearcoat: 1 })); floor.receiveShadow = true; s.add(floor);
    const N = ACHIEVEMENTS.length, cols = 7;
    ACHIEVEMENTS.forEach((a, i) => {
      const got = !!save.achievements[a.id]; const r = Math.floor(i / cols), c = i % cols;
      const x = (c - (cols - 1) / 2) * 3.2, z = -r * 3.6;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.2, 24), new THREE.MeshPhysicalMaterial({ color: 0x1d1f28, metalness: 0.7, roughness: 0.3 })); ped.position.set(x, 0.6, z); ped.castShadow = true; s.add(ped);
      const t = buildTrophy(got ? [0xd4af37, 0xc0c0c0, 0xcd7f32][i % 3] : 0x30323a, i); t.position.set(x, 1.2, z); t.scale.setScalar(1.6); t.userData.spin = got; s.add(t);
      if (got) { const L = new THREE.SpotLight(0xfff0d0, 30, 10, 0.35, 0.6, 1.5); L.position.set(x, 6, z + 1); L.target = t; s.add(L); }
    });
    this.camState = { yaw: Math.PI / 2, pitch: 0.22, dist: 16, auto: true, center: new THREE.Vector3(0, 1.5, -6), pan: true };
  }

  rocket(fromPlanet, toPlanet, done) {
    this.clear(); this.kind = 'rocket'; const s = this.scene = new THREE.Scene();
    this.env = buildEnvironment(s, this.gfx.renderer, fromPlanet === 'earth' ? 'spaceport' : PLANET_ENV[fromPlanet], this.gfx.q, new THREE.Vector3()); if (this.env.water) this.env.water.position.y = -2;
    s.add(groundDisc(fromPlanet, 600));
    const padM = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 2, 32), new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.8 })); padM.position.y = 1; padM.receiveShadow = true; s.add(padM);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 90, 5), new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.7, roughness: 0.5 })); tower.position.set(12, 45, 0); tower.castShadow = true; s.add(tower);
    const rk = buildRocket(1); rk.position.y = 3.4; s.add(rk); this.rk = rk;
    this.fxA = new Particles(Math.round(2500 * this.gfx.q.particles) + 300, true); this.fxN = new Particles(Math.round(2500 * this.gfx.q.particles) + 300, false); s.add(this.fxA.points, this.fxN.points);
    this.cut = { t: 0, done, to: toPlanet, vy: 0, launched: false, finished: false };
    this.camState = null;
  }

  update(dt, cam) {
    if (this.env && this.env.exposure) this.gfx.renderer.toneMappingExposure = this.env.exposure; else if (this.kind === 'trophy') this.gfx.renderer.toneMappingExposure = 1;
    this.t += dt; const t = this.t;
    if (!this.scene) return;
    if (this.kind === 'garage' || this.kind === 'menu') {
      const c = this.camState; if (c.auto) c.yaw += dt * (this.kind === 'menu' ? 0.12 : 0.18);
      if (this.plate) { this.plate.rotation.y = 0; }
      cam.position.set(Math.cos(c.yaw) * c.dist, 1.4 + Math.sin(c.pitch) * c.dist * 0.6, Math.sin(c.yaw) * c.dist); cam.up.set(0, 1, 0); cam.lookAt(0, 0.9, 0); cam.fov = 45; cam.updateProjectionMatrix();
      animateUnderglow(this.car, t);
    } else if (this.kind === 'base') {
      const c = this.camState; if (c.auto) c.yaw += dt * 0.05;
      cam.position.set(Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist, Math.sin(c.pitch) * c.dist, Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist); cam.up.set(0, 1, 0); cam.lookAt(0, 2, 0); cam.fov = 50; cam.updateProjectionMatrix();
      this.plots.forEach(p => p.g.children.forEach(o => { if (o.userData.spin) { o.rotation.y = t; o.position.y = 2.5 + Math.sin(t * 2) * 0.3; } }));
      for (const b of this.robots) {
        const d = b.target.clone().sub(b.r.position); d.y = 0;
        if (b.mode === 'walk') { if (d.length() < 0.5) { b.mode = 'work'; b.wait = 2 + Math.random() * 3; } else { d.normalize(); b.r.position.addScaledVector(d, dt * 2.2); b.r.rotation.y = Math.atan2(d.x, d.z); } }
        else { b.wait -= dt; if (b.wait <= 0) this.pickTarget(b); }
        b.r.userData.animate(t + b.r.id, b.mode);
      }
      this.env.follow(new THREE.Vector3());
    } else if (this.kind === 'trophy') {
      const c = this.camState; c.yaw = Math.PI / 2 + Math.sin(t * 0.15) * 0.5;
      cam.position.set(c.center.x + Math.cos(c.yaw) * c.dist, c.center.y + 3, c.center.z + Math.sin(c.yaw) * c.dist + 6); cam.up.set(0, 1, 0); cam.lookAt(c.center); cam.fov = 55; cam.updateProjectionMatrix();
      this.scene.traverse(o => { if (o.userData.spin) o.rotation.y = t; });
    } else if (this.kind === 'rocket') {
      const c = this.cut; c.t += dt; const rk = this.rk;
      if (c.t > 3.2) { c.launched = true; c.vy += dt * (6 + c.t * 2.5); rk.position.y += c.vy * dt; rk.rotation.z = Math.min(0.25, (c.t - 6) * 0.04 * Math.max(0, c.t - 6)); }
      if (c.t > 2.2) { // engines
        const base = rk.position.clone().add(new THREE.Vector3(0, -1.5, 0));
        const n = c.launched ? 14 : 6;
        for (let k = 0; k < n; k++) { this.fxA.emit(base, new THREE.Vector3((Math.random() - 0.5) * 6, -40 - Math.random() * 20, (Math.random() - 0.5) * 6), { color: [1, 0.6 + Math.random() * 0.3, 0.25], size: 5, life: 0.5, grow: 6, jitter: 4 }); }
        for (let k = 0; k < (c.launched ? 6 : 10); k++) this.fxN.emit(new THREE.Vector3(rk.position.x, Math.max(2, rk.position.y - 6), rk.position.z), new THREE.Vector3((Math.random() - 0.5) * 50, Math.random() * 4, (Math.random() - 0.5) * 50), { color: [0.85, 0.85, 0.88], size: 10, life: 4, grow: 9, alpha: 0.45, drag: 0.6, jitter: 6 });
      }
      this.fxA.update(dt, this.gfx.vh); this.fxN.update(dt, this.gfx.vh);
      const shake = c.launched ? Math.max(0, 0.8 - (c.t - 3.2) * 0.1) : c.t > 2.2 ? 0.3 : 0;
      if (c.t < 5) { cam.position.set(60 + (Math.random() - 0.5) * shake, 14 + (Math.random() - 0.5) * shake, 70); cam.lookAt(rk.position.x, rk.position.y + 30, 0); cam.fov = 50; }
      else { cam.position.set(rk.position.x + 25, rk.position.y - 20, 30); cam.lookAt(rk.position.x, rk.position.y + 20, 0); cam.fov = 60; }
      cam.up.set(0, 1, 0); cam.updateProjectionMatrix(); this.env.follow(rk.position);
      if (c.t > 9.5 && !c.finished) { c.finished = true; c.done && c.done(); }
    }
  }

  pick(x, y) { // raycast base plots
    if (this.kind !== 'base') return null; const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), this.gfx.camera);
    const hit = ray.intersectObjects(this.picks, false)[0]; return hit ? hit.object.userData.plot : null;
  }
}
