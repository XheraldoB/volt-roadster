// Game simulation: Rapier physics (raycast vehicle) + all gameplay rules.
// No rendering here, so it can run headless in tests.
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three';
import { VEHICLES, vehicleOf } from './vehicles.js';
import { buildTrack, buildRoadArrays, poseAt, nearest, sampleAt, ROAD_W } from './track.js';
import { makeTerrain, terrainArrays } from './terrain.js';
import { PLANETS } from './levels.js';
import { rng } from './noise.js';

let rapierReady = null;
export const initPhysics = () => (rapierReady ??= RAPIER.init({}).catch(() => RAPIER.init()));

export const STEP = 1 / 120;
const EARTH_G = 9.81;
const tmpV = new Vector3(), tmpV2 = new Vector3(), tmpQ = new Quaternion();
const v3 = (o) => new Vector3(o.x, o.y, o.z);
const AI_NAMES = ['Nova', 'Sparky', 'Ion Ivy', 'Turbo Tess', 'Ampere', 'Watt Rodriguez', 'Coil', 'Dyna'];

export function carStats(up = {}, bonus = {}, veh = VEHICLES.roadster) {
  const l = k => up[k] || 0; const M = veh.mul || {};
  const st = {
    tank: 60 + 12 * l('tank') + (bonus.tank || 0),
    vmax: 52 + 6 * l('speed'),
    accel: 10 + 1.5 * l('accel'),
    grip: 3.1 + 0.35 * l('handling'),
    steer: 0.42 + 0.03 * l('handling'),
    boostMul: 1.5 + 0.1 * l('boost'),
    boostCap: (2.6 + 0.6 * l('boost')) * (1 + (bonus.nitroCap || 0)),
    jumpV: 5.5 + 0.8 * l('thruster'),
    thrustCap: 1.0 + 0.3 * l('thruster'),
    pickupR: 3.4 + 0.9 * l('magnet'),
    gasCap: 2.5 + 0.5 * l('gas'), // cold-gas RCS tank (seconds of full thrust)
  };
  st.accel *= M.accel ?? 1; st.vmax *= M.vmax ?? 1; st.grip *= M.grip ?? 1; st.steer *= M.steer ?? 1;
  return st;
}

export class Sim {
  constructor(level, opts = {}) {
    level = typeof structuredClone === 'function' ? structuredClone(level) : JSON.parse(JSON.stringify(level)); // buildTrack mutates segment defs
    this.level = level; this.planet = PLANETS[level.planet];
    this.mode = opts.mode || 'race'; // 'race' | 'trial'
    this.g = this.planet.gravity;
    this.veh = vehicleOf(opts.vehicle);
    this.stats = carStats(opts.upgrades, opts.bonus, this.veh);
    if (level.storm) this.stats.grip *= 1 - 0.12 * level.storm * (1 - 0.08 * ((opts.upgrades || {}).handling || 0)); // dust storms cut grip; handling tiers recover it
    this.drainMul = level.drainMul || 1;
    this.robots = opts.robots || 0;
    this.events = [];
    this.tr = buildTrack(level, this.g);
    this.terrain = makeTerrain(this.tr, level);
    this.rand = rng(level.id.length * 977 + level.diff * 13);
    this.time = 0; this.raceTime = 0; this.state = 'countdown'; this.countdown = 3.2;
    this.score = 0; this.coins = 0; this.combo = { chain: 0, mult: 1, timer: 0, pts: 0 };
    this.battery = this.stats.tank; this.boost = this.stats.boostCap * ((opts.bonus || {}).nitroStart ? 1 : 0.6); this.thrust = this.stats.thrustCap; this.gas = this.stats.gasCap; this.rcs = { px: 0, py: 0, pz: 0, lift: 0, on: false };
    this.stat = { pads: 0, flips: 0, rolls: 0, loops: 0, carJumps: 0, nearMiss: 0, perfect: 0, maxAir: 0, crashes: 0, gaps: 0, mailboxes: 0, maxSpeed: 0, drift: 0 };
    this.ghostRec = []; this.ghostT = 0;
  }

  async init() {
    await initPhysics();
    const R = RAPIER;
    const w = this.world = new R.World({ x: 0, y: -this.g, z: 0 });
    w.timestep = STEP;
    // road collider
    this.road = buildRoadArrays(this.tr);
    const c = this.road.col;
    const roadDesc = R.ColliderDesc.trimesh(new Float32Array(c.pos), new Uint32Array(c.idx)).setFriction(1.0);
    this.roadCollider = w.createCollider(roadDesc);
    // terrain collider (coarse)
    const ta = terrainArrays(this.terrain, 120);
    this.terrainCollider = w.createCollider(R.ColliderDesc.trimesh(ta.pos, ta.idx).setFriction(0.9));
    this.terrainHandle = this.terrainCollider.handle;
    this.buildCar();
    this.buildEntities();
    this.respawnAt(this.startS = 22, 0);
    this.lastCpS = 22;
    this.state = 'countdown';
    return this;
  }

  buildCar() {
    const R = RAPIER, w = this.world;
    const body = this.body = w.createRigidBody(R.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(0.02).setAngularDamping(0.4).setCanSleep(false));
    const V = this.veh; this.mass = V.mass;
    const col = R.ColliderDesc.cuboid(...V.half).setTranslation(0, 0.05, 0)
      .setMassProperties(this.mass, { x: V.com[0], y: V.com[1], z: V.com[2] }, { x: V.inertia[0], y: V.inertia[1], z: V.inertia[2] }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0.08).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(0.1);
    this.chassisCol = w.createCollider(col, body);
    this.roofCol = w.createCollider(R.ColliderDesc.cuboid(...V.roof.half).setTranslation(...V.roof.at).setDensity(0).setFriction(0.08).setFrictionCombineRule(R.CoefficientCombineRule.Min), body);
    const vc = this.vc = w.createVehicleController(body);
    vc.setIndexForwardAxis = 2;
    this.wheelPos = V.wheelPos.map(p => p.slice());
    for (const p of this.wheelPos) vc.addWheel({ x: p[0], y: p[1], z: p[2] }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, V.rest, V.radius);
    for (let i = 0; i < 4; i++) {
      vc.setWheelSuspensionStiffness(i, 52); vc.setWheelSuspensionCompression(i, 3.6); vc.setWheelSuspensionRelaxation(i, 4.2);
      vc.setWheelMaxSuspensionTravel(i, V.travel); vc.setWheelMaxSuspensionForce(i, 1e6);
      vc.setWheelFrictionSlip(i, this.stats.grip * (i < 2 ? 1.05 : 0.95)); vc.setWheelSideFrictionStiffness(i, 1.0);
    }
    this.steerCur = 0; this.prevVel = new Vector3(); this.contacts = 4; this.air = 0; this.airRot = new Vector3();
    this.pose = { p: new Vector3(), q: new Quaternion(), pp: new Vector3(), pq: new Quaternion() };
    this.hint = 0; this.prog = { s: 0, x: 0, h: 0, i: 0 }; this.maxS = 0; this.cpIndex = 0;
    this.jumpCd = 0; this.crashT = 0; this.upsideT = 0; this.stuckT = 0; this.offT = 0;
  }

  // ---------- entities ----------
  buildEntities() {
    const R = RAPIER, tr = this.tr, rand = this.rand, hw = ROAD_W / 2;
    // coins + batteries
    this.coinsList = []; this.pickups = [];
    for (let s = 60; s < tr.finishS - 20; s += 12) {
      const sm = sampleAt(tr, s);
      if (sm.gap) { // air coins along trajectory, every ~3rd sample
        if (Math.floor(s / 12) % 2 === 0) this.coinsList.push({ s, x: 0, h: 1.2, taken: false, air: true });
        continue;
      }
      const block = Math.floor(s / 120); const pattern = (block * 7 + 3) % 5;
      if ((block % 3) === 2 && !sm.loop && !sm.cork) continue; // breathing room
      let x = 0;
      if (pattern === 1) x = Math.sin(s / 30) * hw * 0.6;
      else if (pattern === 2) x = hw * 0.5 * ((block % 2) ? 1 : -1);
      else if (pattern === 3) x = -hw * 0.5 * ((block % 2) ? 1 : -1);
      if (sm.loop || sm.cork || sm.wall) x = 0;
      this.coinsList.push({ s, x, h: 1.0, taken: false });
    }
    for (let s = 300; s < tr.finishS - 60; s += 340) {
      let sm = sampleAt(tr, s); let k = 0;
      while ((sm.gap || sm.ramp) && k < 80) { s += 5; sm = sampleAt(tr, s); k++; }
      this.pickups.push({ s, x: ((Math.floor(s / 340) % 3) - 1) * hw * 0.5, h: 1.1, kind: 'battery', taken: false });
    }
    // boost pads every so often on straights
    for (const f of tr.features) if (f.type === 'traffic') this.pickups.push({ s: f.s0 + 30, x: 0, h: 1.1, kind: 'nitro', taken: false });
    // world positions for pickups
    for (const c of [...this.coinsList, ...this.pickups]) { const P = poseAt(tr, c.s, c.x, c.h); c.p = P.p.clone(); }

    // traffic + kicker ramps
    this.traffic = []; this.kickers = [];
    const kinDesc = () => R.RigidBodyDesc.kinematicPositionBased();
    for (const f of tr.features) if (f.type === 'traffic') {
      const L = f.s1 - f.s0;
      for (let k = 0; k < f.kickers; k++) {
        const s = f.s0 + L * (k + 0.5) / (f.kickers + 0.3) - 25;
        const x = ((k % 3) - 1) * hw * 0.55;
        const P = poseAt(tr, s, x, 0);
        const rb = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(P.p.x, P.p.y, P.p.z).setRotation(P.q));
        const verts = new Float32Array([-2, 0, -4, 2, 0, -4, -2, 0, 4, 2, 0, 4, -2, 1.7, 4, 2, 1.7, 4]);
        this.world.createCollider(R.ColliderDesc.convexHull(verts).setFriction(0.9), rb);
        this.kickers.push({ s, x, p: P.p.clone(), q: P.q.clone() });
      }
      for (let k = 0; k < f.count; k++) {
        const s = f.s0 + 40 + (L - 60) * k / Math.max(1, f.count);
        const lane = [-1, 0, 1][k % 3] * hw * 0.55;
        const type = ['sedan', 'van', 'truck', 'sedan', 'bus'][(k + f.count) % 5];
        const dims = { sedan: [0.9, 0.7, 2.2], van: [1.0, 1.1, 2.5], truck: [1.2, 1.5, 4.5], bus: [1.25, 1.5, 5.5] }[type];
        const rb = this.world.createRigidBody(kinDesc());
        this.world.createCollider(R.ColliderDesc.cuboid(...dims).setTranslation(0, dims[1], 0).setFriction(0.5), rb);
        this.traffic.push({ s, s0: f.s0 + 10, s1: f.s1 - 5, x: lane, v: 13 + rand() * 6, type, dims, rb, p: new Vector3(), q: new Quaternion(), pp: new Vector3(), pq: new Quaternion(), passed: false, color: rand() });
      }
    }
    // AI racers
    this.ai = [];
    if (this.mode === 'race') {
      const skill = 0.82 + this.level.diff * 0.035;
      const nAI = Math.max(1, Math.min(3, (this.level.objective && this.level.objective.ai) || 3));
      for (let k = 0; k < nAI; k++) {
        const rb = this.world.createRigidBody(kinDesc());
        this.world.createCollider(R.ColliderDesc.cuboid(0.95, 0.45, 2.15).setTranslation(0, 0.55, 0), rb);
        this.ai.push({ name: AI_NAMES[(k + this.level.diff * 2) % AI_NAMES.length], s: [36, 36, 50][k], x: [-4.2, 4.2, 0][k], tx: 0, v: 0, skill: skill * (0.97 + 0.025 * k), rb,
          p: new Vector3(), q: new Quaternion(), pp: new Vector3(), pq: new Quaternion(), finished: false, finishTime: 0, wheelRot: 0, color: k });
      }
    }
    // quest entities
    this.quest = { ...this.level.quest, done: false, failed: false, progress: 0, active: false, timer: 0 };
    this.questItems = [];
    const q = this.quest, L = tr.finishS;
    const place = (s, x, h, kind, extra = {}) => { const P = poseAt(tr, s, x, h); const o = { s, x, h, kind, p: P.p.clone(), q: P.q.clone(), taken: false, ...extra }; this.questItems.push(o); return o; };
    if (q.type === 'mailbox') {
      for (let k = 0; k < 12; k++) {
        let s = 120 + k * (L - 300) / 12; let sm = sampleAt(tr, s); let g = 0; while ((!sm.solid || sm.magnet || sm.ramp || sm.land) && g < 100) { s += 4; sm = sampleAt(tr, s); g++; }
        const side = k % 2 ? 1 : -1; const o = place(s, side * (hw - 1.4), 0, 'mailbox');
        const rb = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(o.p.x, o.p.y + 0.7, o.p.z).setRotation(o.q).setCanSleep(true));
        this.world.createCollider(R.ColliderDesc.cuboid(0.25, 0.7, 0.3).setDensity(25).setFriction(0.6), rb);
        rb.sleep(); o.rb = rb; o.smashed = false;
      }
    } else if (q.type === 'pizza' || q.type === 'deliver') {
      const s1 = this.safeS(L * 0.18), s2 = this.safeS(L * 0.62);
      place(s1, 0, 1.4, q.item || 'pizza', { role: 'pickup' });
      place(s2, hw + 6, 0, q.item === 'alien' ? 'ufo' : q.item === 'ice' ? 'base' : 'house', { role: 'drop' });
    } else if (q.type === 'ring') {
      const gapF = tr.features.find(f => f.type === 'gap' && tr.def.segments.some(sg => sg.ring && sg.name === f.name)) || tr.features.find(f => f.type === 'gap');
      // apex of trajectory
      let apex = null; for (const sm of tr.samples) if (sm.s >= gapF.s0 && sm.s <= gapF.s1 && (!apex || sm.p.y > apex.p.y)) apex = sm;
      place(apex.s, 0, 1.0, 'ring', { r: 7 });
    } else if (q.type === 'cow') {
      this.cow = place(this.safeS(260), -2, 0, 'cow', { v: 15, caught: false, anim: 0 });
    } else if (q.type === 'collect') {
      const gaps = tr.features.filter(f => f.type === 'gap');
      const spots = [];
      gaps.forEach(f => spots.push({ s: (f.s0 + f.s1) / 2, x: 0, h: 2.5 }));
      tr.features.filter(f => f.type === 'loop').forEach(f => spots.push({ s: (f.s0 + f.s1) / 2, x: 0, h: 1.2 }));
      for (let k = 0; spots.length < 8; k++) spots.push({ s: this.safeS(200 + k * 260), x: ((k % 2) ? 1 : -1) * (hw - 2), h: 1.2 });
      spots.slice(0, 8).forEach(sp => place(sp.s, sp.x, sp.h, q.item));
    } else if (q.type === 'rover') {
      place(this.safeS(L * 0.45), hw - 3, 0, 'rover', { hold: 0 });
    }
    // ghost
    this.ghost = null;
    // planet hazards / toys
    this.meteors = []; this.meteorT = 4; this.meteorsOn = this.planet.id === 'moon';
    this.devils = [];
    if (this.planet.id === 'mars') for (let k = 0; k < 3 + (this.level.storm ? 1 : 0); k++) {
      const s = this.safeS(300 + k * (tr.finishS - 500) / 3.2); const P = poseAt(tr, s, 0, 0);
      this.devils.push({ s, x: 0, phase: k * 1.7, p: P.p.clone(), used: false });
    }
    // easter egg: a little roadster floating in orbit on the moon (and an orbit car over Mars' summit)
    this.egg = null;
    if (this.level.id === 'm3' || this.level.id === 'r3') {
      const g = tr.features.filter(f => f.type === 'gap').pop();
      let apex = null; for (const sm of tr.samples) if (sm.s >= g.s0 && sm.s <= g.s1 && (!apex || sm.p.y > apex.p.y)) apex = sm;
      this.egg = { p: apex.p.clone().add(new Vector3(0, 38, 0)).addScaledVector(apex.X, 30), found: false };
    }
  }

  hazards(h) {
    const p = this.pose.p;
    if (this.meteorsOn) {
      this.meteorT -= h;
      if (this.meteorT <= 0) {
        this.meteorT = Math.max(1.6, 4.8 - this.level.diff * 0.55) * (0.6 + this.rand() * 0.8);
        const lead = Math.max(25, this.speed * 2.1);
        const s = this.prog.s + lead + (this.rand() - 0.3) * 30; const sm = sampleAt(this.tr, s);
        if (sm.solid && !sm.magnet) {
          const x = (this.rand() * 2 - 1) * ROAD_W * 0.4; const P = poseAt(this.tr, s, x, 0);
          this.meteors.push({ s, x, p: P.p.clone(), t: 2.3, T: 2.3, r: 4.5 });
          this.emit('meteorSpawn');
        }
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i]; m.t -= h;
        if (m.t <= 0) {
          const d = m.p.distanceTo(p);
          this.emit('meteorImpact', { p: m.p.clone(), d });
          if (d < m.r && this.crashT <= 0) this.crash('meteor');
          else if (d < 20) { this.stat.dodges = (this.stat.dodges || 0) + 1; this.addScore(400, 'METEOR DODGE!', 'near'); }
          this.meteors.splice(i, 1);
        }
      }
    }
    for (const d of this.devils) {
      d.x = Math.sin(this.time * 0.6 + d.phase) * ROAD_W * 0.35;
      const P = poseAt(this.tr, d.s, d.x, 0); d.p.copy(P.p);
      if (!d.used && d.p.distanceTo(p) < 7) {
        d.used = true; this.boost = this.stats.boostCap;
        const b = this.body; b.applyImpulse({ x: 0, y: this.mass * 11, z: 0 }, true);
        this.stat.devils = (this.stat.devils || 0) + 1; this.addScore(900, 'DUST DEVIL RIDE!', 'air'); this.emit('devil');
      }
    }
    if (this.egg && !this.egg.found && this.egg.p.distanceTo(p) < 70) { this.egg.found = true; this.addScore(5000, 'YOU FOUND THE ORBIT ROADSTER!', 'egg'); this.emit('easterEgg'); }
  }

  safeS(s) { let sm = sampleAt(this.tr, s), g = 0; while ((!sm.solid || sm.magnet || sm.ramp || sm.land || sm.loop) && g < 400) { s += 3; sm = sampleAt(this.tr, s); g++; } return s; }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  respawnAt(s, v = 22) {
    s = this.safeS(Math.max(0, s));
    if (v > 0) { // give enough run-up speed for an upcoming jump
      const g = this.tr.features.find(f => f.type === 'gap' && f.s0 > s && f.s0 - s < 420);
      if (g) { const sg = this.tr.def.segments.find(x => x.t === 'gap' && x.name === g.name); v = Math.max(v, (sg?.speed ?? 36) * 0.85); }
    }
    const P = poseAt(this.tr, s, 0, -this.veh.groundY + 0.18);
    const b = this.body;
    b.setTranslation({ x: P.p.x, y: P.p.y, z: P.p.z }, true);
    b.setRotation({ x: P.q.x, y: P.q.y, z: P.q.z, w: P.q.w }, true);
    const T = new Vector3(0, 0, 1).applyQuaternion(P.q).multiplyScalar(v);
    b.setLinvel({ x: T.x, y: T.y, z: T.z }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.pose.p.copy(P.p); this.pose.q.copy(P.q); this.pose.pp.copy(P.p); this.pose.pq.copy(P.q);
    this.prevVel.copy(T); this.hint = P.a.i; this.rail = null; this.air = 0; this.airRot.set(0, 0, 0); this.upsideT = 0; this.stuckT = 0; this.offT = 0;
    this.prog.s = s;
  }

  setGhost(data) { this.ghost = data && data.frames && data.frames.length ? data : null; }

  // ---------- main update ----------
  update(dt, input) {
    this.acc = (this.acc || 0) + Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 10) { this.fixed(STEP, input); this.acc -= STEP; n++; }
    if (n === 10) this.acc = 0;
    this.alpha = this.acc / STEP;
  }

  fixed(h, inp) {
    this.time += h;
    const b = this.body, vc = this.vc, st = this.stats;
    // save previous poses for interpolation
    this.pose.pp.copy(this.pose.p); this.pose.pq.copy(this.pose.q);
    for (const t of this.traffic) { t.pp.copy(t.p); t.pq.copy(t.q); }
    for (const a of this.ai) { a.pp.copy(a.p); a.pq.copy(a.q); }

    const running = this.state === 'race';
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= h;
      if (Math.ceil(this.countdown) !== before && before > 0) this.emit('count', { n: before - 1 });
      if (this.countdown <= 0) { this.state = 'race'; this.emit('go'); }
    }
    const control = running && this.crashT <= 0 && this.battery > 0;
    const pos = v3(b.translation()), rot = b.rotation(); const q = tmpQ.set(rot.x, rot.y, rot.z, rot.w);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(q), up = new Vector3(0, 1, 0).applyQuaternion(q), left = new Vector3(1, 0, 0).applyQuaternion(q);
    const vel = v3(b.linvel()); const speed = vel.length(); const fspeed = vel.dot(fwd);

    // track relation
    const nr = nearest(this.tr, pos, this.hint); this.hint = nr.i;
    const sm = this.tr.samples[nr.i];
    const rel = tmpV.copy(pos).sub(sm.p);
    this.prog.i = nr.i; this.prog.s = sm.s + rel.dot(sm.T); this.prog.x = rel.dot(sm.X); this.prog.h = rel.dot(sm.U);
    if (this.prog.s > this.maxS && Math.abs(this.prog.x) < ROAD_W) this.maxS = this.prog.s;

    // terrain only matters once we're off the road (fell, overshot) - avoids coarse terrain poking through the road
    const onRoadZone = sm.solid && Math.abs(this.prog.x) < ROAD_W / 2 + 3 && this.prog.h > -4;
    if (this.terrainCollider.isEnabled() === onRoadZone) this.terrainCollider.setEnabled(!onRoadZone);
    // contacts
    let contacts = 0; for (let i = 0; i < 4; i++) if (vc.wheelIsInContact(i)) contacts++;
    if (this.rail) contacts = 4;
    const grounded = contacts >= 2;

    // ---- corkscrew rail mode (coaster-style guidance through the barrel roll) ----
    if (!this.rail && sm.cork && grounded && fspeed > 14 && this.crashT <= 0) {
      const f = this.tr.features.find(f => f.type === 'cork' && this.prog.s >= f.s0 - 2 && this.prog.s < f.s1);
      if (f) this.rail = { s: this.prog.s, x: Math.max(-3, Math.min(3, this.prog.x)), v: fspeed, end: f.s1 };
    }
    if (this.rail) {
      const r = this.rail;
      r.v = Math.min(st.vmax * 1.2, r.v + ((inp.throttle || 0) * 4 - (inp.brake || 0) * 6) * h);
      r.s += r.v * h; r.x *= 1 - 2 * h;
      const P = poseAt(this.tr, r.s, r.x, 0.66);
      const T = new Vector3(0, 0, 1).applyQuaternion(P.q);
      b.setTranslation({ x: P.p.x, y: P.p.y, z: P.p.z }, true); b.setRotation({ x: P.q.x, y: P.q.y, z: P.q.z, w: P.q.w }, true);
      b.setLinvel({ x: T.x * r.v, y: T.y * r.v, z: T.z * r.v }, true);
      const nxt = poseAt(this.tr, r.s + 1, r.x, 0.66); const dq = nxt.q.clone().multiply(P.q.clone().invert());
      const sn = Math.sqrt(Math.max(1e-9, 1 - dq.w * dq.w)); const ang = 2 * Math.atan2(sn, dq.w) * r.v;
      b.setAngvel(sn > 1e-5 ? { x: dq.x / sn * ang, y: dq.y / sn * ang, z: dq.z / sn * ang } : { x: 0, y: 0, z: 0 }, true);
      if (r.s >= r.end) this.rail = null;
    }
    // ---- driving forces ----
    const thr = control ? (inp.throttle || 0) : (this.state === 'countdown' ? 0 : 0);
    const brk = control ? (inp.brake || 0) : (running ? 0.2 : 1);
    const boosting = control && inp.boost && (this.wasBoost ? this.boost > 0.01 : this.boost > 0.2);
    const vmax = st.vmax * (boosting ? 1.28 : 1);
    let drive = 0;
    if (thr > 0) {
      const ratio = Math.max(0, fspeed) / vmax;
      drive = this.mass * st.accel * (boosting ? st.boostMul : 1) * thr * Math.max(0, 1 - ratio * ratio * ratio);
    }
    // ramp launch assist: heavy vehicles (and stock cars) get topped up to the jump's design speed while on the take-off ramp
    if (sm.ramp && grounded && thr > 0.5 && fspeed > 20 && true) {
      const f = this.tr.features.find(f => f.type === 'gap' && this.prog.s > f.s0 - 60 && this.prog.s < f.s0 + 2);
      const req = f ? (this.tr.def.segments.find(sg => sg.t === 'gap' && sg.name === f.name)?.speed ?? 40) * 1.04 : 0;
      if (req && fspeed < req) drive = Math.max(drive, this.mass * Math.min(14, (req - fspeed) * 2.2));
    }
    let braking = 0;
    if (brk > 0) { if (fspeed > 1.5) braking = 38 * brk * this.mass / 1650; else drive = -this.mass * 5 * brk * (fspeed > -14 ? 1 : 0); }
    if (!control && running) braking = Math.max(braking, 6);
    for (let i = 0; i < 4; i++) { vc.setWheelEngineForce(i, drive * (i < 2 ? 0.42 : 0.58) / 2); vc.setWheelBrake(i, braking * (i < 2 ? 0.6 : 0.4)); }
    // steering (speed-sensitive, smoothed)
    const target = (control ? (inp.steer || 0) : 0) * (st.steer / (1 + Math.max(0, speed) / 28) + 0.035);
    const rate = 6 * h; this.steerCur += Math.max(-rate, Math.min(rate, target - this.steerCur));
    vc.setWheelSteering(0, -this.steerCur); vc.setWheelSteering(1, -this.steerCur);

    // stiffer springs under high g (loops / walls), like a real coaster-tuned setup
    const smA = sampleAt(this.tr, this.prog.s + fspeed * 0.08); // tiny look-ahead
    const load = Math.max(0, fspeed * fspeed * Math.max(0, smA.k)) + (sm.magnet ? EARTH_G : Math.max(0, this.g * sm.U.y)) + EARTH_G * this.planet.assist;
    const want = Math.min(320, Math.max(52, 52 * load / EARTH_G));
    this.curStiff = this.curStiff ?? 52;
    const ns = this.curStiff + Math.max(-3, Math.min(3, want - this.curStiff));
    if (ns !== this.curStiff) { for (let i = 0; i < 4; i++) vc.setWheelSuspensionStiffness(i, ns); this.curStiff = ns; }
    // ---- gravity shaping: loops/walls magnet + grip assist + downforce ----
    const m = this.mass;
    const nearSurf = sm.solid && Math.abs(this.prog.x) < ROAD_W * 0.6 && this.prog.h > -1 && this.prog.h < 3.2;
    const magnet = !this.rail && sm.magnet && nearSurf && fspeed > 9 && up.dot(sm.U) > 0.4;
    if (magnet) {
      // cancel world gravity and pull toward the track surface
      const gm = Math.max(this.g, EARTH_G) * 1.05 + Math.max(0, -fspeed * fspeed * smA.k) * 1.15;
      b.applyImpulse({ x: (-sm.U.x * gm) * m * h, y: (this.g - sm.U.y * gm) * m * h, z: (-sm.U.z * gm) * m * h }, true);
      // "rail" assist: follow the track's twist rate and keep the chassis aligned with the surface
      const nx = this.tr.samples[Math.min(this.tr.samples.length - 1, sm.i + 1)];
      const dq = nx.q.clone().multiply(sm.q.clone().invert());
      const ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w))) * (dq.w < 0 ? -1 : 1);
      const sn = Math.sqrt(Math.max(1e-9, 1 - dq.w * dq.w));
      const rate = (nx.s - sm.s) > 0 ? ang / (nx.s - sm.s) * fspeed : 0;
      const wantW = new Vector3(dq.x / sn, dq.y / sn, dq.z / sn).multiplyScalar(sn > 1e-4 ? rate : 0);
      const align = new Vector3().crossVectors(up, sm.U).multiplyScalar(sm.cork ? 9 : 5);
      const av0 = v3(b.angvel());
      // keep player yaw input: only correct the components around forward and left axes
      const target = wantW.add(align);
      const corr = target.sub(av0); const yawPart = up.clone().multiplyScalar(corr.dot(up));
      corr.sub(yawPart).multiplyScalar(sm.cork ? 0.9 : 0.25);
      b.setAngvel({ x: av0.x + corr.x, y: av0.y + corr.y, z: av0.z + corr.z }, true);
    }
    if (grounded) {
      const assist = this.planet.assist * EARTH_G; // grip thrusters on low-g worlds
      const df = Math.min(1.2 * EARTH_G, 0.0035 * speed * speed) + assist;
      b.applyImpulse({ x: -up.x * df * m * h, y: -up.y * df * m * h, z: -up.z * df * m * h }, true);
    }
    // ---- boost ----
    if (boosting) { this.boost = Math.max(0, this.boost - h); if (!this.wasBoost) this.emit('boost'); }
    else this.boost = Math.min(st.boostCap, this.boost + h * 0.06);
    this.wasBoost = boosting; this.boosting = boosting;
    if (boosting && !grounded) b.applyImpulse({ x: fwd.x * m * 6 * h, y: fwd.y * m * 6 * h, z: fwd.z * m * 6 * h }, true);
    // ---- jump / thruster ----
    this.jumpCd -= h; this.thrusting = false; this.rcs.lift = 0; this.rcs.px = 0; this.rcs.py = 0;
    if (control && inp.jump) {
      if (grounded && this.jumpCd <= 0 && !this.jumpHeld) {
        const j = st.jumpV * m; b.applyImpulse({ x: up.x * j, y: up.y * j, z: up.z * j }, true);
        this.jumpCd = 0.6; this.emit('jump');
      } else if (!grounded && !this.veh.rcs && this.thrust > 0 && this.air > 0.25) {
        this.thrust = Math.max(0, this.thrust - h); this.thrusting = true;
        b.applyImpulse({ x: 0, y: m * (this.g * 1.25 + 2) * h, z: 0 }, true);
        b.applyImpulse({ x: fwd.x * m * 3 * h, y: 0, z: fwd.z * m * 3 * h }, true);
      } else if (!grounded && this.veh.rcs && this.gas > 0 && this.air > 0.12) {
        // cold-gas hover / soft-landing burn: holds altitude and bleeds off sink rate
        const vy = b.linvel().y; this.gas = Math.max(0, this.gas - h); this.thrusting = true; this.rcs.lift = 1;
        const up2 = this.g * 1.12 + Math.max(0, -vy) * 2.2;
        b.applyImpulse({ x: 0, y: m * up2 * h, z: 0 }, true);
      }
    }
    this.jumpHeld = !!inp.jump;
    if (grounded) { this.thrust = Math.min(st.thrustCap, this.thrust + h * 0.5); this.gas = Math.min(st.gasCap, this.gas + h * 0.22); }
    // ---- air control ----
    const av = v3(b.angvel());
    if (!grounded) {
      const pitchIn = control ? (inp.pitch || 0) : 0; // + = nose up (backflip)
      const rollIn = control ? (inp.steer || 0) : 0;
      const I = 2600 * (this.veh.inertia[0] / 3000), useRcs = this.veh.rcs && this.gas > 0;
      const k = 5.5 * h * I * (useRcs ? 1.35 : this.veh.rcs ? 0.25 : 1);
      if (this.veh.rcs) { const act = (Math.abs(pitchIn) > 0.05 ? 1 : 0) + (Math.abs(rollIn) > 0.05 ? 1 : 0); this.rcs.px = useRcs ? pitchIn : 0; this.rcs.py = useRcs ? rollIn : 0; if (useRcs && act && this.air > 0.2) this.gas = Math.max(0, this.gas - h * 0.35 * act); }
      if (Math.abs(pitchIn) > 0.05 && this.air > 0.2) b.applyTorqueImpulse({ x: left.x * pitchIn * k, y: left.y * pitchIn * k, z: left.z * pitchIn * k }, true);
      if (Math.abs(rollIn) > 0.05 && this.air > 0.2) {
        const ax = inp.airRoll ? fwd : up; const sgn = inp.airRoll ? 1 : -1;
        b.applyTorqueImpulse({ x: ax.x * rollIn * k * sgn, y: ax.y * rollIn * k * sgn, z: ax.z * rollIn * k * sgn }, true);
      }
      // landing assist: level towards the track up when no input
      if (inp.assist !== false && Math.abs(pitchIn) < 0.05 && Math.abs(rollIn) < 0.05 && this.air > 0.15) {
        const tgt = sm.gap ? new Vector3(0, 1, 0) : sm.U;
        const ax = new Vector3().crossVectors(up, tgt);
        const kk = 1800 * h;
        b.applyTorqueImpulse({ x: (ax.x * 4 - av.x * 0.9) * kk, y: (ax.y * 4 - av.y * 0.6) * kk, z: (ax.z * 4 - av.z * 0.9) * kk }, true);
      }
    }
    // ---- kinematic actors ----
    this.updateTraffic(h); this.updateAI(h, running); this.updateCow(h, running);

    // ---- physics step ----
    vc.updateVehicle(h);
    this.world.step();

    // ---- post step ----
    const np = v3(b.translation()), nrr = b.rotation();
    this.pose.p.copy(np); this.pose.q.set(nrr.x, nrr.y, nrr.z, nrr.w);
    let nv = v3(b.linvel());
    // solver safety net: never let a single step inject absurd energy (deep penetration ejections)
    const vLim = Math.max(this.prevVel.length() + 25, 30);
    if (nv.length() > vLim && nv.length() > this.stats.vmax * 1.3) { nv.setLength(Math.min(this.prevVel.length(), this.stats.vmax * 1.3)); b.setLinvel({ x: nv.x, y: nv.y, z: nv.z }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
    this.speed = nv.length(); this.fspeed = nv.dot(fwd); this.grounded = grounded; this.contacts = contacts;
    this.stat.maxSpeed = Math.max(this.stat.maxSpeed, this.speed);
    // impact detection
    const imp = Math.max(0, (this.prevVel.length() - nv.length()) / h); // sudden speed loss = impact
    this.prevVel.copy(nv);
    // scraping walls / bottoming out (for sparks)
    let scrape = false; this.world.contactPair(this.chassisCol, this.roadCollider, m => { if (m.numContacts() > 0) scrape = true; });
    if (!scrape) this.world.contactPair(this.roofCol, this.roadCollider, m => { if (m.numContacts() > 0) scrape = true; });
    this.scrape = scrape;
    if (running) this.rules(h, { grounded, contacts, imp, up, fwd, sm, speed, inp, boosting, av });
    // countdown: hold the car
    if (this.state === 'countdown') { b.setLinvel({ x: 0, y: Math.min(0, nv.y), z: 0 }, true); }
    if (this.state === 'finished') { for (let i = 0; i < 4; i++) vc.setWheelBrake(i, 10); }
  }

  updateTraffic(h) {
    for (const t of this.traffic) {
      t.s += t.v * h; let wrapped = false;
      // wrap to the section start only when the player is not near the respawn point (a kinematic teleport would launch the car)
      if (t.s > t.s1) { if (Math.abs(this.prog.s - t.s0) > 40) { t.s = t.s0; wrapped = true; } else t.s = t.s1; }
      const P = poseAt(this.tr, t.s, t.x, 0);
      t.p.copy(P.p); t.q.copy(P.q);
      if (wrapped || t.pp.lengthSq() === 0) { t.pp.copy(t.p); t.pq.copy(t.q); t.rb.setTranslation({ x: P.p.x, y: P.p.y, z: P.p.z }, true); t.rb.setRotation({ x: P.q.x, y: P.q.y, z: P.q.z, w: P.q.w }, true); }
      t.rb.setNextKinematicTranslation({ x: P.p.x, y: P.p.y, z: P.p.z }); t.rb.setNextKinematicRotation({ x: P.q.x, y: P.q.y, z: P.q.z, w: P.q.w });
    }
  }

  updateAI(h, running) {
    const ps = this.prog.s;
    for (const a of this.ai) {
      if (running && !a.finished) {
        const sm = sampleAt(this.tr, a.s);
        let target = (34 + this.level.diff * 2.4) * a.skill / 0.9;
        // look ahead for gaps -> hit design speed; loops fine
        const ahead = sampleAt(this.tr, a.s + 40);
        if (sm.gap || ahead.gap || sm.ramp) { const f = this.tr.features.find(f => f.type === 'gap' && a.s < f.s1 + 1 && a.s > f.s0 - 80); if (f) target = Math.max(target * 0.6, (this.tr.def.segments.find(sg => sg.t === 'gap' && sg.name === f.name)?.speed ?? 40) * 1.06); }
        // curvature slow-down
        const c = Math.abs(1 - sm.T.dot(ahead.T));
        if (!sm.gap && !sm.loop && !sm.cork) target *= 1 - Math.min(0.25, c * 1.5);
        // rubber band
        const gap = a.s - ps;
        if (gap > 160) target *= 0.72; else if (gap > 50) target *= 0.85; else if (gap > 0) target *= 0.93; else if (gap < -120) target *= 1.18; else if (gap < -40) target *= 1.08;
        const acc = a.v < target ? 9 : -12; a.v = Math.max(0, a.v + acc * h); if (Math.abs(a.v - target) < 0.5) a.v = target;
        if (sm.gap) a.v = Math.max(a.v, target * 0.98);
        a.s += a.v * h;
        // dodge traffic
        let tx = a.tx;
        for (const t of this.traffic) if (t.s > a.s && t.s - a.s < 35 && Math.abs(t.x - a.x) < 3.2) tx = t.x > 0 ? t.x - 4.5 : t.x + 4.5;
        if (this.prog.s > a.s && this.prog.s - a.s < 25 && Math.abs(this.prog.x - a.x) < 3) tx = this.prog.x > 0 ? this.prog.x - 4.5 : this.prog.x + 4.5;
        tx = Math.max(-5, Math.min(5, tx));
        a.tx = tx; a.x += Math.max(-4 * h, Math.min(4 * h, tx - a.x));
        if (a.s >= this.tr.finishS) { a.finished = true; a.finishTime = this.raceTime; this.emit('aiFinish', { name: a.name }); }
      } else if (a.finished) { a.v *= 0.98; a.s += a.v * h; }
      a.wheelRot += a.v * h / 0.36;
      const P = poseAt(this.tr, a.s, a.x, 0);
      a.p.copy(P.p); a.q.copy(P.q);
      if (a.pp.lengthSq() === 0) { a.pp.copy(a.p); a.pq.copy(a.q); }
      a.rb.setNextKinematicTranslation({ x: P.p.x, y: P.p.y, z: P.p.z }); a.rb.setNextKinematicRotation({ x: P.q.x, y: P.q.y, z: P.q.z, w: P.q.w });
    }
  }

  updateCow(h, running) {
    const c = this.cow; if (!c || c.caught) return;
    if (running) {
      const d = c.s - this.prog.s;
      c.v = d < 60 ? 17 + (this.level.diff) : d > 160 ? 6 : 13;
      c.s = Math.min(this.tr.finishS - 10, c.s + c.v * h);
      c.x = Math.sin(this.time * 0.9) * 4;
      c.anim += h * c.v;
    }
    const P = poseAt(this.tr, c.s, c.x, 0); c.p.copy(P.p); c.q.copy(P.q);
  }

  addScore(pts, text, kind = 'trick') {
    const cb = this.combo;
    cb.chain++; cb.timer = 4; cb.mult = Math.min(8, 1 + Math.floor(cb.chain / 2) * 0.5);
    const total = Math.round(pts * cb.mult);
    this.score += total; cb.pts += total;
    this.emit('score', { text, pts: total, mult: cb.mult, kind });
    if (this.boost < this.stats.boostCap) this.boost = Math.min(this.stats.boostCap, this.boost + pts / 4000);
  }

  rules(h, c) {
    const st = this.stats, tr = this.tr, b = this.body, sm = c.sm;
    this.raceTime += h;
    // combo timer
    if (this.combo.chain > 0) { this.combo.timer -= h; if (this.combo.timer <= 0) { if (this.combo.chain >= 3) this.emit('comboEnd', { pts: this.combo.pts, chain: this.combo.chain }); this.combo.chain = 0; this.combo.mult = 1; this.combo.pts = 0; } }
    // battery
    if (this.crashT <= 0) this.battery = Math.max(0, this.battery - h * this.drainMul * ((c.grounded ? 1 : 0.3) + (c.boosting ? 0.7 : 0) + (this.thrusting && !this.veh.rcs ? 1.5 : 0)));
    if (this.battery <= 0) {
      if (!this.batteryOutT) { this.batteryOutT = 0; this.emit('batteryOut'); }
      this.batteryOutT += h; if (this.speed < 1.5 && this.batteryOutT > 2 || this.batteryOutT > 9) return this.finish(false, 'battery');
    }
    // crash handling
    if (this.crashT > 0) { this.crashT -= h; if (this.crashT <= 0) { this.respawnAt(this.lastCpS ?? 0); this.emit('respawn'); } return; }
    // air / tricks
    if (!c.grounded) {
      this.air += h;
      const q = this.pose.q; const inv = q.clone().invert(); const local = c.av.clone().applyQuaternion(inv);
      this.airRot.x += local.x * h; this.airRot.y += local.y * h; this.airRot.z += local.z * h;
      // car jumps over traffic
      for (const t of this.traffic) {
        const ds = this.prog.s - t.s;
        if (!t.jumped && ds > 0 && ds < 4 && this.prog.h > t.dims[1] * 2 && Math.abs(this.prog.x - t.x) < 6) { t.jumped = true; this.stat.carJumps++; this.addScore(600, 'CAR JUMP!', 'jump'); this.emit('carJump'); }
      }
      if (this.air > 0.8 && !this.airAnnounced) { this.airAnnounced = true; this.wasGap = sm.gap; }
      if (sm.gap) this.overGap = this.tr.features.find(f => f.type === 'gap' && this.prog.s >= f.s0 - 5 && this.prog.s <= f.s1 + 5) || this.overGap;
    } else {
      if (this.air > 0.45) this.landed(c);
      this.air = 0; this.airRot.set(0, 0, 0); this.airAnnounced = false;
      for (const t of this.traffic) t.jumped = false;
      // drift points
      const vel = v3(b.linvel()); const slip = vel.length() > 12 ? Math.abs(Math.atan2(vel.dot(new Vector3(1, 0, 0).applyQuaternion(this.pose.q)), Math.max(1, vel.dot(c.fwd)))) : 0;
      if (slip > 0.22) { this.driftT = (this.driftT || 0) + h; this.drifting = true; }
      else if (this.drifting) { if (this.driftT > 0.8) { this.stat.drift += this.driftT; this.addScore(Math.round(this.driftT * 300), `DRIFT ${this.driftT.toFixed(1)}s`, 'drift'); } this.drifting = false; this.driftT = 0; }
    }
    this.stat.maxAir = Math.max(this.stat.maxAir, this.air);
    // hits (walls, traffic)
    if (c.imp > 90 && !this.justLanded) { this.emit('hit', { strength: Math.min(1, c.imp / 300) }); if (this.combo.chain && c.imp > 150) { this.combo.timer = Math.min(this.combo.timer, 0.5); } }
    this.justLanded = false;
    // traffic: near miss / crash
    for (const t of this.traffic) {
      const ds = t.s - this.prog.s;
      const dx = Math.abs(this.prog.x - t.x);
      if (Math.abs(ds) < t.dims[2] + 2.3 && dx < t.dims[0] + 1.05 && this.prog.h < t.dims[1] * 2 && this.speed - t.v > 18 * this.veh.tough && !t.hitT) { t.hitT = 2; this.crash('traffic'); return; }
      if (t.hitT) t.hitT -= h;
      if (ds > -1 && ds < 1 && !t.passed && c.grounded) { t.passed = true; if (dx < t.dims[0] + 3.4 && dx > t.dims[0] + 0.9) { this.stat.nearMiss++; this.addScore(300, 'NEAR MISS!', 'near'); this.emit('nearMiss'); } }
      if (ds > 8) t.passed = false;
    }
    // loops / corks / walls completion
    for (const f of tr.features) {
      if (f.type !== 'loop' && f.type !== 'cork' && f.type !== 'wall') continue;
      if (!f.state && this.prog.s > f.s0 && this.prog.s < f.s0 + 10) f.state = 'in';
      if (f.state === 'in' && this.prog.s > f.s1) {
        f.state = 'done';
        if (f.type === 'loop') { this.stat.loops++; this.addScore(800, (f.name || 'LOOP').toUpperCase() + '!', 'loop'); this.emit('loop', { name: f.name }); }
        else if (f.type === 'cork') this.addScore(1000, 'CORKSCREW!', 'loop');
        else this.addScore(600, 'WALL RIDE!', 'loop');
      }
      if (f.state === 'in' && this.prog.s < f.s0 - 30) f.state = null;
    }
    // crash conditions
    const upDot = c.up.dot(sm.gap ? new Vector3(0, 1, 0) : sm.U);
    if (upDot < -0.1 && this.contacts === 0 && this.speed < 18) { this.upsideT += h; if (this.upsideT > 1.1) return this.crash('flip'); } else this.upsideT = Math.max(0, this.upsideT - h);
    const below = sm.gap ? this.prog.h < -14 : this.prog.h < -9;
    if (below || Math.abs(this.prog.x) > 90 || this.pose.p.y < -400) { this.offT += h; if (this.offT > (below ? 0.4 : 1.2)) return this.crash(below ? 'fall' : 'off'); } else this.offT = 0;
    if (Math.abs(this.prog.x) > ROAD_W * 0.65 && c.grounded && !sm.gap) { this.stuckT += h; if (this.stuckT > 2.5) return this.crash('off'); }
    else if (this.speed < 1 && c.inp.throttle > 0.5) { this.stuckT += h; if (this.stuckT > 3) return this.crash('stuck'); }
    else this.stuckT = 0;
    // checkpoints
    const cps = tr.checkpoints;
    while (this.cpIndex + 1 < cps.length && this.prog.s > cps[this.cpIndex + 1] && Math.abs(this.prog.x) < ROAD_W) {
      this.cpIndex++; this.lastCpS = cps[this.cpIndex];
      const bonus = 3 + this.robots * 1;
      this.battery = Math.min(st.tank, this.battery + bonus);
      this.emit('checkpoint', { n: this.cpIndex, bonus });
    }
    // pickups
    const p = this.pose.p;
    for (const cn of this.coinsList) if (!cn.taken && Math.abs(cn.s - this.prog.s) < 6 && cn.p.distanceToSquared(p) < st.pickupR * st.pickupR) {
      cn.taken = true; this.coins++; this.score += 10; this.emit('coin', { p: cn.p });
    }
    for (const pk of this.pickups) if (!pk.taken && Math.abs(pk.s - this.prog.s) < 6 && pk.p.distanceToSquared(p) < 3.8 * 3.8) {
      pk.taken = true;
      if (pk.kind === 'battery') { this.battery = Math.min(st.tank, this.battery + 12); this.gas = Math.min(st.gasCap, this.gas + 1); this.emit('battery', { p: pk.p }); }
      else { this.boost = st.boostCap; this.emit('nitro', { p: pk.p }); }
    }
    this.questRules(h, c);
    this.hazards(h);
    // ghost recording (10 Hz)
    this.ghostT += h; if (this.ghostT >= 0.1) { this.ghostT = 0; const q = this.pose.q; this.ghostRec.push([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3), +q.w.toFixed(3)]); }
    // finish
    if (this.prog.s >= tr.finishS && Math.abs(this.prog.x) < ROAD_W) this.finish(true);
  }

  landed(c) {
    const t = this.air, rot = this.airRot;
    const upDot = c.up.dot(c.sm.U);
    this.justLanded = true;
    const vy = Math.abs(this.prevVel.dot(c.sm.U));
    this.emit('land', { strength: Math.min(1, (vy + t * 2) / 25), air: t });
    if (upDot < 0.45 / this.veh.tough) { this.crash('landing'); return; }
    const flips = Math.floor((Math.abs(rot.x) + 0.6) / (Math.PI * 2));
    const rolls = Math.floor((Math.abs(rot.z) + 0.6) / (Math.PI * 2));
    const spins = Math.floor((Math.abs(rot.y) + 0.5) / (Math.PI * 2));
    if (t > 0.8) this.addScore(Math.round(t * 150), `AIR ${t.toFixed(1)}s`, 'air');
    if (flips) { this.stat.flips += flips; this.addScore(1200 * flips, flips > 1 ? `${flips}x FLIP!` : (rot.x < 0 ? 'BACKFLIP!' : 'FRONTFLIP!'), 'flip'); }
    if (rolls) { this.stat.rolls += rolls; this.addScore(900 * rolls, rolls > 1 ? `${rolls}x BARREL ROLL!` : 'BARREL ROLL!', 'flip'); }
    if (spins) this.addScore(600 * spins, `${spins * 360} SPIN!`, 'flip');
    // gap cleared + landing pad precision
    const g = this.overGap;
    if (g && !g.cleared && this.prog.s > g.s1 - 2) {
      g.cleared = true; this.stat.gaps++;
      this.addScore(g.cliff ? 900 : 700, (g.name ? g.name.toUpperCase() : (g.cliff ? 'CLIFF' : 'CANYON')) + ' CLEARED', 'gap');
      const d = Math.hypot(this.prog.s - g.padS, this.prog.x);
      if (d < g.padR) this.stat.pads++;
      if (d < 2.5) { this.stat.perfect++; this.addScore(2500, 'PERFECT LANDING!', 'pad'); this.emit('perfect'); }
      else if (d < g.padR) { this.addScore(Math.round(1500 * (1 - d / g.padR)) + 300, `PAD LANDING ${d.toFixed(1)}m`, 'pad'); this.emit('pad'); }
      if (upDot > 0.97 && t > 1) this.addScore(250, 'CLEAN LANDING', 'clean');
    }
    this.overGap = null;
  }

  crash(reason) {
    if (this.crashT > 0 || this.state !== 'race') return;
    this.crashT = 1.6; this.stat.crashes++;
    this.combo.chain = 0; this.combo.mult = 1; this.combo.pts = 0;
    this.emit('crash', { reason, p: this.pose.p.clone() });
    const q = this.quest; if (q && q.noCrash && q.active && !q.done) { q.active = false; q.failed = true; this.emit('questFail', { text: 'You crashed - the pizza is now modern art.' }); }
    // quest delivery items are lost? keep it lenient
  }

  questRules(h, c) {
    const q = this.quest; if (q.done || q.failed) return;
    const p = this.pose.p;
    if (q.type === 'mailbox') {
      for (const o of this.questItems) if (!o.smashed && o.p.distanceToSquared(p) < 3.2 * 3.2) {
        o.smashed = true; q.progress++; this.stat.mailboxes++;
        const f = this.body.linvel();
        o.rb.wakeUp(); o.rb.applyImpulse({ x: f.x * 6 + (Math.random() - 0.5) * 50, y: 260, z: f.z * 6 }, true); o.rb.applyTorqueImpulse({ x: 40, y: 30, z: 20 }, true);
        this.addScore(200, 'MAILBOX SMASH!', 'quest'); this.emit('mailbox', { p: o.p });
        if (q.progress >= q.count) this.completeQuest();
      }
    } else if (q.type === 'pizza' || q.type === 'deliver') {
      const [pick, drop] = this.questItems;
      if (!q.active && !pick.taken && pick.p.distanceToSquared(p) < 4.5 * 4.5) { pick.taken = true; q.active = true; q.timer = q.time; this.emit('questStart', { text: q.item === 'alien' ? 'Alien on board! Get it to the UFO' : q.item === 'ice' ? 'Ice core loaded! Hurry before it melts' : 'Pizza grabbed! Deliver it hot!' }); }
      if (q.active) {
        q.timer -= h;
        if (this.prog.s > drop.s - 3) { q.active = false; this.completeQuest(); }
        else if (q.timer <= 0) { q.active = false; q.failed = true; this.emit('questFail', { text: q.item === 'alien' ? 'The alien got bored and teleported home' : q.item === 'ice' ? 'The ice core melted into a puddle' : 'The pizza went cold. Sad pizza.' }); }
      }
    } else if (q.type === 'ring') {
      const r = this.questItems[0]; if (r.p.distanceToSquared(p) < r.r * r.r) { r.taken = true; this.completeQuest(); }
    } else if (q.type === 'cow') {
      const cw = this.cow; if (cw && !cw.caught && cw.p.distanceToSquared(p) < 5 * 5) { cw.caught = true; this.emit('moo'); this.completeQuest(); }
    } else if (q.type === 'collect') {
      for (const o of this.questItems) if (!o.taken && o.p.distanceToSquared(p) < 4 * 4) { o.taken = true; q.progress++; this.emit('questItem', { p: o.p, n: q.progress, of: q.count }); if (q.progress >= q.count) this.completeQuest(); }
    } else if (q.type === 'rover') {
      const o = this.questItems[0];
      if (o.p.distanceToSquared(p) < 12 * 12 && this.speed < 3.5) { o.hold += h; if (o.hold > 2) { this.emit('beep'); this.completeQuest(); } } else o.hold = 0;
    }
  }

  completeQuest() { const q = this.quest; if (q.done) return; q.done = true; this.score += 1000; this.emit('questDone', { name: q.name, reward: q.reward }); }

  position() { // 1-based race position
    let pos = 1; for (const a of this.ai) if ((a.finished && !this.finishedOk) || a.s > this.prog.s) pos++;
    return pos;
  }

  finish(ok, reason) {
    if (this.state === 'finished') return;
    this.state = 'finished'; this.finishedOk = ok;
    const position = this.mode === 'race' ? (ok ? 1 + this.ai.filter(a => a.finished).length : 4) : 1;
    const timeBonus = ok ? Math.max(0, Math.round((this.tr.length / 30 - this.raceTime) * 40)) : 0;
    const posBonus = ok && this.mode === 'race' ? [0, 3000, 1500, 600, 0][position] : 0;
    const coinBonus = this.coins * 10;
    const total = this.score + timeBonus + posBonus;
    const goal = Math.round(this.tr.length * 4 + this.level.diff * 2500);
    let stars = 0; const obj = (this.level.objective || {}).type || 'race', S = this.level.stars || {};
    let gold = this.tr.length / 38, silver = this.tr.length / 32;
    if (S.type === 'time' && typeof S.threeStar === 'number') { gold = S.threeStar; silver = S.twoStar; }
    let objText = '';
    if (ok) {
      if (this.mode === 'race') { const g3 = S.threeStar && S.threeStar.minScore || goal; stars = 1 + (position <= 2 ? 1 : 0) + (position === 1 && total >= g3 ? 1 : 0); objText = `Win + ${g3.toLocaleString('en-US')} pts for 3★`; }
      else if (obj === 'precision_landing') { const t3 = S.threeStar || {}, t2 = S.twoStar || {}; const pads = this.stat.pads; stars = pads >= (t3.padsHit || 3) && this.stat.perfect >= (t3.perfects || 1) ? 3 : pads >= (t2.padsHit || 2) ? 2 : pads >= 1 ? 1 : 0; objText = `Pads hit ${pads} · perfect ${this.stat.perfect}`; if (!stars) objText += ' (land on a pad to pass)'; }
      else if (obj === 'stunt_score') { stars = total >= (S.threeStar || goal * 1.5) ? 3 : total >= (S.twoStar || goal) ? 2 : total >= (S.oneStar || 0) ? 1 : 0; objText = `Stunt score: ${(S.oneStar || 0).toLocaleString('en-US')} / ${(S.twoStar || 0).toLocaleString('en-US')} / ${(S.threeStar || 0).toLocaleString('en-US')}`; }
      else if (obj === 'collect') { const all = this.quest.done; const maxT = S.threeStar && S.threeStar.maxTime || gold; stars = all ? (this.raceTime <= maxT ? 3 : 2) : 1; objText = all ? `All items collected${this.raceTime <= maxT ? ' fast!' : ` (3★ under ${maxT.toFixed(0)}s)`}` : 'Collect every item for more stars'; }
      else { stars = this.raceTime <= gold ? 3 : this.raceTime <= silver ? 2 : 1; objText = 'Beat the gold time for 3★'; }
    }
    this.result = { ok, reason, position, time: this.raceTime, score: total, trickScore: this.score - coinBonus, timeBonus, posBonus, coins: this.coins, stars, goal,
      quest: { name: this.quest.name, done: this.quest.done, reward: this.quest.done ? this.quest.reward : 0 }, stat: { ...this.stat }, ghost: ok ? { time: this.raceTime, frames: this.ghostRec } : null,
      gold, silver, objective: obj, objText, pads: this.stat.pads };
    this.emit('finish', this.result);
  }

  // interpolated player pose for rendering
  renderPose(outP, outQ) { const a = this.alpha || 0; outP.lerpVectors(this.pose.pp, this.pose.p, a); outQ.slerpQuaternions(this.pose.pq, this.pose.q, a); }

  dispose() { try { this.world.free(); } catch (e) {} }
}
